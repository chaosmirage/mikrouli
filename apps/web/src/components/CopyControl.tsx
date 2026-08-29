import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

// Static sx objects hoisted to module scope so every render reuses one object
// identity (MUI re-renders on sx reference change).
const COPY_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  minWidth: 0,
} as const;

// The confirmation's ONE typographic shape: the quiet-bold weight of the
// confirmed reading, carried by BOTH states. The reserved slot is then
// already sized for the exact reading that lands into it — the take flips
// only color and visibility, never the slot's width contribution to the row.
const COPY_CONFIRMATION_TYPOGRAPHY_SX = { fontWeight: 600 } as const;

// The confirmed-state reading: the landed statement is quiet ink on a calm
// surface — presence, not loudness, is what makes the landing visible.
const COPY_LANDED_SX = { ...COPY_CONFIRMATION_TYPOGRAPHY_SX, color: 'success.main' } as const;
const COPY_FAILED_SX = { color: 'error.main' } as const;

// The confirmation's reserved place: the same statement stands from the
// first paint with visibility alone carrying the state, so the landing
// appears INTO space the row already owned — a visibility change cannot
// reflow layout, so the confirmation container keeps its height (and its
// width) across idle and landed, whatever stands beside or below the take.
const COPY_RESERVED_SX = { ...COPY_CONFIRMATION_TYPOGRAPHY_SX, visibility: 'hidden' } as const;

interface CopyControlProps {
  /// The exact text one activation takes onto the clipboard.
  value: string;
  /// Harness address for this instance's take control; the landed and failed
  /// statements derive their addresses from it (`<testId>-landed`), so every
  /// taking in the product stays reachable by its own stable token.
  testId?: string;
}

/**
 * The taking control: one activation puts the exact text onto the clipboard,
 * and the landed confirmation stands BESIDE the control in the same glance —
 * never a silent write. A refused take states its failure the same way.
 *
 * The confirmation is reflow-free: its place is reserved from the first
 * paint (the statement stands hidden until the take lands), so the row —
 * and everything below it — never shifts on the landing.
 *
 * Identical wherever a takeable string appears (the result moment, the set's
 * rows, the credential secret, the connect examples): one act, one look, one
 * confirmation.
 */
export default function CopyControl({ value, testId = 'copy-link' }: CopyControlProps) {
  const { t } = useTranslation('common');
  const { outcome, copy } = useCopyToClipboard();

  const handleTake = useCallback(() => copy(value), [copy, value]);
  const landed = outcome.status === 'landed';

  return (
    <Stack sx={COPY_ROW_SX}>
      <IconButton size="small" aria-label={t('copy')} onClick={handleTake} data-testid={testId}>
        <ContentCopyIcon fontSize="small" />
      </IconButton>
      {/* The reserved slot: the same element in both states, so the take
          lands into the row's own space. The harness address says which
          state stands (`-confirmation` reserved, `-landed` visible). */}
      <Typography
        variant="body2"
        role="status"
        sx={landed ? COPY_LANDED_SX : COPY_RESERVED_SX}
        data-testid={landed ? `${testId}-landed` : `${testId}-confirmation`}
      >
        {t('copied')}
      </Typography>
      {outcome.status === 'failed' && (
        <Typography
          variant="body2"
          role="status"
          sx={COPY_FAILED_SX}
          data-testid={`${testId}-failed`}
        >
          {t('copyFailed')}
        </Typography>
      )}
    </Stack>
  );
}
