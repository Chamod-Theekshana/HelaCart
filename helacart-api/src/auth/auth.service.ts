import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateProfile(identity: DecodedIdToken) {
    if (!identity.email) {
      throw new UnauthorizedException('Firebase account must have an email');
    }

    return this.prisma.user.upsert({
      where: { firebaseUid: identity.uid },
      update: {
        email: identity.email,
        name: identity.name ?? null,
      },
      create: {
        firebaseUid: identity.uid,
        email: identity.email,
        name: identity.name ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });
  }
}