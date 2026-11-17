import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class TopUpDto {
  @ApiProperty({ example: 1000000, description: 'Amount in cents (smallest unit), 1 to 100000000' })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount!: number;
}
