import { ConflictError } from '../../../shared/domain/errors';
import { RegisterUserInput, RegisterUserUseCase } from './register-user.use-case';
import { FakeHasher, InMemoryUserRepository } from './test-doubles';

describe('RegisterUserUseCase', () => {
  let repo: InMemoryUserRepository;
  let useCase: RegisterUserUseCase;

  const input: RegisterUserInput = {
    fullName: 'Ana Costa',
    nif: '004512398la042',
    email: 'Ana@Example.com',
    password: 'Passw0rd123',
    role: 'CLIENT',
  };

  beforeEach(() => {
    repo = new InMemoryUserRepository();
    useCase = new RegisterUserUseCase(repo, new FakeHasher());
  });

  it('creates a user with normalised e-mail/NIF, a hashed password and zero balance', async () => {
    const result = await useCase.execute(input);

    expect(result).toMatchObject({ email: 'ana@example.com', nif: '004512398LA042', role: 'CLIENT', balance: 0 });
    expect(repo.items[0].passwordHash).toBe('hashed:Passw0rd123');
  });

  it('never exposes the password hash', async () => {
    const result = await useCase.execute(input);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate e-mail regardless of letter case', async () => {
    await useCase.execute(input);
    await expect(useCase.execute({ ...input, nif: '999999999ZZ999', email: 'ANA@EXAMPLE.COM' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('rejects a duplicate NIF', async () => {
    await useCase.execute(input);
    await expect(useCase.execute({ ...input, email: 'other@example.com' })).rejects.toBeInstanceOf(ConflictError);
  });
});
