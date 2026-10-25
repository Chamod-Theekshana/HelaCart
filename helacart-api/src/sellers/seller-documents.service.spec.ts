import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  SellerDocumentsService,
  type ApplicationFiles,
  sellerDocumentMaxBytes,
} from './seller-documents.service.js';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/client-s3', async (original) => ({
  ...(await original<typeof import('@aws-sdk/client-s3')>()),
  S3Client: class {
    send = send;
    destroy() {}
  },
}));

describe('Private seller verification documents', () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const photo = () => ({
    buffer: png,
    size: png.length,
    mimetype: 'image/png',
  });
  const files = (): ApplicationFiles => ({
    identityFront: [photo()],
    identityBack: [photo()],
  });
  const settings = {
    R2_ACCOUNT_ID: 'a'.repeat(32),
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'public-images',
    R2_PRIVATE_BUCKET: 'private-verification',
  };
  const database = { sellerApplicationDocument: { findFirst: vi.fn() } };
  const service = () =>
    new SellerDocumentsService(
      new ConfigService(settings),
      database as unknown as PrismaService,
    );

  beforeEach(() => {
    send.mockReset().mockResolvedValue({});
    database.sellerApplicationDocument.findFirst.mockReset();
  });

  it.each([{}, { identityFront: [photo()] }, { identityBack: [photo()] }])(
    'requires both identity sides: %j',
    (input) => {
      expect(() => service().validate(input)).toThrow(BadRequestException);
    },
  );

  it('accepts both identity sides without a business registration', async () => {
    const result = await service().upload('seller-id', files());
    expect(result.map((doc) => doc.kind)).toEqual([
      'IDENTITY_FRONT',
      'IDENTITY_BACK',
    ]);
    expect(result.every((doc) => !doc.storageKey.includes('http'))).toBe(true);
    for (const [command] of send.mock.calls) {
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: 'private-verification',
        CacheControl: 'private, no-store',
      });
    }
  });

  it('includes the optional business registration photo when supplied', async () => {
    const result = await service().upload('seller-id', {
      ...files(),
      businessRegistration: [photo()],
    });
    expect(result).toHaveLength(3);
    expect(result[2].kind).toBe('BUSINESS_REGISTRATION');
  });

  it('rejects unsupported, empty, oversized and spoofed image uploads', () => {
    const invalid = [
      { ...photo(), mimetype: 'image/svg+xml' },
      { ...photo(), buffer: Buffer.alloc(0), size: 0 },
      {
        ...photo(),
        buffer: Buffer.alloc(sellerDocumentMaxBytes + 1),
        size: sellerDocumentMaxBytes + 1,
      },
      { ...photo(), buffer: Buffer.from('not an image'), size: 12 },
    ];
    for (const file of invalid)
      expect(() =>
        service().validate({ ...files(), identityFront: [file] }),
      ).toThrow(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('fails closed when no separate private bucket is configured', async () => {
    const unsafe = new SellerDocumentsService(
      new ConfigService({ ...settings, R2_PRIVATE_BUCKET: settings.R2_BUCKET }),
      database as unknown as PrismaService,
    );
    await expect(unsafe.upload('seller-id', files())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('cleans up every attempted object after a partial storage failure', async () => {
    send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('storage failed'));
    await expect(service().upload('seller-id', files())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(
      send.mock.calls.filter(
        ([command]) => command instanceof DeleteObjectCommand,
      ),
    ).toHaveLength(2);
  });

  it('scopes document reads to the requested seller application', async () => {
    database.sellerApplicationDocument.findFirst.mockResolvedValue(null);
    await expect(
      service().read('other-seller', 'document-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(database.sellerApplicationDocument.findFirst).toHaveBeenCalledWith({
      where: { id: 'document-id', sellerId: 'other-seller' },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('reads photo bytes without returning storage keys or public links', async () => {
    database.sellerApplicationDocument.findFirst.mockResolvedValue({
      storageKey: 'private-key',
      contentType: 'image/png',
    });
    send.mockResolvedValue({ Body: { transformToByteArray: async () => png } });
    expect(await service().read('seller-id', 'document-id')).toEqual({
      bytes: png,
      contentType: 'image/png',
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
  });
});
