// Runtime configuration channel served by nginx + njs at /config.js.
//
// Emits a single boolean (guestShortenEnabled) so the SPA can render the
// landing-page shorten form only when the operator has enabled Guest
// shortening. Reading the env var here (per request) keeps the flag
// toggleable without an SPA rebuild: change the value, restart nginx (or
// the SPA container / dev edge), and the next /config.js reflects it.
//
// Strict equality on the lowercased string "true" avoids truthy fallthrough
// for values like "1", "yes", or accidental empty strings. Anything that is
// not exactly "true" (case-insensitive) resolves to false so the form stays
// hidden on misconfiguration (fail-safe default).
//
// Only this one field is emitted. process.env is never dumped wholesale and
// no other configuration, secret, or PII leaves the server through this
// endpoint.

const ENV_VAR = 'GUEST_SHORTEN_ENABLED';
const DEFAULT_RAW = 'true';

function emit(r) {
  const raw = process.env[ENV_VAR];
  const enabled = String(raw ?? DEFAULT_RAW).toLowerCase() === 'true';
  r.headersOut['Content-Type'] = 'application/javascript';
  r.headersOut['Cache-Control'] = 'no-cache';
  r.return(200, 'window.__MIKROULI_CONFIG__ = { guestShortenEnabled: ' + enabled + ' };\n');
}

export default { emit };
