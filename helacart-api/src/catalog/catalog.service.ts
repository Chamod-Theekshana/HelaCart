import { priceProducts } from '../discovery/pricing.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  Prisma,
  ProductReviewDecision,
  ProductStatus,
  SellerStatus,
} from '../generated/prisma/client.js';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { apiError } from '../common/api-error.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateProductDto,
  ListPublicProductsDto,
  UpdateProductDto,
} from './dto/product.dto.js';

export type SellerAccessOptions = {
  /** Only the shop OWNER may continue (MANAGER gets 403 OWNER_ONLY). */
  ownerOnly?: boolean;
  /** With requireApproved: a SUSPENDED shop may continue (order fulfilment). */
  allowSuspended?: boolean;
};

export const publicProduct = {
  id: true,
  title: true,
  slug: true,
  description: true,
  brand: true,
  warranty: true,
  specifications: true,
  priceLkrMinor: true,
  imageUrls: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  seller: { select: { id: true, name: true, slug: true } },
  variants: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      position: true,
      sku: true,
      optionValues: true,
      priceLkrMinor: true,
      onHand: true,
      reserved: true,
    },
  },
} as const;

export const privateProduct = {
  ...publicProduct,
  variants: {
    ...publicProduct.variants,
    select: {
      ...publicProduct.variants.select,
      lowStockThreshold: true,
      stockAlertsEnabled: true,
      stockSettingsVersion: true,
    },
  },
  sku: true,
  categoryId: true,
  sellerId: true,
  status: true,
  createdAt: true,
  reviews: {
    select: { decision: true, reason: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
} as const;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async createCategory(dto: CreateCategoryDto, identity?: DecodedIdToken) {
    const actor =
      identity && this.audit ? await this.audit.actor(identity) : undefined;
    try {
      const category = await this.prisma.category.create({ data: dto });
      if (actor && this.audit)
        await this.audit.record(this.prisma, actor, {
          action: 'CATEGORY_CREATE',
          subjectType: 'CATEGORY',
          subjectId: category.id,
          details: { name: category.name, slug: category.slug },
        });
      return category;
    } catch (error) {
      this.throwUniqueConflict(error, 'Category slug already exists');
    }
  }

  /**
   * Product images must be uploaded through HelaCart (R2_PUBLIC_BASE_URL).
   * Without R2 configuration, development/test accept any HTTPS URL while
   * production rejects all external URLs.
   */
  assertImageUrlsAllowed(imageUrls?: string[]) {
    if (!imageUrls?.length) return;
    const base = this.config?.get<string>('R2_PUBLIC_BASE_URL')?.trim();
    if (!base) {
      if (this.config?.get<string>('NODE_ENV') === 'production')
        throw apiError(
          400,
          'IMAGE_URL_NOT_ALLOWED',
          'Upload product images through HelaCart',
        );
      return;
    }
    const origin = new URL(base).origin;
    for (const value of imageUrls) {
      let allowed = false;
      try {
        const url = new URL(value);
        allowed =
          url.origin === origin &&
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          url.pathname.length > 1;
      } catch {
        allowed = false;
      }
      if (!allowed)
        throw apiError(
          400,
          'IMAGE_URL_NOT_ALLOWED',
          'Product images must be uploaded through HelaCart',
        );
    }
  }

  categories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
      },
    });
  }

  async publicProducts(query: ListPublicProductsDto) {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.APPROVED,
        seller: { status: SellerStatus.APPROVED },
        category: {
          isActive: true,
          ...(query.category ? { slug: query.category } : {}),
        },
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
        ...(query.q
          ? { title: { contains: query.q, mode: 'insensitive' as const } }
          : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      select: publicProduct,
    });
    return {
      items: (await priceProducts(this.prisma, rows.slice(0, limit))).map(
        (row) => this.withAvailability(row),
      ),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }

  async publicProduct(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        status: ProductStatus.APPROVED,
        seller: { status: SellerStatus.APPROVED },
        category: { isActive: true },
      },
      select: publicProduct,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.withAvailability(
      (await priceProducts(this.prisma, [product]))[0],
    );
  }

  async createProduct(
    sellerId: string,
    identity: DecodedIdToken,
    dto: CreateProductDto,
  ) {
    await this.requireSellerMember(sellerId, identity, true);
    this.assertImageUrlsAllowed(dto.imageUrls);
    await this.requireCategory(dto.categoryId);
    try {
      return await this.prisma.product.create({
        data: {
          ...this.productData(dto),
          sellerId,
          status: ProductStatus.DRAFT,
          variants: {
            create: {
              sellerId,
              position: 0,
              sku: dto.sku,
              priceLkrMinor: dto.priceLkrMinor,
            },
          },
        },
        select: privateProduct,
      });
    } catch (error) {
      this.throwUniqueConflict(
        error,
        'Product slug or SKU already exists for this seller',
      );
    }
  }

  async sellerProducts(
    sellerId: string,
    identity: DecodedIdToken,
    status?: ProductStatus,
  ) {
    await this.requireSellerMember(sellerId, identity, false);
    return this.prisma.product.findMany({
      where: { sellerId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: privateProduct,
    });
  }

  async sellerProduct(
    sellerId: string,
    productId: string,
    identity: DecodedIdToken,
  ) {
    await this.requireSellerMember(sellerId, identity, false);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId },
      select: privateProduct,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async editProduct(
    sellerId: string,
    productId: string,
    identity: DecodedIdToken,
    dto: UpdateProductDto,
  ) {
    await this.requireSellerMember(sellerId, identity, true);
    if (!Object.keys(dto).length)
      throw new BadRequestException('Supply at least one product field');
    this.assertImageUrlsAllowed(dto.imageUrls);
    if (dto.categoryId) await this.requireCategory(dto.categoryId);
    try {
      const update = async (tx: Prisma.TransactionClient) => {
        const updated = await tx.product.updateMany({
          where: {
            id: productId,
            sellerId,
            seller: { status: SellerStatus.APPROVED },
            status: {
              in: [
                ProductStatus.DRAFT,
                ProductStatus.REJECTED,
                ProductStatus.APPROVED,
                ProductStatus.HIDDEN,
              ],
            },
          },
          // Editing an approved product immediately removes it from the public catalog.
          data: { ...this.productData(dto), status: ProductStatus.DRAFT },
        });
        if (updated.count !== 1)
          await this.productTransitionError(sellerId, productId);
        if (dto.sku !== undefined || dto.priceLkrMinor !== undefined) {
          const variant = await tx.productVariant.updateMany({
            where: { productId, sellerId, position: 0 },
            data: { sku: dto.sku, priceLkrMinor: dto.priceLkrMinor },
          });
          if (variant.count !== 1)
            throw new ConflictException(
              'Default variant missing; apply the inventory migration',
            );
        }
      };
      if (dto.sku !== undefined || dto.priceLkrMinor !== undefined)
        await this.prisma.$transaction(update);
      else await update(this.prisma);
    } catch (error) {
      this.throwUniqueConflict(
        error,
        'Product slug or SKU already exists for this seller',
      );
    }
    return this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: privateProduct,
    });
  }

  async submitProduct(
    sellerId: string,
    productId: string,
    identity: DecodedIdToken,
  ) {
    await this.requireSellerMember(sellerId, identity, true);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId },
      select: { id: true, imageUrls: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.imageUrls.length === 0)
      throw new BadRequestException('Add at least one image before review');
    const updated = await this.prisma.product.updateMany({
      where: {
        id: productId,
        sellerId,
        seller: { status: SellerStatus.APPROVED },
        category: { isActive: true },
        status: { in: [ProductStatus.DRAFT, ProductStatus.REJECTED] },
      },
      data: { status: ProductStatus.PENDING },
    });
    if (updated.count !== 1)
      await this.productTransitionError(sellerId, productId);
    return this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: privateProduct,
    });
  }

  async hideProduct(
    sellerId: string,
    productId: string,
    identity: DecodedIdToken,
  ) {
    await this.requireSellerMember(sellerId, identity, true);
    const updated = await this.prisma.product.updateMany({
      where: {
        id: productId,
        sellerId,
        seller: { status: SellerStatus.APPROVED },
        status: ProductStatus.APPROVED,
      },
      data: { status: ProductStatus.HIDDEN },
    });
    if (updated.count !== 1)
      await this.productTransitionError(sellerId, productId);
    return this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: privateProduct,
    });
  }

  adminProducts(status: ProductStatus = ProductStatus.PENDING) {
    return this.prisma.product.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: privateProduct,
    });
  }

  async reviewProduct(
    productId: string,
    identity: DecodedIdToken,
    decision: ProductReviewDecision,
    reason?: string,
    commissionRateBps?: number,
  ) {
    const reviewer = await this.auth.getOrCreateProfile(identity);
    const actor = {
      id: reviewer.id,
      email: (reviewer as { email?: string }).email ?? identity.email ?? '',
    };
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id: productId },
        select: {
          status: true,
          imageUrls: true,
          commissionRateBps: true,
          commissionVersion: true,
        },
      });
      if (!existing) throw new NotFoundException('Product not found');
      if (existing.status !== ProductStatus.PENDING)
        throw new ConflictException('Product is not pending review');
      if (
        decision === ProductReviewDecision.APPROVED &&
        !existing.imageUrls.length
      )
        throw new ConflictException('Product has no image');
      if (decision === ProductReviewDecision.APPROVED) {
        const policy = await tx.commissionPolicy.findUnique({
          where: { id: 'platform' },
          select: { enabled: true },
        });
        if (
          policy?.enabled &&
          existing.commissionRateBps == null &&
          commissionRateBps === undefined
        )
          throw apiError(
            409,
            'COMMISSION_RATE_REQUIRED',
            'Set a commission rate for this product before approving it',
          );
        if (commissionRateBps !== undefined) {
          const version = (existing.commissionVersion ?? 0) + 1;
          const rated = await tx.product.updateMany({
            where: {
              id: productId,
              commissionVersion: existing.commissionVersion ?? 0,
            },
            data: { commissionRateBps, commissionVersion: version },
          });
          if (rated.count !== 1)
            throw new ConflictException(
              'Product commission changed. Reload before approving',
            );
          await tx.productCommissionChange.create({
            data: {
              productId,
              version,
              actorId: reviewer.id,
              beforeRateBps: existing.commissionRateBps ?? null,
              rateBps: commissionRateBps,
              reason: 'Commission rate set when the product was approved',
            },
          });
          await this.audit?.record(tx, actor, {
            action: 'COMMISSION_RATE_CHANGE',
            subjectType: 'PRODUCT',
            subjectId: productId,
            reason: 'Commission rate set when the product was approved',
            details: {
              beforeRateBps: existing.commissionRateBps ?? null,
              rateBps: commissionRateBps,
              version,
            },
          });
        }
      }

      const updated = await tx.product.updateMany({
        where: {
          id: productId,
          status: ProductStatus.PENDING,
          ...(decision === ProductReviewDecision.APPROVED
            ? {
                seller: { status: SellerStatus.APPROVED },
                category: { isActive: true },
              }
            : {}),
        },
        data: {
          status:
            decision === ProductReviewDecision.APPROVED
              ? ProductStatus.APPROVED
              : ProductStatus.REJECTED,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'Product cannot be reviewed in its current state',
        );
      await tx.productReview.create({
        data: {
          productId,
          reviewerUserId: reviewer.id,
          decision,
          reason: reason ?? null,
        },
      });
      await this.audit?.record(tx, actor, {
        action:
          decision === ProductReviewDecision.APPROVED
            ? 'PRODUCT_APPROVE'
            : 'PRODUCT_REJECT',
        subjectType: 'PRODUCT',
        subjectId: productId,
        reason: reason ?? null,
        details: commissionRateBps !== undefined ? { commissionRateBps } : {},
      });
      return tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: privateProduct,
      });
    });
  }

  /**
   * Seller route access. `requireApproved` marks a write route: a SUSPENDED
   * shop gets 403 SELLER_SUSPENDED unless `allowSuspended` (order status,
   * shipment updates). Read routes pass `false` and keep working when suspended.
   */
  async requireSellerMember(
    sellerId: string,
    identity: DecodedIdToken,
    requireApproved: boolean,
    options: SellerAccessOptions = {},
  ) {
    if (!identity.email_verified)
      throw new ForbiddenException(
        'Verify your email to manage seller products',
      );
    const profile = await this.auth.getOrCreateProfile(identity);
    const membership = await this.prisma.sellerMember.findUnique({
      where: { sellerId_userId: { sellerId, userId: profile.id } },
      select: { role: true, seller: { select: { status: true } } },
    });
    if (!membership) throw new ForbiddenException('Seller membership required');
    if (options.ownerOnly && membership.role !== 'OWNER')
      throw apiError(
        403,
        'OWNER_ONLY',
        'Only the shop owner can make this change',
      );
    const status = membership.seller.status;
    if (requireApproved && status !== SellerStatus.APPROVED) {
      if (status === SellerStatus.SUSPENDED) {
        if (!options.allowSuspended)
          throw apiError(
            403,
            'SELLER_SUSPENDED',
            'This shop is suspended. Contact HelaCart support',
          );
      } else
        throw new ForbiddenException(
          'Seller must be approved to manage products',
        );
    }
    return profile;
  }

  private productData<T extends CreateProductDto | UpdateProductDto>(dto: T) {
    return {
      ...dto,
      specifications: dto.specifications?.map(({ name, value }) => ({
        name,
        value,
      })),
    };
  }

  withAvailability<
    T extends {
      variants?: Array<{
        id: string;
        position: number;
        sku: string;
        optionValues: unknown;
        priceLkrMinor: number;
        onHand: number;
        reserved: number;
      }>;
    },
  >(product: T) {
    return {
      ...product,
      variants: (product.variants ?? []).map(
        ({ onHand, reserved, ...variant }) => ({
          ...variant,
          availableQuantity: onHand - reserved,
        }),
      ),
    };
  }

  private async requireCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { isActive: true },
    });
    if (!category?.isActive)
      throw new BadRequestException('Choose an active category');
  }

  private async productTransitionError(
    sellerId: string,
    productId: string,
  ): Promise<never> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    throw new ConflictException('Product cannot change in its current state');
  }

  private throwUniqueConflict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
