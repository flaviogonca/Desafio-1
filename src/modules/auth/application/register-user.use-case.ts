import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../shared/domain/errors';
import { PublicUser, Role, toPublicUser } from '../../users/domain/user.entity';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';
import { PASSWORD_HASHER, PasswordHasher } from './password-hasher';

export interface RegisterUserInput {
  fullName: string;
  nif: string;
  email: string;
  password: string;
  role: Role;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    const nif = input.nif.trim().toUpperCase();

    // Same message for both cases: do not reveal which field already exists.
    if ((await this.users.findByEmail(email)) || (await this.users.findByNif(nif))) {
      throw new ConflictError('E-mail or NIF already registered');
    }

    const user = await this.users.create({
      fullName: input.fullName.trim(),
      nif,
      email,
      passwordHash: await this.hasher.hash(input.password),
      role: input.role,
    });
    return toPublicUser(user);
  }
}
