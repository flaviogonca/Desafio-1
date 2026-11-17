import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Roles } from '../../auth/presentation/decorators';
import { Role } from '../../users/domain/user.entity';
import { CancelBookingUseCase } from '../application/cancel-booking.use-case';
import { CreateBookingUseCase } from '../application/create-booking.use-case';
import { QueryBookingsUseCase } from '../application/query-bookings.use-case';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsQuery } from './dto/list-bookings.query';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly createBooking: CreateBookingUseCase,
    private readonly cancelBooking: CancelBookingUseCase,
    private readonly queries: QueryBookingsUseCase,
  ) {}

  @Roles(Role.CLIENT)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    return this.createBooking.execute({ clientId: user.id, serviceId: dto.serviceId });
  }

  /** History of the authenticated user (as client or as provider). */
  @Get()
  history(@CurrentUser() user: AuthenticatedUser, @Query() query: ListBookingsQuery) {
    return this.queries.history(user.id, query.page, query.limit, query.status);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.queries.getOne({ bookingId: id, actorId: user.id });
  }

  /** Cancel and refund. Allowed for the client who booked or the provider of the service. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cancelBooking.execute({ bookingId: id, actorId: user.id });
  }
}
