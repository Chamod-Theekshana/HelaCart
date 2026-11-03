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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FirebaseAuthGuard,
  type AuthenticatedRequest,
} from '../auth/firebase-auth.guard.js';
import { AdminGuard } from '../sellers/admin.guard.js';
import { AccountPermissionsService } from './account-permissions.service.js';
import {
  AccountsQueryDto,
  AccessDecisionDto,
  AddManagerDto,
  TeamReasonDto,
} from './account-permissions.dto.js';
const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('admin/accounts')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminAccountsController {
  constructor(private readonly service: AccountPermissionsService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Query() q: AccountsQueryDto,
  ) {
    return this.service.accounts(q);
  }
  @Patch(':id/access') @Header('Cache-Control', 'private, no-store') decide(
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AccessDecisionDto,
  ) {
    return this.service.decide(id, req.user, dto);
  }
}
@Controller('sellers/:sellerId/team')
@UseGuards(FirebaseAuthGuard)
export class SellerTeamController {
  constructor(private readonly service: AccountPermissionsService) {}
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.team(id, req.user);
  }
  @Post() @Header('Cache-Control', 'private, no-store') add(
    @Param('sellerId', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddManagerDto,
  ) {
    return this.service.add(id, req.user, dto);
  }
  @Delete(':id') @Header('Cache-Control', 'private, no-store') remove(
    @Param('sellerId', uuid) shop: string,
    @Param('id', uuid) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: TeamReasonDto,
  ) {
    return this.service.remove(shop, id, req.user, dto);
  }
}
