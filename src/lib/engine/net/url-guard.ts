import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isBlockedAddress, isBlockedHostname } from './ip';

export class UrlRejectedError extends Error {
  constructor(message: string, public readonly code: 'invalid' | 'private' | 'unresolvable' | 'scheme' | 'credentials' | 'port') {
    super(message);
  }
}

/** Parses user input into a canonical http(s) URL without touching the network. */
export function normalizeUrl(input: string): URL {
  const value = (input || '').trim();
  if (!value || value.length > 2048) throw new UrlRejectedError('Enter a valid web address, for example https://example.com.', 'invalid');
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new UrlRejectedError('Enter a valid web address, for example https://example.com.', 'invalid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UrlRejectedError('Only http and https pages can be reviewed.', 'scheme');
  if (url.username || url.password) throw new UrlRejectedError('Remove the username or password from the address.', 'credentials');
  if (url.port && !['80', '443', '8080', '8443'].includes(url.port)) throw new UrlRejectedError('Only standard web ports can be reviewed.', 'port');
  if (!url.hostname.includes('.') && !isIP(url.hostname)) throw new UrlRejectedError('Enter a complete public web address, including the domain ending (such as .com).', 'invalid');
  if (isBlockedHostname(url.hostname)) throw new UrlRejectedError('Local, private and internal addresses cannot be reviewed.', 'private');
  url.hash = '';
  return url;
}

export async function resolvePublic(hostname: string): Promise<string[]> {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new UrlRejectedError('Local, private and internal addresses cannot be reviewed.', 'private');
    return [host];
  }
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UrlRejectedError(`We couldn't find a website at ${host}. Check the address and try again.`, 'unresolvable');
  }
  if (!records.length) throw new UrlRejectedError(`We couldn't find a website at ${host}.`, 'unresolvable');
  // Refuse mixed answers: a public + private answer is a classic DNS-rebinding setup.
  if (records.some((r) => isBlockedAddress(r.address))) throw new UrlRejectedError('This address points to a private network and cannot be reviewed.', 'private');
  return records.map((r) => r.address);
}

/** Full validation used before a review is accepted. */
export async function validatePublicUrl(input: string): Promise<string> {
  const url = normalizeUrl(input);
  await resolvePublic(url.hostname);
  return url.toString();
}
