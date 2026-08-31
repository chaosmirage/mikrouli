import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotFoundPage from './NotFoundPage';
import AppShell from '../components/AppShell';
import { AuthProvider } from '../auth/AuthContext';
import { withThemeMode } from '../../.storybook/decorators';

// The statement only reads truthfully at an address nothing answers: this
// router lands the page on one, so the supporting line names that address and
// not whichever route a default router happens to hold.
function atUnknownAddress(path: string) {
  return function decorator(Story: () => ReactNode) {
    return <MemoryRouter initialEntries={[path]}>{Story()}</MemoryRouter>;
  };
}

// The statement's real place is inside the shell, so this variant mounts the
// page through the shell's own outlet at an unknown address: navigation stays
// alive around the statement and the return act really navigates.
function insideShell() {
  return function decorator(Story: () => ReactNode) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    return (
      <MemoryRouter initialEntries={['/no-such-address']}>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="*" element={<Story />} />
              </Route>
            </Routes>
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };
}

const meta: Meta<typeof NotFoundPage> = {
  title: 'Pages/NotFoundPage',
  component: NotFoundPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof NotFoundPage>;

// The resolved statement on its own: one title, one supporting line naming
// the visited address in the technical register, and the one accent act
// returning to the shortener. Renders purely from the notFound i18n namespace.
export const Default: Story = {
  decorators: [withThemeMode, atUnknownAddress('/no-such-address')],
};

// The same statement standing inside the shell at an address nothing answers,
// so the composition a visitor actually meets — app bar above, footer below,
// navigation intact — can be seen with the return act live.
export const InsideTheShell: Story = {
  decorators: [withThemeMode, insideShell()],
};
