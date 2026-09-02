import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { readDashboardBlob } from './storage/blob';

/**
 * The web container: serves the built dashboard and the payload the refresh job
 * wrote to blob storage.
 *
 * It scales to zero, so it holds no timers and no state — everything it serves
 * comes from storage. The hourly refresh runs as a separate Container Apps job,
 * which is the only way a scale-to-zero app can refresh at all: an in-process
 * timer dies with the last replica.
 */
const PORT = Number(process.env.PORT ?? 8080);
const STATIC_ROOT = resolve(process.env.STATIC_ROOT ?? './public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

const SECURITY_HEADERS: Record<string, string> = {
  // Inline styles only — the app styles elements directly, no inline scripts.
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

function send(
  response: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...SECURITY_HEADERS,
    ...headers,
  });
  response.end(body);
}

async function serveDashboard(response: ServerResponse): Promise<void> {
  try {
    const payload = await readDashboardBlob();

    if (!payload) {
      // The client keeps whatever it already has and says the refresh failed.
      // Blanking the board is never the right answer.
      return send(
        response,
        503,
        JSON.stringify({
          error: 'no snapshot yet',
          detail: 'The refresh job has not written a payload yet.',
        }),
      );
    }

    return send(response, 200, JSON.stringify(payload), {
      // The job writes hourly; a short cache keeps a wall display and a few
      // laptops from each hitting storage on every poll.
      'cache-control': 'public, max-age=60, stale-while-revalidate=1800',
    });
  } catch (error) {
    console.error(`Dashboard read failed: ${(error as Error).message}`);
    return send(response, 502, JSON.stringify({ error: 'storage unavailable' }));
  }
}

/** Resolve a URL path inside STATIC_ROOT, refusing anything that escapes it. */
function safeStaticPath(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(join(STATIC_ROOT, normalize(decoded)));
  if (candidate !== STATIC_ROOT && !candidate.startsWith(STATIC_ROOT + '/')) return null;
  return candidate;
}

async function serveStatic(urlPath: string, response: ServerResponse): Promise<void> {
  const path = safeStaticPath(urlPath);
  if (!path) return send(response, 403, JSON.stringify({ error: 'forbidden' }));

  let filePath = path;
  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) filePath = join(filePath, 'index.html');
    else if (!stats.isFile()) throw new Error('not a file');
  } catch {
    // Single-page app: unknown paths fall back to the shell.
    filePath = join(STATIC_ROOT, 'index.html');
  }

  try {
    await stat(filePath);
  } catch {
    return send(response, 404, JSON.stringify({ error: 'not found' }));
  }

  const type = MIME[extname(filePath)] ?? 'application/octet-stream';
  const immutable = filePath.includes('/assets/');

  response.writeHead(200, {
    'content-type': type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...SECURITY_HEADERS,
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer((request: IncomingMessage, response: ServerResponse) => {
  const url = request.url ?? '/';

  // Container Apps probes this while the app is scaled to zero; it must not
  // touch storage or it will fail the readiness check on a cold start.
  if (url === '/healthz') return send(response, 200, JSON.stringify({ ok: true }));

  if (url.startsWith('/api/dashboard')) {
    if (request.method !== 'GET') {
      return send(response, 405, JSON.stringify({ error: 'method not allowed' }));
    }
    void serveDashboard(response);
    return;
  }

  if (url.startsWith('/api/')) return send(response, 404, JSON.stringify({ error: 'not found' }));

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return send(response, 405, JSON.stringify({ error: 'method not allowed' }));
  }

  void serveStatic(url, response);
});

server.listen(PORT, () => {
  console.log(`Dashboard listening on :${PORT}, serving ${STATIC_ROOT}`);
});

// Container Apps sends SIGTERM when scaling to zero. Exit cleanly so in-flight
// responses finish instead of being cut off.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
