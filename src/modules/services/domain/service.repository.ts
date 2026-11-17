import { Page } from '../../../shared/http/pagination';
import { NewService, ServicePatch, ServiceView } from './service.entity';

/** Port. "Active" means not soft-deleted. */
export interface ServiceRepository {
  create(data: NewService): Promise<ServiceView>;
  findActiveById(id: string): Promise<ServiceView | null>;
  listActive(page: number, limit: number): Promise<Page<ServiceView>>;
  listActiveByProvider(providerId: string, page: number, limit: number): Promise<Page<ServiceView>>;
  update(id: string, patch: ServicePatch): Promise<ServiceView>;
  softDelete(id: string): Promise<void>;
}

export const SERVICE_REPOSITORY = Symbol('ServiceRepository');
