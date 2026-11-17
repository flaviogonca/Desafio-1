import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../shared/domain/errors';
import { NewService, ServiceView } from '../domain/service.entity';
import { SERVICE_REPOSITORY, ServiceRepository } from '../domain/service.repository';

@Injectable()
export class CreateServiceUseCase {
  constructor(@Inject(SERVICE_REPOSITORY) private readonly services: ServiceRepository) {}

  execute(input: NewService): Promise<ServiceView> {
    // Business rule, also enforced by the DTO and a DB CHECK: price must be greater than zero.
    if (!Number.isInteger(input.price) || input.price <= 0) {
      throw new ValidationError('price must be an integer greater than zero');
    }
    return this.services.create({
      name: input.name.trim(),
      description: input.description.trim(),
      price: input.price,
      providerId: input.providerId,
    });
  }
}
