import { safeNextPath } from '@/lib/safe-redirect';

describe('safeNextPath', () => {
  it.each([
    ['/targets', '/targets'],
    ['/findings?severity=HIGH', '/findings?severity=HIGH'],
  ])('keeps the internal path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([null, '', 'https://evil.example', '//evil.example/x', '/\\evil.example', 'javascript:alert(1)', '/%2F%2Fevil.example'])('falls back to / for %p', (input) => {
    const out = safeNextPath(input);
    expect(out.startsWith('/')).toBe(true);
    expect(out.startsWith('//')).toBe(false);
    expect(out).not.toContain('evil.example/x');
    if (input === null || input === '' || !String(input).startsWith('/') || String(input).startsWith('//') || String(input).includes('\\')) expect(out).toBe('/');
  });
});
