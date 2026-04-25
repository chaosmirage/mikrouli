const OS_OTHER_ID = 0;
const BROWSER_OTHER_ID = 0;

export const OS_NAMES: Record<number, string> = {
  0: 'Unknown',
  1: 'Windows',
  2: 'macOS',
  3: 'Linux',
  4: 'iOS',
  5: 'Android',
};

export const BROWSER_NAMES: Record<number, string> = {
  0: 'Unknown',
  1: 'Chrome',
  2: 'Firefox',
  3: 'Safari',
  4: 'Edge',
  5: 'Opera',
};

export const COUNTRY_NAMES: Record<number, string> = {
  0: 'Unknown',
};

export function parseOsId(ua: string | undefined): number {
  if (!ua) return OS_OTHER_ID;
  if (/Windows NT/i.test(ua)) return 1;
  if (/Android/i.test(ua)) return 5;
  if (/iPhone|iPad|iPod/i.test(ua)) return 4;
  if (/Macintosh|Mac OS X/i.test(ua)) return 2;
  if (/Linux/i.test(ua)) return 3;
  return OS_OTHER_ID;
}

export function parseBrowserId(ua: string | undefined): number {
  if (!ua) return BROWSER_OTHER_ID;
  if (/Edg\/|Edge\//i.test(ua)) return 4;
  if (/OPR\/|Opera/i.test(ua)) return 5;
  if (/Firefox/i.test(ua)) return 2;
  if (/Chrome/i.test(ua)) return 1;
  if (/Safari/i.test(ua)) return 3;
  return BROWSER_OTHER_ID;
}
