import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CloseIcon from '@mui/icons-material/Close';
import type { SxProps, Theme } from '@mui/material/styles';
import { useThemeMode } from '../theme-mode-context';
import type { ThemeMode } from '../theme-mode-context';

// --- Data structures -------------------------------------------------------

/** One standing inside a settings selection: a held value, its label, and the
 *  width its pill holds so the row of standings reads as one rhythm. */
interface SettingChoice<V extends string> {
  value: V;
  label: string;
  width: number;
}

/** The closed enum of color-mode standings (mirrors the theme-mode store). */
const MODE_VALUES = ['light', 'dark', 'follow-system'] as const satisfies readonly ThemeMode[];

/** The closed enum of language standings (mirrors the supported i18n languages). */
const LANGUAGE_VALUES = ['en', 'de', 'el'] as const;

type LanguageCode = (typeof LANGUAGE_VALUES)[number];

/** Mode standings carry translated labels; language standings carry their own
 *  endonym code, so the pair reads the same in every locale. */
const MODE_LABEL_KEYS: Record<ThemeMode, string> = {
  light: 'themeLight',
  dark: 'themeDark',
  'follow-system': 'themeSystem',
};

const LANGUAGE_CODES: Record<LanguageCode, string> = {
  en: 'EN',
  de: 'DE',
  el: 'ΕΛ',
};

// The standing's held shape: one pill, every one the same height, its width
// fixed by the row it stands in -- so three standings never read as one
// joined control whose equal thirds would misstate the choices as tracks.
const STANDING_HEIGHT = 36;
const LANGUAGE_STANDING_WIDTH = 64;
const MODE_STANDING_WIDTHS: Record<ThemeMode, number> = {
  light: 90,
  dark: 90,
  'follow-system': 150,
};

const modeOptionTestId = (value: ThemeMode) => `settings-mode-option-${value}`;

const languageOptionTestId = (value: LanguageCode) => `settings-language-option-${value}`;

// --- Styling (hoisted; identities are stable across renders) ---------------

/** One small raised paper standing over the veil: the panel's own width. */
const PANEL_WIDTH = 440;

const PANEL_PAPER_PROPS = {
  sx: { maxWidth: `${PANEL_WIDTH}px`, width: '100%' },
} as const;

const TITLE_SX = { pt: 3.5, px: 4, pb: 0 } as const;

// The closing reach: one bare glyph at the title's own corner, so lifting the
// pair never asks a second reading of the panel's content. The offsets are
// the glyph's own corner in the panel, not spacing steps.
const CLOSE_REACH_SX = { position: 'absolute', top: '28px', right: '28px' } as const;
const CLOSE_GLYPH_SX = { fontSize: '0.75rem' } as const;

const CONTENT_SX = { px: 4, pt: 3, pb: 4 } as const;

const GROUP_HEADING_SX = { color: 'ink.muted', lineHeight: 1.5 } as const;

// The current-choice marking on the standing itself: the accent's
// confirmed-state reading — a solid accent fill carrying inverse text. The
// fill is held identically under the pointer and on touch devices, so the
// standing never loses its mark to a hover tint mid-reach.
const CURRENT_CHOICE_SX: SxProps<Theme> = {
  '&.Mui-selected, &.Mui-selected:hover': {
    backgroundColor: 'primary.main',
    color: 'primary.contrastText',
    '@media (hover: none)': { backgroundColor: 'primary.main' },
  },
};

// Each standing holds its row's fixed width and its own confirmed-state
// marking, so the row reads as one rhythm in every locale. Hoisted per value:
// one identity, created once.
const MODE_STANDING_SX: Record<ThemeMode, SxProps<Theme>> = {
  light: { ...CURRENT_CHOICE_SX, width: `${MODE_STANDING_WIDTHS.light}px` },
  dark: { ...CURRENT_CHOICE_SX, width: `${MODE_STANDING_WIDTHS.dark}px` },
  'follow-system': {
    ...CURRENT_CHOICE_SX,
    width: `${MODE_STANDING_WIDTHS['follow-system']}px`,
  },
};

const LANGUAGE_STANDING_SX: SxProps<Theme> = {
  ...CURRENT_CHOICE_SX,
  width: `${LANGUAGE_STANDING_WIDTH}px`,
};

// The standings stand as separate pills with gaps between: content-centered,
// fully rounded, on the neutral chip ground.
const GROUP_STANDINGS_SX: SxProps<Theme> = {
  '& .MuiToggleButtonGroup-grouped': {
    margin: 0.75,
    border: '1px solid transparent',
    borderRadius: '9999px',
    backgroundColor: 'secondary.light',
    color: 'text.primary',
    height: STANDING_HEIGHT,
    padding: 0,
    '&:not(:first-of-type)': {
      borderLeft: '1px solid transparent',
      borderRadius: '9999px',
    },
    '&:not(:last-of-type)': { borderRadius: '9999px' },
  },
};

// --- The homogeneous selection group ----------------------------------------

const modeStandingSx = (value: ThemeMode) => MODE_STANDING_SX[value];

const languageStandingSx = () => LANGUAGE_STANDING_SX;

interface SettingChoiceGroupProps<V extends string> {
  heading: string;
  headingId: string;
  choices: readonly SettingChoice<V>[];
  value: V;
  onSelect: (next: V) => void;
  testIdFor: (value: V) => string;
  standingSxFor: (value: V) => SxProps<Theme>;
}

/**
 * One selection rendered as its standings with the current choice marked.
 * Both selections of the pair render through this single shape so the pair
 * stays homogeneous: a visual divergence would claim a functional difference
 * that does not exist.
 */
function SettingChoiceGroup<V extends string>({
  heading,
  headingId,
  choices,
  value,
  onSelect,
  testIdFor,
  standingSxFor,
}: SettingChoiceGroupProps<V>) {
  const handleChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, next: unknown) => {
      // Re-activating the held standing deselects in the raw group event; the
      // held choice is simply kept — one selection is always held.
      const chosen = choices.find((choice) => choice.value === next);
      if (chosen) onSelect(chosen.value);
    },
    [choices, onSelect],
  );

  return (
    <Box>
      <Typography id={headingId} variant="overline" component="h3" sx={GROUP_HEADING_SX}>
        {heading}
      </Typography>
      <ToggleButtonGroup
        exclusive
        value={value}
        onChange={handleChange}
        aria-labelledby={headingId}
        sx={GROUP_STANDINGS_SX}
      >
        {choices.map((choice) => (
          <ToggleButton
            key={choice.value}
            value={choice.value}
            data-testid={testIdFor(choice.value)}
            sx={standingSxFor(choice.value)}
          >
            {choice.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

// --- The panel ---------------------------------------------------------------

export interface SettingsPanelProps {
  /** Whether the pair stands open over the user's place. */
  open: boolean;
  /** Called when the pair closes; the occupied place is never navigated away. */
  onClose: () => void;
}

const MODE_HEADING_ID = 'settings-mode-heading';
const LANGUAGE_HEADING_ID = 'settings-language-heading';
const TITLE_ID = 'settings-title';

/**
 * The setting pair: color mode and language staged together as one small
 * raised panel standing over the occupied place. It is presentation over the
 * two standing stores (the theme-mode context and the i18n instance) —
 * selections write straight through and the whole product obeys at once;
 * closing returns the user to the place they never left.
 */
export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { mode, setMode } = useThemeMode();
  const { t, i18n } = useTranslation('common');

  const handleSelectMode = useCallback((next: ThemeMode) => setMode(next), [setMode]);

  const handleSelectLanguage = useCallback(
    (next: LanguageCode) => {
      void i18n.changeLanguage(next);
    },
    [i18n],
  );

  const modeChoices = MODE_VALUES.map((value) => ({
    value,
    label: t(MODE_LABEL_KEYS[value]),
    width: MODE_STANDING_WIDTHS[value],
  }));
  const languageChoices = LANGUAGE_VALUES.map((value) => ({
    value,
    label: LANGUAGE_CODES[value],
    width: LANGUAGE_STANDING_WIDTH,
  }));

  // The current language is read through the closed enum: an unrecognized
  // resolved language falls back to English rather than rendering raw.
  const currentLanguage =
    LANGUAGE_VALUES.find((code) => code === i18n.resolvedLanguage) ??
    LANGUAGE_VALUES.find((code) => code === i18n.language) ??
    'en';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      data-testid="settings-panel"
      aria-labelledby={TITLE_ID}
      PaperProps={PANEL_PAPER_PROPS}
    >
      <DialogTitle id={TITLE_ID} variant="h4" sx={TITLE_SX}>
        {t('settings')}
      </DialogTitle>
      <IconButton
        onClick={onClose}
        aria-label={t('closeSettings')}
        data-testid="settings-close"
        size="small"
        sx={CLOSE_REACH_SX}
      >
        <CloseIcon sx={CLOSE_GLYPH_SX} />
      </IconButton>
      <DialogContent sx={CONTENT_SX}>
        <Stack spacing={4.5}>
          <SettingChoiceGroup
            heading={t('themeMode')}
            headingId={MODE_HEADING_ID}
            choices={modeChoices}
            value={mode}
            onSelect={handleSelectMode}
            testIdFor={modeOptionTestId}
            standingSxFor={modeStandingSx}
          />
          <SettingChoiceGroup
            heading={t('language')}
            headingId={LANGUAGE_HEADING_ID}
            choices={languageChoices}
            value={currentLanguage}
            onSelect={handleSelectLanguage}
            testIdFor={languageOptionTestId}
            standingSxFor={languageStandingSx}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
