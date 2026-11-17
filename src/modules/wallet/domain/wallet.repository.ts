/** Largest balance we allow: keeps well inside the 32-bit INTEGER column (2_147_483_647). */
export const MAX_BALANCE = 2_000_000_000;

/** Port for balance operations. Every method must be atomic. */
export interface WalletRepository {
  /**
   * Adds `amount` to the user's balance in a single atomic statement and returns the new balance.
   * Returns null when the user does not exist or the balance limit would be exceeded.
   */
  credit(userId: string, amount: number): Promise<number | null>;
}

export const WALLET_REPOSITORY = Symbol('WalletRepository');
