import { ConflictError, ForbiddenError, NotFoundError } from '../../../shared/domain/errors';
import { InMemoryServiceRepository } from '../../services/application/test-doubles';
import { BookingStatus } from '../domain/booking.entity';
import { CancelBookingUseCase } from './cancel-booking.use-case';
import { CreateBookingUseCase } from './create-booking.use-case';
import { QueryBookingsUseCase } from './query-bookings.use-case';
import { InMemoryLedger } from './test-doubles';

describe('Booking use cases', () => {
  const PRICE = 2000;
  let ledger: InMemoryLedger;
  let services: InMemoryServiceRepository;
  let create: CreateBookingUseCase;
  let cancel: CancelBookingUseCase;
  let queries: QueryBookingsUseCase;
  let serviceId: string;

  beforeEach(async () => {
    ledger = new InMemoryLedger();
    ledger.addUser('client-1', 5000, 'Client One');
    ledger.addUser('client-2', 0, 'Client Two');
    ledger.addUser('provider-1', 0, 'Provider One');
    ledger.addUser('provider-2', 0, 'Provider Two');

    services = new InMemoryServiceRepository();
    ({ id: serviceId } = await services.create({
      name: 'Cleaning',
      description: 'Full cleaning',
      price: PRICE,
      providerId: 'provider-1',
    }));
    ledger.addService(serviceId, 'Cleaning');

    create = new CreateBookingUseCase(services, ledger);
    cancel = new CancelBookingUseCase(ledger, ledger);
    queries = new QueryBookingsUseCase(ledger);
  });

  const balance = (id: string) => ledger.balances.get(id);

  describe('create', () => {
    it('debits the client, credits the provider and records the booking with the price snapshot', async () => {
      const booking = await create.execute({ clientId: 'client-1', serviceId });

      expect(booking).toMatchObject({ amount: PRICE, status: 'CONFIRMED', client: { id: 'client-1' } });
      expect(balance('client-1')).toBe(3000);
      expect(balance('provider-1')).toBe(2000);
    });

    it('succeeds when the balance equals the price (boundary)', async () => {
      ledger.balances.set('client-1', PRICE);
      await expect(create.execute({ clientId: 'client-1', serviceId })).resolves.toBeDefined();
      expect(balance('client-1')).toBe(0);
    });

    it('fails with a conflict when the balance is one cent short, and changes nothing', async () => {
      ledger.balances.set('client-1', PRICE - 1);
      await expect(create.execute({ clientId: 'client-1', serviceId })).rejects.toThrow(
        new ConflictError('Insufficient balance'),
      );
      expect(balance('client-1')).toBe(PRICE - 1);
      expect(balance('provider-1')).toBe(0);
      expect(ledger.bookings).toHaveLength(0);
    });

    it('rolls the client debit back when crediting the provider fails (no half-moved money)', async () => {
      ledger.failProviderCredit = true;
      await expect(create.execute({ clientId: 'client-1', serviceId })).rejects.toBeInstanceOf(ConflictError);
      expect(balance('client-1')).toBe(5000);
      expect(ledger.bookings).toHaveLength(0);
    });

    it('returns not found for an unknown or soft-deleted service', async () => {
      await expect(create.execute({ clientId: 'client-1', serviceId: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
      await services.softDelete(serviceId);
      await expect(create.execute({ clientId: 'client-1', serviceId })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('keeps the booked amount even if the provider changes the price afterwards', async () => {
      const booking = await create.execute({ clientId: 'client-1', serviceId });
      await services.update(serviceId, { price: 9999 });
      expect((await queries.getOne({ bookingId: booking.id, actorId: 'client-1' })).amount).toBe(PRICE);
    });
  });

  describe('cancel', () => {
    it('lets the client cancel: full refund, provider debited, status CANCELLED', async () => {
      const { id } = await create.execute({ clientId: 'client-1', serviceId });
      const cancelled = await cancel.execute({ bookingId: id, actorId: 'client-1' });

      expect(cancelled).toMatchObject({ status: BookingStatus.CANCELLED, cancelledById: 'client-1' });
      expect(balance('client-1')).toBe(5000);
      expect(balance('provider-1')).toBe(0);
    });

    it('lets the provider of the service cancel too', async () => {
      const { id } = await create.execute({ clientId: 'client-1', serviceId });
      await cancel.execute({ bookingId: id, actorId: 'provider-1' });
      expect(balance('client-1')).toBe(5000);
      expect(balance('provider-1')).toBe(0);
    });

    it('forbids anyone who is not a participant', async () => {
      const { id } = await create.execute({ clientId: 'client-1', serviceId });
      await expect(cancel.execute({ bookingId: id, actorId: 'client-2' })).rejects.toBeInstanceOf(ForbiddenError);
      await expect(cancel.execute({ bookingId: id, actorId: 'provider-2' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(balance('client-1')).toBe(3000); // nothing refunded
    });

    it('cannot cancel twice: second attempt is a conflict and refunds nothing more', async () => {
      const { id } = await create.execute({ clientId: 'client-1', serviceId });
      await cancel.execute({ bookingId: id, actorId: 'client-1' });

      await expect(cancel.execute({ bookingId: id, actorId: 'client-1' })).rejects.toBeInstanceOf(ConflictError);
      expect(balance('client-1')).toBe(5000);
    });

    it('returns not found for an unknown booking', async () => {
      await expect(cancel.execute({ bookingId: 'nope', actorId: 'client-1' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rolls everything back when the provider cannot cover the refund (balance never negative)', async () => {
      const { id } = await create.execute({ clientId: 'client-1', serviceId });
      ledger.balances.set('provider-1', 0); // provider no longer has the money
      await expect(cancel.execute({ bookingId: id, actorId: 'client-1' })).rejects.toBeInstanceOf(ConflictError);

      expect(balance('client-1')).toBe(3000); // refund undone
      expect((await ledger.findViewById(id))?.status).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('history and permissions', () => {
    it('each user sees only the bookings they took part in', async () => {
      await create.execute({ clientId: 'client-1', serviceId });
      ledger.balances.set('client-2', 5000);
      await create.execute({ clientId: 'client-2', serviceId });

      expect((await queries.history('client-1', 1, 20)).total).toBe(1);
      expect((await queries.history('provider-1', 1, 20)).total).toBe(2);
      expect((await queries.history('provider-2', 1, 20)).total).toBe(0);
    });

    it('filters by status and keeps cancelled bookings in the history', async () => {
      const { id } = await create.execute({ clientId: 'client-1', serviceId });
      await cancel.execute({ bookingId: id, actorId: 'client-1' });

      expect((await queries.history('client-1', 1, 20)).total).toBe(1);
      expect((await queries.history('client-1', 1, 20, BookingStatus.CONFIRMED)).total).toBe(0);
      expect((await queries.history('client-1', 1, 20, BookingStatus.CANCELLED)).total).toBe(1);
    });

    it('forbids reading a booking you are not part of', async () => {
      const { id } = await create.execute({ clientId: 'client-1', serviceId });
      await expect(queries.getOne({ bookingId: id, actorId: 'client-2' })).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
