import { NestFactory } from '@nestjs/core';
import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { AppModule } from './app.module';

const HTTP_PORT = 3000;

const validationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
};

// All routes (including the F3 redirect that lands later) live under /api.
// Nginx rewrites root-level 6-char slug requests (GET /abc123) to
// /api/abc123 so the user-facing URL stays clean while NestJS routing
// is uniform.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(validationPipeOptions));
  await app.listen(HTTP_PORT);
}

bootstrap();
