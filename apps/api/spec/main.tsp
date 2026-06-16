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

// Cookie-based auth scheme for the browser SPA. The access token travels in
// an HttpOnly cookie so page scripts cannot read it.
alias CookieAuth = ApiKeyAuth<ApiKeyLocation.cookie, "mikrouli_access">;

// Machine API-key scheme: the x-api-key header accepted by ApiKeyAuthGuard.
// Generates an OpenAPI 3.0 securitySchemes entry: type=apiKey, in=header.
// Declared as a model (not an alias) so the OpenAPI emitter produces a single
// named securityScheme entry shared across all namespaces that reference it.
model ApiKeyHeaderAuth {
  @doc("API key passed in the x-api-key request header")
  type: "apiKey";
  in: ApiKeyLocation.header;
  name: "x-api-key";
}

// Links/Stats namespaces: the guard is BearerOrApiKeyGuard — accepts cookie,
// bearer JWT, and the x-api-key header. Truthfully documents all three paths.
alias BrowserOrMachineAuth = CookieAuth | BearerAuth | ApiKeyHeaderAuth;

// Auth/ApiKeys namespaces: the guard is JwtAuthGuard only — accepts cookie and
// bearer JWT but NOT x-api-key (key management stays human-session-gated).
alias BrowserSessionAuth = CookieAuth | BearerAuth;

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

@error
model TooManyRequestsError {
  @statusCode _: 429;
  ...ProblemDetails;
}

// ---------------------------------------------------------------------------
// Usage models
// ---------------------------------------------------------------------------

model UsageSummary {
  linksCreated: integer;
  linkLimit: integer;
  linksRemaining: integer;
  keysCreated: integer;
  keyLimit: integer;
  keysRemaining: integer;
  resetDate: utcDateTime;
  retentionMs: integer;
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

// Session response: tokens leave the body and arrive as HttpOnly cookies set
// by the server. The body carries the user profile so the SPA can render
// immediately without a follow-up /me call.
model SessionResponse {
  @statusCode _: 200;
  @header("set-cookie") accessCookie: string;
  @header("set-cookie") refreshCookie: string;
  @body body: UserProfile;
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
    | ValidationError;

  @post
  @route("/login")
  @doc("Authenticate with credentials; sets HttpOnly session cookies on success")
  op login(@body body: LoginRequest):
    | SessionResponse
    | BadRequestError
    | UnauthorizedError;

  @post
  @route("/refresh")
  @doc("Rotate the refresh token cookie and issue a new session cookie pair")
  op refresh():
    | SessionResponse
    | UnauthorizedError;

  @post
  @route("/logout")
  @useAuth(BrowserSessionAuth)
  @doc("Revoke the current session and clear the session cookies")
  op logout():
    | { @statusCode _: 204; }
    | UnauthorizedError;

  @get
  @route("/me")
  @useAuth(BrowserSessionAuth)
  @doc("Return authenticated user profile")
  op me():
    | { @statusCode _: 200; @body body: UserProfile; }
    | UnauthorizedError;

  @get
  @route("/github")
  @doc("Redirect browser to GitHub OAuth authorization page; mints a one-time CSRF state token")
  op githubAuthorize():
    | { @statusCode _: 302; @header location: string; }
    | InternalServerError;

  @get
  @route("/github/callback")
  @doc("OAuth callback from GitHub; validates state, exchanges code, resolves account, sets session cookies, redirects to SPA")
  op githubCallback(
    @query code?: string,
    @query state?: string,
    @query error?: string,
  ):
    | {
        @statusCode _: 302;
        @header location: string;
        @header("set-cookie") accessCookie?: string;
        @header("set-cookie") refreshCookie?: string;
      }
    | InternalServerError;
}

// ---------------------------------------------------------------------------
// Links namespace (bearer auth)
// ---------------------------------------------------------------------------

@route("/api/urls")
@useAuth(BrowserOrMachineAuth)
namespace Links {
  @post
  @doc("Shorten a URL")
  op create(@body body: CreateLinkRequest):
    | { @statusCode _: 201; @body body: PublicLink; }
    | BadRequestError
    | UnauthorizedError
    | ValidationError
    | TooManyRequestsError;

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
// API Keys namespace (human-session-gated only; NOT machine API-key)
// ---------------------------------------------------------------------------

@route("/api/api-keys")
@useAuth(BrowserSessionAuth)
namespace ApiKeys {
  @post
  @doc("Create a new API key")
  op create(@body body: CreateApiKeyRequest):
    | { @statusCode _: 201; @body body: ApiKeyCreated; }
    | BadRequestError
    | UnauthorizedError
    | ValidationError
    | TooManyRequestsError;

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
@useAuth(BrowserOrMachineAuth)
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

// ---------------------------------------------------------------------------
// Usage namespace (human-session-gated only; NOT machine API-key)
// ---------------------------------------------------------------------------

@route("/api/usage")
@useAuth(BrowserSessionAuth)
namespace Usage {
  @get
  @doc("Return the authenticated user's monthly quota consumption and allowance for the current calendar month")
  op get():
    | { @statusCode _: 200; @body body: UsageSummary; }
    | UnauthorizedError;
}
