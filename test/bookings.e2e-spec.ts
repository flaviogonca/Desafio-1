import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/shared/prisma/prisma.service';

/**
 * End-to-end tests against the REAL database. They prove the rules that unit tests cannot:
 * atomicity and race conditions. Every run creates its own users (unique suffix) and removes them.
 */
describe('Bookings (e2e, real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  let counter = 0;

  beforeAll(async () => {
    process.env.THROTTLE_DISABLED = 'true'; // the login limit (10/min) would block creating test users
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { endsWith: `@${run}.e2e.test` } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.booking.deleteMany({ where: { OR: [{ clientId: { in: ids } }, { providerId: { in: ids } }] } });
    await prisma.service.deleteMany({ where: { providerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function createUser(role: 'CLIENT' | 'PROVIDER') {
    const n = ++counter;
    const email = `${role.toLowerCase()}${n}@${run}.e2e.test`;
    const nif = `${run}${n}`.toUpperCase().padEnd(9, '0').slice(0, 14);
    const password = 'Passw0rd123';
    await http().post('/auth/register').send({ fullName: `User ${n}`, nif, email, password, role }).expect(201);
    const login = await http().post('/auth/login').send({ identifier: email, password }).expect(200);
    return { token: login.body.accessToken as string, id: login.body.user.id as string };
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const balanceOf = async (u: { token: string }) => (await http().get('/users/me').set(auth(u.token))).body.balance as number;

  async function scenario(price: number, clientBalance: number) {
    const provider = await createUser('PROVIDER');
    const client = await createUser('CLIENT');
    const service = await http()
      .post('/services')
      .set(auth(provider.token))
      .send({ name: 'Cleaning', description: 'Full cleaning', price })
      .expect(201);
    if (clientBalance > 0) {
      await http().post('/wallet/top-up').set(auth(client.token)).send({ amount: clientBalance }).expect(200);
    }
    return { provider, client, serviceId: service.body.id as string };
  }

  it('happy path: book, see history on both sides, cancel with refund, cannot cancel twice', async () => {
    const { provider, client, serviceId } = await scenario(1000, 5000);

    const booked = await http().post('/bookings').set(auth(client.token)).send({ serviceId }).expect(201);
    expect(booked.body).toMatchObject({ amount: 1000, status: 'CONFIRMED' });
    expect(await balanceOf(client)).toBe(4000);
    expect(await balanceOf(provider)).toBe(1000);

    const clientHistory = await http().get('/bookings').set(auth(client.token)).expect(200);
    const providerHistory = await http().get('/bookings').set(auth(provider.token)).expect(200);
    expect(clientHistory.body.total).toBe(1);
    expect(providerHistory.body.items[0]).toMatchObject({ id: booked.body.id, service: { name: 'Cleaning' } });

    await http().post(`/bookings/${booked.body.id}/cancel`).set(auth(provider.token)).expect(200);
    expect(await balanceOf(client)).toBe(5000);
    expect(await balanceOf(provider)).toBe(0);

    await http().post(`/bookings/${booked.body.id}/cancel`).set(auth(client.token)).expect(409);
    expect(await balanceOf(client)).toBe(5000); // still refunded only once
  });

  it('rejects a booking with insufficient balance and a provider trying to book', async () => {
    const { provider, client, serviceId } = await scenario(1000, 999);
    await http().post('/bookings').set(auth(client.token)).send({ serviceId }).expect(409);
    await http().post('/bookings').set(auth(provider.token)).send({ serviceId }).expect(403);
    expect(await balanceOf(client)).toBe(999);
  });

  it('forbids a stranger from cancelling or reading a booking', async () => {
    const { client, serviceId } = await scenario(1000, 1000);
    const stranger = await createUser('CLIENT');
    const booked = await http().post('/bookings').set(auth(client.token)).send({ serviceId }).expect(201);

    await http().post(`/bookings/${booked.body.id}/cancel`).set(auth(stranger.token)).expect(403);
    await http().get(`/bookings/${booked.body.id}`).set(auth(stranger.token)).expect(403);
  });

  it('CONCURRENCY: 10 simultaneous bookings with balance for only one -> exactly one succeeds', async () => {
    const { provider, client, serviceId } = await scenario(1000, 1000);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => http().post('/bookings').set(auth(client.token)).send({ serviceId })),
    );
    const statuses = responses.map((r) => r.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(await balanceOf(client)).toBe(0); // never negative
    expect(await balanceOf(provider)).toBe(1000); // credited exactly once
    expect(await prisma.booking.count({ where: { clientId: client.id } })).toBe(1);
  });

  it('CONCURRENCY: 25 simultaneous bookings with balance for exactly 10 -> exactly 10 succeed', async () => {
    const { provider, client, serviceId } = await scenario(1000, 10_000);

    const responses = await Promise.all(
      Array.from({ length: 25 }, () => http().post('/bookings').set(auth(client.token)).send({ serviceId })),
    );

    expect(responses.filter((r) => r.status === 201)).toHaveLength(10);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(15);
    expect(await balanceOf(client)).toBe(0);
    expect(await balanceOf(provider)).toBe(10_000);
  });

  it('CONCURRENCY: simultaneous cancellations by client and provider -> refund happens exactly once', async () => {
    const { provider, client, serviceId } = await scenario(1000, 1000);
    const booked = await http().post('/bookings').set(auth(client.token)).send({ serviceId }).expect(201);

    const responses = await Promise.all(
      [client, provider, client, provider, client, provider].map((who) =>
        http().post(`/bookings/${booked.body.id}/cancel`).set(auth(who.token)),
      ),
    );

    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await balanceOf(client)).toBe(1000); // refunded once, not six times
    expect(await balanceOf(provider)).toBe(0);
  });

  it('money is conserved: after mixed concurrent bookings and cancellations the total never changes', async () => {
    const { provider, client, serviceId } = await scenario(700, 5000);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => http().post('/bookings').set(auth(client.token)).send({ serviceId })),
    );
    const ids = results.filter((r) => r.status === 201).map((r) => r.body.id as string);
    await Promise.all(ids.slice(0, 3).map((id) => http().post(`/bookings/${id}/cancel`).set(auth(client.token))));

    expect((await balanceOf(client)) + (await balanceOf(provider))).toBe(5000);
  });
});
