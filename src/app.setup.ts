import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter';

/** Shared by main.ts and the e2e tests, so tests exercise exactly what runs in production. */
export function configureApp(app: INestApplication): void {
  // Behind a reverse proxy (Render, nginx) every request would otherwise appear to come from the
  // proxy's IP, so the rate limiter would share ONE bucket across all users. TRUST_PROXY is the
  // number of proxy hops to trust (Render: 1). Unset = trust none (safe default, no header spoofing).
  const hops = Number(process.env.TRUST_PROXY);
  if (Number.isInteger(hops) && hops > 0) {
    (app.getHttpAdapter().getInstance() as { set: (k: string, v: number) => void }).set('trust proxy', hops);
  }
  app.use(helmet());
  // CORS_ORIGIN="https://a.com,https://b.com". Empty or unset allows any origin (development only).
  const origins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : true });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // ...and reject the request if any were sent (blocks mass assignment)
      transform: true,
    }),
  );
}
