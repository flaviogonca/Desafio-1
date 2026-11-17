import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { MAX_BALANCE, WalletRepository } from '../domain/wallet.repository';

@Injectable()
export class PrismaWalletRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async credit(userId: string, amount: number): Promise<number | null> {
    // One atomic UPDATE: `balance = balance + amount` runs inside PostgreSQL, so two concurrent
    // top-ups can never overwrite each other (a read-then-write in Node could lose one).
    // The WHERE clause also refuses to pass the maximum balance.
    const updated = await this.prisma.user.updateManyAndReturn({
      where: { id: userId, balance: { lte: MAX_BALANCE - amount } },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });
    return updated[0]?.balance ?? null;
  }
}
