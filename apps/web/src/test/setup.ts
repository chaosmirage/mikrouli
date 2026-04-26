import '@testing-library/jest-dom';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../i18n/locales/en/common.json';
import enAuth from '../i18n/locales/en/auth.json';
import enDashboard from '../i18n/locales/en/dashboard.json';
import enStats from '../i18n/locales/en/stats.json';
import enApiKeys from '../i18n/locales/en/apiKeys.json';
import enErrors from '../i18n/locales/en/errors.json';

import deCommon from '../i18n/locales/de/common.json';
import deAuth from '../i18n/locales/de/auth.json';
import deDashboard from '../i18n/locales/de/dashboard.json';
import deStats from '../i18n/locales/de/stats.json';
import deApiKeys from '../i18n/locales/de/apiKeys.json';
import deErrors from '../i18n/locales/de/errors.json';

const TEST_EN = {
  common: enCommon,
  auth: enAuth,
  dashboard: enDashboard,
  stats: enStats,
  apiKeys: enApiKeys,
  errors: enErrors,
};
const TEST_DE = {
  common: deCommon,
  auth: deAuth,
  dashboard: deDashboard,
  stats: deStats,
  apiKeys: deApiKeys,
  errors: deErrors,
};

void i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: TEST_EN, de: TEST_DE },
  ns: ['common', 'auth', 'dashboard', 'stats', 'apiKeys', 'errors'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});
