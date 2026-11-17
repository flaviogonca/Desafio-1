import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenClaims, TokenIssuer } from '../application/token-issuer';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issue(claims: TokenClaims): Promise<{ accessToken: string; expiresIn: string }> {
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '1h');
    const accessToken = await this.jwt.signAsync({ ...claims }, { expiresIn: expiresIn as never });
    return { accessToken, expiresIn };
  }
}
