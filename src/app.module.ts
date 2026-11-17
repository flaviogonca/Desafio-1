import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { JwtAuthGuard } from './modules/auth/presentation/jwt-auth.guard';
import { RolesGuard } from './modules/auth/presentation/roles.guard';
import { ServicesModule } from './modules/services/services.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PrismaModule } from './shared/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('THROTTLE_TTL_MS', 60_000)),
            limit: Number(config.get('THROTTLE_LIMIT', 60)),
          },
        ],
        // Tests only: lets e2e suites create many users in a burst. Never enable in production.
        skipIf: () => config.get('THROTTLE_DISABLED') === 'true',
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ServicesModule,
    WalletModule,
    BookingsModule,
  ],
  providers: [
    // Order matters: rate limit first, then authenticate, then authorise by role.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
