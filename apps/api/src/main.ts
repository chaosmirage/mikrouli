import './instrumentation';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';

const HTTP_PORT = 3000;
const OPENAPI_SPEC_PATH = '../spec/tsp-output/@typespec/openapi3/openapi.json';

function loadOpenApiDocument(): Record<string, unknown> {
  const specPath = path.resolve(__dirname, OPENAPI_SPEC_PATH);
  const raw = fs.readFileSync(specPath, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function mountSwagger(app: INestApplication, document: Record<string, unknown>): void {
  // Mount under the /api global prefix so nginx routes correctly.
  SwaggerModule.setup('api/docs', app, document as unknown as OpenAPIObject);
}

function validationExceptionFactory(errors: unknown[]): BadRequestException {
  return new BadRequestException({ kind: 'validation', errors });
}

function buildValidationPipeOptions(): ValidationPipeOptions {
  return {
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationExceptionFactory,
  };
}

// All routes (including the F3 redirect that lands later) live under /api.
// Nginx rewrites root-level 6-char slug requests (GET /abc123) to
// /api/abc123 so the user-facing URL stays clean while NestJS routing
// is uniform.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(buildValidationPipeOptions()));
  app.useGlobalFilters(new ProblemDetailsFilter(configService));
  mountSwagger(app, loadOpenApiDocument());
  await app.listen(HTTP_PORT);
}

bootstrap();
