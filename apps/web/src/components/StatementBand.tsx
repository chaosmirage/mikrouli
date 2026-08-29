import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import type { AlertColor } from '@mui/material/Alert';
import { extractErrorMessage } from '../api/client';

/**
 * The aftermath of one act, stated as exactly one of four kinds. The union is
 * discriminated so an impossible combination (under way and failed at once)
 * cannot be expressed, and `cause` stays `unknown` because it is whatever the
 * call threw: the band resolves it through the shared problem-details
 * extraction (RFC 9457 messages), it never renders the thrown value raw.
 */
export type StatementBandState =
  | { readonly kind: 'underway' }
  | { readonly kind: 'landed' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'failure'; readonly cause: unknown };

export interface StatementBandProps {
  /** The aftermath to state, or null when there is nothing to state yet. */
  readonly state: StatementBandState | null;
  /** Translation key stating this act's own under-way register (namespace-prefixed keys allowed). */
  readonly underwayKey?: string;
  /** Translation key stating this act's own landed confirmation; defaults to the shared copied statement. */
  readonly landedKey?: string;
  /** Translation key stating this surface's own empty register (namespace-prefixed keys allowed). */
  readonly emptyKey?: string;
}

interface ResolvedStatement {
  readonly severity: AlertColor;
  readonly message: string;
}

type Translate = (key: string) => string;

interface StatementKeyOverrides {
  readonly underwayKey?: string;
  readonly landedKey?: string;
  readonly emptyKey?: string;
}

/**
 * Resolves one aftermath kind into the register it states itself at and the
 * message the reader sees. Each kind carries its own severity step and its own
 * statement source; a refusal is always the resolved problem-details message,
 * never a raw code and never an echoed payload.
 */
function resolveStatement(
  state: StatementBandState,
  t: Translate,
  overrides: StatementKeyOverrides,
): ResolvedStatement {
  switch (state.kind) {
    case 'underway':
      return { severity: 'info', message: t(overrides.underwayKey ?? 'statementUnderway') };
    case 'landed':
      return { severity: 'success', message: t(overrides.landedKey ?? 'copied') };
    case 'empty':
      return { severity: 'warning', message: t(overrides.emptyKey ?? 'statementEmpty') };
    case 'failure':
      return { severity: 'error', message: extractErrorMessage(state.cause) };
  }
}

/**
 * The one aftermath vehicle: every asynchronous act's statement — under way,
 * empty, landed, refused — stands in this band beside the act that caused it,
 * in the active locale. Rendering is MUI Alert under the theme's centralized
 * token overrides; the band adds no styling of its own, so every visual value
 * stays owned by the theme.
 */
export default function StatementBand({
  state,
  underwayKey,
  landedKey,
  emptyKey,
}: StatementBandProps) {
  const { t } = useTranslation('common');
  if (state === null) return null;
  const statement = resolveStatement(state, t, { underwayKey, landedKey, emptyKey });
  return (
    <Alert severity={statement.severity} data-testid="statement-band">
      {statement.message}
    </Alert>
  );
}
