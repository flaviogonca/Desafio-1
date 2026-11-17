import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/errors';
import { InMemoryUserRepository } from '../../auth/application/test-doubles';
import { MAX_BALANCE, WalletRepository } from '../domain/wallet.repository';
import { MAX_TOP_UP, TopUpUseCase } from './top-up.use-case';

class InMemoryWalletRepository implements WalletRepository {
  constructor(private readonly balances: Map<string, number>) {}
  async credit(userId: string, amount: number) {
    const current = this.balances.get(userId);
    if (current === undefined || current > MAX_BALANCE - amount) return null;
    this.balances.set(userId, current + amount);
    return current + amount;
  }
}

describe('TopUpUseCase', () => {
  let balances: Map<string, number>;
  let useCase: TopUpUseCase;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    const user = await users.create({ fullName: 'Ana', nif: '1', email: 'a@a.com', passwordHash: 'x', role: 'CLIENT' });
    balances = new Map([[user.id, 0]]);
    useCase = new TopUpUseCase(new InMemoryWalletRepository(balances), users);
  });

  it('adds the amount to the balance and accumulates across top-ups', async () => {
    expect(await useCase.execute({ userId: 'user-1', amount: 1000 })).toEqual({ balance: 1000 });
    expect(await useCase.execute({ userId: 'user-1', amount: 250 })).toEqual({ balance: 1250 });
  });

  it.each([0, -5, 1.5, MAX_TOP_UP + 1])('rejects amount %p', async (amount) => {
    await expect(useCase.execute({ userId: 'user-1', amount })).rejects.toBeInstanceOf(ValidationError);
    expect(balances.get('user-1')).toBe(0);
  });

  it('accepts the boundary amounts 1 and the maximum', async () => {
    await expect(useCase.execute({ userId: 'user-1', amount: 1 })).resolves.toEqual({ balance: 1 });
    await expect(useCase.execute({ userId: 'user-1', amount: MAX_TOP_UP })).resolves.toBeDefined();
  });

  it('returns not found for an unknown user', async () => {
    await expect(useCase.execute({ userId: 'ghost', amount: 10 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to exceed the maximum balance', async () => {
    balances.set('user-1', MAX_BALANCE);
    await expect(useCase.execute({ userId: 'user-1', amount: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect(balances.get('user-1')).toBe(MAX_BALANCE);
  });
});
