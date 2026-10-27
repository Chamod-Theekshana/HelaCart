import { priceProducts } from '../discovery/pricing.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import {
  CreateProductDto,
  ListPublicProductsDto,
  UpdateProductDto,
} from './dto/product.dto.js';

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
  ) {}

  async createCategory(dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({ data: dto });
    } catch (error) {
      this.throwUniqueConflict(error, 'Category slug already exists');
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
  ) {
    const reviewer = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id: productId },
        select: { status: true, imageUrls: true },
      });
      if (!existing) throw new NotFoundException('Product not found');
      if (existing.status !== ProductStatus.PENDING)
        throw new ConflictException('Product is not pending review');
      if (
        decision === ProductReviewDecision.APPROVED &&
        !existing.imageUrls.length
      )
        throw new ConflictException('Product has no image');

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
      return tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: privateProduct,
      });
    });
  }

  async requireSellerMember(
    sellerId: string,
    identity: DecodedIdToken,
    requireApproved: boolean,
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
    if (requireApproved && membership.seller.status !== SellerStatus.APPROVED)
      throw new ForbiddenException(
        'Seller must be approved to manage products',
      );
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
