import type { DecodedIdToken } from 'firebase-admin/auth';
import type { ConfigService } from '@nestjs/config';
import type { AuthService } from '../auth/auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ChannelProvidersService } from '../notifications/channel-providers.service.js';
import { PhoneVerificationService } from './phone-verification.service.js';
import { generateOtp, hashOtp, otpMatches } from './otp.js';

describe('Phone verification by SMS OTP', () => {
  const identity = { uid: 'buyer', email_verified: true } as DecodedIdToken;
  const secret = 's'.repeat(32);
  const verificationId = '6a0c3f1e-8a8b-4c63-9a5f-2bb1d9f5d0aa';
  const tx = {
    $executeRaw: vi.fn(),
    phoneVerification: {
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    verifiedPhone: { upsert: vi.fn() },
  };
  const prisma = {
    ...tx,
    phoneVerification: { ...tx.phoneVerification, findFirst: vi.fn() },
    verifiedPhone: { ...tx.verifiedPhone, findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const providers = { smsEnabled: true, sendSms: vi.fn() };
  const settings: Record<string, unknown> = {};
  const service = new PhoneVerificationService(
    prisma as unknown as PrismaService,
    {
      getOrCreateProfile: async () => ({ id: 'user-1' }),
    } as unknown as AuthService,
    providers as unknown as ChannelProvidersService,
    { get: (key: string) => settings[key] } as unknown as ConfigService,
  );
  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: verificationId,
    userId: 'user-1',
    phone: '+94771234567',
    codeHash: hashOtp(secret, verificationId, '123456'),
    attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    settings.OTP_SECRET = secret;
    settings.NODE_ENV = 'production';
    providers.smsEnabled = true;
    prisma.$transaction.mockImplementation((fn: (db: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.phoneVerification.count.mockResolvedValue(0);
    tx.phoneVerification.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: data.id,
          phone: data.phone,
          expiresAt: data.expiresAt,
          createdAt: data.createdAt,
        }),
    );
    providers.sendSms.mockResolvedValue({ ok: true });
    tx.phoneVerification.updateMany.mockResolvedValue({ count: 1 });
    tx.verifiedPhone.upsert.mockImplementation(
      ({ create }: { create: { phone: string; verifiedAt: Date } }) =>
        Promise.resolve({ phone: create.phone, verifiedAt: create.verifiedAt }),
    );
  });

  it('generates six-digit codes and compares only HMACs in constant time', () => {
    for (let i = 0; i < 50; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
    const hash = hashOtp(secret, verificationId, '000123');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('000123');
    expect(otpMatches(secret, verificationId, '000123', hash)).toBe(true);
    expect(otpMatches(secret, verificationId, '000124', hash)).toBe(false);
    expect(otpMatches('x'.repeat(32), verificationId, '000123', hash)).toBe(
      false,
    );
    expect(otpMatches(secret, 'other-id', '000123', hash)).toBe(false);
  });

  it('normalises the phone, stores only a hash and sends the code by SMS', async () => {
    const result = await service.start(identity, '077 123 4567');
    expect(result.phone).toBe('+94771234567');
    const data = tx.phoneVerification.create.mock.calls[0][0].data;
    const [phone, message] = providers.sendSms.mock.calls[0];
    expect(phone).toBe('+94771234567');
    const code = /\d{6}/.exec(message)![0];
    expect(data.codeHash).toBe(hashOtp(secret, data.id, code));
    expect(Object.values(data)).not.toContain(code);
    expect(Object.keys(data)).not.toContain('code');
    expect(result.resendAfter.getTime() - data.createdAt.getTime()).toBe(
      60_000,
    );
  });

  it('rejects invalid numbers with PHONE_INVALID', async () => {
    await expect(service.start(identity, '0112345678')).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'PHONE_INVALID' }),
    });
  });

  it('rate limits per phone and per user with OTP_RATE_LIMITED', async () => {
    tx.phoneVerification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    await expect(service.start(identity, '0771234567')).rejects.toMatchObject({
      status: 429,
      response: expect.objectContaining({ code: 'OTP_RATE_LIMITED' }),
    });
    tx.phoneVerification.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5);
    await expect(service.start(identity, '0771234567')).rejects.toMatchObject({
      status: 429,
    });
    expect(providers.sendSms).not.toHaveBeenCalled();
  });

  it('refuses to start without SMS in production', async () => {
    providers.smsEnabled = false;
    await expect(service.start(identity, '0771234567')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('logs the code instead of sending it outside production without SMS', async () => {
    providers.smsEnabled = false;
    settings.NODE_ENV = 'development';
    await expect(service.start(identity, '0771234567')).resolves.toMatchObject({
      phone: '+94771234567',
    });
    expect(providers.sendSms).not.toHaveBeenCalled();
  });

  it('verifies the correct code once and records the verified phone', async () => {
    prisma.phoneVerification.findFirst.mockResolvedValue(stored());
    const result = await service.confirm(identity, verificationId, '123456');
    expect(result.phone).toBe('+94771234567');
    expect(tx.phoneVerification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ consumedAt: null }),
        data: { consumedAt: expect.any(Date) },
      }),
    );
    expect(tx.verifiedPhone.upsert).toHaveBeenCalledOnce();
  });

  it('counts wrong codes as attempts with OTP_INVALID', async () => {
    prisma.phoneVerification.findFirst.mockResolvedValue(stored());
    await expect(
      service.confirm(identity, verificationId, '654321'),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ code: 'OTP_INVALID' }),
    });
    expect(tx.phoneVerification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } }),
    );
    await expect(
      service.confirm(identity, verificationId, '12345'),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.verifiedPhone.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', { expiresAt: new Date(Date.now() - 1) }],
    ['used', { consumedAt: new Date() }],
    ['out of attempts', { attempts: 5 }],
  ])('returns OTP_EXPIRED for an %s code', async (_label, overrides) => {
    prisma.phoneVerification.findFirst.mockResolvedValue(stored(overrides));
    await expect(
      service.confirm(identity, verificationId, '123456'),
    ).rejects.toMatchObject({
      status: 410,
      response: expect.objectContaining({ code: 'OTP_EXPIRED' }),
    });
    expect(tx.verifiedPhone.upsert).not.toHaveBeenCalled();
  });
});
