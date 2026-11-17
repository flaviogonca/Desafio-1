import { Page } from '../../../shared/http/pagination';
import { BookingStatus, BookingView, NewBooking } from '../domain/booking.entity';
import { BookingRepository } from '../domain/booking.repository';
import { TxContext, UnitOfWork } from '../domain/unit-of-work';

/**
 * In-memory ledger that behaves like a database transaction: if the work function throws,
 * balances and bookings are restored to their state before `run()`. This lets unit tests
 * prove "no money moves when something fails".
 */
export class InMemoryLedger implements UnitOfWork, BookingRepository {
  balances = new Map<string, number>();
  bookings: BookingView[] = [];
  /** Test hook: make the provider credit fail, to exercise rollback. */
  failProviderCredit = false;
  private names = new Map<string, string>();
  private serviceNames = new Map<string, string>();

  addUser(id: string, balance: number, fullName = id): void {
    this.balances.set(id, balance);
    this.names.set(id, fullName);
  }
  addService(id: string, name = id): void {
    this.serviceNames.set(id, name);
  }

  async run<T>(work: (ctx: TxContext) => Promise<T>): Promise<T> {
    const snapshot = { balances: new Map(this.balances), bookings: this.bookings.map((b) => ({ ...b })) };
    try {
      return await work(this.context());
    } catch (error) {
      this.balances = snapshot.balances;
      this.bookings = snapshot.bookings;
      throw error;
    }
  }

  async findViewById(id: string) {
    return this.bookings.find((b) => b.id === id) ?? null;
  }

  async listForUser(userId: string, page: number, limit: number, status?: BookingStatus): Promise<Page<BookingView>> {
    const all = this.bookings
      .filter((b) => b.client.id === userId || b.provider.id === userId)
      .filter((b) => !status || b.status === status);
    return { items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit };
  }

  private context(): TxContext {
    return {
      wallet: {
        debitIfSufficient: async (userId, amount) => {
          const balance = this.balances.get(userId);
          if (balance === undefined || balance < amount) return false;
          this.balances.set(userId, balance - amount);
          return true;
        },
        credit: async (userId, amount) => {
          if (this.failProviderCredit && userId.startsWith('provider')) return false;
          const balance = this.balances.get(userId);
          if (balance === undefined) return false;
          this.balances.set(userId, balance + amount);
          return true;
        },
      },
      bookings: {
        create: async (data: NewBooking) => {
          const booking: BookingView = {
            id: `booking-${this.bookings.length + 1}`,
            amount: data.amount,
            status: BookingStatus.CONFIRMED,
            createdAt: new Date(),
            cancelledAt: null,
            cancelledById: null,
            service: { id: data.serviceId, name: this.serviceNames.get(data.serviceId) ?? data.serviceId },
            client: { id: data.clientId, fullName: this.names.get(data.clientId) ?? data.clientId },
            provider: { id: data.providerId, fullName: this.names.get(data.providerId) ?? data.providerId },
          };
          this.bookings.push(booking);
          return booking;
        },
        cancelIfConfirmed: async (id, cancelledById) => {
          const booking = this.bookings.find((b) => b.id === id);
          if (!booking || booking.status !== BookingStatus.CONFIRMED) return null;
          booking.status = BookingStatus.CANCELLED;
          booking.cancelledAt = new Date();
          booking.cancelledById = cancelledById;
          return { clientId: booking.client.id, providerId: booking.provider.id, amount: booking.amount };
        },
        findViewById: async (id) => this.bookings.find((b) => b.id === id) ?? null,
      },
    };
  }
}
