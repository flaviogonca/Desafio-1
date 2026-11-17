import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/domain/errors';
import { ServicePatch, ServiceView } from '../domain/service.entity';
import { SERVICE_REPOSITORY, ServiceRepository } from '../domain/service.repository';

@Injectable()
export class UpdateServiceUseCase {
  constructor(@Inject(SERVICE_REPOSITORY) private readonly services: ServiceRepository) {}

  async execute(input: { serviceId: string; actorId: string; patch: ServicePatch }): Promise<ServiceView> {
    const { name, description, price } = input.patch;
    if (name === undefined && description === undefined && price === undefined) {
      throw new ValidationError('Provide at least one field to update');
    }
    if (price !== undefined && (!Number.isInteger(price) || price <= 0)) {
      throw new ValidationError('price must be an integer greater than zero');
    }

    const service = await this.services.findActiveById(input.serviceId);
    if (!service) throw new NotFoundError('Service not found');
    // Ownership rule: only the provider who owns the service may change it.
    if (service.providerId !== input.actorId) throw new ForbiddenError('You can only change your own services');

    return this.services.update(input.serviceId, {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(price !== undefined && { price }),
    });
  }
}
