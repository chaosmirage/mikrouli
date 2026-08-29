// The single canonical short-URL resolver for the web app. The API stores
// `shortUrl` as a bare slug ("GYa6kx"); the public URL is produced by
// composing it with the current origin. Pre-resolved URLs (test fixtures,
// future API change) are passed through unchanged. Every surface that renders
// a short address (ShortenCard's result moment, the dashboard link rows)
// reads this one implementation — no parallel hand-rolled copies.
export function resolveFullShortUrl(raw: string): string {
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.trim();
  if (typeof window === 'undefined') return raw;
  const origin = window.location.origin;
  if (!origin || origin === 'null') return raw;
  return `${origin}/${raw}`;
}
