import { describe, expect, it } from 'vitest';
import { isBlockedAddress, isBlockedHostname } from '@/lib/engine/net/ip';
import { normalizeUrl, validatePublicUrl, UrlRejectedError } from '@/lib/engine/net/url-guard';

describe('isBlockedAddress', () => {
  const cases: [string, boolean][] = [
    ['8.8.8.8', false], ['198.202.176.41', false], ['104.18.40.45', false], ['172.64.147.211', false], ['172.66.147.243', false],
    ['127.0.0.1', true], ['10.1.2.3', true], ['172.16.5.4', true], ['172.31.255.255', true], ['192.168.1.1', true],
    ['169.254.169.254', true], ['100.64.0.1', true], ['0.0.0.0', true], ['224.0.0.1', true], ['255.255.255.255', true],
    ['::1', true], ['::', true], ['::ffff:127.0.0.1', true], ['::ffff:7f00:1', true], ['::ffff:8.8.8.8', true], ['fd00::1', true], ['fe80::1', true],
    ['2606:4700:10::ac42:93f3', false], ['2a06:98c1:3105::6812:282d', false], ['64:ff9b::7f00:1', true], ['2002:7f00:1::', true],
    ['not-an-ip', true], ['', true],
  ];
  it.each(cases)('%s → blocked=%s', (address, blocked) => {
    expect(isBlockedAddress(address)).toBe(blocked);
  });
});

describe('isBlockedHostname', () => {
  it.each(['localhost', 'LOCALHOST', 'api.localhost', 'printer.local', 'db.internal', 'nas.lan', 'router.home.arpa', '[::1]', '127.0.0.1', ''])('blocks %s', (h) => {
    expect(isBlockedHostname(h)).toBe(true);
  });
  it.each(['example.com', 'localhost.example.com', 'internal-tools.com', '8.8.8.8'])('allows %s', (h) => {
    expect(isBlockedHostname(h)).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('adds https:// to bare domains and keeps the path', () => {
    expect(normalizeUrl('example.com/pricing?x=1').toString()).toBe('https://example.com/pricing?x=1');
    expect(normalizeUrl('  http://Example.com  ').hostname).toBe('example.com');
  });
  const rejects: [string, string][] = [
    ['ftp://example.com', 'scheme'], ['javascript:alert(1)', 'invalid'], ['file:///etc/passwd', 'scheme'], ['data:text/html,hi', 'invalid'],
    ['https://user:pass@example.com', 'credentials'], ['https://example.com:22', 'port'],
    ['https://intranet', 'invalid'], ['', 'invalid'], [`https://example.com/${'a'.repeat(2100)}`, 'invalid'],
  ];
  it.each(rejects)('rejects %s (%s)', (input, code) => {
    try { normalizeUrl(input); expect.unreachable(); } catch (e) {
      expect(e).toBeInstanceOf(UrlRejectedError);
      expect((e as UrlRejectedError).code).toBe(code);
    }
  });
});

describe('validatePublicUrl', () => {
  // Every one of these resolves to a loopback, link-local or private address without DNS.
  it.each([
    'http://127.0.0.1/', 'http://localhost:8080/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data/',
    'http://0x7f000001/', 'http://2130706433/', 'http://0177.0.0.1/', 'http://10.0.0.1/', 'http://[::ffff:127.0.0.1]/',
  ])('refuses %s', async (url) => {
    await expect(validatePublicUrl(url)).rejects.toBeInstanceOf(UrlRejectedError);
  });
});
