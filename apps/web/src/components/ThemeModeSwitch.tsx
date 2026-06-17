import { useCallback } from 'react';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../theme-mode-context';
import type { ThemeMode } from '../theme-mode-context';

const SELECT_SX = {
  color: 'text.secondary',
  fontSize: '0.875rem',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
} as const;

const OPTIONS: readonly ThemeMode[] = ['light', 'dark', 'follow-system'];

/**
 * Three-way visual-mode selector placed next to LocaleSwitcher in the app bar.
 * Renders the canonical testids the e2e operates against.
 */
export default function ThemeModeSwitch() {
  const { mode, setMode } = useThemeMode();
  const { t } = useTranslation('common');

  const handleChange = useCallback(
    (e: SelectChangeEvent) => {
      setMode(e.target.value as ThemeMode);
    },
    [setMode],
  );

  const inputProps = { 'aria-label': t('themeMode') };

  return (
    <Select
      value={mode}
      onChange={handleChange}
      size="small"
      data-testid="theme-mode-switcher"
      inputProps={inputProps}
      sx={SELECT_SX}
    >
      {OPTIONS.map((opt) => (
        <MenuItem key={opt} value={opt} data-testid={`theme-mode-option-${opt}`}>
          {opt === 'light' && t('themeLight')}
          {opt === 'dark' && t('themeDark')}
          {opt === 'follow-system' && t('themeSystem')}
        </MenuItem>
      ))}
    </Select>
  );
}
