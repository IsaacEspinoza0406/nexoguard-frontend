// Production HTTPS bootstrap. Next owns all routing, SSR, middleware and CSP.
// No additional reverse proxy and no custom request or cookie handling.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import next from 'next';

const hostname = '0.0.0.0';
const port = Number(process.env.PORT || 3000);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_PORT');
const api = new URL(process.env.API_INTERNAL_URL || '');
if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash || api.pathname !== '/') throw new Error('INTERNAL_API_HTTPS_REQUIRED');
if (!process.env.NODE_EXTRA_CA_CERTS) throw new Error('INTERNAL_CA_REQUIRED');
// Node loads NODE_EXTRA_CA_CERTS at process startup; a missing file must not silently fall back.
readFileSync(process.env.NODE_EXTRA_CA_CERTS);
const cert = readFileSync(process.env.NEXOGUARD_INTERNAL_TLS_CERT || '');
const key = readFileSync(process.env.NEXOGUARD_INTERNAL_TLS_KEY || '');
const app = next({ dev: false, hostname, port });
await app.prepare();
const server = createServer({ cert, key, minVersion: 'TLSv1.2' }, app.getRequestHandler());
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.listen(port, hostname);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 30000).unref();
  server.closeIdleConnections();
  await new Promise(resolve => server.close(resolve));
  await app.close();
  clearTimeout(deadline);
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
