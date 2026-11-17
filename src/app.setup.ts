import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter';

/** Shared by main.ts and the e2e tests, so tests exercise exactly what runs in production. */
export function configureApp(app: INestApplication): void {
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
