import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service({
  title: "Mikrouli URL Shortener API",
})
@server("https://mikrou.li", "Production")
namespace MikrouliApi;

// ---------------------------------------------------------------------------
// Shared models
// ---------------------------------------------------------------------------

model Timestamps {
  createdAt: utcDateTime;
}

// ---------------------------------------------------------------------------
// RFC 9457 Problem Details models
// ---------------------------------------------------------------------------

model ProblemDetails {
  @header("content-type") contentType: "application/problem+json";
  type?: url;
  title?: string;
  status?: integer;
  detail?: string;
  instance?: url;
}

model ValidationErrorItem {
  field: string;
  message: string;
  rule: string;
}

@error
model BadRequestError {
  @statusCode _: 400;
  ...ProblemDetails;
}

@error
model UnauthorizedError {
  @statusCode _: 401;
  ...ProblemDetails;
}

@error
model ForbiddenError {
  @statusCode _: 403;
  ...ProblemDetails;
}

@error
model NotFoundError {
  @statusCode _: 404;
  ...ProblemDetails;
}

@error
model ConflictError {
  @statusCode _: 409;
  ...ProblemDetails;
}

@error
model GoneError {
  @statusCode _: 410;
  ...ProblemDetails;
}

@error
model ValidationError {
  @statusCode _: 422;
  ...ProblemDetails;
  errors: ValidationErrorItem[];
}

@error
model InternalServerError {
  @statusCode _: 500;
  ...ProblemDetails;
}

// ---------------------------------------------------------------------------
// Auth models
// ---------------------------------------------------------------------------

model RegisterRequest {
  @format("email") @maxLength(255) email: string;
  @minLength(8) @maxLength(128) password: string;
}

model RegisterResponse {
  ...Timestamps;
  id: string;
  @format("email") email: string;
}

model LoginRequest {
  @format("email") email: string;
  password: string;
}

model LoginResponse {
  accessToken: string;
  refreshToken: string;
}

model RefreshRequest {
  refreshToken: string;
}

model UserProfile {
  ...Timestamps;
  id: string;
  @format("email") email: string;
}

// ---------------------------------------------------------------------------
// Links models
// ---------------------------------------------------------------------------

model CreateLinkRequest {
  @maxLength(8192) url: string;
  expiresAt?: utcDateTime | null;
}

model PublicLink {
  ...Timestamps;
  shortUrl: string;
  originalUrl: string;
  expiresAt: utcDateTime | null;
}

model LinksList {
  data: PublicLink[];
}

// ---------------------------------------------------------------------------
// API Keys models
// ---------------------------------------------------------------------------

model CreateApiKeyRequest {
  @minLength(1) @maxLength(64) label: string;
}

model ApiKeyCreated {
  ...Timestamps;
  id: string;
  label: string;
  key: string;
  keyPrefix: string;
}

model ApiKeySummary {
  ...Timestamps;
  id: string;
  label: string;
  keyPrefix: string;
  lastUsedAt: utcDateTime | null;
  revokedAt: utcDateTime | null;
}

model ApiKeysList {
  data: ApiKeySummary[];
}

// ---------------------------------------------------------------------------
// Stats models
// ---------------------------------------------------------------------------

model ClickByPeriod {
  period: string;
  clicks: integer;
}

model ClickByCountry {
  country: string;
  clicks: integer;
}

model ClickByBrowser {
  browser: string;
  clicks: integer;
}

model StatsAggregate {
  slug: string;
  totalClicks: integer;
  byDay: ClickByPeriod[];
  byCountry: ClickByCountry[];
  byBrowser: ClickByBrowser[];
}

// ---------------------------------------------------------------------------
// Health and Redirect models
// ---------------------------------------------------------------------------

model HealthResponse {
  status: "ok";
}

model RedirectResponse {
  @statusCode _: 302;
  @header location: string;
}

// ---------------------------------------------------------------------------
// Auth namespace (no auth required)
// ---------------------------------------------------------------------------

@route("/api/auth")
namespace Auth {
  @post
  @route("/register")
  @doc("Register a new user account")
  op register(@body body: RegisterRequest):
    | { @statusCode _: 201; @body body: RegisterResponse; }
    | BadRequestError
    | ConflictError
    | ValidationError;

  @post
  @route("/login")
  @doc("Authenticate and receive JWT tokens")
  op login(@body body: LoginRequest):
    | { @statusCode _: 200; @body body: LoginResponse; }
    | BadRequestError
    | UnauthorizedError;

  @post
  @route("/refresh")
  @doc("Rotate refresh token and issue new token pair")
  op refresh(@body body: RefreshRequest):
    | { @statusCode _: 200; @body body: LoginResponse; }
    | UnauthorizedError;

  @get
  @route("/me")
  @useAuth(BearerAuth)
  @doc("Return authenticated user profile")
  op me():
    | { @statusCode _: 200; @body body: UserProfile; }
    | UnauthorizedError;
}

// ---------------------------------------------------------------------------
// Links namespace (bearer auth)
// ---------------------------------------------------------------------------

@route("/api/urls")
@useAuth(BearerAuth)
namespace Links {
  @post
  @doc("Shorten a URL")
  op create(@body body: CreateLinkRequest):
    | { @statusCode _: 201; @body body: PublicLink; }
    | BadRequestError
    | UnauthorizedError
    | ValidationError;

  @get
  @doc("List authenticated user's short links")
  op list(@query limit?: integer):
    | { @statusCode _: 200; @body body: LinksList; }
    | UnauthorizedError;

  @delete
  @route("/{slug}")
  @doc("Delete a short link by slug")
  op remove(
    @path @pattern("^[A-Za-z0-9_]{6}$") slug: string,
  ):
    | { @statusCode _: 204; }
    | UnauthorizedError
    | ForbiddenError
    | NotFoundError;
}

// ---------------------------------------------------------------------------
// Redirect namespace (public)
// ---------------------------------------------------------------------------

@route("/api")
namespace Redirect {
  @get
  @route("/{slug}")
  @doc("Redirect to original URL for a given slug")
  op redirect(
    @path @pattern("^[A-Za-z0-9_]{6}$") slug: string,
  ):
    | RedirectResponse
    | NotFoundError
    | GoneError;
}

// ---------------------------------------------------------------------------
// API Keys namespace (bearer only)
// ---------------------------------------------------------------------------

@route("/api/api-keys")
@useAuth(BearerAuth)
namespace ApiKeys {
  @post
  @doc("Create a new API key")
  op create(@body body: CreateApiKeyRequest):
    | { @statusCode _: 201; @body body: ApiKeyCreated; }
    | BadRequestError
    | UnauthorizedError
    | ValidationError;

  @get
  @doc("List API keys for the authenticated user")
  op list():
    | { @statusCode _: 200; @body body: ApiKeysList; }
    | UnauthorizedError;

  @delete
  @route("/{id}")
  @doc("Revoke an API key by id")
  op revoke(@path id: string):
    | { @statusCode _: 204; }
    | UnauthorizedError
    | NotFoundError;
}

// ---------------------------------------------------------------------------
// Stats namespace (bearer auth)
// ---------------------------------------------------------------------------

@route("/api/stats")
@useAuth(BearerAuth)
namespace Stats {
  @get
  @route("/{slug}")
  @doc("Get click analytics for a short link")
  op get(
    @path @pattern("^[A-Za-z0-9_]{6}$") slug: string,
  ):
    | { @statusCode _: 200; @body body: StatsAggregate; }
    | UnauthorizedError
    | ForbiddenError
    | NotFoundError;
}

// ---------------------------------------------------------------------------
// Health namespace (public)
// ---------------------------------------------------------------------------

@route("/api/health")
namespace Health {
  @get
  @doc("Service health check")
  op check():
    | { @statusCode _: 200; @body body: HealthResponse; };
}
