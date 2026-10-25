import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthenticatedRequest } from '../auth/firebase-auth.guard.js';
import { ContentImageStorageService } from './content-image-storage.service.js';
import { defaultHero, type HeroContent } from './hero-content.js';
import { UpdateHeroDto } from './content.dto.js';

@Injectable()
export class HeroAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly storage: ContentImageStorageService,
  ) {}
  async publicHero() {
    const row = await this.prisma.storefrontAppearance.findUnique({
      where: { id: 'home' },
      select: { published: true },
    });
    return row ? (row.published as HeroContent) : defaultHero;
  }
  private ensure() {
    return this.prisma.storefrontAppearance.upsert({
      where: { id: 'home' },
      create: { id: 'home', draft: defaultHero, published: defaultHero },
      update: {},
    });
  }
  async admin() {
    const row = await this.ensure();
    return {
      draft: row.draft as HeroContent,
      published: row.published as HeroContent,
      revision: row.revision,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  }
  private async current(revision: number) {
    const row = await this.ensure();
    if (row.revision !== revision)
      throw new ConflictException(
        'Hero changed. Reload the editor before continuing.',
      );
    return row;
  }
  async update(dto: UpdateHeroDto) {
    const { expectedRevision, ...text } = dto;
    for (const field of [
      'eyebrow',
      'title',
      'description',
      'buttonLabel',
      'imageAlt',
    ] as const)
      if (!text[field].trim())
        throw new BadRequestException('Hero text cannot be blank');
    const row = await this.current(expectedRevision);
    const result = await this.prisma.storefrontAppearance.updateMany({
      where: { id: 'home', revision: expectedRevision },
      data: {
        draft: { ...(row.draft as HeroContent), ...text },
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'Hero changed. Reload the editor before continuing.',
      );
    return this.admin();
  }
  async publish(revision: number, identity: DecodedIdToken) {
    await this.current(revision);
    const reviewer = await this.auth.getOrCreateProfile(identity);
    const old = await this.prisma.$transaction(
      async (tx) => {
        const row = await tx.storefrontAppearance.findUniqueOrThrow({
          where: { id: 'home' },
        });
        const result = await tx.storefrontAppearance.updateMany({
          where: { id: 'home', revision },
          data: {
            published: row.draft!,
            publishedAt: new Date(),
            publishedByUserId: reviewer.id,
            revision: { increment: 1 },
          },
        });
        if (result.count !== 1)
          throw new ConflictException(
            'Hero changed. Reload the editor before publishing.',
          );
        return {
          previous: row.published as HeroContent,
          next: row.draft as HeroContent,
        };
      },
      { timeout: 15000, maxWait: 10000 },
    );
    const retained = [old.next.desktopImageUrl, old.next.mobileImageUrl];
    await Promise.all(
      [old.previous.desktopImageUrl, old.previous.mobileImageUrl]
        .filter((url) => url && !retained.includes(url))
        .map((url) => this.storage.cleanup(this.storage.heroKey(url))),
    );
    return this.admin();
  }
  async image(kind: string, revision: number, request?: AuthenticatedRequest) {
    if (kind !== 'desktop' && kind !== 'mobile')
      throw new BadRequestException('Choose desktop or mobile');
    const row = await this.current(revision);
    const draft = row.draft as HeroContent,
      published = row.published as HeroContent;
    const field = kind === 'desktop' ? 'desktopImageUrl' : 'mobileImageUrl';
    const uploaded = request
      ? await this.storage.upload(request, 'hero')
      : null;
    try {
      const result = await this.prisma.storefrontAppearance.updateMany({
        where: { id: 'home', revision },
        data: {
          draft: { ...draft, [field]: uploaded?.imageUrl ?? null },
          revision: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException(
          'Hero changed. Reload the editor before continuing.',
        );
    } catch (error) {
      await this.storage.cleanup(uploaded?.storageKey);
      throw error;
    }
    const retained = [
      published.desktopImageUrl,
      published.mobileImageUrl,
      draft[kind === 'desktop' ? 'mobileImageUrl' : 'desktopImageUrl'],
    ];
    if (!retained.includes(draft[field]))
      await this.storage.cleanup(this.storage.heroKey(draft[field]));
    return this.admin();
  }
}
