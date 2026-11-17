import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { MAX_BALANCE } from '../../wallet/domain/wallet.repository';
import { BookingStatus, BookingView, NewBooking } from '../domain/booking.entity';
import { TxBookings, TxContext, TxWallet, UnitOfWork } from '../domain/unit-of-work';
import { BOOKING_INCLUDE, toBookingView } from './booking.mapper';

class PrismaTxWallet implements TxWallet {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async debitIfSufficient(userId: string, amount: number): Promise<boolean> {
    // `balance >= amount` is evaluated by PostgreSQL on the locked row, in the same statement
    // that subtracts. Concurrent debits queue on the row lock, so the balance can never go negative.
    const { count } = await this.tx.user.updateMany({
      where: { id: userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    return count === 1;
  }

  async credit(userId: string, amount: number): Promise<boolean> {
    const { count } = await this.tx.user.updateMany({
      where: { id: userId, balance: { lte: MAX_BALANCE - amount } },
      data: { balance: { increment: amount } },
    });
    return count === 1;
  }
}

class PrismaTxBookings implements TxBookings {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async create(data: NewBooking): Promise<BookingView> {
    const row = await this.tx.booking.create({ data, include: BOOKING_INCLUDE });
    return toBookingView(row);
  }

  async cancelIfConfirmed(id: string, cancelledById: string) {
    const claimed = await this.tx.booking.updateManyAndReturn({
      where: { id, status: BookingStatus.CONFIRMED },
      data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancelledById },
      select: { clientId: true, providerId: true, amount: true },
    });
    return claimed[0] ?? null;
  }

  async findViewById(id: string): Promise<BookingView | null> {
    const row = await this.tx.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    return row ? toBookingView(row) : null;
  }
}

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (ctx: TxContext) => Promise<T>): Promise<T> {
    // Prisma commits when the callback resolves and rolls back if it throws.
    return this.prisma.$transaction((tx) => work({ wallet: new PrismaTxWallet(tx), bookings: new PrismaTxBookings(tx) }));
  }
}
