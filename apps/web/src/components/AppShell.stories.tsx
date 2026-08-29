import type { Meta, StoryObj } from '@storybook/react';
import AppShell from './AppShell';
import { withFullProviders } from '../../.storybook/decorators';

// AppShell uses useAuth (AuthProvider needs a QueryClient above it), renders
// SettingsPanel (which calls useThemeMode), and uses useNavigate.
// withFullProviders provides the complete chain: ThemeModeProvider > ThemedInner
// (ThemeProvider) > Router > QueryClient > Auth, matching the real provider tree.
const meta: Meta<typeof AppShell> = {
  title: 'Components/AppShell',
  component: AppShell,
  decorators: [withFullProviders],
};

export default meta;

type Story = StoryObj<typeof AppShell>;

// Renders the shell in the logged-out (guest) nav state. The global MSW
// handler for GET /api/auth/me returns null by not matching a logged-in
// fixture; this story relies on the default AuthProvider bootstrap that
// resolves the session probe to null (logged out).
export const GuestNav: Story = {};

// Renders the shell in the authenticated nav state. The global MSW handler
// for GET /api/auth/me returns the demo user, so the AuthProvider query
// resolves to a logged-in session and the AuthNav branch renders.
export const AuthNav: Story = {};
