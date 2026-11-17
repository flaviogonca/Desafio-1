import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '../../../shared/domain/errors';
import { SERVICE_REPOSITORY, ServiceRepository } from '../domain/service.repository';

@Injectable()
export class DeleteServiceUseCase {
  constructor(@Inject(SERVICE_REPOSITORY) private readonly services: ServiceRepository) {}

  async execute(input: { serviceId: string; actorId: string }): Promise<void> {
    const service = await this.services.findActiveById(input.serviceId);
    if (!service) throw new NotFoundError('Service not found');
    if (service.providerId !== input.actorId) throw new ForbiddenError('You can only delete your own services');

    // Soft delete: existing bookings keep pointing at the service they were made for.
    await this.services.softDelete(input.serviceId);
  }
}
