import { randomBytes, randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChannelProvidersService } from '../notifications/channel-providers.service.js';
import { apiError } from '../common/api-error.js';
import { normalizeSriLankanMobile } from '../common/phone.js';
import {
  generateOtp,
  hashOtp,
  otpMatches,
  otpMaxAttempts,
  otpPerUserPerHour,
  otpResendMs,
  otpTtlMs,
} from './otp.js';

@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);
  /** Development without SMS: codes are logged, so a per-process key is enough. */
  private readonly fallbackSecret = randomBytes(32).toString('hex');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly providers: ChannelProvidersService,
    private readonly config: ConfigService,
  ) {}

  private secret() {
    return this.config.get<string>('OTP_SECRET') || this.fallbackSecret;
  }

  async start(identity: DecodedIdToken, rawPhone: string) {
    const phone = normalizeSriLankanMobile(rawPhone);
    if (!phone)
      throw apiError(
        400,
        'PHONE_INVALID',
        'Enter a Sri Lankan mobile number such as 0771234567',
      );
    const production = this.config.get<string>('NODE_ENV') === 'production';
    if (!this.providers.smsEnabled && production)
      throw new ServiceUnavailableException(
        'Phone verification is temporarily unavailable',
      );
    const user = await this.auth.getOrCreateProfile(identity);
    const id = randomUUID();
    const code = generateOtp();
    const now = new Date();
    const verification = await this.prisma.$transaction(
      async (tx) => {
        // Serialise concurrent requests for this user and this number.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`otp:${user.id}`}, 0))`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`otp:${phone}`}, 0))`;
        const [recentForPhone, lastHourForUser] = await Promise.all([
          tx.phoneVerification.count({
            where: {
              phone,
              createdAt: { gt: new Date(now.getTime() - otpResendMs) },
            },
          }),
          tx.phoneVerification.count({
            where: {
              userId: user.id,
              createdAt: { gt: new Date(now.getTime() - 3_600_000) },
            },
          }),
        ]);
        if (recentForPhone > 0 || lastHourForUser >= otpPerUserPerHour)
          throw apiError(
            429,
            'OTP_RATE_LIMITED',
            'Too many verification codes requested. Try again later',
          );
        return tx.phoneVerification.create({
          data: {
            id,
            userId: user.id,
            phone,
            codeHash: hashOtp(this.secret(), id, code),
            expiresAt: new Date(now.getTime() + otpTtlMs),
            createdAt: now,
          },
          select: { id: true, phone: true, expiresAt: true, createdAt: true },
        });
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
    const message = `${code} is your HelaCart verification code. It expires in 10 minutes. Never share it.`;
    if (this.providers.smsEnabled) {
      const sent = await this.providers.sendSms(phone, message);
      if (!sent.ok) {
        this.logger.warn(`Verification SMS failed: ${sent.error}`);
        throw new ServiceUnavailableException(
          'Could not send the verification SMS. Try again shortly',
        );
      }
    } else {
      // Development only (production is refused above): never reached in prod.
      this.logger.warn(
        `DEV ONLY - SMS is not configured. Verification code for ${phone}: ${code}`,
      );
    }
    return {
      verificationId: verification.id,
      phone: verification.phone,
      expiresAt: verification.expiresAt,
      resendAfter: new Date(verification.createdAt.getTime() + otpResendMs),
    };
  }

  async confirm(
    identity: DecodedIdToken,
    verificationId: string,
    code: string,
  ) {
    const user = await this.auth.getOrCreateProfile(identity);
    const verification = await this.prisma.phoneVerification.findFirst({
      where: { id: verificationId, userId: user.id },
    });
    if (!verification)
      throw new NotFoundException('Verification request not found');
    const expired = () =>
      apiError(
        410,
        'OTP_EXPIRED',
        'This code has expired. Request a new verification code',
      );
    if (
      verification.consumedAt ||
      verification.expiresAt.getTime() <= Date.now() ||
      verification.attempts >= otpMaxAttempts
    )
      throw expired();
    if (
      !/^\d{6}$/.test(code) ||
      !otpMatches(this.secret(), verification.id, code, verification.codeHash)
    ) {
      const counted = await this.prisma.phoneVerification.updateMany({
        where: {
          id: verification.id,
          consumedAt: null,
          attempts: { lt: otpMaxAttempts },
        },
        data: { attempts: { increment: 1 } },
      });
      if (!counted.count) throw expired();
      throw apiError(400, 'OTP_INVALID', 'The verification code is incorrect');
    }
    const verifiedAt = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        const consumed = await tx.phoneVerification.updateMany({
          where: {
            id: verification.id,
            consumedAt: null,
            attempts: { lt: otpMaxAttempts },
            expiresAt: { gt: verifiedAt },
          },
          data: { consumedAt: verifiedAt },
        });
        if (!consumed.count) throw expired();
        const saved = await tx.verifiedPhone.upsert({
          where: {
            userId_phone: { userId: user.id, phone: verification.phone },
          },
          update: { verifiedAt },
          create: { userId: user.id, phone: verification.phone, verifiedAt },
          select: { phone: true, verifiedAt: true },
        });
        return saved;
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }

  async verifiedPhones(identity: DecodedIdToken) {
    const user = await this.auth.getOrCreateProfile(identity);
    return this.prisma.verifiedPhone.findMany({
      where: { userId: user.id },
      orderBy: { verifiedAt: 'desc' },
      take: 20,
      select: { phone: true, verifiedAt: true },
    });
  }
}
