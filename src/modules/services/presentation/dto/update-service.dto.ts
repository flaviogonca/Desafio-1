import { PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';

/** Every field optional; the use case rejects an empty body. */
export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
