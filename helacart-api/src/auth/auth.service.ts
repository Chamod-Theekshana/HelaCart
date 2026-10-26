import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './update-profile.dto.js';

export const accountProfileSelect = {
  id: true,
  firebaseUid: true,
  email: true,
  emailVerified: true,
  name: true,
  phone: true,
  avatarContentType: true,
  photoVersion: true,
  createdAt: true,
  updatedAt: true,
  accessStatus: true,
  accessVersion: true,
  memberships: {
    select: {
      role: true,
      seller: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          shippingFeeLkrMinor: true,
          logoUrl: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

function presentProfile<T extends { avatarContentType: string | null }>(
  row: T,
) {
  const { avatarContentType, ...profile } = row;
  return { ...profile, hasPhoto: Boolean(avatarContentType) };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateProfile(identity: DecodedIdToken) {
    if (!identity.email) {
      throw new UnauthorizedException('Firebase account must have an email');
    }

    const displayName =
      typeof identity.name === 'string' && identity.name.trim()
        ? identity.name.trim()
        : undefined;

    try {
      const profile = await this.prisma.user.upsert({
        where: { firebaseUid: identity.uid },
        update: {
          email: identity.email,
          emailVerified: identity.email_verified === true,
        },
        create: {
          firebaseUid: identity.uid,
          email: identity.email,
          emailVerified: identity.email_verified === true,
          name: displayName,
        },
        select: accountProfileSelect,
      });
      if (profile.accessStatus === 'SUSPENDED')
        throw new ForbiddenException(
          'Your HelaCart account is suspended. Contact HelaCart support for help',
        );
      return presentProfile(profile);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This email is already linked to another HelaCart account',
        );
      }
      throw error;
    }
  }

  async updateProfile(identity: DecodedIdToken, dto: UpdateProfileDto) {
    if (!identity.email_verified)
      throw new ForbiddenException(
        'Verify your email before editing your profile',
      );
    const user = await this.getOrCreateProfile(identity);
    return presentProfile(
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        },
        select: accountProfileSelect,
      }),
    );
  }
}
