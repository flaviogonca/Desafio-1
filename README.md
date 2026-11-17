# Bulir Bookings API

RESTful API for a service-booking platform. **Clients** book services offered by **providers** and pay with a balance they hold on the platform. Built for the Bulir backend challenge.

**Stack:** Node.js 22 · NestJS 11 · TypeScript · PostgreSQL 17 · Prisma 7 · JWT · Docker · Jest

## What it does

| Area | Behaviour |
|---|---|
| Users | Register as client or provider (full name, NIF, e-mail, password). NIF and e-mail are unique; e-mail is case-insensitive. |
| Auth | Log in with e-mail **or** NIF plus password and receive a JWT. Every route except `register`, `login` and `health` needs `Authorization: Bearer <token>`. |
| Services | Providers create, list, edit and delete **their own** services (name, description, price). Clients browse the catalogue. |
| Wallet | Clients top up their balance (simulated, no payment provider). |
| Bookings | A client books a service. The price is debited from the client and credited to the provider atomically. |
| Cancellation | The client or the provider of the booking can cancel. The client is refunded in full, once. |
| History | Each user lists the bookings they took part in (as client or provider), paginated, filterable by status. |

## Quick start

```bash
cp .env.example .env            # then set JWT_SECRET (openssl rand -hex 32) and POSTGRES_PASSWORD
```

### Option A: everything in Docker

```bash
docker compose --profile app up --build
# API:      http://localhost:3000
# Swagger:  http://localhost:3000/docs
# Health:   http://localhost:3000/health
```

The container applies pending database migrations before it starts.

### Option B: database in Docker, API on your machine (development)

```bash
docker compose up -d db         # change DB_PORT in .env if 5432 is taken, and update DATABASE_URL
npm install
npx prisma migrate deploy       # create the tables
npm run start:dev               # watch mode
```

### Production-like stack

```bash
cp .env.example .env.production # set strong values for every secret and CORS_ORIGIN
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Differences from development: the database is **not** published to the host, the stack refuses to start without `JWT_SECRET`, `POSTGRES_PASSWORD` and `CORS_ORIGIN`, containers restart automatically, the API runs as a non-root user on a read-only filesystem with a memory limit.

## Tests

```bash
npm test            # 43 unit tests: business rules, no database needed
npm run test:e2e    # 7 end-to-end tests against the real database (needs `docker compose up -d db` and migrations applied)
```

The e2e suite is where the money rules are proven: for example 25 simultaneous bookings from a client with balance for only 10 end with **exactly 10** bookings, and 6 simultaneous cancellations refund **exactly once**. Each run creates its own users and deletes them afterwards.

## API

Interactive docs and request/response schemas: **`/docs`** (Swagger). All money values are **integers in cents** (`5000` means 50.00). All errors share one shape: `{ statusCode, error, message, path, timestamp }`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Create a user |
| POST | `/auth/login` | public | Log in with `identifier` (e-mail or NIF) and `password` |
| GET | `/users/me` | any user | Profile with current balance |
| POST | `/services` | provider | Create a service |
| GET | `/services` | client | Catalogue (paginated) |
| GET | `/services/mine` | provider | My services (paginated) |
| PATCH | `/services/:id` | owner provider | Edit a service |
| DELETE | `/services/:id` | owner provider | Delete a service (soft delete) |
| POST | `/wallet/top-up` | client | Add balance |
| POST | `/bookings` | client | Book a service |
| GET | `/bookings` | any user | My history (`?page`, `?limit`, `?status`) |
| GET | `/bookings/:id` | participant | One booking |
| POST | `/bookings/:id/cancel` | participant | Cancel with full refund |
| GET | `/health` | public | Liveness and database check |

Status codes: `400` invalid input, `401` missing or invalid token, `403` not allowed, `404` not found, `409` conflict (duplicate user, insufficient balance, already cancelled), `429` rate limit.

## Architecture

Clean Architecture per module. Dependencies point inwards: use cases know nothing about NestJS, HTTP or Prisma.

```
src/modules/<module>/
  domain/           entities and ports (repository interfaces)
  application/      use cases = the business rules
  infrastructure/   Prisma and bcrypt/JWT adapters (implement the ports)
  presentation/     controllers, DTOs, guards
src/shared/         domain errors, global error filter, Prisma service, health check
```

Modules: `auth`, `users`, `services`, `wallet`, `bookings`.

Why it matters: the rules live in plain classes that unit tests run in milliseconds with in-memory fakes, while Prisma is only one replaceable adapter (Repository Pattern).

## Design decisions

**PostgreSQL, not MongoDB.** The core of this product is money moving between accounts. That needs ACID transactions, row locks and constraints, which PostgreSQL gives natively. The schema also has `CHECK` constraints (`balance >= 0`, `price > 0`, `amount > 0`), so even a bug in the code cannot create a negative balance.

**Money as integer cents.** No floating point, so no rounding errors.

**Atomic balance changes.** A balance is never read in Node, changed and written back (two requests could overwrite each other). Instead each change is one conditional SQL statement run by PostgreSQL:

```sql
UPDATE users SET balance = balance - :price WHERE id = :client AND balance >= :price
```

Concurrent requests queue on the row lock; whoever arrives when the money is gone updates zero rows and gets `409`.

**One transaction per booking.** The debit, the credit and the booking record commit together or not at all (`UnitOfWork` port, Prisma adapter).

**Cancel exactly once.** Cancelling first "claims" the booking with `WHERE status = 'CONFIRMED'`. If several cancellations race, only one claims it and only that one refunds.

**No deadlocks.** Operations always lock the client's balance first and the provider's second.

**Price snapshot.** A booking stores the price it was made at, so later price edits never change history or refunds.

**Soft delete for services.** Deleting hides a service from lists but keeps past bookings pointing at it.

**Hand-written JWT guard** instead of Passport, so the whole authentication flow is visible in a single file. The algorithm is pinned to HS256.

**Pagination everywhere**, capped at 100 items, so no endpoint can return an unbounded list.

## Security

| Risk | Measure |
|---|---|
| SQL injection | Prisma sends parameterised queries; no raw string-built SQL |
| XSS | JSON-only API, input validated and unknown fields rejected, `helmet` security headers |
| CSRF | The token travels in the `Authorization` header, not in a cookie, so browsers never attach it on their own |
| Brute force | Global rate limit plus a stricter one on `/auth/login` (10 per minute) |
| Mass assignment | `whitelist` and `forbidNonWhitelisted` on every DTO (`balance` or `role` tricks are rejected) |
| Passwords | bcrypt (12 rounds); the hash is never returned |
| User enumeration | Same `401` for unknown user and wrong password, with equal response time; same `409` for duplicate e-mail or NIF |
| Authorization | Role guard on routes plus ownership and participation checks inside use cases |
| Secrets | Required at startup; `JWT_SECRET` must be at least 32 characters |
| Container | Multi-stage image, non-root user, read-only filesystem in production |

## Environment variables

See `.env.example`. The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signing key, at least 32 characters |
| `JWT_EXPIRES_IN` | Token lifetime (default `1h`) |
| `CORS_ORIGIN` | Allowed browser origins, comma separated. Empty allows any (development only) |
| `THROTTLE_LIMIT`, `THROTTLE_TTL_MS` | Global rate limit (default 60 per minute per IP) |
| `THROTTLE_DISABLED` | Tests only. Never set in production |
| `DB_PORT`, `API_PORT` | Host ports published by Docker Compose |

## Requirements covered

| Challenge requirement | Where |
|---|---|
| Register users with unique NIF and e-mail, two user types | `auth`, `users` |
| JWT authentication | `auth` (guard in `jwt-auth.guard.ts`) |
| Providers manage services | `services` |
| Clients book, with a balance check and balance updates for both sides | `bookings`, `wallet` |
| Booking history | `GET /bookings` |
| Permission checks on creating and cancelling | role guard and use cases |
| Atomic balance updates | conditional SQL inside one transaction |
| Free choice of database and ORM | PostgreSQL and Prisma, justified above |

## Assumptions and limits

- The challenge does not say how a client gets balance, so a simulated top-up endpoint was added.
- "Update a booking" is limited to the only meaningful change: cancelling it.
- Insufficient balance answers `409` (the request is valid but conflicts with the account state).
- The NIF format is not specified; any 9 to 14 letters or digits is accepted.
- Migrations run when the container starts, which is safe for one API instance. With several instances, run `prisma migrate deploy` as a separate release step.
- Not implemented: refresh tokens, e-mail verification, a real payment provider.
