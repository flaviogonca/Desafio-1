import { BookingView } from '../domain/booking.entity';

export const BOOKING_INCLUDE = {
  service: { select: { id: true, name: true } },
  client: { select: { id: true, fullName: true } },
  provider: { select: { id: true, fullName: true } },
} as const;

/** Explicit mapping: only the API contract leaves the repository. */
export function toBookingView(row: BookingView): BookingView {
  return {
    id: row.id,
    amount: row.amount,
    status: row.status,
    createdAt: row.createdAt,
    cancelledAt: row.cancelledAt,
    cancelledById: row.cancelledById,
    service: row.service,
    client: row.client,
    provider: row.provider,
  };
}
