import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
@Injectable()
export class AccountAccessService {
  constructor(private readonly prisma: PrismaService) {}
  async assertActive(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      select: { accessStatus: true },
    });
    if (user?.accessStatus === 'SUSPENDED')
      throw new ForbiddenException(
        'Your HelaCart account is suspended. Contact HelaCart support for help',
      );
  }
}
