import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '../../../shared/domain/errors';
import { Page } from '../../../shared/http/pagination';
import { BookingStatus, BookingView } from '../domain/booking.entity';
import { BOOKING_REPOSITORY, BookingRepository } from '../domain/booking.repository';

@Injectable()
export class QueryBookingsUseCase {
  constructor(@Inject(BOOKING_REPOSITORY) private readonly bookings: BookingRepository) {}

  /** History: each user sees only the bookings they took part in. */
  history(userId: string, page: number, limit: number, status?: BookingStatus): Promise<Page<BookingView>> {
    return this.bookings.listForUser(userId, page, limit, status);
  }

  async getOne(input: { bookingId: string; actorId: string }): Promise<BookingView> {
    const booking = await this.bookings.findViewById(input.bookingId);
    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.client.id !== input.actorId && booking.provider.id !== input.actorId) {
      throw new ForbiddenError('You are not a participant of this booking');
    }
    return booking;
  }
}
