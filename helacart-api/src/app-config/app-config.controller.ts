import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Public force-update, legal and support configuration (contract §9). */
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  get() {
    const value = (key: string) => this.config.get<string>(key) ?? '';
    return {
      android: {
        minimumVersion: value('APP_ANDROID_MIN_VERSION'),
        latestVersion: value('APP_ANDROID_LATEST_VERSION'),
        storeUrl: value('APP_ANDROID_STORE_URL'),
      },
      ios: {
        minimumVersion: value('APP_IOS_MIN_VERSION'),
        latestVersion: value('APP_IOS_LATEST_VERSION'),
        storeUrl: value('APP_IOS_STORE_URL'),
      },
      legal: {
        privacyUrl: value('LEGAL_PRIVACY_URL'),
        termsUrl: value('LEGAL_TERMS_URL'),
        returnsUrl: value('LEGAL_RETURNS_URL'),
      },
      support: {
        email: value('SUPPORT_EMAIL'),
        phone: value('SUPPORT_PHONE'),
      },
    };
  }
}
