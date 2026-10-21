import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { FirebaseAdminService } from './firebase-admin.service.js';
import { FirebaseAuthGuard } from './firebase-auth.guard.js';
import { ProfilePhotosService } from './profile-photos.service.js';
import { ProfilePhotoStorageService } from './profile-photo-storage.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseAdminService,
    FirebaseAuthGuard,
    ProfilePhotosService,
    ProfilePhotoStorageService,
  ],
  exports: [AuthService, FirebaseAdminService, FirebaseAuthGuard],
})
export class AuthModule {}
