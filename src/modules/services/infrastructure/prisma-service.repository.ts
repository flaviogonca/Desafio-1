import { Injectable } from '@nestjs/common';
import { Page } from '../../../shared/http/pagination';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { NewService, ServicePatch, ServiceView } from '../domain/service.entity';
import { ServiceRepository } from '../domain/service.repository';

const WITH_PROVIDER = { provider: { select: { id: true, fullName: true } } } as const;

/** Explicit mapping: only the API contract leaves the repository, never internal columns like deletedAt. */
function toView(row: ServiceView): ServiceView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    providerId: row.providerId,
    provider: row.provider,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: NewService): Promise<ServiceView> {
    return toView(await this.prisma.service.create({ data, include: WITH_PROVIDER }));
  }

  async findActiveById(id: string): Promise<ServiceView | null> {
    const row = await this.prisma.service.findFirst({ where: { id, deletedAt: null }, include: WITH_PROVIDER });
    return row ? toView(row) : null;
  }

  listActive(page: number, limit: number): Promise<Page<ServiceView>> {
    return this.paginate({ deletedAt: null }, page, limit);
  }

  listActiveByProvider(providerId: string, page: number, limit: number): Promise<Page<ServiceView>> {
    return this.paginate({ deletedAt: null, providerId }, page, limit);
  }

  async update(id: string, patch: ServicePatch): Promise<ServiceView> {
    return toView(await this.prisma.service.update({ where: { id }, data: patch, include: WITH_PROVIDER }));
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async paginate(
    where: { deletedAt: null; providerId?: string },
    page: number,
    limit: number,
  ): Promise<Page<ServiceView>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        include: WITH_PROVIDER,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.service.count({ where }),
    ]);
    return { items: items.map(toView), total, page, limit };
  }
}
