import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../services/domain/service.repository';
import { BookingView } from '../domain/booking.entity';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

@Injectable()
export class CreateBookingUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY) private readonly services: ServiceRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: { clientId: string; serviceId: string }): Promise<BookingView> {
    const service = await this.services.findActiveById(input.serviceId);
    if (!service) throw new NotFoundError('Service not found');

    return this.unitOfWork.run(async (tx) => {
      // 1. Debit the client only if the balance covers the price (equal balance is enough).
      //    One conditional statement: no gap between "check" and "debit" for a race to slip into.
      if (!(await tx.wallet.debitIfSufficient(input.clientId, service.price))) {
        throw new ConflictError('Insufficient balance');
      }
      // 2. Credit the provider. A failure here throws, so step 1 is rolled back too.
      if (!(await tx.wallet.credit(service.providerId, service.price))) {
        throw new ConflictError('Provider balance limit exceeded');
      }
      // 3. Record the booking with the price snapshot.
      return tx.bookings.create({
        serviceId: service.id,
        clientId: input.clientId,
        providerId: service.providerId,
        amount: service.price,
      });
    });
  }
}
