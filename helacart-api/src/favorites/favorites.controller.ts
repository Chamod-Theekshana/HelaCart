import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { FavoritesService } from './favorites.service.js';
import { FavoritePageDto } from './favorites.dto.js';
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('me/favorites')
@UseGuards(FirebaseAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}
  @Get('summary') @Header('Cache-Control', 'no-store') summary(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.favorites.summary(request.user);
  }
  @Get() @Header('Cache-Control', 'no-store') list(
    @Req() request: AuthenticatedRequest,
    @Query() query: FavoritePageDto,
  ) {
    return this.favorites.list(request.user, query);
  }
  @Put('products/:productId') @Header('Cache-Control', 'no-store') save(
    @Req() request: AuthenticatedRequest,
    @Param('productId', uuid) id: string,
  ) {
    return this.favorites.save(request.user, id);
  }
  @Delete(':favoriteId') @Header('Cache-Control', 'no-store') remove(
    @Req() request: AuthenticatedRequest,
    @Param('favoriteId', uuid) id: string,
  ) {
    return this.favorites.remove(request.user, id);
  }
}
