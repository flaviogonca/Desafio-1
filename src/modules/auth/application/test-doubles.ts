import { NewUser, User } from '../../users/domain/user.entity';
import { UserRepository } from '../../users/domain/user.repository';
import { PasswordHasher } from './password-hasher';
import { TokenClaims, TokenIssuer } from './token-issuer';

export class InMemoryUserRepository implements UserRepository {
  readonly items: User[] = [];

  async create(data: NewUser): Promise<User> {
    const user: User = { ...data, id: `user-${this.items.length + 1}`, balance: 0, createdAt: new Date() };
    this.items.push(user);
    return user;
  }
  async findById(id: string) {
    return this.items.find((u) => u.id === id) ?? null;
  }
  async findByEmail(email: string) {
    return this.items.find((u) => u.email === email) ?? null;
  }
  async findByNif(nif: string) {
    return this.items.find((u) => u.nif === nif) ?? null;
  }
}

/** Fast and deterministic stand-in for bcrypt. */
export class FakeHasher implements PasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string) {
    return hash === `hashed:${plain}`;
  }
}

export class FakeTokenIssuer implements TokenIssuer {
  async issue(claims: TokenClaims) {
    return { accessToken: `token-for-${claims.sub}-${claims.role}`, expiresIn: '1h' };
  }
}
