import type { components } from './openapi-generated';

// Auth
export type RegisterRequest = components['schemas']['RegisterRequest'];
export type RegisterResponse = components['schemas']['RegisterResponse'];

export type LoginRequest = components['schemas']['LoginRequest'];
// Login and refresh both return UserProfile; tokens travel in HttpOnly cookies.
export type LoginResponse = components['schemas']['UserProfile'];
export type RefreshResponse = components['schemas']['UserProfile'];

export type MeResponse = components['schemas']['UserProfile'];

// Links
export type CreateLinkRequest = components['schemas']['CreateLinkRequest'];
export type CreateLinkResponse = components['schemas']['PublicLink'];
export type LinksListResponse = components['schemas']['LinksList'];
export type PublicLinkSchema = components['schemas']['PublicLink'];

// API Keys
export type CreateApiKeyRequest = components['schemas']['CreateApiKeyRequest'];
export type CreateApiKeyResponse = components['schemas']['ApiKeyCreated'];
export type ApiKeysListResponse = components['schemas']['ApiKeysList'];
export type ApiKeySummarySchema = components['schemas']['ApiKeySummary'];

// Stats
export type StatsAggregateResponse = components['schemas']['StatsAggregate'];

// Health
export type HealthCheckResponse = components['schemas']['HealthResponse'];

// Usage
export type UsageSummaryResponse = components['schemas']['UsageSummary'];
