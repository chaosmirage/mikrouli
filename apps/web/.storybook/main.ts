import type { StorybookConfig } from '@storybook/react-vite';

// Storybook build configuration for the web workspace.
// The react-vite framework picks up apps/web/vite.config.ts automatically,
// reusing the existing Vite plugin chain (including @vitejs/plugin-react).
// The dev proxy in vite.config.ts is inert when no backend is running,
// which is the expected state for isolated component development.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  staticDirs: ['../public'],
  addons: ['@storybook/addon-toolbars', 'msw-storybook-addon'],
  core: {
    // Prevent phone-home telemetry from dev and CI environments.
    disableTelemetry: true,
  },
};

export default config;
