import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { WorkspaceService } from './workspace.service.js';
import {
  ApplicationQuery,
  ListQuery,
  OrderQuery,
  ProductQuery,
  PublicCatalogQuery,
  ReturnQuery,
} from './workspace.dto.js';
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('catalog')
export class CatalogBrowseController {
  constructor(private readonly workspace: WorkspaceService) {}
  @Get('products') @Header('Cache-Control', 'no-store') products(
    @Query() query: PublicCatalogQuery,
  ) {
    return this.workspace.publicCatalog(query);
  }
}
@Controller('workspace/me')
@UseGuards(FirebaseAuthGuard)
export class BuyerWorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}
  @Get('orders') @Header('Cache-Control', 'no-store') orders(
    @Req() request: AuthenticatedRequest,
    @Query() query: OrderQuery,
  ) {
    return this.workspace.buyerOrders(request.user, query);
  }
  @Get('returns') @Header('Cache-Control', 'no-store') returns(
    @Req() request: AuthenticatedRequest,
    @Query() query: ReturnQuery,
  ) {
    return this.workspace.buyerReturns(request.user, query);
  }
  @Get('notifications') @Header('Cache-Control', 'no-store') notifications(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListQuery,
  ) {
    return this.workspace.buyerNotifications(request.user, query);
  }
  @Get('summary') @Header('Cache-Control', 'no-store') summary(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workspace.buyerSummary(request.user);
  }
}
@Controller('workspace/sellers/:sellerId')
@UseGuards(FirebaseAuthGuard)
export class SellerWorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}
  @Get('orders') @Header('Cache-Control', 'no-store') orders(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: OrderQuery,
  ) {
    return this.workspace.sellerOrders(sellerId, request.user, query);
  }
  @Get('products') @Header('Cache-Control', 'no-store') products(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: ProductQuery,
  ) {
    return this.workspace.products(query, sellerId, request.user);
  }
  @Get('inventory') @Header('Cache-Control', 'no-store') inventory(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: ProductQuery,
  ) {
    return this.workspace.inventory(sellerId, request.user, query);
  }
  @Get('summary') @Header('Cache-Control', 'no-store') summary(
    @Param('sellerId', uuid) sellerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workspace.sellerSummary(sellerId, request.user);
  }
}
@Controller('workspace/admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminWorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}
  @Get('orders') @Header('Cache-Control', 'no-store') orders(
    @Query() query: OrderQuery,
  ) {
    return this.workspace.adminOrders(query);
  }
  @Get('products') @Header('Cache-Control', 'no-store') products(
    @Query() query: ProductQuery,
  ) {
    return this.workspace.products(query);
  }
  @Get('seller-applications') @Header('Cache-Control', 'no-store') applications(
    @Query() query: ApplicationQuery,
  ) {
    return this.workspace.applications(query);
  }
  @Get('returns') @Header('Cache-Control', 'no-store') returns(
    @Query() query: ReturnQuery,
  ) {
    return this.workspace.returns(query);
  }
  @Get('cod') @Header('Cache-Control', 'no-store') cod(
    @Query() query: ListQuery,
  ) {
    return this.workspace.cod(query);
  }
  @Get('summary') @Header('Cache-Control', 'no-store') summary() {
    return this.workspace.adminSummary();
  }
}
