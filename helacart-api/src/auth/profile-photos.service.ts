import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ProfilePhotoStorageService,
  type ProfilePhotoFile,
} from './profile-photo-storage.service.js';

@Injectable()
export class ProfilePhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly storage: ProfilePhotoStorageService,
  ) {}

  private async ownPhoto(identity: DecodedIdToken) {
    const user = await this.auth.getOrCreateProfile(identity);
    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        avatarStorageKey: true,
        avatarContentType: true,
        avatarByteSize: true,
      },
    });
  }

  async read(identity: DecodedIdToken) {
    const user = await this.ownPhoto(identity);
    if (
      !user.avatarStorageKey ||
      !user.avatarContentType ||
      !user.avatarByteSize
    )
      throw new NotFoundException('No profile photo');
    return this.storage.read({
      storageKey: user.avatarStorageKey,
      contentType: user.avatarContentType,
      byteSize: user.avatarByteSize,
    });
  }

  async upload(identity: DecodedIdToken, file?: ProfilePhotoFile) {
    if (!identity.email_verified)
      throw new ForbiddenException(
        'Verify your email before updating your photo',
      );
    this.storage.validate(file);
    const user = await this.ownPhoto(identity);
    const photo = await this.storage.upload(user.id, file);
    try {
      const updated = await this.prisma.user.updateMany({
        where: { id: user.id, avatarStorageKey: user.avatarStorageKey },
        data: {
          avatarStorageKey: photo.storageKey,
          avatarContentType: photo.contentType,
          avatarByteSize: photo.byteSize,
          photoVersion: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new ConflictException(
          'Your photo changed. Refresh your profile and try again',
        );
    } catch (error) {
      await this.storage.remove(photo.storageKey).catch(() => undefined);
      throw error;
    }
    if (user.avatarStorageKey)
      await this.storage.remove(user.avatarStorageKey).catch(() => undefined);
    return this.auth.getOrCreateProfile(identity);
  }

  async remove(identity: DecodedIdToken) {
    if (!identity.email_verified)
      throw new ForbiddenException(
        'Verify your email before removing your photo',
      );
    const user = await this.ownPhoto(identity);
    const updated = await this.prisma.user.updateMany({
      where: { id: user.id, avatarStorageKey: user.avatarStorageKey },
      data: {
        avatarStorageKey: null,
        avatarContentType: null,
        avatarByteSize: null,
        photoVersion: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new ConflictException(
        'Your photo changed. Refresh your profile and try again',
      );
    if (user.avatarStorageKey)
      await this.storage.remove(user.avatarStorageKey).catch(() => undefined);
    return this.auth.getOrCreateProfile(identity);
  }
}
