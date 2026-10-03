import type { CheckModule, FindingDraft, HttpExchange } from '../types';
import { evidenceFrom, headerAll, isHttps, makeFinding } from './util';

const MODULE = 'cookie-security';
const TYPE = 'Session Management';
const SESSION_NAME = /(sess|sid|token|auth|jwt|login|remember)/i;

interface ParsedCookie {
  name: string;
  attributes: Map<string, string>;
}

export function parseSetCookie(value: string): ParsedCookie {
  const [pair = '', ...rest] = value.split(';');
  const eq = pair.indexOf('=');
  const name = (eq === -1 ? pair : pair.slice(0, eq)).trim();
  const attributes = new Map<string, string>();
  for (const attr of rest) {
    const i = attr.indexOf('=');
    const key = (i === -1 ? attr : attr.slice(0, i)).trim().toLowerCase();
    if (key) attributes.set(key, i === -1 ? '' : attr.slice(i + 1).trim());
  }
  return { name, attributes };
}

/** Checks Set-Cookie headers on the baseline and redirect responses. */
export const cookieCheck: CheckModule = {
  name: MODULE,
  description: 'Cookies missing the HttpOnly, Secure or SameSite attributes.',
  run(recon) {
    const findings: FindingDraft[] = [];
    const seen = new Set<string>();
    const exchanges: HttpExchange[] = [...recon.redirects, recon.baseline];

    for (const ex of exchanges) {
      for (const raw of headerAll(ex, 'set-cookie')) {
        const cookie = parseSetCookie(raw);
        if (!cookie.name || seen.has(cookie.name)) continue;
        seen.add(cookie.name);
        const looksLikeSession = SESSION_NAME.test(cookie.name);
        const evidence = [evidenceFrom(ex, `Set-Cookie for "${cookie.name}" with attributes: ${[...cookie.attributes.keys()].join(', ') || 'none'}.`)];

        if (!cookie.attributes.has('httponly')) {
          findings.push(
            makeFinding(MODULE, {
              ruleId: 'cookies.httponly-missing',
              title: `Cookie "${cookie.name}" is readable by JavaScript (no HttpOnly)`,
              type: TYPE,
              severity: looksLikeSession ? 'MEDIUM' : 'LOW',
              confidence: looksLikeSession ? 'HIGH' : 'MEDIUM',
              description: `The cookie "${cookie.name}" is set without the HttpOnly attribute.`,
              impact: 'Any script running in the page, including injected script from an XSS bug, can read the cookie. For a session cookie that means account takeover.',
              remediation: 'Add HttpOnly to every cookie that client-side code does not need to read, and always to session cookies.',
              references: ['https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#cookies'],
              evidence,
              exchange: ex,
              discriminator: cookie.name,
            }),
          );
        }

        if (isHttps(ex) && !cookie.attributes.has('secure')) {
          findings.push(
            makeFinding(MODULE, {
              ruleId: 'cookies.secure-missing',
              title: `Cookie "${cookie.name}" can be sent over plain HTTP (no Secure)`,
              type: TYPE,
              severity: looksLikeSession ? 'MEDIUM' : 'LOW',
              confidence: 'HIGH',
              description: `The cookie "${cookie.name}" is set over HTTPS without the Secure attribute.`,
              impact: 'The browser will also send this cookie on any http:// request to the site, where anyone on the network path can read it.',
              remediation: 'Add the Secure attribute to every cookie set by an HTTPS site.',
              references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies'],
              evidence,
              exchange: ex,
              discriminator: cookie.name,
            }),
          );
        }

        const sameSite = cookie.attributes.get('samesite')?.toLowerCase();
        if (!sameSite || (sameSite === 'none' && !cookie.attributes.has('secure'))) {
          findings.push(
            makeFinding(MODULE, {
              ruleId: 'cookies.samesite-weak',
              title: `Cookie "${cookie.name}" has no effective SameSite protection`,
              type: TYPE,
              severity: looksLikeSession ? 'MEDIUM' : 'LOW',
              confidence: 'MEDIUM',
              description: sameSite
                ? `The cookie "${cookie.name}" uses SameSite=None without Secure, which browsers reject or treat as unprotected.`
                : `The cookie "${cookie.name}" does not set a SameSite attribute and relies on browser defaults.`,
              impact: 'Cookies sent on cross-site requests make cross-site request forgery (CSRF) easier when the application has no other CSRF defense.',
              remediation: 'Set SameSite=Lax (or Strict) on session cookies. Use SameSite=None only together with Secure and a CSRF token.',
              references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value'],
              evidence,
              exchange: ex,
              discriminator: cookie.name,
            }),
          );
        }
      }
    }
    return findings;
  },
};
