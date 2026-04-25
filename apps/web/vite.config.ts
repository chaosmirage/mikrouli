/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_DEV_TARGET = 'http://localhost:3000';
const VITE_DEV_PORT = 5173;

const apiProxy = {
  target: API_DEV_TARGET,
  changeOrigin: true,
};

const server = {
  port: VITE_DEV_PORT,
  host: true,
  proxy: { '/api': apiProxy },
};

const build = {
  outDir: 'dist',
};

const coverage = {
  reporter: ['text', 'lcov'],
};

const test = {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
  coverage,
};

export default defineConfig({
  plugins: [react()],
  server,
  build,
  test,
});
