import http from 'node:http';
import net from 'node:net';
import { resolvePublic } from './url-guard';
import { isBlockedHostname } from './ip';

export type ProxyStats = { requests: number; blocked: string[]; bytes: number; budgetExceeded: boolean };

/**
 * A tiny forward proxy that every capture browser is forced through. Each
 * destination is resolved here, checked against the private-range blocklist and
 * then connected to by IP, so redirects, sub-resources, WebSockets and DNS
 * rebinding cannot reach internal services. It also enforces a byte budget.
 */
export async function startGuardedProxy(opts: { maxBytes?: number; allowPrivate?: boolean } = {}) {
  const maxBytes = opts.maxBytes ?? 80 * 1024 * 1024;
  const stats: ProxyStats = { requests: 0, blocked: [], bytes: 0, budgetExceeded: false };
  const dnsCache = new Map<string, Promise<string>>();
  const sockets = new Set<net.Socket>();

  const resolve = (host: string): Promise<string> => {
    let hit: Promise<string> | undefined = dnsCache.get(host);
    if (!hit) {
      hit = (async (): Promise<string> => {
        if (opts.allowPrivate) {
          const { lookup } = await import('node:dns/promises');
          return (await lookup(host)).address;
        }
        if (isBlockedHostname(host)) throw new Error('blocked host');
        const addresses = await resolvePublic(host);
        const first = addresses[0];
        if (!first) throw new Error('no address');
        return first;
      })();
      dnsCache.set(host, hit);
      hit.catch(() => undefined);
    }
    return hit;
  };
  const account = (n: number) => {
    stats.bytes += n;
    if (stats.bytes > maxBytes) stats.budgetExceeded = true;
  };
  const block = (host: string) => {
    if (stats.blocked.length < 50) stats.blocked.push(host);
  };

  const server = http.createServer(async (req, res) => {
    // Plain-HTTP proxying: request line carries an absolute URL.
    stats.requests += 1;
    let target: URL;
    try { target = new URL(req.url || ''); } catch { res.writeHead(400).end(); return; }
    if (stats.budgetExceeded) { res.writeHead(509).end(); return; }
    let ip: string;
    try { ip = await resolve(target.hostname); } catch { block(target.hostname); res.writeHead(403).end(); return; }
    const upstream = http.request({
      host: ip, port: Number(target.port || 80), method: req.method, path: target.pathname + target.search,
      headers: { ...req.headers, host: target.host }, timeout: 20_000,
    }, (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.on('data', (chunk: Buffer) => account(chunk.length));
      up.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    upstream.on('timeout', () => upstream.destroy());
    req.pipe(upstream);
  });

  server.on('connect', async (req, clientSocket: net.Socket, head) => {
    stats.requests += 1;
    sockets.add(clientSocket);
    clientSocket.on('close', () => sockets.delete(clientSocket));
    clientSocket.on('error', () => undefined);
    const [host, portText] = (req.url || '').split(/:(?=\d+$)/);
    const port = Number(portText || 443);
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || stats.budgetExceeded) {
      clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    let ip: string;
    try { ip = await resolve(host.replace(/^\[|\]$/g, '')); } catch {
      block(host);
      clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    const upstream = net.connect({ host: ip, port, timeout: 20_000 }, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head?.length) upstream.write(head);
      upstream.on('data', (chunk: Buffer) => {
        account(chunk.length);
        if (stats.budgetExceeded) { upstream.destroy(); clientSocket.destroy(); }
      });
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    sockets.add(upstream);
    upstream.on('close', () => sockets.delete(upstream));
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => clientSocket.destroy());
  });

  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', () => resolveListen()));
  const address = server.address() as net.AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    stats,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}

/** Chromium flags that force every connection through the guarded proxy. */
export function proxyChromeArgs(proxyUrl: string) {
  return [
    `--proxy-server=${proxyUrl}`,
    // Chrome bypasses proxies for loopback by default; subtract that implicit rule.
    '--proxy-bypass-list=<-loopback>',
    '--disable-quic',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--webrtc-ip-handling-policy=disable_non_proxied_udp',
  ];
}
