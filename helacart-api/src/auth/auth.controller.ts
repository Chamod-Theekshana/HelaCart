import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UpdateProfileDto } from './update-profile.dto.js';
import { ProfilePhotosService } from './profile-photos.service.js';
import {
  profilePhotoMaxBytes,
  type ProfilePhotoFile,
} from './profile-photo-storage.service.js';
import { AuthService } from './auth.service.js';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from './firebase-auth.guard.js';

@Controller('auth')
@UseGuards(FirebaseAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly photos: ProfilePhotosService,
  ) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  getMe(@Req() request: AuthenticatedRequest) {
    return this.authService.getOrCreateProfile(request.user);
  }

  @Patch('me')
  @Header('Cache-Control', 'no-store')
  update(@Req() request: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(request.user, dto);
  }

  @Post('me/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: profilePhotoMaxBytes, files: 1, fields: 0 },
    }),
  )
  @Header('Cache-Control', 'no-store')
  upload(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: ProfilePhotoFile,
  ) {
    return this.photos.upload(request.user, file);
  }

  @Delete('me/photo')
  @Header('Cache-Control', 'no-store')
  remove(@Req() request: AuthenticatedRequest) {
    return this.photos.remove(request.user);
  }

  @Get('me/photo')
  @Header('Cache-Control', 'private, no-store')
  async photo(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const photo = await this.photos.read(request.user);
    response.setHeader('Content-Type', photo.contentType);
    response.setHeader(
      'Content-Disposition',
      'inline; filename="profile-photo"',
    );
    return new StreamableFile(photo.bytes);
  }
}
