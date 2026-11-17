import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateServiceDto {
  @ApiProperty({ example: 'Home cleaning' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Full apartment cleaning, 3 hours, supplies included.' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  description!: string;

  @ApiProperty({ example: 500000, description: 'Price in cents (smallest unit). Must be greater than zero.' })
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  price!: number;
}
