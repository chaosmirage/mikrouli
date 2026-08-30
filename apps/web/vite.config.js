/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var API_DEV_TARGET = 'http://localhost:3000';
var VITE_DEV_PORT = 5173;
var apiProxy = {
    target: API_DEV_TARGET,
    changeOrigin: true,
};
var server = {
    port: VITE_DEV_PORT,
    host: true,
    // Trailing slash matters: `/api` (no slash) would also intercept the SPA
    // route `/api-keys` and try to proxy it to the API. `/api/` only matches
    // actual API paths and lets `/api-keys` fall through to vite's SPA handler.
    proxy: { '/api/': apiProxy },
};
var build = {
    outDir: 'dist',
};
var coverage = {
    reporter: ['text', 'lcov'],
};
var test = {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: coverage,
};
export default defineConfig({
    plugins: [react()],
    server: server,
    build: build,
    test: test,
});
