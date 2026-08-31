/**
 * Asserts that every i18n namespace has identical key SETS across en, de, el.
 * A missing or extra key in any locale is a test failure.
 */

import { describe, it, expect } from 'vitest';

// Static imports of all locale JSON files (mirrors i18n/index.ts registrations)
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enStats from './locales/en/stats.json';
import enApiKeys from './locales/en/apiKeys.json';
import enErrors from './locales/en/errors.json';
import enLanding from './locales/en/landing.json';
import enConnect from './locales/en/connect.json';
import enUsage from './locales/en/usage.json';
import enLegal from './locales/en/legal.json';
import enNotFound from './locales/en/notFound.json';

import deCommon from './locales/de/common.json';
import deAuth from './locales/de/auth.json';
import deDashboard from './locales/de/dashboard.json';
import deStats from './locales/de/stats.json';
import deApiKeys from './locales/de/apiKeys.json';
import deErrors from './locales/de/errors.json';
import deLanding from './locales/de/landing.json';
import deConnect from './locales/de/connect.json';
import deUsage from './locales/de/usage.json';
import deLegal from './locales/de/legal.json';
import deNotFound from './locales/de/notFound.json';

import elCommon from './locales/el/common.json';
import elAuth from './locales/el/auth.json';
import elDashboard from './locales/el/dashboard.json';
import elStats from './locales/el/stats.json';
import elApiKeys from './locales/el/apiKeys.json';
import elErrors from './locales/el/errors.json';
import elLanding from './locales/el/landing.json';
import elConnect from './locales/el/connect.json';
import elUsage from './locales/el/usage.json';
import elLegal from './locales/el/legal.json';
import elNotFound from './locales/el/notFound.json';

const NAMESPACES = [
  { name: 'common',    en: enCommon,    de: deCommon,    el: elCommon },
  { name: 'auth',      en: enAuth,      de: deAuth,      el: elAuth },
  { name: 'dashboard', en: enDashboard, de: deDashboard, el: elDashboard },
  { name: 'stats',     en: enStats,     de: deStats,     el: elStats },
  { name: 'apiKeys',   en: enApiKeys,   de: deApiKeys,   el: elApiKeys },
  { name: 'errors',    en: enErrors,    de: deErrors,    el: elErrors },
  { name: 'landing',   en: enLanding,   de: deLanding,   el: elLanding },
  { name: 'connect',   en: enConnect,   de: deConnect,   el: elConnect },
  { name: 'usage',     en: enUsage,     de: deUsage,     el: elUsage },
  { name: 'legal',     en: enLegal,     de: deLegal,     el: elLegal },
  { name: 'notFound',  en: enNotFound,  de: deNotFound,  el: elNotFound },
];

function keysOf(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}

describe('i18n locale parity', () => {
  for (const ns of NAMESPACES) {
    describe(`namespace: ${ns.name}`, () => {
      it('de has same keys as en', () => {
        expect(keysOf(ns.de as Record<string, unknown>)).toEqual(
          keysOf(ns.en as Record<string, unknown>),
        );
      });

      it('el has same keys as en', () => {
        expect(keysOf(ns.el as Record<string, unknown>)).toEqual(
          keysOf(ns.en as Record<string, unknown>),
        );
      });
    });
  }
});
