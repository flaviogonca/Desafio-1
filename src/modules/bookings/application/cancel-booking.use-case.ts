import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../shared/domain/errors';
import { BookingStatus, BookingView } from '../domain/booking.entity';
import { BOOKING_REPOSITORY, BookingRepository } from '../domain/booking.repository';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

@Injectable()
export class CancelBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookings: BookingRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(input: { bookingId: string; actorId: string }): Promise<BookingView> {
    const booking = await this.bookings.findViewById(input.bookingId);
    if (!booking) throw new NotFoundError('Booking not found');

    // Permission: only the client who booked or the provider of the service.
    const isParticipant = booking.client.id === input.actorId || booking.provider.id === input.actorId;
    if (!isParticipant) throw new ForbiddenError('You are not a participant of this booking');
    if (booking.status === BookingStatus.CANCELLED) throw new ConflictError('Booking is already cancelled');

    return this.unitOfWork.run(async (tx) => {
      // Claim the booking first. The check above is only a friendly early answer; THIS statement is
      // the real guard: if two cancellations race, one gets null and the refund runs exactly once.
      const claimed = await tx.bookings.cancelIfConfirmed(input.bookingId, input.actorId);
      if (!claimed) throw new ConflictError('Booking is already cancelled');

      // Full refund to the client, taken from the provider. Always client first, then provider
      // (same order as booking creation), so concurrent operations cannot deadlock each other.
      if (!(await tx.wallet.credit(claimed.clientId, claimed.amount))) {
        throw new ConflictError('Client balance limit exceeded');
      }
      if (!(await tx.wallet.debitIfSufficient(claimed.providerId, claimed.amount))) {
        throw new ConflictError('Provider balance is insufficient to refund this booking');
      }

      const updated = await tx.bookings.findViewById(input.bookingId);
      return updated as BookingView;
    });
  }
}
