import { BlockList, isIP } from 'node:net';

/**
 * Address ranges the capture browser must never reach. Covers loopback, RFC1918,
 * CGNAT, link-local (cloud metadata), multicast, documentation/benchmark ranges,
 * and IPv6 equivalents, including IPv4-mapped/NAT64/6to4 forms that could tunnel
 * to an internal IPv4 address.
 */
// Separate lists: Node's BlockList also matches IPv4 addresses against
// IPv4-mapped IPv6 rules, so a single list containing ::ffff:0:0/96 would block
// every IPv4 address.
const blocked4 = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked4.addSubnet(net, prefix, 'ipv4');
const blocked6 = new BlockList();
for (const [net, prefix] of [
  // ::/96 covers ::, ::1 and deprecated IPv4-compatible addresses.
  ['::', 96], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
  ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as const) blocked6.addSubnet(net, prefix, 'ipv6');

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  if (family === 4) return blocked4.check(address, 'ipv4');
  const lower = address.toLowerCase();
  // Dotted IPv4-mapped forms (::ffff:1.2.3.4) are always refused.
  if (/^(::ffff:|::)(\d+\.){3}\d+$/.test(lower)) return true;
  return blocked6.check(lower, 'ipv6');
}

const blockedHostnames = /(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|localdomain)$/i;
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || blockedHostnames.test(host)) return true;
  if (isIP(host)) return isBlockedAddress(host);
  return false;
}
