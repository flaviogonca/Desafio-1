export const BookingStatus = { CONFIRMED: 'CONFIRMED', CANCELLED: 'CANCELLED' } as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

type Party = { id: string; fullName: string };

/**
 * A booking is also the financial transaction, so it doubles as the platform history.
 * `amount` is the price at booking time (cents): later price edits never change it.
 */
export interface BookingView {
  id: string;
  amount: number;
  status: BookingStatus;
  createdAt: Date;
  cancelledAt: Date | null;
  cancelledById: string | null;
  service: { id: string; name: string };
  client: Party;
  provider: Party;
}

export interface NewBooking {
  serviceId: string;
  clientId: string;
  providerId: string;
  amount: number;
}
