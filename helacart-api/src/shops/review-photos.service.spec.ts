import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReviewPhotosService } from './review-photos.service.js';
import {
  ReviewPhotoStorageService,
  reviewPhotoMaxBytes,
} from './review-photo-storage.service.js';

describe('Review photo validation', () => {
  const storage = new ReviewPhotoStorageService(new ConfigService({}));
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const file = (buffer = png, mimetype = 'image/png') => ({
    buffer,
    mimetype,
    size: buffer.length,
  });
  it('accepts optional photos and supported raster signatures', () => {
    expect(() => storage.validate([])).not.toThrow();
    expect(() =>
      storage.validate([
        file(),
        file(Buffer.from([255, 216, 255, 217]), 'image/jpeg'),
        file(Buffer.from('RIFF0000WEBP'), 'image/webp'),
      ]),
    ).not.toThrow();
  });
  it('rejects more than three photos', () => {
    expect(() =>
      storage.validate(Array.from({ length: 4 }, () => file())),
    ).toThrow('at most 3');
  });
  it('rejects empty, oversized and mismatched file sizes', () => {
    for (const item of [
      file(Buffer.alloc(0)),
      file(Buffer.alloc(reviewPhotoMaxBytes + 1)),
      { ...file(), size: 1 },
    ])
      expect(() => storage.validate([item])).toThrow('5 MB');
  });
  it('rejects SVG and a forged raster content type', () => {
    expect(() =>
      storage.validate([file(Buffer.from('<svg/>'), 'image/svg+xml')]),
    ).toThrow('JPEG');
    expect(() => storage.validate([file(Buffer.from('not a PNG'))])).toThrow(
      'do not match',
    );
  });
});
describe('Review photo transactions and visibility', () => {
  const database = {
    shopReviewPhoto: {
      updateMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
    },
    shopReviewReport: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  const storage = {
    validate: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    read: vi.fn(),
  };
  const service = new ReviewPhotosService(
    database as unknown as PrismaService,
    storage as unknown as ReviewPhotoStorageService,
  );
  const stored = {
    id: 'photo',
    storageKey: 'review-photos/review/photo.png',
    contentType: 'image/png',
    byteSize: 8,
  };
  beforeEach(() => {
    vi.resetAllMocks();
    storage.upload.mockResolvedValue([stored]);
    database.$transaction.mockImplementation(
      (callback: (tx: typeof database) => unknown) => callback(database),
    );
  });
  it('caps retained plus newly uploaded photos before storage writes', async () => {
    await expect(
      service.replace(
        'review',
        ['1', '2', '3'],
        [{ buffer: Buffer.alloc(1), mimetype: 'image/png', size: 1 }],
        vi.fn(),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('commits review and photo additions/removals in one transaction', async () => {
    const persist = vi.fn().mockResolvedValue({ id: 'review' });
    await service.replace('review', ['kept'], [], persist);
    expect(persist).toHaveBeenCalledWith(database);
    expect(database.shopReviewPhoto.updateMany).toHaveBeenCalledWith({
      where: { reviewId: 'review', deletedAt: null, id: { notIn: ['kept'] } },
      data: { deletedAt: expect.any(Date) },
    });
    expect(database.shopReviewPhoto.createMany).toHaveBeenCalledWith({
      data: [{ ...stored, reviewId: 'review' }],
    });
  });
  it('removes attempted uploads when review persistence loses an edit race', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('Review changed'));
    await expect(service.replace('review', [], [], persist)).rejects.toThrow(
      'Review changed',
    );
    expect(storage.remove).toHaveBeenCalledWith([stored]);
    expect(database.shopReviewPhoto.createMany).not.toHaveBeenCalled();
  });
  it('rejects photos outside a published review and approved shop', async () => {
    database.shopReviewPhoto.findFirst.mockResolvedValue(null);
    await expect(
      service.publicPhoto('shop', 'review', 'photo'),
    ).rejects.toMatchObject({ status: 404 });
    expect(storage.read).not.toHaveBeenCalled();
    expect(database.shopReviewPhoto.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'photo',
          reviewId: 'review',
          deletedAt: null,
          review: {
            isHidden: false,
            deletedAt: null,
            seller: { slug: 'shop', status: 'APPROVED' },
          },
        },
      }),
    );
  });
  it('serves only reported snapshot photos to administrators, including soft-deleted photos', async () => {
    database.shopReviewReport.findFirst.mockResolvedValue({
      reviewId: 'review',
    });
    database.shopReviewPhoto.findFirst.mockResolvedValue(stored);
    storage.read.mockResolvedValue({
      bytes: Buffer.from('photo'),
      contentType: 'image/png',
    });
    await service.adminPhoto('report', 'photo');
    expect(database.shopReviewReport.findFirst).toHaveBeenCalledWith({
      where: { id: 'report', photoSnapshotIds: { has: 'photo' } },
      select: { reviewId: true },
    });
    expect(database.shopReviewPhoto.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'photo', reviewId: 'review' } }),
    );
  });
  it('never reads private objects for an unrelated photo/report', async () => {
    database.shopReviewReport.findFirst.mockResolvedValue(null);
    await expect(
      service.adminPhoto('report', 'unrelated-photo'),
    ).rejects.toMatchObject({ status: 404 });
    expect(storage.read).not.toHaveBeenCalled();
  });
});
