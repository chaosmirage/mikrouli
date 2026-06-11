import './instrumentation';
import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
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

function buildHelmetOptions(isProd: boolean): Parameters<typeof helmet>[0] {
  return {
    // HSTS is owned by the k8s production overlay; never by the API layer.
    hsts: false,
    // Apply a strict CSP only in production; dev keeps it disabled so the
    // Swagger UI (only mounted in non-production) loads without inline-script errors.
    contentSecurityPolicy: isProd ? undefined : false,
  };
}

// All routes (including the F3 redirect that lands later) live under /api.
// Nginx rewrites root-level 6-char slug requests (GET /abc123) to
// /api/abc123 so the user-facing URL stays clean while NestJS routing
// is uniform.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  // Access the underlying Express application instance for Express-specific settings.
  const expressApp = app.getHttpAdapter().getInstance() as {
    set(key: string, value: unknown): void;
    disable(key: string): void;
  };

  // 1. Trust the verified proxy hop count before anything reads req.ip.
  //    Default 1 (one nginx hop) matches the compose stack; k8s sets 2
  //    (traefik + web-nginx, both append XFF) via the TRUST_PROXY_HOPS env var.
  const trustProxyHops = Number(process.env['TRUST_PROXY_HOPS'] ?? 1);
  expressApp.set('trust proxy', trustProxyHops);

  // 2. Remove Express's x-powered-by fingerprint before any response goes out.
  expressApp.disable('x-powered-by');

  // 3. Security headers — hsts:false because HSTS is nginx/prod-overlay's job.
  app.use(helmet(buildHelmetOptions(isProd)));

  // 4. Cookie parser must be registered before guards run token extraction.
  app.use(cookieParser());

  // 5. No enableCors() — all stacks are same-origin; credentialed CORS would
  //    only widen the attack surface; allowlist-CORS is the documented future path.

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe(buildValidationPipeOptions()));
  app.useGlobalFilters(new ProblemDetailsFilter(configService));

  // 6. Swagger UI is only available outside production to prevent info disclosure.
  if (!isProd) {
    mountSwagger(app, loadOpenApiDocument());
  }

  await app.listen(HTTP_PORT);
}

bootstrap();
