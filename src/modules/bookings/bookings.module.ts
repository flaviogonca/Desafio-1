import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { CancelBookingUseCase } from './application/cancel-booking.use-case';
import { CreateBookingUseCase } from './application/create-booking.use-case';
import { QueryBookingsUseCase } from './application/query-bookings.use-case';
import { BOOKING_REPOSITORY } from './domain/booking.repository';
import { UNIT_OF_WORK } from './domain/unit-of-work';
import { PrismaBookingRepository } from './infrastructure/prisma-booking.repository';
import { PrismaUnitOfWork } from './infrastructure/prisma-unit-of-work';
import { BookingsController } from './presentation/bookings.controller';

@Module({
  imports: [ServicesModule],
  controllers: [BookingsController],
  providers: [
    CreateBookingUseCase,
    CancelBookingUseCase,
    QueryBookingsUseCase,
    { provide: BOOKING_REPOSITORY, useClass: PrismaBookingRepository },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
  ],
})
export class BookingsModule {}
