import { describe, it, expect, afterEach } from 'vitest';
import i18next from 'i18next';
import { formatDate, formatDateTime, formatNumber } from './format';

// A fixed UTC instant keeps the expected display strings independent of the
// machine the suite runs on.
const JAN_5_NOON = '2024-01-05T12:30:00Z';

async function useLocale(lng: 'en' | 'de' | 'el'): Promise<void> {
  await i18next.changeLanguage(lng);
}

afterEach(async () => {
  await i18next.changeLanguage('en');
});

describe('locale formatting', () => {
  it('renders a date in the English convention for the active locale', () => {
    expect(formatDate(JAN_5_NOON)).toBe('Jan 5, 2024');
  });

  it('renders the same instant in the German date convention', async () => {
    await useLocale('de');
    expect(formatDate(JAN_5_NOON)).toBe('05.01.2024');
  });

  it('renders the same instant in the Greek date convention', async () => {
    await useLocale('el');
    expect(formatDate(JAN_5_NOON)).toBe('5 Ιαν 2024');
  });

  it('renders a date and time in the active locale convention', () => {
    expect(formatDateTime(JAN_5_NOON)).toBe('Jan 5, 2024, 12:30 PM');
  });

  it('renders the date and time in the German convention', async () => {
    await useLocale('de');
    expect(formatDateTime(JAN_5_NOON)).toBe('05.01.2024, 12:30');
  });

  it('groups numbers with the active locale separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('groups numbers with German separators', async () => {
    await useLocale('de');
    expect(formatNumber(1234567)).toBe('1.234.567');
  });

  it('states an absent standing as an em dash', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('states an unparseable instant as an em dash instead of throwing', () => {
    expect(formatDate('not-a-timestamp')).toBe('—');
    expect(formatDateTime('not-a-timestamp')).toBe('—');
  });
});
