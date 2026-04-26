import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enStats from './locales/en/stats.json';
import enApiKeys from './locales/en/apiKeys.json';
import enErrors from './locales/en/errors.json';

import ruCommon from './locales/ru/common.json';
import ruAuth from './locales/ru/auth.json';
import ruDashboard from './locales/ru/dashboard.json';
import ruStats from './locales/ru/stats.json';
import ruApiKeys from './locales/ru/apiKeys.json';
import ruErrors from './locales/ru/errors.json';

const LOCALE_STORAGE_KEY = 'mikrouli.locale';
const SUPPORTED_LANGS = ['en', 'ru'] as const;
const NAMESPACES = ['common', 'auth', 'dashboard', 'stats', 'apiKeys', 'errors'] as const;

const EN_RESOURCES = {
  common: enCommon,
  auth: enAuth,
  dashboard: enDashboard,
  stats: enStats,
  apiKeys: enApiKeys,
  errors: enErrors,
};
const RU_RESOURCES = {
  common: ruCommon,
  auth: ruAuth,
  dashboard: ruDashboard,
  stats: ruStats,
  apiKeys: ruApiKeys,
  errors: ruErrors,
};

function buildResources() {
  return { en: EN_RESOURCES, ru: RU_RESOURCES };
}

function buildDetection() {
  return {
    order: ['localStorage', 'navigator'],
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
