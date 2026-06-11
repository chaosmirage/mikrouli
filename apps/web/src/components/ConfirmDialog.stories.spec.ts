/**
 * Verifies that the Storybook build artifact contains the ConfirmDialog story.
 *
 * The user-closest observable seam for this integration is the static build
 * output: `storybook-static/` must exist and its story index must include an
 * entry for the ConfirmDialog component.
 *
 * Run `pnpm --filter web build-storybook` before this suite to populate the
 * artifact under test. When the artifact is absent the suite skips rather than
 * fails, because build-artifact presence is enforced by the build-storybook
 * gate, not the unit-test gate.
 *
 * Limitation: this test is deterministic (filesystem checks, not a browser) —
 * it cannot verify that the story *renders* in a live browser iframe. Live
 * rendering is a manual observation.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// __dirname is apps/web/src/components — two levels up reaches apps/web
const STORYBOOK_STATIC = resolve(__dirname, '../..', 'storybook-static');
const INDEX_JSON = resolve(STORYBOOK_STATIC, 'index.json');

const artifactBuilt = existsSync(STORYBOOK_STATIC);

// Skip the suite when build-storybook has not been run yet: the unit-test gate
// runs without the Storybook build step; the build-storybook gate (run
// separately) is responsible for proving the artifact exists with the story.
describe.skipIf(!artifactBuilt)(
  'Storybook build artifact contains the ConfirmDialog story',
  () => {
    it('storybook-static/index.html is present', () => {
      const indexHtml = resolve(STORYBOOK_STATIC, 'index.html');
      expect(
        existsSync(indexHtml),
        `Expected index.html at ${indexHtml}`,
      ).toBe(true);
    });

    it('index.json contains an entry for the ConfirmDialog story', () => {
      expect(
        existsSync(INDEX_JSON),
        `Expected index.json at ${INDEX_JSON}`,
      ).toBe(true);

      const raw = readFileSync(INDEX_JSON, 'utf-8');
      const index = JSON.parse(raw) as { entries: Record<string, { title: string }> };

      const hasConfirmDialog = Object.values(index.entries).some(
        (entry) => entry.title.toLowerCase().includes('confirmdialog'),
      );

      expect(
        hasConfirmDialog,
        'Expected at least one story with title containing "ConfirmDialog" in index.json',
      ).toBe(true);
    });
  },
);
