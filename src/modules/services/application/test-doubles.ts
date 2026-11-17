import { Page } from '../../../shared/http/pagination';
import { NewService, ServicePatch, ServiceView } from '../domain/service.entity';
import { ServiceRepository } from '../domain/service.repository';

export class InMemoryServiceRepository implements ServiceRepository {
  readonly items: (ServiceView & { deletedAt: Date | null })[] = [];

  async create(data: NewService): Promise<ServiceView> {
    const now = new Date();
    const item = {
      ...data,
      id: `svc-${this.items.length + 1}`,
      provider: { id: data.providerId, fullName: 'Provider' },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.items.push(item);
    return item;
  }
  async findActiveById(id: string) {
    return this.items.find((s) => s.id === id && !s.deletedAt) ?? null;
  }
  async listActive(page: number, limit: number) {
    return this.page(this.items.filter((s) => !s.deletedAt), page, limit);
  }
  async listActiveByProvider(providerId: string, page: number, limit: number) {
    return this.page(this.items.filter((s) => !s.deletedAt && s.providerId === providerId), page, limit);
  }
  async update(id: string, patch: ServicePatch) {
    const item = this.items.find((s) => s.id === id)!;
    Object.assign(item, patch);
    return item;
  }
  async softDelete(id: string) {
    this.items.find((s) => s.id === id)!.deletedAt = new Date();
  }
  private page(all: ServiceView[], page: number, limit: number): Page<ServiceView> {
    return { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit };
  }
}
