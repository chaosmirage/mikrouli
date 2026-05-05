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

import deCommon from './locales/de/common.json';
import deAuth from './locales/de/auth.json';
import deDashboard from './locales/de/dashboard.json';
import deStats from './locales/de/stats.json';
import deApiKeys from './locales/de/apiKeys.json';
import deErrors from './locales/de/errors.json';
import deLanding from './locales/de/landing.json';

const LOCALE_STORAGE_KEY = 'mikrouli.locale';
const SUPPORTED_LANGS = ['en', 'de'] as const;
const NAMESPACES = ['common', 'auth', 'dashboard', 'stats', 'apiKeys', 'errors', 'landing'] as const;

const EN_RESOURCES = {
  common: enCommon,
  auth: enAuth,
  dashboard: enDashboard,
  stats: enStats,
  apiKeys: enApiKeys,
  errors: enErrors,
  landing: enLanding,
};
const DE_RESOURCES = {
  common: deCommon,
  auth: deAuth,
  dashboard: deDashboard,
  stats: deStats,
  apiKeys: deApiKeys,
  errors: deErrors,
  landing: deLanding,
};

function buildResources() {
  return { en: EN_RESOURCES, de: DE_RESOURCES };
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
