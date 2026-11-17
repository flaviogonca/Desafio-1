import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Roles } from '../../auth/presentation/decorators';
import { Role } from '../../users/domain/user.entity';
import { TopUpUseCase } from '../application/top-up.use-case';
import { TopUpDto } from './dto/top-up.dto';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly topUp: TopUpUseCase) {}

  /** Clients add balance (simulated, no payment integration). */
  @Roles(Role.CLIENT)
  @Post('top-up')
  @HttpCode(HttpStatus.OK)
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: TopUpDto) {
    return this.topUp.execute({ userId: user.id, amount: dto.amount });
  }
}
