import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { TopUpUseCase } from './application/top-up.use-case';
import { WALLET_REPOSITORY } from './domain/wallet.repository';
import { PrismaWalletRepository } from './infrastructure/prisma-wallet.repository';
import { WalletController } from './presentation/wallet.controller';

@Module({
  imports: [UsersModule],
  controllers: [WalletController],
  providers: [TopUpUseCase, { provide: WALLET_REPOSITORY, useClass: PrismaWalletRepository }],
  exports: [WALLET_REPOSITORY],
})
export class WalletModule {}
