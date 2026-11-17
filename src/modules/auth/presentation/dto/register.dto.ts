import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '../../../users/domain/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'Flávio Silva' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '004512398LA042', description: 'Tax ID (NIF): 9 to 14 letters/digits, unique' })
  @IsString()
  @Matches(/^[A-Za-z0-9]{9,14}$/, { message: 'nif must contain 9 to 14 letters or digits' })
  nif!: string;

  @ApiProperty({ example: 'flavio@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt ignores everything after 72 bytes
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password must contain at least one letter and one digit' })
  password!: string;

  @ApiProperty({ enum: Object.values(Role), example: Role.CLIENT })
  @IsIn(Object.values(Role))
  role!: Role;
}
