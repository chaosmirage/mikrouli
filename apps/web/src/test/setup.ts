import '@testing-library/jest-dom';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../i18n/locales/en/common.json';
import enAuth from '../i18n/locales/en/auth.json';
import enDashboard from '../i18n/locales/en/dashboard.json';
import enStats from '../i18n/locales/en/stats.json';
import enApiKeys from '../i18n/locales/en/apiKeys.json';
import enErrors from '../i18n/locales/en/errors.json';

import ruCommon from '../i18n/locales/ru/common.json';
import ruAuth from '../i18n/locales/ru/auth.json';
import ruDashboard from '../i18n/locales/ru/dashboard.json';
import ruStats from '../i18n/locales/ru/stats.json';
import ruApiKeys from '../i18n/locales/ru/apiKeys.json';
import ruErrors from '../i18n/locales/ru/errors.json';

const TEST_EN = { common: enCommon, auth: enAuth, dashboard: enDashboard, stats: enStats, apiKeys: enApiKeys, errors: enErrors };
const TEST_RU = { common: ruCommon, auth: ruAuth, dashboard: ruDashboard, stats: ruStats, apiKeys: ruApiKeys, errors: ruErrors };

void i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: TEST_EN, ru: TEST_RU },
  ns: ['common', 'auth', 'dashboard', 'stats', 'apiKeys', 'errors'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});
