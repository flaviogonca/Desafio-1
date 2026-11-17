import { Injectable } from '@nestjs/common';
import { Page } from '../../../shared/http/pagination';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { BookingStatus, BookingView } from '../domain/booking.entity';
import { BookingRepository } from '../domain/booking.repository';
import { BOOKING_INCLUDE, toBookingView } from './booking.mapper';

@Injectable()
export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findViewById(id: string): Promise<BookingView | null> {
    const row = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    return row ? toBookingView(row) : null;
  }

  async listForUser(userId: string, page: number, limit: number, status?: BookingStatus): Promise<Page<BookingView>> {
    const where = {
      OR: [{ clientId: userId }, { providerId: userId }],
      ...(status && { status }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items: rows.map(toBookingView), total, page, limit };
  }
}
