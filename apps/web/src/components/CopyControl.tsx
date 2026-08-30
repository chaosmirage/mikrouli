import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { Theme } from '@mui/material/styles';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

// The take's own ground: the control IS its button. The root's one job is to
// anchor the floating statement, so it takes a positioning context and sizes
// itself to the button alone — no confirmation matter ever widens or heightens
// it, which is what keeps the control sitting flush inside its act cluster.
const TAKE_ROOT_SX = { position: 'relative', display: 'inline-flex' } as const;

// The confirmation's floating shape, StatementBand-family: the confirmed
// reading's quiet-bold weight on the raised surface, hairline edge, the
// depth's elevated step, and the family's radius. Anchored above the control
// and stripped of pointer events, so it states the landing without occupying
// flow space (position: absolute) or covering any sibling's click target.
const CONFIRMATION_BASE_SX = {
  position: 'absolute',
  bottom: (theme: Theme) => `calc(100% + ${theme.spacing(0.75)})`,
  left: 0,
  zIndex: 1,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  typography: 'body2',
  fontWeight: 600,
  padding: (theme: Theme) => theme.spacing(0.5, 1.25),
  borderRadius: (theme: Theme) => theme.shape.borderRadius,
  border: (theme: Theme) => `1px solid ${theme.palette.line.hairline}`,
  backgroundColor: (theme: Theme) => theme.palette.surface.raised,
  boxShadow: (theme: Theme) => theme.depth.hover,
} as const;

// The two readings of one take: the landed statement in the success ink, the
// refused statement in the error ink — one floating shape, two inks.
const CONFIRMATION_LANDED_SX = {
  ...CONFIRMATION_BASE_SX,
  color: (theme: Theme) => theme.palette.success.main,
} as const;
const CONFIRMATION_FAILED_SX = {
  ...CONFIRMATION_BASE_SX,
  color: (theme: Theme) => theme.palette.error.main,
} as const;

// The named take: where a surface states the act as a word, the word stands in
// the accent ink at the meta scale — the one saturated element on a calm
// surface, so the act itself is what the eye finds.
const TAKE_WORD_SX = { color: 'accent.solid', typography: 'meta' } as const;

interface CopyControlProps {
  /// The exact text one activation takes onto the clipboard.
  value: string;
  /// Harness address for this instance's take control; the landed and failed
  /// statements derive their addresses from it (`<testId>-landed`), so every
  /// taking in the product stays reachable by its own stable token.
  testId?: string;
  /// When set, the control states its act as this word (accent ink, meta
  /// scale) instead of the icon glyph. The word is the control's own visible
  /// name, so it is not duplicated as an accessible label.
  label?: string;
}

/**
 * The taking control: one activation puts the exact text onto the clipboard,
 * and the landed confirmation stands over the control in the same glance —
 * never a silent write. A refused take states its failure the same way.
 *
 * The confirmation is reflow-free by construction: idle renders nothing at
 * all, and the landed (or refused) statement floats above the control as an
 * absolutely positioned chip that occupies no flow space and intercepts no
 * pointers — so neither the row the control stands in nor anything beside or
 * below it can shift on the landing.
 *
 * Identical wherever a takeable string appears (the result moment, the set's
 * rows, the credential secret, the connect examples): one act, one look, one
 * confirmation. Where the surface names the act as a word, the word replaces
 * the glyph; the act behind it never changes.
 */
export default function CopyControl({ value, testId = 'copy-link', label }: CopyControlProps) {
  const { t } = useTranslation('common');
  const { outcome, copy } = useCopyToClipboard();

  const handleTake = useCallback(() => copy(value), [copy, value]);
  const landed = outcome.status === 'landed';
  const iconOnly = label === undefined;

  return (
    <Box sx={TAKE_ROOT_SX}>
      <IconButton
        size="small"
        aria-label={iconOnly ? t('copy') : undefined}
        onClick={handleTake}
        data-testid={testId}
        sx={iconOnly ? undefined : TAKE_WORD_SX}
      >
        {iconOnly ? <ContentCopyIcon fontSize="small" /> : label}
      </IconButton>
      {/* The floating statement: mounted only once the take resolves, so
          idle leaves the row's flow exactly as it stood. The harness address
          says which reading stands (`-landed` confirmed, `-failed` refused). */}
      {outcome.status !== 'idle' && (
        <Box
          role="status"
          sx={landed ? CONFIRMATION_LANDED_SX : CONFIRMATION_FAILED_SX}
          data-testid={landed ? `${testId}-landed` : `${testId}-failed`}
        >
          {landed ? t('copied') : t('copyFailed')}
        </Box>
      )}
    </Box>
  );
}
