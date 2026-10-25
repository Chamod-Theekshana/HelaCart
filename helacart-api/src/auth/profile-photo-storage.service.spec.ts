import {
  ProfilePhotoStorageService,
  profilePhotoMaxBytes,
} from './profile-photo-storage.service.js';
describe('Profile photo validation', () => {
  const storage = new ProfilePhotoStorageService({} as never);
  it('accepts supported image headers and rejects active content', () => {
    const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(() =>
      storage.validate({ buffer, size: buffer.length, mimetype: 'image/png' }),
    ).not.toThrow();
    expect(() =>
      storage.validate({
        buffer: Buffer.from('<svg/>'),
        size: 6,
        mimetype: 'image/svg+xml',
      }),
    ).toThrow('JPEG, PNG or WebP');
  });
  it('rejects mismatched bytes, empty and oversized uploads', () => {
    expect(() =>
      storage.validate({
        buffer: Buffer.from('fake'),
        size: 4,
        mimetype: 'image/png',
      }),
    ).toThrow('do not match');
    expect(() =>
      storage.validate({
        buffer: Buffer.alloc(0),
        size: 0,
        mimetype: 'image/png',
      }),
    ).toThrow('3 MB');
    expect(() =>
      storage.validate({
        buffer: Buffer.alloc(profilePhotoMaxBytes + 1),
        size: profilePhotoMaxBytes + 1,
        mimetype: 'image/png',
      }),
    ).toThrow('3 MB');
  });
});
