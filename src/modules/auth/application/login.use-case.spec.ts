import { UnauthorizedError } from '../../../shared/domain/errors';
import { LoginUseCase } from './login.use-case';
import { RegisterUserUseCase } from './register-user.use-case';
import { FakeHasher, FakeTokenIssuer, InMemoryUserRepository } from './test-doubles';

describe('LoginUseCase', () => {
  let login: LoginUseCase;

  beforeEach(async () => {
    const repo = new InMemoryUserRepository();
    const hasher = new FakeHasher();
    await new RegisterUserUseCase(repo, hasher).execute({
      fullName: 'Ana Costa',
      nif: '004512398LA042',
      email: 'ana@example.com',
      password: 'Passw0rd123',
      role: 'PROVIDER',
    });
    login = new LoginUseCase(repo, hasher, new FakeTokenIssuer());
  });

  it('logs in with e-mail and password (case-insensitive e-mail)', async () => {
    const result = await login.execute({ identifier: 'ANA@example.com', password: 'Passw0rd123' });
    expect(result).toMatchObject({ tokenType: 'Bearer', user: { email: 'ana@example.com', role: 'PROVIDER' } });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('logs in with NIF and password', async () => {
    const result = await login.execute({ identifier: '004512398la042', password: 'Passw0rd123' });
    expect(result.accessToken).toContain('PROVIDER');
  });

  it('gives the same generic error for a wrong password and an unknown user', async () => {
    const wrongPassword = login.execute({ identifier: 'ana@example.com', password: 'nope' });
    const unknownUser = login.execute({ identifier: 'ghost@example.com', password: 'Passw0rd123' });

    await expect(wrongPassword).rejects.toThrow(new UnauthorizedError('Invalid credentials'));
    await expect(unknownUser).rejects.toThrow(new UnauthorizedError('Invalid credentials'));
  });
});
