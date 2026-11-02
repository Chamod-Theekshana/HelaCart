import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from '../auth/firebase-admin.service.js';

export type SendResult =
  | { ok: true }
  | { ok: false; retryable: boolean; error: string };

export type PushResult = SendResult & {
  /** Tokens FCM reported as unregistered/invalid; the caller removes them. */
  invalidTokens: string[];
};

const invalidTokenCodes = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * Thin clients for external channels: Resend (email), Notify.lk (SMS) and
 * Firebase Cloud Messaging (push). They never throw for provider failures and
 * never include credentials in returned error text.
 */
@Injectable()
export class ChannelProvidersService {
  constructor(
    private readonly config: ConfigService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  get emailEnabled() {
    return this.config.get<boolean>('EMAIL_ENABLED') === true;
  }
  get smsEnabled() {
    return this.config.get<boolean>('SMS_ENABLED') === true;
  }
  get pushEnabled() {
    return this.config.get<boolean>('PUSH_NOTIFICATIONS_ENABLED') !== false;
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
  ): Promise<SendResult> {
    if (!this.emailEnabled)
      return { ok: false, retryable: false, error: 'Email is not configured' };
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow<string>('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.getOrThrow<string>('RESEND_FROM'),
          to: [to],
          subject,
          text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return { ok: true };
      return {
        ok: false,
        // 4xx other than rate limiting will not succeed on retry.
        retryable: response.status === 429 || response.status >= 500,
        error: `Resend responded ${response.status}`,
      };
    } catch (error) {
      return { ok: false, retryable: true, error: networkError(error) };
    }
  }

  /** `phone` is E.164 (+947XXXXXXXX); Notify.lk expects 947XXXXXXXX. */
  async sendSms(phone: string, message: string): Promise<SendResult> {
    if (!this.smsEnabled)
      return { ok: false, retryable: false, error: 'SMS is not configured' };
    const to = phone.replace(/^\+/, '');
    if (!/^947\d{8}$/.test(to))
      return { ok: false, retryable: false, error: 'Invalid SMS recipient' };
    try {
      // POST form body keeps the API key out of URLs and access logs.
      const response = await fetch('https://app.notify.lk/api/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          user_id: this.config.getOrThrow<string>('NOTIFY_LK_USER_ID'),
          api_key: this.config.getOrThrow<string>('NOTIFY_LK_API_KEY'),
          sender_id: this.config.getOrThrow<string>('NOTIFY_LK_SENDER_ID'),
          to,
          message: message.slice(0, 600),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await response.json().catch(() => null)) as {
        status?: unknown;
      } | null;
      if (response.ok && body?.status === 'success') return { ok: true };
      return {
        ok: false,
        retryable: response.status === 429 || response.status >= 500,
        error: `Notify.lk responded ${response.status}`,
      };
    } catch (error) {
      return { ok: false, retryable: true, error: networkError(error) };
    }
  }

  async sendPush(
    tokens: string[],
    payload: {
      title: string;
      body: string;
      data: Record<string, string>;
    },
  ): Promise<PushResult> {
    if (!this.pushEnabled)
      return {
        ok: false,
        retryable: false,
        error: 'Push is disabled',
        invalidTokens: [],
      };
    if (!tokens.length)
      return {
        ok: false,
        retryable: false,
        error: 'No registered devices',
        invalidTokens: [],
      };
    try {
      const result = await this.firebase.sendPush({
        tokens: tokens.slice(0, 500),
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      const invalidTokens = result.responses.flatMap((response, index) =>
        !response.success && invalidTokenCodes.has(response.error?.code ?? '')
          ? [tokens[index]]
          : [],
      );
      if (result.successCount > 0) return { ok: true, invalidTokens };
      return {
        ok: false,
        // Retrying is pointless when every token was rejected as invalid.
        retryable: invalidTokens.length < tokens.length,
        error: `FCM delivered to 0 of ${tokens.length} devices`,
        invalidTokens,
      };
    } catch (error) {
      return {
        ok: false,
        retryable: true,
        error: networkError(error),
        invalidTokens: [],
      };
    }
  }
}

function networkError(error: unknown) {
  return error instanceof Error
    ? `${error.name}: ${error.message}`.slice(0, 300)
    : 'Provider request failed';
}
