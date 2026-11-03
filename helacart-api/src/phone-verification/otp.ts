import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const otpTtlMs = 10 * 60_000;
export const otpResendMs = 60_000;
export const otpMaxAttempts = 5;
export const otpPerUserPerHour = 5;

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Only this HMAC is stored; it is bound to the verification id. */
export function hashOtp(secret: string, verificationId: string, code: string) {
  return createHmac('sha256', secret)
    .update(`${verificationId}:${code}`)
    .digest('hex');
}

export function otpMatches(
  secret: string,
  verificationId: string,
  code: string,
  storedHash: string,
): boolean {
  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashOtp(secret, verificationId, code), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
