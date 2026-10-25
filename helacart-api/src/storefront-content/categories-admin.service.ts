import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';
import { CategoryListDto, UpdateCategoryDto } from './content.dto.js';
import { ContentImageStorageService } from './content-image-storage.service.js';

export const adminCategorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  sortOrder: true,
  isActive: true,
  imageUrl: true,
  revision: true,
  _count: { select: { products: true } },
} as const;
@Injectable()
export class CategoriesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ContentImageStorageService,
  ) {}
  async list(query: CategoryListDto) {
    const where = {
      ...(query.availability === 'all'
        ? {}
        : { isActive: query.availability === 'active' }),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { slug: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const [items, total] = await Promise.all([
          tx.category.findMany({
            where,
            select: adminCategorySelect,
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          tx.category.count({ where }),
        ]);
        return {
          items,
          total,
          page: query.page,
          pageSize: query.limit,
          pages: Math.max(1, Math.ceil(total / query.limit)),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000, maxWait: 10000 },
    );
  }
  private async current(id: string, revision: number) {
    const row = await this.prisma.category.findUnique({
      where: { id },
      select: { ...adminCategorySelect, imageStorageKey: true },
    });
    if (!row) throw new NotFoundException('Category not found');
    if (row.revision !== revision)
      throw new ConflictException(
        'Category changed. Reload categories and try again.',
      );
    return row;
  }
  async update(id: string, dto: UpdateCategoryDto) {
    const { expectedRevision, ...data } = dto;
    await this.current(id, expectedRevision);
    const result = await this.prisma.category.updateMany({
      where: { id, revision: expectedRevision },
      data: {
        ...data,
        description: data.description || null,
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'Category changed. Reload categories and try again.',
      );
    return this.prisma.category.findUniqueOrThrow({
      where: { id },
      select: adminCategorySelect,
    });
  }
  async remove(id: string, revision: number) {
    const row = await this.current(id, revision);
    try {
      const result = await this.prisma.category.deleteMany({
        where: { id, revision, products: { none: {} } },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Category changed or contains products. Archive categories that have products.',
        );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      )
        throw new ConflictException(
          'Category contains products. Archive it instead.',
        );
      throw error;
    }
    await this.storage.cleanup(row.imageStorageKey);
    return { removed: true };
  }
  async image(id: string, revision: number, request?: AuthenticatedRequest) {
    const row = await this.current(id, revision);
    const uploaded = request
      ? await this.storage.upload(request, `categories/${id}`)
      : null;
    try {
      const result = await this.prisma.category.updateMany({
        where: { id, revision },
        data: {
          imageUrl: uploaded?.imageUrl ?? null,
          imageStorageKey: uploaded?.storageKey ?? null,
          revision: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Category changed. Reload categories and try again.',
        );
    } catch (error) {
      await this.storage.cleanup(uploaded?.storageKey);
      throw error;
    }
    await this.storage.cleanup(row.imageStorageKey);
    return this.prisma.category.findUniqueOrThrow({
      where: { id },
      select: adminCategorySelect,
    });
  }
}
