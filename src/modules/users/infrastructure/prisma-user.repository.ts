import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../../shared/domain/errors';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { NewUser, User } from '../domain/user.entity';
import { UserRepository } from '../domain/user.repository';

const PRISMA_UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: NewUser): Promise<User> {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      // The use case checks for duplicates first (friendly message), but two concurrent
      // requests can both pass that check. The UNIQUE index is the real guarantee.
      if (this.isUniqueViolation(error)) {
        throw new ConflictError('E-mail or NIF already registered');
      }
      throw error;
    }
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findByNif(nif: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { nif } });
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { code?: string }).code === PRISMA_UNIQUE_VIOLATION;
  }
}
