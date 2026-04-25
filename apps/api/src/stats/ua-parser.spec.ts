import { parseBrowserId, parseOsId } from './ua-parser';

const CHROME_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIREFOX_LINUX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0';
const EDGE_WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const SAFARI_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const OPERA_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 OPR/106.0';
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';

describe('parseOsId', () => {
  it('returns 2 (macOS) for Chrome on Mac UA', () => {
    expect(parseOsId(CHROME_MAC_UA)).toBe(2);
  });

  it('returns 3 (Linux) for Firefox on Linux UA', () => {
    expect(parseOsId(FIREFOX_LINUX_UA)).toBe(3);
  });

  it('returns 1 (Windows) for Edge on Windows UA', () => {
    expect(parseOsId(EDGE_WINDOWS_UA)).toBe(1);
  });

  it('returns 4 (iOS) for Safari on iOS UA', () => {
    expect(parseOsId(SAFARI_IOS_UA)).toBe(4);
  });

  it('returns 5 (Android) for Android Chrome UA', () => {
    expect(parseOsId(ANDROID_CHROME_UA)).toBe(5);
  });

  it('returns 0 (Other) for empty UA', () => {
    expect(parseOsId(undefined)).toBe(0);
    expect(parseOsId('')).toBe(0);
  });
});

describe('parseBrowserId', () => {
  it('returns 1 (Chrome) for Chrome on Mac UA', () => {
    expect(parseBrowserId(CHROME_MAC_UA)).toBe(1);
  });

  it('returns 2 (Firefox) for Firefox on Linux UA', () => {
    expect(parseBrowserId(FIREFOX_LINUX_UA)).toBe(2);
  });

  it('returns 4 (Edge) for Edge UA (contains Chrome token)', () => {
    expect(parseBrowserId(EDGE_WINDOWS_UA)).toBe(4);
  });

  it('returns 3 (Safari) for Safari on iOS UA', () => {
    expect(parseBrowserId(SAFARI_IOS_UA)).toBe(3);
  });

  it('returns 5 (Opera) for Opera UA', () => {
    expect(parseBrowserId(OPERA_UA)).toBe(5);
  });

  it('returns 0 (Other) for empty UA', () => {
    expect(parseBrowserId(undefined)).toBe(0);
    expect(parseBrowserId('')).toBe(0);
  });
});
