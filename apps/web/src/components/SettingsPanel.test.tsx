import { describe, it, expect, afterEach } from 'vitest';
import { useState, useCallback } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import i18next from 'i18next';
import { ThemeModeProvider } from '../theme-mode-context';
import { createAppTheme } from '../theme';
import SettingsPanel from './SettingsPanel';

const THEME_STORAGE_KEY = 'mikrouli.themeMode';

// The pair renders under the product's own theme, so a marking read through a
// palette token can be observed exactly as the running app resolves it.
const LIGHT_THEME = createAppTheme('light');
const DARK_THEME = createAppTheme('dark');

const noop = () => undefined;

function renderPanel(open = true, onClose: () => void = noop, theme = LIGHT_THEME) {
  return render(
    <ThemeProvider theme={theme}>
      <ThemeModeProvider>
        <SettingsPanel open={open} onClose={onClose} />
      </ThemeModeProvider>
    </ThemeProvider>,
  );
}

// The shell wires the panel as a controlled dialog; the close contract is
// observed through the same wiring (the host drops `open` on close).
function PanelHost() {
  const [open, setOpen] = useState(true);
  const handleClose = useCallback(() => setOpen(false), []);
  return (
    <>
      <p data-testid="kept-place">the standing page</p>
      <SettingsPanel open={open} onClose={handleClose} />
    </>
  );
}

describe('SettingsPanel', () => {
  afterEach(async () => {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    await act(async () => {
      await i18next.changeLanguage('en');
    });
  });

  it('presents both selections of the pair with all their standings', () => {
    renderPanel();
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    expect(screen.getByTestId('settings-mode-option-light')).toBeInTheDocument();
    expect(screen.getByTestId('settings-mode-option-dark')).toBeInTheDocument();
    expect(screen.getByTestId('settings-mode-option-follow-system')).toBeInTheDocument();
    expect(screen.getByTestId('settings-language-option-en')).toBeInTheDocument();
    expect(screen.getByTestId('settings-language-option-de')).toBeInTheDocument();
    expect(screen.getByTestId('settings-language-option-el')).toBeInTheDocument();
  });

  it('names the language standings in their own codes', () => {
    renderPanel();
    expect(screen.getByTestId('settings-language-option-en')).toHaveTextContent('EN');
    expect(screen.getByTestId('settings-language-option-de')).toHaveTextContent('DE');
    expect(screen.getByTestId('settings-language-option-el')).toHaveTextContent('ΕΛ');
  });

  it('marks the current mode choice and the current language choice', () => {
    renderPanel();
    expect(screen.getByTestId('settings-mode-option-follow-system')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('settings-mode-option-dark')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId('settings-language-option-en')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('settings-language-option-de')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('marks the current choice of both selections with the solid accent fill and inverse text', () => {
    renderPanel();

    // The current standing carries the accent's confirmed-state reading: a
    // solid accent fill carrying inverse text, read from the palette tokens.
    expect(screen.getByTestId('settings-mode-option-follow-system')).toHaveStyle({
      backgroundColor: LIGHT_THEME.palette.primary.main,
      color: LIGHT_THEME.palette.primary.contrastText,
    });
    expect(screen.getByTestId('settings-language-option-en')).toHaveStyle({
      backgroundColor: LIGHT_THEME.palette.primary.main,
      color: LIGHT_THEME.palette.primary.contrastText,
    });

    // The superseded standings carry no accent fill: the mark names exactly
    // the current choice, never the whole row.
    expect(screen.getByTestId('settings-mode-option-dark')).not.toHaveStyle({
      backgroundColor: LIGHT_THEME.palette.primary.main,
    });
    expect(screen.getByTestId('settings-language-option-de')).not.toHaveStyle({
      backgroundColor: LIGHT_THEME.palette.primary.main,
    });
  });

  it('marks the current choice in the dark mode reading of the same accent', () => {
    // The confirmed-state reading is a relation the system states in both
    // modes: the same marking, resolved through the dark mode's tokens.
    renderPanel(true, noop, DARK_THEME);
    expect(screen.getByTestId('settings-mode-option-follow-system')).toHaveStyle({
      backgroundColor: DARK_THEME.palette.primary.main,
      color: DARK_THEME.palette.primary.contrastText,
    });
    expect(screen.getByTestId('settings-language-option-en')).toHaveStyle({
      backgroundColor: DARK_THEME.palette.primary.main,
      color: DARK_THEME.palette.primary.contrastText,
    });
  });

  it('a mode selection is written through the standing mode store', () => {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    renderPanel();
    fireEvent.click(screen.getByTestId('settings-mode-option-dark'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('a language selection is obeyed by every rendered statement', async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('settings-language-option-de'));
    await waitFor(() =>
      expect(screen.getByTestId('settings-close')).toHaveAccessibleName('Fertig'),
    );
    expect(screen.getByText('Einstellungen')).toBeInTheDocument();
  });

  it('one activation of the closing lifts the pair while the place beneath stands', async () => {
    render(
      <ThemeModeProvider>
        <PanelHost />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-close'));
    // The lift is a brief departure motion; the pair is gone once it settles.
    await waitFor(() =>
      expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('kept-place')).toBeInTheDocument();
  });

  it('presents no standings while closed', () => {
    renderPanel(false);
    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-mode-option-light')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-language-option-en')).not.toBeInTheDocument();
  });
});
