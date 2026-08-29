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

// The confirmed-state reading: the landed statement is quiet ink on a calm
// surface — presence, not loudness, is what makes the landing visible.
const COPY_LANDED_SX = { color: 'success.main', fontWeight: 600 } as const;
const COPY_FAILED_SX = { color: 'error.main' } as const;

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
 * Identical wherever a takeable string appears (the result moment, the set's
 * rows, the credential secret): one act, one look, one confirmation.
 */
export default function CopyControl({ value, testId = 'copy-link' }: CopyControlProps) {
  const { t } = useTranslation('common');
  const { outcome, copy } = useCopyToClipboard();

  const handleTake = useCallback(() => copy(value), [copy, value]);

  return (
    <Stack sx={COPY_ROW_SX}>
      <IconButton
        size="small"
        aria-label={t('copy')}
        onClick={handleTake}
        data-testid={testId}
      >
        <ContentCopyIcon fontSize="small" />
      </IconButton>
      {outcome.status === 'landed' && (
        <Typography
          variant="body2"
          role="status"
          sx={COPY_LANDED_SX}
          data-testid={`${testId}-landed`}
        >
          {t('copied')}
        </Typography>
      )}
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
