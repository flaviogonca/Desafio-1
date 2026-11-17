import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../../../shared/http/pagination';
import { ServiceView } from '../domain/service.entity';
import { SERVICE_REPOSITORY, ServiceRepository } from '../domain/service.repository';

@Injectable()
export class ListServicesUseCase {
  constructor(@Inject(SERVICE_REPOSITORY) private readonly services: ServiceRepository) {}

  /** Catalogue shown to clients. */
  all(page: number, limit: number): Promise<Page<ServiceView>> {
    return this.services.listActive(page, limit);
  }

  /** Only the services of the authenticated provider. */
  mine(providerId: string, page: number, limit: number): Promise<Page<ServiceView>> {
    return this.services.listActiveByProvider(providerId, page, limit);
  }
}
