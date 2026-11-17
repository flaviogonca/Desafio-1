import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ForbiddenError } from '../../../shared/domain/errors';
import { AuthenticatedUser } from './authenticated-user';
import { ROLES_KEY } from './decorators';
import { Role } from '../../users/domain/user.entity';

/** Runs after JwtAuthGuard. Routes without @Roles() are open to any authenticated user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>().user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    return true;
  }
}
