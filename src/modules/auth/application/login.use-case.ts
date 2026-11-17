import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../shared/domain/errors';
import { PublicUser, toPublicUser, User } from '../../users/domain/user.entity';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';
import { PASSWORD_HASHER, PasswordHasher } from './password-hasher';
import { TOKEN_ISSUER, TokenIssuer } from './token-issuer';

export interface LoginInput {
  identifier: string; // e-mail OR NIF
  password: string;
}
export interface LoginOutput {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: PublicUser;
}

@Injectable()
export class LoginUseCase {
  // A REAL hash, computed once. Compared when the user does not exist so that
  // "unknown user" and "wrong password" take the same time (no user enumeration by timing).
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.findByIdentifier(input.identifier.trim());
    const passwordOk = await this.hasher.compare(input.password, user?.passwordHash ?? (await this.getDummyHash()));

    // One generic message for every failure: never say which part was wrong.
    if (!user || !passwordOk) throw new UnauthorizedError('Invalid credentials');

    const { accessToken, expiresIn } = await this.tokens.issue({ sub: user.id, role: user.role });
    return { accessToken, tokenType: 'Bearer', expiresIn, user: toPublicUser(user) };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('timing-equalisation-placeholder');
    return this.dummyHash;
  }

  private findByIdentifier(identifier: string): Promise<User | null> {
    return identifier.includes('@')
      ? this.users.findByEmail(identifier.toLowerCase())
      : this.users.findByNif(identifier.toUpperCase());
  }
}
