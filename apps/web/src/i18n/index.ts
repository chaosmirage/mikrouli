import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

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

const LOCALE_STORAGE_KEY = 'mikrouli.locale';
const SUPPORTED_LANGS = ['en', 'de', 'el'] as const;
const NAMESPACES = ['common', 'auth', 'dashboard', 'stats', 'apiKeys', 'errors', 'landing', 'connect', 'usage', 'legal'] as const;

const EN_RESOURCES = {
  common: enCommon,
  auth: enAuth,
  dashboard: enDashboard,
  stats: enStats,
  apiKeys: enApiKeys,
  errors: enErrors,
  landing: enLanding,
  connect: enConnect,
  usage: enUsage,
  legal: enLegal,
};
const DE_RESOURCES = {
  common: deCommon,
  auth: deAuth,
  dashboard: deDashboard,
  stats: deStats,
  apiKeys: deApiKeys,
  errors: deErrors,
  landing: deLanding,
  connect: deConnect,
  usage: deUsage,
  legal: deLegal,
};
const EL_RESOURCES = {
  common: elCommon,
  auth: elAuth,
  dashboard: elDashboard,
  stats: elStats,
  apiKeys: elApiKeys,
  errors: elErrors,
  landing: elLanding,
  connect: elConnect,
  usage: elUsage,
  legal: elLegal,
};

function buildResources() {
  return { en: EN_RESOURCES, de: DE_RESOURCES, el: EL_RESOURCES };
}

// Default to English for fresh visitors.
// We do NOT consult navigator language; only respect explicit user choice persisted in localStorage.
function buildDetection() {
  return {
    order: ['localStorage'],
    lookupLocalStorage: LOCALE_STORAGE_KEY,
    caches: ['localStorage'],
  };
}

const INIT_OPTIONS = {
  fallbackLng: 'en' as const,
  supportedLngs: SUPPORTED_LANGS,
  ns: NAMESPACES,
  defaultNS: 'common' as const,
  resources: buildResources(),
  interpolation: { escapeValue: false },
  detection: buildDetection(),
};

function initI18n(): void {
  void i18next.use(LanguageDetector).use(initReactI18next).init(INIT_OPTIONS);
}

initI18n();
export default i18next;
