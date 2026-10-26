import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import {
  AccountsQueryDto,
  AccessDecisionDto,
  AddManagerDto,
  TeamReasonDto,
} from './account-permissions.dto.js';
import { paginated } from '../shops/shops.service.js';
const options = { timeout: 30000, maxWait: 10000 };
@Injectable()
export class AccountPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  private admins() {
    return this.config.getOrThrow<string[]>('ADMIN_FIREBASE_UIDS');
  }
  async accounts(q: AccountsQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(q.status ? { accessStatus: q.status } : {}),
      ...(q.q
        ? {
            OR: [
              { email: { contains: q.q, mode: 'insensitive' } },
              { name: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          accessStatus: true,
          accessVersion: true,
          createdAt: true,
          firebaseUid: true,
          memberships: {
            select: { role: true, seller: { select: { name: true } } },
          },
          accessChanges: {
            take: 10,
            orderBy: { version: 'desc' },
            select: {
              version: true,
              status: true,
              reason: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(
      rows.map(({ firebaseUid, ...row }) => ({
        ...row,
        isAdmin: this.admins().includes(firebaseUid),
      })),
      total,
      q,
    );
  }
  async decide(id: string, identity: DecodedIdToken, dto: AccessDecisionDto) {
    const actor = await this.auth.getOrCreateProfile(identity);
    if (!identity.email_verified || !this.admins().includes(identity.uid))
      throw new ForbiddenException('Administrator access required');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id },
        select: { firebaseUid: true, accessStatus: true, accessVersion: true },
      });
      if (!user) throw new NotFoundException('Account not found');
      if (id === actor.id || this.admins().includes(user.firebaseUid))
        throw new ForbiddenException(
          'Administrator accounts cannot be suspended through this screen',
        );
      if (user.accessVersion !== dto.version)
        throw new ConflictException(
          'Account access changed. Refresh before deciding',
        );
      if (user.accessStatus === dto.status)
        throw new BadRequestException('Account already has this access status');
      const version = dto.version + 1;
      await tx.user.update({
        where: { id },
        data: { accessStatus: dto.status, accessVersion: version },
      });
      await tx.accountAccessChange.create({
        data: {
          userId: id,
          actorId: actor.id,
          version,
          status: dto.status,
          reason: dto.reason,
        },
      });
      return { saved: true };
    }, options);
  }
  private async owner(
    sellerId: string,
    identity: DecodedIdToken,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (!identity.email_verified)
      throw new ForbiddenException('Verify your email to manage shop access');
    const member = await db.sellerMember.findFirst({
      where: {
        sellerId,
        user: { firebaseUid: identity.uid, accessStatus: 'ACTIVE' },
      },
      select: {
        userId: true,
        role: true,
        seller: { select: { status: true } },
      },
    });
    if (!member || member.role !== 'OWNER')
      throw new ForbiddenException(
        'Only the shop owner can manage team access',
      );
    if (!['APPROVED', 'SUSPENDED'].includes(member.seller.status))
      throw new ForbiddenException('Shop approval is required');
    return member;
  }
  async team(sellerId: string, identity: DecodedIdToken) {
    await this.owner(sellerId, identity);
    const [members, history] = await Promise.all([
      this.prisma.sellerMember.findMany({
        where: { sellerId },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              emailVerified: true,
              accessStatus: true,
            },
          },
        },
      }),
      this.prisma.sellerTeamChange.findMany({
        where: { sellerId },
        take: 50,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          memberUserId: true,
          action: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);
    return { members, history };
  }
  async add(sellerId: string, identity: DecodedIdToken, dto: AddManagerDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Seller" WHERE id=${sellerId}::uuid FOR UPDATE`;
      const owner = await this.owner(sellerId, identity, tx);
      const user = await tx.user.findFirst({
        where: {
          email: { equals: dto.email, mode: 'insensitive' },
          emailVerified: true,
          accessStatus: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!user)
        throw new BadRequestException(
          'Use the exact email of an existing, verified and active HelaCart account',
        );
      const existing = await tx.sellerMember.findUnique({
        where: { sellerId_userId: { sellerId, userId: user.id } },
        select: { id: true },
      });
      if (existing)
        throw new ConflictException('This account already belongs to the shop');
      const count = await tx.sellerMember.count({ where: { sellerId } });
      if (count >= 20)
        throw new BadRequestException('A shop can have up to 20 team members');
      await tx.sellerMember.create({
        data: { sellerId, userId: user.id, role: 'MANAGER' },
      });
      await tx.sellerTeamChange.create({
        data: {
          sellerId,
          actorId: owner.userId,
          memberUserId: user.id,
          action: 'ADDED',
          reason: dto.reason,
        },
      });
      return { saved: true };
    }, options);
  }
  async remove(
    sellerId: string,
    id: string,
    identity: DecodedIdToken,
    dto: TeamReasonDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Seller" WHERE id=${sellerId}::uuid FOR UPDATE`;
      const owner = await this.owner(sellerId, identity, tx);
      const member = await tx.sellerMember.findFirst({
        where: { id, sellerId },
        select: { userId: true, role: true },
      });
      if (!member) throw new NotFoundException('Team member not found');
      if (member.role === 'OWNER')
        throw new ForbiddenException('The shop owner cannot be removed');
      await tx.sellerMember.delete({ where: { id } });
      await tx.sellerTeamChange.create({
        data: {
          sellerId,
          actorId: owner.userId,
          memberUserId: member.userId,
          action: 'REMOVED',
          reason: dto.reason,
        },
      });
      return { deleted: true };
    }, options);
  }
}
