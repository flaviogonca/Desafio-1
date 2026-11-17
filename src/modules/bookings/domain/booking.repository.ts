import { Page } from '../../../shared/http/pagination';
import { BookingStatus, BookingView } from './booking.entity';

/** Read side (no money moves here). Writes go through the UnitOfWork. */
export interface BookingRepository {
  findViewById(id: string): Promise<BookingView | null>;
  /** Bookings where the user is the client OR the provider, newest first. */
  listForUser(userId: string, page: number, limit: number, status?: BookingStatus): Promise<Page<BookingView>>;
}

export const BOOKING_REPOSITORY = Symbol('BookingRepository');
