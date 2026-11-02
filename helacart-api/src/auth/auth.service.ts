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
          statusReason: true,
          shippingFeeLkrMinor: true,
          logoUrl: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type ProfileRow = {
  avatarContentType: string | null;
  memberships?: Array<{
    seller?: { status?: string; statusReason?: string | null } | null;
  }>;
};

function presentProfile<T extends ProfileRow>(row: T) {
  const { avatarContentType, ...profile } = row;
  return {
    ...profile,
    // Clients read the shop status directly on each membership entry.
    memberships: (row.memberships ?? []).map((membership) => ({
      ...membership,
      sellerStatus: membership.seller?.status ?? null,
      statusReason: membership.seller?.statusReason ?? null,
    })) as unknown as T['memberships'],
    hasPhoto: Boolean(avatarContentType),
  };
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

    const emailVerified = identity.email_verified === true;
    try {
      // Read first: most requests come from an unchanged, existing profile and
      // must not issue a write (row lock + WAL) on every authenticated call.
      const existing = await this.prisma.user.findUnique({
        where: { firebaseUid: identity.uid },
        select: accountProfileSelect,
      });
      if (
        existing &&
        existing.email === identity.email &&
        existing.emailVerified === emailVerified
      )
        return presentProfile(this.assertUsable(existing));
      if (existing?.accessStatus === 'DELETED') this.assertUsable(existing);
      const profile = await this.prisma.user.upsert({
        where: { firebaseUid: identity.uid },
        update: {
          email: identity.email,
          emailVerified,
        },
        create: {
          firebaseUid: identity.uid,
          email: identity.email,
          emailVerified,
          name: displayName,
        },
        select: accountProfileSelect,
      });
      return presentProfile(this.assertUsable(profile));
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

  private assertUsable<T extends { accessStatus?: string }>(profile: T): T {
    if (profile.accessStatus === 'SUSPENDED')
      throw new ForbiddenException(
        'Your HelaCart account is suspended. Contact HelaCart support for help',
      );
    if (profile.accessStatus === 'DELETED')
      throw new ForbiddenException('This HelaCart account was deleted');
    return profile;
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
