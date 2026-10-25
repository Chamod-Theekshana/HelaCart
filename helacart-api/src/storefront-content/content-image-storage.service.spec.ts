import { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';
import {
  ContentImageStorageService,
  contentImageMaximum,
} from './content-image-storage.service.js';
describe('Admin content image boundaries', () => {
  const service = new ContentImageStorageService(new ConfigService({}));
  const incoming = (type: string, bytes: Buffer, length?: number) =>
    Object.assign(Readable.from([bytes]), {
      headers: {
        'content-type': type,
        ...(length === undefined ? {} : { 'content-length': String(length) }),
      },
    }) as AuthenticatedRequest;
  it.each(['image/svg+xml', 'text/html', 'application/json'])(
    'refuses active or non-image format %s',
    async (type) => {
      await expect(
        service.upload(incoming(type, Buffer.from('fake')), 'hero'),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it('rejects forged image signatures', async () => {
    await expect(
      service.upload(incoming('image/png', Buffer.from('not a PNG')), 'hero'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('checks advertised and streamed sizes', async () => {
    await expect(
      service.upload(
        incoming('image/png', Buffer.from('small'), contentImageMaximum + 1),
        'hero',
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.upload(
        incoming('image/png', Buffer.alloc(contentImageMaximum + 1)),
        'hero',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('reports missing storage configuration only after accepting real image bytes', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=',
      'base64',
    );
    await expect(
      service.upload(incoming('image/png', png), 'hero'),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('does not delete objects outside managed storefront prefixes', async () => {
    await expect(
      service.remove('products/not-ours.png'),
    ).resolves.toBeUndefined();
    await expect(
      service.remove('storefront/hero/../../private.png'),
    ).resolves.toBeUndefined();
    expect(
      service.heroKey('https://evil.example/storefront/hero/file.png'),
    ).toBeNull();
  });
  it('cleans an uncertain upload without masking its original error', async () => {
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockRejectedValueOnce(new Error('upload interrupted'))
      .mockResolvedValueOnce({} as never);
    const configured = new ContentImageStorageService(
      new ConfigService({
        R2_ACCOUNT_ID: 'a'.repeat(32),
        R2_ACCESS_KEY_ID: 'test',
        R2_SECRET_ACCESS_KEY: 'test',
        R2_BUCKET: 'test-bucket',
        R2_PUBLIC_BASE_URL: 'https://images.example.com',
      }),
    );
    try {
      await expect(
        configured.upload(
          incoming('image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          'hero',
        ),
      ).rejects.toThrow('upload interrupted');
      expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    } finally {
      send.mockRestore();
    }
  });
});
