import '@testing-library/jest-dom';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../i18n/locales/en/common.json';
import enAuth from '../i18n/locales/en/auth.json';
import enDashboard from '../i18n/locales/en/dashboard.json';
import enStats from '../i18n/locales/en/stats.json';
import enApiKeys from '../i18n/locales/en/apiKeys.json';
import enErrors from '../i18n/locales/en/errors.json';
import enLanding from '../i18n/locales/en/landing.json';
import enConnect from '../i18n/locales/en/connect.json';

import deCommon from '../i18n/locales/de/common.json';
import deAuth from '../i18n/locales/de/auth.json';
import deDashboard from '../i18n/locales/de/dashboard.json';
import deStats from '../i18n/locales/de/stats.json';
import deApiKeys from '../i18n/locales/de/apiKeys.json';
import deErrors from '../i18n/locales/de/errors.json';
import deLanding from '../i18n/locales/de/landing.json';
import deConnect from '../i18n/locales/de/connect.json';

import elCommon from '../i18n/locales/el/common.json';
import elAuth from '../i18n/locales/el/auth.json';
import elDashboard from '../i18n/locales/el/dashboard.json';
import elStats from '../i18n/locales/el/stats.json';
import elApiKeys from '../i18n/locales/el/apiKeys.json';
import elErrors from '../i18n/locales/el/errors.json';
import elLanding from '../i18n/locales/el/landing.json';
import elConnect from '../i18n/locales/el/connect.json';

const TEST_EN = {
  common: enCommon,
  auth: enAuth,
  dashboard: enDashboard,
  stats: enStats,
  apiKeys: enApiKeys,
  errors: enErrors,
  landing: enLanding,
  connect: enConnect,
};
const TEST_DE = {
  common: deCommon,
  auth: deAuth,
  dashboard: deDashboard,
  stats: deStats,
  apiKeys: deApiKeys,
  errors: deErrors,
  landing: deLanding,
  connect: deConnect,
};
const TEST_EL = {
  common: elCommon,
  auth: elAuth,
  dashboard: elDashboard,
  stats: elStats,
  apiKeys: elApiKeys,
  errors: elErrors,
  landing: elLanding,
  connect: elConnect,
};

void i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: TEST_EN, de: TEST_DE, el: TEST_EL },
  ns: ['common', 'auth', 'dashboard', 'stats', 'apiKeys', 'errors', 'landing', 'connect'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});
