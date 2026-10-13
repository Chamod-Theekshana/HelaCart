import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApp, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { FirebaseAuthGuard } from './firebase-auth.guard.js';
import { FIREBASE_AUTH } from './firebase-auth.constants.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseAuthGuard,
    {
      provide: FIREBASE_AUTH,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = getApps().length
          ? getApp()
          : initializeApp({
              credential: applicationDefault(),
              projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
            });

        return getAuth(app);
      },
    },
  ],
})
export class AuthModule {}