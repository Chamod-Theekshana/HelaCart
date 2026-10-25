import { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';
import type { CatalogService } from '../catalog/catalog.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ShopImagesService } from './shop-images.service.js';
describe('Shop image upload boundaries', () => {
  const member = vi.fn();
  const update = vi.fn();
  const service = new ShopImagesService(
    new ConfigService({}),
    { seller: { update } } as unknown as PrismaService,
    { requireSellerMember: member } as unknown as CatalogService,
  );
  const identity = { uid: 'seller' } as DecodedIdToken;
  const incoming = (
    mime: string,
    body = Buffer.from('invalid image'),
    size = body.length,
  ) =>
    Object.assign(Readable.from([body]), {
      headers: { 'content-type': mime, 'content-length': String(size) },
    }) as AuthenticatedRequest;
  beforeEach(() => {
    member.mockReset().mockResolvedValue({ id: 'seller' });
    update.mockReset();
  });
  it('checks membership before accepting any bytes', async () => {
    member.mockRejectedValue(new ForbiddenException());
    await expect(
      service.upload('other-shop', 'logo', identity, incoming('image/png')),
    ).rejects.toThrow(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects arbitrary kinds and active image formats', async () => {
    await expect(
      service.upload('shop', 'documents', identity, incoming('image/png')),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.upload('shop', 'logo', identity, incoming('image/svg+xml')),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rejects oversized uploads and forged content types', async () => {
    await expect(
      service.upload(
        'shop',
        'cover',
        identity,
        incoming('image/png', Buffer.from('small'), 6 * 1024 * 1024),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.upload('shop', 'logo', identity, incoming('image/png')),
    ).rejects.toMatchObject({ status: 400 });
    expect(update).not.toHaveBeenCalled();
  });
});
