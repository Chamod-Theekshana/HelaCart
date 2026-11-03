import { HttpException } from '@nestjs/common';

const reasons: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  410: 'Gone',
  429: 'Too Many Requests',
  503: 'Service Unavailable',
};

/** Stable, machine-readable failure codes shared with the web and mobile clients. */
export type ApiErrorCode =
  | 'COMMISSION_RATE_REQUIRED'
  | 'OTP_RATE_LIMITED'
  | 'PHONE_INVALID'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'PHONE_NOT_VERIFIED'
  | 'TOO_MANY_OPEN_ORDERS'
  | 'COD_LIMIT_EXCEEDED'
  | 'SELLER_SUSPENDED'
  | 'OWNER_ONLY'
  | 'ACCOUNT_HAS_OPEN_ORDERS'
  | 'ACCOUNT_OWNS_SHOP'
  | 'IMAGE_URL_NOT_ALLOWED'
  | 'ORDER_TRANSITION_NOT_ALLOWED'
  | 'APPLICATION_ALREADY_PENDING';

/**
 * Nest-shaped error body `{ statusCode, message, error }` plus a stable `code`
 * clients may branch on. Clients must never parse `message`.
 */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
): HttpException {
  return new HttpException(
    { statusCode: status, message, error: reasons[status] ?? 'Error', code },
    status,
  );
}
