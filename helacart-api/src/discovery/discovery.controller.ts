import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { DiscoveryService } from './discovery.service.js';
import { PromotionsService } from './promotions.service.js';
import { FavoriteAlertsService } from './favorite-alerts.service.js';
import {
  SuggestQueryDto,
  RecommendationQueryDto,
  CreatePromotionDto,
  PromotionDecisionDto,
  PromotionListDto,
  FavoriteAlertDto,
} from './discovery.dto.js';
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('discovery')
export class PublicDiscoveryController {
  constructor(private readonly service: DiscoveryService) {}
  @Get('suggestions') @Header('Cache-Control', 'no-store') suggestions(
    @Query() q: SuggestQueryDto,
  ) {
    return this.service.suggest(q.q);
  }
  @Get('recommendations') @Header('Cache-Control', 'no-store') recommendations(
    @Query() q: RecommendationQueryDto,
  ) {
    return this.service.recommendations(q);
  }
}
@Controller('me')
@UseGuards(FirebaseAuthGuard)
export class BuyerDiscoveryController {
  constructor(
    private readonly service: DiscoveryService,
    private readonly alerts: FavoriteAlertsService,
  ) {}
  @Get('recommendations')
  @Header('Cache-Control', 'private, no-store')
  recommendations(
    @Req() req: AuthenticatedRequest,
    @Query() q: RecommendationQueryDto,
  ) {
    return this.service.recommendations(q, req.user);
  }
  @Patch('favorites/:id/alerts')
  @Header('Cache-Control', 'private, no-store')
  settings(
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: FavoriteAlertDto,
  ) {
    return this.alerts.settings(id, req.user, dto);
  }
}
@Controller('sellers/:sellerId/promotions')
@UseGuards(FirebaseAuthGuard)
export class SellerPromotionsController {
  constructor(private readonly service: PromotionsService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Query() q: PromotionListDto,
  ) {
    return this.service.list(req.user, id, q);
  }
  @Post() @Header('Cache-Control', 'private, no-store') create(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.service.create(id, req.user, dto);
  }
  @Patch(':id') @Header('Cache-Control', 'private, no-store') decide(
    @Param('sellerId', uuid) seller: string,
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: PromotionDecisionDto,
  ) {
    return this.service.decide(id, req.user, seller, dto);
  }
}
@Controller('admin/promotions')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminPromotionsController {
  constructor(private readonly service: PromotionsService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Req() req: AuthenticatedRequest,
    @Query() q: PromotionListDto,
  ) {
    return this.service.list(req.user, undefined, q);
  }
  @Patch(':id') @Header('Cache-Control', 'private, no-store') decide(
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: PromotionDecisionDto,
  ) {
    return this.service.decide(id, req.user, undefined, dto);
  }
}
