import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bulir Bookings API')
    .setDescription('Service bookings platform: clients book services from providers using an internal balance.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
