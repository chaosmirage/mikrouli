import { useQuery } from '@tanstack/react-query';

// Tri-state result for the Guest shorten flag. `loading` is the initial state
// before /config.js resolves; `enabled` is only ever returned when the channel
// explicitly says so; `disabled` is the fail-safe default for every other
// case (flag off, malformed body, network error). Callers MUST hide the form
// unless the state is `enabled`.
export type GuestFlagState = 'loading' | 'enabled' | 'disabled';

interface RuntimeConfig {
  guestShortenEnabled?: unknown;
}

// Parses the text emitted by apps/web/scripts/runtime-config.njs. Strict
// equality on `=== true` avoids truthy fallthrough for strings/numbers that
// might leak in if the channel body is ever malformed. Any parse failure
// resolves to false so the form stays hidden on misconfiguration.
function parseConfigBody(raw: string): boolean {
  try {
    // The njs response assigns to a global; eval is unnecessary and blocked
    // by CSP. Match the boolean literal directly.
    const match = raw.match(/guestShortenEnabled\s*:\s*(true|false)\b/);
    if (!match) return false;
    return match[1] === 'true';
  } catch {
    return false;
  }
}

async function fetchGuestFlag(): Promise<boolean> {
  const response = await fetch('/config.js', { cache: 'no-cache' });
  if (!response.ok) return false;
  const body = await response.text();
  return parseConfigBody(body);
}

// Reads the runtime Guest-shorten flag via @tanstack/react-query. The query
// is the single consumer of the njs-served /config.js channel; components
// consume this hook so the parsing/fail-safe logic lives in one place.
export function useGuestShortenEnabled(): GuestFlagState {
  const query = useQuery({
    queryKey: ['guest-config'],
    queryFn: fetchGuestFlag,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (query.isLoading) return 'loading';
  return query.data === true ? 'enabled' : 'disabled';
}

// Exposed for tests that need to assert the parser in isolation.
export const __parseConfigBody = parseConfigBody;
export type { RuntimeConfig };
