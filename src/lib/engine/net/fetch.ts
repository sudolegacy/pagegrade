import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import { isBlockedAddress, isBlockedHostname } from './ip';

/**
 * A small, SSRF-safe GET for the few plain HTTP requests the engine makes
 * outside the browser (robots.txt and the raw HTML for the AI readiness
 * checks). Every hop is re-checked: the host name, every DNS answer and every
 * redirect target must be public, and the whole request has one deadline and a
 * size cap.
 */
export const PAGEGRADE_UA = 'Mozilla/5.0 (compatible; PageGrade/2.1; page review)';

export type GuardedResponse = { status: number; headers: http.IncomingHttpHeaders; body: string; url: string; truncated: boolean };
export type GuardedGetOptions = { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; allowPrivate?: boolean; userAgent?: string; accept?: string };

export class FetchBlockedError extends Error {}

function guardedLookup(allowPrivate: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (hostname: string, options: dns.LookupOptions, callback: (...args: any[]) => void) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = addresses as dns.LookupAddress[];
      if (!list.length) return callback(new FetchBlockedError(`No address for ${hostname}`));
      // Any private answer blocks the request, so mixed answers cannot be used for DNS rebinding.
      if (!allowPrivate && list.some((a) => isBlockedAddress(a.address))) return callback(new FetchBlockedError(`Blocked address for ${hostname}`));
      if (options.all) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
}

type Once = { status: number; headers: http.IncomingHttpHeaders; body: string; truncated: boolean; location?: string };

function requestOnce(url: URL, o: { allowPrivate: boolean; maxBytes: number; remainingMs: number; userAgent?: string; accept?: string }): Promise<Once> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    let timer: NodeJS.Timeout | undefined;
    const req = mod.request(url, {
      method: 'GET',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lookup: guardedLookup(o.allowPrivate) as any,
      headers: { 'user-agent': o.userAgent ?? PAGEGRADE_UA, accept: o.accept ?? '*/*', 'accept-encoding': 'gzip, deflate, br' },
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        clearTimeout(timer);
        return resolve({ status, headers: res.headers, body: '', truncated: false, location: res.headers.location });
      }
      const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
      const stream = enc === 'gzip' || enc === 'x-gzip' ? res.pipe(zlib.createGunzip())
        : enc === 'deflate' ? res.pipe(zlib.createInflate())
        : enc === 'br' ? res.pipe(zlib.createBrotliDecompress())
        : res;
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;
      const finish = (truncated: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ status, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), truncated });
      };
      stream.on('data', (c: Buffer) => {
        if (done) return;
        const room = o.maxBytes - size;
        if (c.length >= room) { chunks.push(c.subarray(0, room)); size = o.maxBytes; finish(true); req.destroy(); return; }
        chunks.push(c);
        size += c.length;
      });
      stream.on('end', () => finish(false));
      stream.on('error', (e: Error) => { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    });
    timer = setTimeout(() => req.destroy(new Error('The request timed out')), o.remainingMs);
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.end();
  });
}

export async function guardedGet(input: string, opts: GuardedGetOptions = {}): Promise<GuardedResponse> {
  const { timeoutMs = 6000, maxBytes = 512 * 1024, maxRedirects = 3, allowPrivate = false } = opts;
  const deadline = Date.now() + timeoutMs;
  let url = new URL(input);
  for (let hop = 0; ; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new FetchBlockedError('Only web addresses can be fetched');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!allowPrivate && (isBlockedHostname(host) || (net.isIP(host) && isBlockedAddress(host)))) throw new FetchBlockedError(`Blocked host ${host}`);
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new Error('The request timed out');
    const res = await requestOnce(url, { allowPrivate, maxBytes, remainingMs, userAgent: opts.userAgent, accept: opts.accept });
    if (res.location) {
      if (hop >= maxRedirects) throw new Error('Too many redirects');
      url = new URL(res.location, url);
      continue;
    }
    return { status: res.status, headers: res.headers, body: res.body, url: url.toString(), truncated: res.truncated };
  }
}
