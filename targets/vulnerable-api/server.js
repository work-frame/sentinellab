// INTENTIONALLY VULNERABLE — LOCAL SECURITY TRAINING TARGET
// Deliberately misconfigured JSON API used to validate SentinelLab.
// Do not deploy. It returns static demo data only and stores nothing.
'use strict';
const http = require('node:http');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const BANNER = 'INTENTIONALLY VULNERABLE — LOCAL SECURITY TRAINING TARGET';

const products = [
  { id: 1, name: 'Demo widget', price: 9.99 },
  { id: 2, name: 'Demo gadget', price: 19.99 },
];

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

const server = http.createServer((req, res) => {
  res.setHeader('Server', 'nginx/1.18.0');
  res.setHeader('X-Training-Target', 'INTENTIONALLY VULNERABLE - LOCAL SECURITY TRAINING TARGET');

  // Weakness: reflects any Origin and allows credentials.
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    // Weakness: advertises write methods on the root path.
    res.writeHead(204, { Allow: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' });
    return res.end();
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed', warning: BANNER });

  if (req.url === '/' ) return send(res, 200, { name: 'Demo API', warning: BANNER, endpoints: ['/api/products'] });
  if (req.url === '/api/products') return send(res, 200, { warning: BANNER, items: products });

  // Weakness: unknown routes return a fake stack trace with internal paths.
  // The trace is static text; nothing actually fails.
  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(
    `${BANNER}\n\nTypeError: Cannot read properties of undefined (reading 'handler')\n` +
      `    at Router.dispatch (/srv/demo-api/node_modules/router/index.js:142:17)\n` +
      `    at Server.handle (/srv/demo-api/server.js:37:5)\n`,
  );
});

server.listen(PORT, HOST, () => console.log(`[vulnerable-api] ${BANNER} listening on ${HOST}:${PORT}`));
