import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { SxProps, Theme } from '@mui/material/styles';
import { useThemeMode } from '../theme-mode-context';
import type { ThemeMode } from '../theme-mode-context';

// --- Data structures -------------------------------------------------------

/** One standing inside a settings selection: a held value plus its label. */
interface SettingChoice<V extends string> {
  value: V;
  label: string;
}

/** The closed enum of color-mode standings (mirrors the theme-mode store). */
const MODE_VALUES = ['light', 'dark', 'follow-system'] as const satisfies readonly ThemeMode[];

/** The closed enum of language standings (mirrors the supported i18n languages). */
const LANGUAGE_VALUES = ['en', 'de', 'el'] as const;

type LanguageCode = (typeof LANGUAGE_VALUES)[number];

/** Mode standings carry translated labels; language standings carry endonyms
 *  (a language is named in itself in every locale). */
const MODE_LABEL_KEYS: Record<ThemeMode, string> = {
  light: 'themeLight',
  dark: 'themeDark',
  'follow-system': 'themeSystem',
};

const LANGUAGE_ENDONYMS: Record<LanguageCode, string> = {
  en: 'English',
  de: 'Deutsch',
  el: 'Ελληνικά',
};

const modeOptionTestId = (value: ThemeMode) => `settings-mode-option-${value}`;

const languageOptionTestId = (value: LanguageCode) => `settings-language-option-${value}`;

// --- Styling (hoisted; identities are stable across renders) ---------------

const GROUP_HEADING_SX = { color: 'text.secondary' } as const;

const GROUP_BUTTONS_SX = { pt: 1 } as const;

// The current-choice marking: the accent's confirmed-state reading — a solid
// accent fill carrying inverse text. The fill is held identically under the
// pointer and on touch devices, so the standing never loses its mark to a
// hover tint mid-reach.
const CURRENT_CHOICE_SX: SxProps<Theme> = {
  '&.Mui-selected, &.Mui-selected:hover': {
    backgroundColor: 'primary.main',
    color: 'primary.contrastText',
    '@media (hover: none)': { backgroundColor: 'primary.main' },
  },
};

// --- The homogeneous selection group ----------------------------------------

interface SettingChoiceGroupProps<V extends string> {
  heading: string;
  headingId: string;
  choices: readonly SettingChoice<V>[];
  value: V;
  onSelect: (next: V) => void;
  testIdFor: (value: V) => string;
}

/**
 * One selection rendered as three standings with the current choice marked.
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
        fullWidth
        value={value}
        onChange={handleChange}
        aria-labelledby={headingId}
        sx={GROUP_BUTTONS_SX}
      >
        {choices.map((choice) => (
          <ToggleButton
            key={choice.value}
            value={choice.value}
            data-testid={testIdFor(choice.value)}
            sx={CURRENT_CHOICE_SX}
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
 * The setting pair: color mode and language staged together as one panel
 * standing over the occupied place. It is presentation over the two standing
 * stores (the theme-mode context and the i18n instance) — selections write
 * straight through and the whole product obeys at once; closing returns the
 * user to the place they never left.
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
  }));
  const languageChoices = LANGUAGE_VALUES.map((value) => ({
    value,
    label: LANGUAGE_ENDONYMS[value],
  }));

  // The current language is read through the closed enum: an unrecognized
  // resolved language falls back to English rather than rendering raw.
  const currentLanguage =
    LANGUAGE_VALUES.find((code) => code === i18n.resolvedLanguage) ??
    LANGUAGE_VALUES.find((code) => code === i18n.language) ??
    'en';

  return (
    <Dialog open={open} onClose={onClose} data-testid="settings-panel" aria-labelledby={TITLE_ID}>
      <DialogTitle id={TITLE_ID}>{t('settings')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <SettingChoiceGroup
            heading={t('themeMode')}
            headingId={MODE_HEADING_ID}
            choices={modeChoices}
            value={mode}
            onSelect={handleSelectMode}
            testIdFor={modeOptionTestId}
          />
          <SettingChoiceGroup
            heading={t('language')}
            headingId={LANGUAGE_HEADING_ID}
            choices={languageChoices}
            value={currentLanguage}
            onSelect={handleSelectLanguage}
            testIdFor={languageOptionTestId}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="settings-close">
          {t('closeSettings')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
