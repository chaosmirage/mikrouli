import type { components, paths } from './openapi-generated';

export type { paths };

// Auth
export type RegisterRequest = components['schemas']['RegisterRequest'];
export type RegisterResponse = components['schemas']['RegisterResponse'];
export type LoginRequest = components['schemas']['LoginRequest'];
export type LoginResponse = components['schemas']['LoginResponse'];
export type RefreshRequest = components['schemas']['RefreshRequest'];
export type MeResponse = components['schemas']['UserProfile'];

// Links
export type CreateLinkRequest = components['schemas']['CreateLinkRequest'];
export type PublicLink = components['schemas']['PublicLink'];
export type LinksListResponse = components['schemas']['LinksList'];

// API Keys
export type CreateApiKeyRequest = components['schemas']['CreateApiKeyRequest'];
export type ApiKeyCreated = components['schemas']['ApiKeyCreated'];
export type ApiKeySummary = components['schemas']['ApiKeySummary'];
export type ApiKeysList = components['schemas']['ApiKeysList'];

// Stats
export type StatsAggregate = components['schemas']['StatsAggregate'];
export type ClickByPeriod = components['schemas']['ClickByPeriod'];
export type ClickByCountry = components['schemas']['ClickByCountry'];
export type ClickByBrowser = components['schemas']['ClickByBrowser'];

// Health
export type HealthResponse = components['schemas']['HealthResponse'];
