import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
      return await this.prisma.user.upsert({
        where: { firebaseUid: identity.uid },
        update: {
          email: identity.email,
          emailVerified: identity.email_verified === true,
          ...(displayName ? { name: displayName } : {}),
        },
        create: {
          firebaseUid: identity.uid,
          email: identity.email,
          emailVerified: identity.email_verified === true,
          name: displayName,
        },
        select: {
          id: true,
          firebaseUid: true,
          email: true,
          emailVerified: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          memberships: {
            select: {
              role: true,
              seller: {
                select: { id: true, name: true, slug: true, status: true },
              },
            },
          },
        },
      });
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
}
