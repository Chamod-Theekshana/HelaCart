import {
  Controller,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { ProductImagesService } from './product-images.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('sellers/:sellerId/products/:productId/images')
@UseGuards(FirebaseAuthGuard)
export class ProductImagesController {
  constructor(private readonly images: ProductImagesService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  upload(
    @Param('sellerId', uuid) sellerId: string,
    @Param('productId', uuid) productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.images.upload(sellerId, productId, request.user, request);
  }
}
