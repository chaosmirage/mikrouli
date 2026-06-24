import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import { AuthProvider } from '../src/auth/AuthContext';
import { ThemeModeProvider, useThemeMode } from '../src/theme-mode-context';
import { createAppTheme } from '../src/theme';

function ThemedInner({ children }: { children: ReactNode }) {
  const { effectiveMode } = useThemeMode();
  return (
    <ThemeProvider theme={createAppTheme(effectiveMode)}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

// --- Composable decorator factories ---
// Each wraps the Story in a single provider. Compose them in the correct
// nesting order in each story's `decorators` array: outermost first.

export function withQueryClient(Story: () => ReactNode): React.JSX.Element {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  );
}

export function withAuth(Story: () => ReactNode): React.JSX.Element {
  return (
    <AuthProvider>
      <Story />
    </AuthProvider>
  );
}

export function withThemeMode(Story: () => ReactNode): React.JSX.Element {
  return (
    <ThemeModeProvider>
      <ThemedInner>
        <Story />
      </ThemedInner>
    </ThemeModeProvider>
  );
}

export function withRouter(Story: () => ReactNode): React.JSX.Element {
  return (
    <MemoryRouter>
      <Story />
    </MemoryRouter>
  );
}

export function withContainer(maxWidth: 'sm' | 'md' | 'lg' | false = 'lg') {
  return function withContainerInner(Story: () => ReactNode): React.JSX.Element {
    return (
      <Container maxWidth={maxWidth} sx={{ py: 5 }}>
        <Story />
      </Container>
    );
  };
}

// --- Combined page decorators ---
// These wrap all required providers in a SINGLE decorator function to
// guarantee correct nesting order, avoiding any Storybook decorator
// composition ambiguity.

// Authenticated page: Router > QueryClient > Auth > Container > Story.
// Used by Dashboard, Stats, ApiKeys, Usage.
export function withAuthPage(
  Story: () => ReactNode,
): React.JSX.Element {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Container maxWidth="lg" sx={{ py: 5 }}>
            <Story />
          </Container>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// Authenticated page with custom router (e.g. /stats/:slug).
export function withAuthPageCustomRouter(
  initialEntries: string[],
  maxWidth: 'sm' | 'md' | 'lg' | false = 'lg',
) {
  return function decorator(Story: () => ReactNode): React.JSX.Element {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <Container maxWidth={maxWidth} sx={{ py: 5 }}>
              <Story />
            </Container>
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };
}

// Guest page with auth: Router > QueryClient > Auth > Story (no Container —
// the page manages its own layout). Used by Landing, Login, Register.
export function withGuestPage(Story: () => ReactNode): React.JSX.Element {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Story />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// Static page (no auth, no query): Router > Story. Used by Terms, Privacy.
export function withStaticPage(Story: () => ReactNode): React.JSX.Element {
  return (
    <MemoryRouter>
      <Story />
    </MemoryRouter>
  );
}

// Component that needs the full theme-mode chain + router + query + auth.
// Used by AppShell (calls useThemeMode, useNavigate, useAuth).
export function withFullProviders(Story: () => ReactNode): React.JSX.Element {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <ThemeModeProvider>
      <ThemedInner>
        <MemoryRouter>
          <QueryClientProvider client={client}>
            <AuthProvider>
              <Story />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      </ThemedInner>
    </ThemeModeProvider>
  );
}
