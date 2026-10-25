import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  Prisma,
  ProductStatus,
  SellerStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogService, publicProduct } from '../catalog/catalog.service.js';
import { FavoritePageDto } from './favorites.dto.js';

const maxFavorites = 500;
const favoriteDetails = {
  id: true,
  productId: true,
  titleSnapshot: true,
  sellerNameSnapshot: true,
  imageUrlSnapshot: true,
  createdAt: true,
  product: {
    select: {
      ...publicProduct,
      status: true,
      seller: { select: { ...publicProduct.seller.select, status: true } },
      category: {
        select: { ...publicProduct.category.select, isActive: true },
      },
    },
  },
} as const satisfies Prisma.ProductFavoriteSelect;

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
  ) {}

  async summary(identity: DecodedIdToken) {
    const user = await this.auth.getOrCreateProfile(identity);
    const items = await this.prisma.productFavorite.findMany({
      where: { userId: user.id },
      select: { id: true, productId: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: maxFavorites,
    });
    return { items, total: items.length };
  }
  async list(identity: DecodedIdToken, query: FavoritePageDto) {
    const user = await this.auth.getOrCreateProfile(identity),
      page = query.page ?? 1,
      limit = query.limit ?? 12;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.productFavorite.count({ where: { userId: user.id } }),
      this.prisma.productFavorite.findMany({
        where: { userId: user.id },
        select: favoriteDetails,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((row) => this.present(row)),
      total,
      page,
      pageSize: limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }
  async save(identity: DecodedIdToken, productId: string) {
    const user = await this.auth.getOrCreateProfile(identity);
    return this.prisma.$transaction(
      async (tx) => {
        // Serialize this account's saves so the list limit also holds across tabs/devices.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id}::uuid FOR UPDATE`;
        const previous = await tx.productFavorite.findUnique({
          where: { userId_productId: { userId: user.id, productId } },
          select: { id: true, productId: true },
        });
        if (previous) return previous;
        const product = await tx.product.findFirst({
          where: {
            id: productId,
            status: ProductStatus.APPROVED,
            seller: { status: SellerStatus.APPROVED },
            category: { isActive: true },
          },
          select: {
            title: true,
            imageUrls: true,
            seller: { select: { name: true } },
          },
        });
        if (!product)
          throw new NotFoundException('Product is no longer available');
        if (
          (await tx.productFavorite.count({ where: { userId: user.id } })) >=
          maxFavorites
        )
          throw new ConflictException(
            'Your favorites list has reached 500 products. Remove an item before saving another.',
          );
        return tx.productFavorite.create({
          data: {
            userId: user.id,
            productId,
            titleSnapshot: product.title,
            sellerNameSnapshot: product.seller.name,
            imageUrlSnapshot: product.imageUrls[0] ?? null,
          },
          select: { id: true, productId: true },
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }
  async remove(identity: DecodedIdToken, favoriteId: string) {
    const user = await this.auth.getOrCreateProfile(identity);
    // Idempotent removal never discloses whether another account owns this ID.
    await this.prisma.productFavorite.deleteMany({
      where: { id: favoriteId, userId: user.id },
    });
    return { removed: true };
  }
  private present(
    row: Prisma.ProductFavoriteGetPayload<{ select: typeof favoriteDetails }>,
  ) {
    const item = row.product;
    let product = null;
    if (
      item?.status === ProductStatus.APPROVED &&
      item.seller.status === SellerStatus.APPROVED &&
      item.category.isActive
    ) {
      const {
        status: _status,
        seller: { status: _sellerStatus, ...seller },
        category: { isActive: _active, ...category },
        ...details
      } = item;
      void _status;
      void _sellerStatus;
      void _active;
      product = this.catalog.withAvailability({ ...details, seller, category });
    }
    return {
      id: row.id,
      productId: row.productId,
      createdAt: row.createdAt,
      title: product?.title ?? row.titleSnapshot,
      sellerName: product?.seller.name ?? row.sellerNameSnapshot,
      imageUrl: product?.imageUrls[0] ?? row.imageUrlSnapshot,
      product,
    };
  }
}
