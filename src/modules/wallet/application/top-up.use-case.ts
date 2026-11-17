import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/errors';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';
import { WALLET_REPOSITORY, WalletRepository } from '../domain/wallet.repository';

export const MAX_TOP_UP = 100_000_000; // per request, in cents

@Injectable()
export class TopUpUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallet: WalletRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  /** Simulated top-up (no payment provider). Returns the new balance. */
  async execute(input: { userId: string; amount: number }): Promise<{ balance: number }> {
    if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > MAX_TOP_UP) {
      throw new ValidationError(`amount must be an integer between 1 and ${MAX_TOP_UP}`);
    }

    const balance = await this.wallet.credit(input.userId, input.amount);
    if (balance !== null) return { balance };

    // credit() returned null: tell the two causes apart for a precise error.
    if (!(await this.users.findById(input.userId))) throw new NotFoundError('User not found');
    throw new ConflictError('Balance limit exceeded');
  }
}
