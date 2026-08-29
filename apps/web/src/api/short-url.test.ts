import { describe, it, expect } from 'vitest';
import { resolveFullShortUrl } from './short-url';

// Drives the resolver at its public seam: the bare slug the API stores goes
// in, the takeable public URL comes out; anything already resolved passes
// through unchanged. The no-origin branches guard non-browser contexts and
// opaque origins and are not drivable under jsdom's always-present origin.
describe('resolveFullShortUrl', () => {
  it('composes a bare slug with the current origin', () => {
    expect(resolveFullShortUrl('GYa6kx')).toBe(`${window.location.origin}/GYa6kx`);
  });

  it('passes an already-resolved URL through, trimmed', () => {
    expect(resolveFullShortUrl('https://s.io/GYa6kx  ')).toBe('https://s.io/GYa6kx');
  });
});
