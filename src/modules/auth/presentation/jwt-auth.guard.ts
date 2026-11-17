import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UnauthorizedError } from '../../../shared/domain/errors';
import { Role } from '../../users/domain/user.entity';
import { AuthenticatedUser } from './authenticated-user';
import { IS_PUBLIC_KEY } from './decorators';

/**
 * Applied globally: every route requires a valid Bearer token unless marked @Public().
 * Written by hand (no passport) so the whole authentication flow is visible in one place.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedError('Missing or malformed Authorization header');

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: Role }>(token);
      request.user = { id: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
