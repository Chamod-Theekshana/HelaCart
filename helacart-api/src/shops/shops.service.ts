import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogService, publicProduct } from '../catalog/catalog.service.js';
import { ShopPageDto, ShopProductsDto, UpdateShopDto, UpdateShopBusinessDto } from './shops.dto.js';

export const shopSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  publicLocation: true,
  logoUrl: true,
  coverUrl: true,
  createdAt: true,
  shippingFeeLkrMinor: true,
} as const;
export const publishedReview = { isHidden: false, deletedAt: null } as const;
export const privateShopSelect = {
  ...shopSelect,
  status: true,
  contactPhone: true,
  pickupAddress: true,
  identityDocumentType: true,
  documents: {
    select: { id: true, kind: true, contentType: true, byteSize: true },
    orderBy: { kind: 'asc' as const },
  },
} as const;
export function ratingSummary(
  rows: { rating: number; _count: { _all: number } }[],
) {
  const breakdown = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: rows.find((row) => row.rating === rating)?._count._all ?? 0,
  }));
  const total = breakdown.reduce((sum, row) => sum + row.count, 0);
  return {
    total,
    average: total
      ? Math.round(
          (breakdown.reduce((sum, row) => sum + row.rating * row.count, 0) /
            total) *
            10,
        ) / 10
      : 0,
    breakdown,
  };
}
export function paginated<T>(items: T[], total: number, query: ShopPageDto) {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

@Injectable()
export class ShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async approved(slug: string) {
    const shop = await this.prisma.seller.findFirst({
      where: { slug, status: 'APPROVED' },
      select: shopSelect,
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  async directory(query: ShopPageDto) {
    const where: Prisma.SellerWhereInput = {
      status: 'APPROVED',
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [shops, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        select: {
          ...shopSelect,
          _count: {
            select: {
              products: {
                where: { status: 'APPROVED', category: { isActive: true } },
              },
            },
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.seller.count({ where }),
    ]);
    const ratings = shops.length
      ? await this.prisma.shopReview.groupBy({
          by: ['sellerId', 'rating'],
          where: {
            ...publishedReview,
            sellerId: { in: shops.map((shop) => shop.id) },
          },
          _count: { _all: true },
        })
      : [];
    return paginated(
      shops.map(({ _count, ...shop }) => ({
        ...shop,
        productCount: _count.products,
        rating: ratingSummary(
          ratings.filter((row) => row.sellerId === shop.id),
        ),
      })),
      total,
      query,
    );
  }

  async profile(slug: string) {
    const shop = await this.approved(slug);
    const [productCount, ratings, categories] = await Promise.all([
      this.prisma.product.count({
        where: {
          sellerId: shop.id,
          status: 'APPROVED',
          category: { isActive: true },
        },
      }),
      this.prisma.shopReview.groupBy({
        by: ['rating'],
        where: { sellerId: shop.id, ...publishedReview },
        _count: { _all: true },
      }),
      this.prisma.category.findMany({
        where: {
          isActive: true,
          products: { some: { sellerId: shop.id, status: 'APPROVED' } },
        },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      ...shop,
      productCount,
      rating: ratingSummary(ratings),
      categories,
    };
  }

  async products(slug: string, query: ShopProductsDto) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException(
        'Minimum price must not exceed maximum price',
      );
    const shop = await this.approved(slug);
    const where: Prisma.ProductWhereInput = {
      sellerId: shop.id,
      seller: { status: 'APPROVED' },
      status: 'APPROVED',
      category: {
        isActive: true,
        ...(query.category ? { slug: query.category } : {}),
      },
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
      priceLkrMinor: {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      },
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'price-asc'
        ? [{ priceLkrMinor: 'asc' }, { id: 'asc' }]
        : query.sort === 'price-desc'
          ? [{ priceLkrMinor: 'desc' }, { id: 'asc' }]
          : query.sort === 'name'
            ? [{ title: 'asc' }, { id: 'asc' }]
            : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: publicProduct,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginated(
      items.map((item) => this.catalog.withAvailability(item)),
      total,
      query,
    );
  }

  async privateProfile(sellerId: string, identity: DecodedIdToken) {
    await this.catalog.requireSellerMember(sellerId, identity, false);
    return this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: privateShopSelect,
    });
  }

  async updateBusiness(sellerId: string, identity: DecodedIdToken, dto: UpdateShopBusinessDto) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    return this.prisma.seller.update({
      where: { id: sellerId, status: 'APPROVED' },
      data: { contactPhone: dto.contactPhone, pickupAddress: dto.pickupAddress },
      select: privateShopSelect,
    });
  }

  async update(sellerId: string, identity: DecodedIdToken, dto: UpdateShopDto) {
    await this.catalog.requireSellerMember(sellerId, identity, true);
    return this.prisma.seller.update({
      where: { id: sellerId, status: 'APPROVED' },
      data: {
        name: dto.name,
        description: dto.description || null,
        publicLocation: dto.publicLocation || null,
      },
      select: shopSelect,
    });
  }
}
