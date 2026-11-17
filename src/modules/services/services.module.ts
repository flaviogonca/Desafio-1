import { Module } from '@nestjs/common';
import { CreateServiceUseCase } from './application/create-service.use-case';
import { DeleteServiceUseCase } from './application/delete-service.use-case';
import { ListServicesUseCase } from './application/list-services.use-case';
import { UpdateServiceUseCase } from './application/update-service.use-case';
import { SERVICE_REPOSITORY } from './domain/service.repository';
import { PrismaServiceRepository } from './infrastructure/prisma-service.repository';
import { ServicesController } from './presentation/services.controller';

@Module({
  controllers: [ServicesController],
  providers: [
    CreateServiceUseCase,
    UpdateServiceUseCase,
    DeleteServiceUseCase,
    ListServicesUseCase,
    { provide: SERVICE_REPOSITORY, useClass: PrismaServiceRepository },
  ],
  exports: [SERVICE_REPOSITORY],
})
export class ServicesModule {}
