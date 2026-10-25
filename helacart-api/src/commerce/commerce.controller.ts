import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import {
  AddressDto,
  CartQuantityDto,
  CheckoutDto,
  DeliveryFeeDto,
  SellerOrderStatusDto,
} from './commerce.dto.js';
import { CommerceService } from './commerce.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('me')
@UseGuards(FirebaseAuthGuard)
export class BuyerCommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('addresses') @Header('Cache-Control', 'no-store') addresses(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.addresses(request.user);
  }
  @Post('addresses') @Header('Cache-Control', 'no-store') addAddress(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AddressDto,
  ) {
    return this.commerce.addAddress(request.user, dto);
  }
  @Delete('addresses/:addressId')
  @Header('Cache-Control', 'no-store')
  removeAddress(
    @Req() request: AuthenticatedRequest,
    @Param('addressId', uuid) id: string,
  ) {
    return this.commerce.removeAddress(request.user, id);
  }
  @Get('cart') @Header('Cache-Control', 'no-store') cart(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.cart(request.user);
  }
  @Put('cart/items/:variantId') @Header('Cache-Control', 'no-store') setItem(
    @Req() request: AuthenticatedRequest,
    @Param('variantId', uuid) id: string,
    @Body() dto: CartQuantityDto,
  ) {
    return this.commerce.setCartItem(request.user, id, dto.quantity);
  }
  @Delete('cart/items/:variantId')
  @Header('Cache-Control', 'no-store')
  removeItem(
    @Req() request: AuthenticatedRequest,
    @Param('variantId', uuid) id: string,
  ) {
    return this.commerce.removeCartItem(request.user, id);
  }
  @Post('orders/checkout') @Header('Cache-Control', 'no-store') checkout(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CheckoutDto,
  ) {
    return this.commerce.checkout(request.user, dto);
  }
  @Get('orders') @Header('Cache-Control', 'no-store') orders(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.myOrders(request.user);
  }
  @Get('orders/:orderId') @Header('Cache-Control', 'no-store') order(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', uuid) id: string,
  ) {
    return this.commerce.myOrder(request.user, id);
  }
  @Patch('orders/:orderId/seller-orders/:sellerOrderId/cancel')
  @Header('Cache-Control', 'no-store')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', uuid) orderId: string,
    @Param('sellerOrderId', uuid) sellerOrderId: string,
  ) {
    return this.commerce.buyerCancel(request.user, orderId, sellerOrderId);
  }
}

@Controller('sellers/:sellerId')
@UseGuards(FirebaseAuthGuard)
export class SellerCommerceController {
  constructor(private readonly commerce: CommerceService) {}
  @Patch('delivery-settings') @Header('Cache-Control', 'no-store') delivery(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: DeliveryFeeDto,
  ) {
    return this.commerce.setShippingFee(
      sellerId,
      request.user,
      dto.shippingFeeLkrMinor,
    );
  }
  @Get('orders') @Header('Cache-Control', 'no-store') orders(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.sellerOrders(sellerId, request.user);
  }
  @Patch('orders/:sellerOrderId/status')
  @Header('Cache-Control', 'no-store')
  status(
    @Param('sellerId', uuid) sellerId: string,
    @Param('sellerOrderId', uuid) sellerOrderId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: SellerOrderStatusDto,
  ) {
    return this.commerce.sellerStatus(
      sellerId,
      sellerOrderId,
      request.user,
      dto,
    );
  }
}

@Controller('admin/orders')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminCommerceController {
  constructor(private readonly commerce: CommerceService) {}
  @Get() @Header('Cache-Control', 'no-store') orders() {
    return this.commerce.adminOrders();
  }
}
