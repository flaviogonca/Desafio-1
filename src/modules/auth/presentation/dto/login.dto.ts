import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'flavio@example.com', description: 'E-mail or NIF' })
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  identifier!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
