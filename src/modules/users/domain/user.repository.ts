import { NewUser, User } from './user.entity';

/**
 * Port (Repository Pattern). Use cases depend on this interface only;
 * the Prisma implementation lives in the infrastructure layer.
 */
export interface UserRepository {
  create(data: NewUser): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByNif(nif: string): Promise<User | null>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
