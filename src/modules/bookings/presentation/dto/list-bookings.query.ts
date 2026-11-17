import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQuery } from '../../../../shared/http/pagination';
import { BookingStatus } from '../../domain/booking.entity';

export class ListBookingsQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: Object.values(BookingStatus) })
  @IsOptional()
  @IsIn(Object.values(BookingStatus))
  status?: BookingStatus;
}
