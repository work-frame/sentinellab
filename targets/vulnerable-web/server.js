// INTENTIONALLY VULNERABLE — LOCAL SECURITY TRAINING TARGET
// Deliberately misconfigured HTTP server used to validate SentinelLab.
// Do not deploy. It serves static text only and stores nothing.
'use strict';
const http = require('node:http');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const BANNER = 'INTENTIONALLY VULNERABLE — LOCAL SECURITY TRAINING TARGET';

const page = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Demo Shop (vulnerable-web)</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; color: #1d2939; }
  .banner { background: #b42318; color: #fff; padding: 12px 16px; font-weight: 700; text-align: center; letter-spacing: .03em; }
  main { max-width: 640px; margin: 2rem auto; padding: 0 16px; }
  code { background: #f2f4f7; padding: 2px 4px; }
</style></head>
<body>
<div class="banner" role="alert">${BANNER}</div>
<main>
  <h1>Demo Shop</h1>
  <p>This page exists so SentinelLab has something to scan. It has no products, no accounts and no data.</p>
  <p>Deliberate weaknesses: missing security headers, a session cookie without <code>HttpOnly</code>, <code>Secure</code> or <code>SameSite</code>, version banners, and TRACE listed as an allowed method.</p>
</main>
</body>
</html>`;

const server = http.createServer((req, res) => {
  // Weakness: version banners.
  res.setHeader('Server', 'Apache/2.4.49 (Unix)');
  res.setHeader('X-Powered-By', 'PHP/7.2.34');
  res.setHeader('X-Training-Target', 'INTENTIONALLY VULNERABLE - LOCAL SECURITY TRAINING TARGET');

  if (req.method === 'OPTIONS') {
    // Weakness: advertises TRACE. The server does not actually implement it.
    res.writeHead(204, { Allow: 'GET, HEAD, POST, OPTIONS, TRACE' });
    return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' });
    return res.end('Method not allowed');
  }
  if (req.url !== '/' && !req.url.startsWith('/?')) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<div style="background:#b42318;color:#fff;padding:8px">${BANNER}</div><p>Not found</p>`);
  }
  // Weakness: no CSP, X-Frame-Options, nosniff or Referrer-Policy; weak cookie flags.
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Set-Cookie': 'PHPSESSID=demo-not-a-real-session; Path=/',
  });
  res.end(req.method === 'HEAD' ? undefined : page);
});

server.listen(PORT, HOST, () => console.log(`[vulnerable-web] ${BANNER} listening on ${HOST}:${PORT}`));
