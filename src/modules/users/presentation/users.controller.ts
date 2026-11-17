import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { toPublicUser } from '../domain/user.entity';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  /** Profile of the authenticated user, including the current balance. */
  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser) {
    const user = await this.users.findById(current.id);
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user);
  }
}
