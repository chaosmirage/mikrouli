import i18next from 'i18next';

// Display formatting for every date and number the client renders. The
// platform Intl formatters are keyed to the active i18next language so each
// locale reads its own conventions; one formatter set is created per locale
// and reused for as long as that locale stays active.
//
// Only display lives here: ISO strings in, display strings out. No parsing,
// arithmetic, or timezone conversion — timestamps are shown as recorded
// (UTC), matching the recorded instant regardless of the viewer's clock.

const ABSENT_STANDING = '—';

interface LocaleFormatters {
  date: Intl.DateTimeFormat;
  dateTime: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
}

const formattersByLocale = new Map<string, LocaleFormatters>();

function activeLocale(): string {
  const active = i18next.resolvedLanguage ?? i18next.language;
  if (active) return active;
  const fallback = i18next.options.fallbackLng;
  if (typeof fallback === 'string') return fallback;
  if (Array.isArray(fallback)) return fallback[0] ?? 'en';
  return 'en';
}

function formattersFor(locale: string): LocaleFormatters {
  const cached = formattersByLocale.get(locale);
  if (cached) return cached;
  const created: LocaleFormatters = {
    date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }),
    dateTime: new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }),
    number: new Intl.NumberFormat(locale),
  };
  formattersByLocale.set(locale, created);
  return created;
}

function toDisplay(iso: string | null, pick: (f: LocaleFormatters) => Intl.DateTimeFormat): string {
  if (!iso) return ABSENT_STANDING;
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return ABSENT_STANDING;
  return pick(formattersFor(activeLocale())).format(instant);
}

export function formatDate(iso: string | null): string {
  return toDisplay(iso, (f) => f.date);
}

export function formatDateTime(iso: string | null): string {
  return toDisplay(iso, (f) => f.dateTime);
}

export function formatNumber(value: number): string {
  return formattersFor(activeLocale()).number.format(value);
}
