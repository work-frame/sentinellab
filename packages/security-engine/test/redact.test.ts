import { redactBody, redactHeaders, redactSetCookie } from '../src/http/redact';

describe('redaction', () => {
  it('removes cookie values but keeps attributes', () => {
    expect(redactSetCookie('sid=abc123; Path=/; HttpOnly')).toBe('sid=[REDACTED]; Path=/; HttpOnly');
  });

  it('redacts credential headers', () => {
    const out = redactHeaders({ authorization: ['Bearer abc'], 'content-type': ['text/html'] });
    expect(out).toEqual({ authorization: ['[REDACTED]'], 'content-type': ['text/html'] });
  });

  it('redacts secrets in bodies', () => {
    const body = '{"user":"amy","password":"hunter2","token":"t0k"} key=AKIAABCDEFGHIJKLMNOP eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJlc2ln';
    const out = redactBody(body);
    expect(out).not.toMatch(/hunter2|t0k|AKIAABCDEFGHIJKLMNOP|eyJhbGci/);
    expect(out).toContain('"user":"amy"');
  });
});
