import { Role } from '../../users/domain/user.entity';

export interface TokenClaims {
  sub: string;
  role: Role;
}
export interface TokenIssuer {
  issue(claims: TokenClaims): Promise<{ accessToken: string; expiresIn: string }>;
}
export const TOKEN_ISSUER = Symbol('TokenIssuer');
