import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationQuery } from '../../../shared/http/pagination';
import { AuthenticatedUser } from '../../auth/presentation/authenticated-user';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { Roles } from '../../auth/presentation/decorators';
import { Role } from '../../users/domain/user.entity';
import { CreateServiceUseCase } from '../application/create-service.use-case';
import { DeleteServiceUseCase } from '../application/delete-service.use-case';
import { ListServicesUseCase } from '../application/list-services.use-case';
import { UpdateServiceUseCase } from '../application/update-service.use-case';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(
    private readonly createService: CreateServiceUseCase,
    private readonly updateService: UpdateServiceUseCase,
    private readonly deleteService: DeleteServiceUseCase,
    private readonly listServices: ListServicesUseCase,
  ) {}

  @Roles(Role.PROVIDER)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateServiceDto) {
    return this.createService.execute({ ...dto, providerId: user.id });
  }

  /** Catalogue: clients only (challenge rule). */
  @Roles(Role.CLIENT)
  @Get()
  list(@Query() query: PaginationQuery) {
    return this.listServices.all(query.page, query.limit);
  }

  // Declared before ':id' routes so "mine" is never parsed as an id.
  @Roles(Role.PROVIDER)
  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQuery) {
    return this.listServices.mine(user.id, query.page, query.limit);
  }

  @Roles(Role.PROVIDER)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.updateService.execute({ serviceId: id, actorId: user.id, patch: dto });
  }

  @Roles(Role.PROVIDER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.deleteService.execute({ serviceId: id, actorId: user.id });
  }
}
