import { BookingView, NewBooking } from './booking.entity';

/**
 * Operations available INSIDE one database transaction. If the work function throws,
 * everything done through the context is rolled back: money is never left half-moved.
 */
export interface TxWallet {
  /** Atomically subtracts `amount` only if balance >= amount. False means nothing changed. */
  debitIfSufficient(userId: string, amount: number): Promise<boolean>;
  /** Atomically adds `amount`, refusing to pass the maximum balance. False means nothing changed. */
  credit(userId: string, amount: number): Promise<boolean>;
}

export interface TxBookings {
  create(data: NewBooking): Promise<BookingView>;
  /**
   * Flips CONFIRMED to CANCELLED in one conditional statement. Returns null when the booking is
   * not CONFIRMED any more, so only one of several concurrent cancellations can win.
   */
  cancelIfConfirmed(
    id: string,
    cancelledById: string,
  ): Promise<{ clientId: string; providerId: string; amount: number } | null>;
  findViewById(id: string): Promise<BookingView | null>;
}

export interface TxContext {
  wallet: TxWallet;
  bookings: TxBookings;
}

export interface UnitOfWork {
  run<T>(work: (ctx: TxContext) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
