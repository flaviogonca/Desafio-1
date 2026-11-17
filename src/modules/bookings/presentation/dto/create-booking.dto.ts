import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: '4ee04449-1ff1-416c-bfa8-675b9b0f2691' })
  @IsUUID()
  serviceId!: string;
}
