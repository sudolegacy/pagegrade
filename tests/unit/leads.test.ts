import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/leads/route';
import { db } from '@/lib/server/db';
import { env } from '@/lib/server/env';
import { createLead, findLead, leadStats, listLeads, recentLeadFrom, updateLead, type LeadKind, type LeadStatus } from '@/lib/server/leads';
import { mailer } from '@/lib/server/mail';
import { createSession } from '@/lib/server/session';
import { createUser } from '@/lib/server/users';

// The route reads the session cookie and resolves prospect hostnames; neither should need a real request or network.
const session = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (session.token ? { value: session.token } : undefined) }) }));
vi.mock('node:dns/promises', () => ({
  lookup: async (host: string) => {
    if (host.includes('does-not-exist')) throw new Error('ENOTFOUND');
    return [{ address: '93.184.216.34', family: 4 }];
  },
}));

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Pretends the lead was made `ms` ago, so time-window rules can be tested without waiting. */
const age = (id: string, ms: number) => {
  const t = Date.now() - ms;
  db().prepare('UPDATE leads SET created_at = ?, updated_at = ? WHERE id = ?').run(t, t, id);
};
const lead = (email: string, kind: LeadKind = 'pack', status?: LeadStatus) => {
  const l = createLead({ kind, email, name: 'Test' });
  if (status) updateLead(l.id, { status });
  return l;
};

beforeEach(() => { db().prepare('DELETE FROM leads').run(); });

describe('createLead', () => {
  it('stores a trimmed, lower-cased email and the prospects in order', () => {
    const created = createLead({
      kind: 'pack', name: '  Sam Agency ', email: '  Sam@Agency.CO.uk ', company: ' Agency Ltd ', website: ' https://agency.co.uk/ ',
      message: ' Web design in Leeds ', prospects: ['https://one.example/', 'https://two.example/'], source: 'agencies',
    });
    const stored = findLead(created.id);
    expect(stored).toMatchObject({
      kind: 'pack', name: 'Sam Agency', email: 'sam@agency.co.uk', company: 'Agency Ltd', website: 'https://agency.co.uk/',
      message: 'Web design in Leeds', prospects: ['https://one.example/', 'https://two.example/'], source: 'agencies',
    });
  });

  it('starts as a new lead with no note and no linked account', () => {
    const created = lead('a@example.com');
    expect(created).toMatchObject({ status: 'new', note: '', userId: null, prospects: [], message: '' });
    expect(created.createdAt).toBe(created.updatedAt);
    expect(findLead('does-not-exist')).toBeNull();
  });

  it('caps field lengths and keeps at most ten prospects', () => {
    const created = createLead({
      kind: 'other', email: 'a@example.com', name: 'n'.repeat(200), company: 'c'.repeat(200), website: 'w'.repeat(400), message: 'm'.repeat(3000),
      source: 's'.repeat(100), prospects: Array.from({ length: 12 }, (_, i) => `https://example.com/${i}`),
    });
    expect(created.name).toHaveLength(80);
    expect(created.company).toHaveLength(120);
    expect(created.website).toHaveLength(300);
    expect(created.message).toHaveLength(2000);
    expect(created.source).toHaveLength(60);
    expect(created.prospects).toHaveLength(10);
  });
});

describe('listLeads', () => {
  it('lists newest first', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((x) => lead(`${x}@example.com`));
    age(a.id, 3 * HOUR);
    age(b.id, 2 * HOUR);
    age(c.id, HOUR);
    expect(listLeads().map((l) => l.email)).toEqual(['c@example.com', 'b@example.com', 'a@example.com']);
    expect(listLeads({ limit: 2 }).map((l) => l.email)).toEqual(['c@example.com', 'b@example.com']);
  });

  it('keeps only leads that still need action when open is set', () => {
    const statuses: LeadStatus[] = ['new', 'contacted', 'pack_sent', 'won', 'lost'];
    for (const status of statuses) lead(`${status}@example.com`, 'pack', status);
    expect(listLeads().map((l) => l.status).sort()).toEqual([...statuses].sort());
    const open = listLeads({ open: true }).map((l) => l.status).sort();
    expect(open).toEqual(['contacted', 'new', 'pack_sent']);
  });
});

describe('updateLead', () => {
  it('changes the status and saves a trimmed note', () => {
    const created = lead('a@example.com');
    age(created.id, HOUR);
    expect(updateLead(created.id, { status: 'contacted', note: '  Replied, call on Friday  ' })).toBe(true);
    const after = findLead(created.id)!;
    expect(after).toMatchObject({ status: 'contacted', note: 'Replied, call on Friday' });
    expect(after.updatedAt).toBeGreaterThan(after.createdAt);
  });

  it('can clear a note and link or unlink an account', () => {
    const created = lead('a@example.com');
    updateLead(created.id, { note: 'something', userId: 'user-1' });
    expect(findLead(created.id)).toMatchObject({ note: 'something', userId: 'user-1' });
    updateLead(created.id, { note: '', userId: null });
    expect(findLead(created.id)).toMatchObject({ note: '', userId: null });
  });

  it('reports false when there is nothing to change or no such lead', () => {
    const created = lead('a@example.com');
    expect(updateLead(created.id, {})).toBe(false);
    expect(updateLead('does-not-exist', { status: 'won' })).toBe(false);
    expect(findLead(created.id)?.status).toBe('new');
  });
});

describe('leadStats', () => {
  it('is all zeros with no leads', () => {
    expect(leadStats(0)).toEqual({ total: 0, packs: 0, won: 0, open: 0, packsSince: 0, wonSince: 0 });
  });

  it('counts requests, customers and open leads, and what happened inside the window', () => {
    lead('new-pack@example.com', 'pack', 'new');
    lead('won-pack@example.com', 'pack', 'won');
    lead('lost-call@example.com', 'call', 'lost');
    lead('contacted-partner@example.com', 'partner', 'contacted');
    const oldSent = lead('old-sent@example.com', 'pack', 'pack_sent');
    const oldWon = lead('old-won@example.com', 'pack', 'won');
    age(oldSent.id, 10 * DAY);
    age(oldWon.id, 10 * DAY);

    expect(leadStats(Date.now() - 7 * DAY)).toEqual({ total: 6, packs: 4, won: 2, open: 3, packsSince: 2, wonSince: 1 });
    expect(leadStats(Date.now() - 30 * DAY)).toMatchObject({ packsSince: 4, wonSince: 2 });
  });
});

describe('recentLeadFrom', () => {
  it('finds the same address asking for the same thing within a day, whatever its case or spacing', () => {
    const created = lead('Agency@Example.com ');
    expect(recentLeadFrom('agency@example.com', 'pack')?.id).toBe(created.id);
    expect(recentLeadFrom('  AGENCY@example.COM', 'pack')?.id).toBe(created.id);
  });

  it('does not match a different kind of request or a different address', () => {
    lead('agency@example.com', 'pack');
    expect(recentLeadFrom('agency@example.com', 'call')).toBeNull();
    expect(recentLeadFrom('someone-else@example.com', 'pack')).toBeNull();
  });

  it('ignores requests older than the window, unless a longer window is asked for', () => {
    const created = lead('agency@example.com');
    age(created.id, 25 * HOUR);
    expect(recentLeadFrom('agency@example.com', 'pack')).toBeNull();
    expect(recentLeadFrom('agency@example.com', 'pack', 48 * HOUR)?.id).toBe(created.id);
  });

  it('returns the newest request when there are several', () => {
    const first = lead('agency@example.com');
    age(first.id, 2 * HOUR);
    const second = lead('agency@example.com');
    expect(recentLeadFrom('agency@example.com', 'pack')?.id).toBe(second.id);
  });
});

describe('POST /api/leads', () => {
  const alerts = vi.spyOn(mailer, 'founderLead');
  let visitor = 0;
  const post = async (payload: unknown, headers: Record<string, string> = {}) => {
    const req = new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', referer: 'http://localhost:3000/agencies', 'x-forwarded-for': `203.0.113.${++visitor}`, ...headers },
      body: JSON.stringify(payload),
    });
    const res = await POST(req, undefined);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const pack = {
    kind: 'pack', name: 'Sam Agency', email: 'Sam@Agency.co.uk', company: 'Agency Ltd', website: 'agency.co.uk',
    prospects: ['example.com/services', '', 'https://example.org/'], message: 'Web design in Leeds',
  };

  beforeEach(() => {
    alerts.mockReset();
    alerts.mockResolvedValue({ sent: true });
    session.token = undefined;
  });

  it('records a pack request, tidies it up and alerts the founder', async () => {
    const { status, body } = await post(pack);
    expect(status).toBe(201);
    expect(body).toMatchObject({ ok: true, id: expect.any(String) });
    expect(findLead(body.id as string)).toMatchObject({
      kind: 'pack', name: 'Sam Agency', email: 'sam@agency.co.uk', company: 'Agency Ltd', website: 'https://agency.co.uk/',
      prospects: ['https://example.com/services', 'https://example.org/'], message: 'Web design in Leeds', source: 'agencies', status: 'new', userId: null,
    });
    expect(alerts).toHaveBeenCalledTimes(1);
    expect(alerts).toHaveBeenCalledWith(env.founderAlertEmail, expect.objectContaining({ kind: 'pack', email: 'sam@agency.co.uk', adminUrl: `${env.appUrl}/admin/plan#pipeline` }));
  });

  it('treats the same email asking again within a day as a double submit', async () => {
    const first = await post(pack);
    const second = await post({ ...pack, name: 'Sam again' });
    expect(second).toEqual({ status: 201, body: { ok: true, id: first.body.id } });
    expect(listLeads()).toHaveLength(1);
    expect(alerts).toHaveBeenCalledTimes(1);
  });

  it('asks for the details a pack needs', async () => {
    const cases: [Record<string, string>, string][] = [
      [{ name: ' ' }, 'name'], [{ company: '' }, 'company'], [{ website: '' }, 'website'], [{ website: 'not a web address' }, 'website'], [{ email: 'nope' }, 'email'],
    ];
    for (const [patch, field] of cases) {
      const { status, body } = await post({ ...pack, ...patch });
      expect([field, status]).toEqual([field, 400]);
      expect(body.field).toBe(field);
    }
    expect(listLeads()).toHaveLength(0);
  });

  it('accepts a call request with just an email address', async () => {
    const { status, body } = await post({ kind: 'call', email: 'who@example.com' });
    expect(status).toBe(201);
    expect(findLead(body.id as string)).toMatchObject({ kind: 'call', name: '', company: '', website: '', prospects: [] });
  });

  it('rejects prospect pages that are not public websites, and says which', async () => {
    const { status, body } = await post({ ...pack, prospects: ['https://does-not-exist.example/', '', 'https://example.com/', 'http://10.0.0.1/admin'] });
    expect(status).toBe(400);
    expect(body).toMatchObject({ field: 'prospects', index: 0, code: 'invalid_prospect' });
    expect((body.problems as { index: number }[]).map((p) => p.index)).toEqual([0, 3]);
    expect(listLeads()).toHaveLength(0);
    expect(alerts).not.toHaveBeenCalled();
  });

  it('refuses other sites and filled-in honeypots', async () => {
    expect(await post(pack, { origin: 'https://evil.example' })).toMatchObject({ status: 403, body: { code: 'bad_origin' } });
    expect(await post({ ...pack, hp: 'http://spam.example' })).toMatchObject({ status: 400, body: { code: 'invalid' } });
    expect(listLeads()).toHaveLength(0);
  });

  it('still records the lead when the alert email cannot be sent', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    alerts.mockRejectedValueOnce(new Error('smtp down'));
    const { status } = await post(pack);
    quiet.mockRestore();
    expect(status).toBe(201);
    expect(listLeads()).toHaveLength(1);
  });

  it('links the lead to the signed-in account', async () => {
    const user = createUser({ email: `lead-${Math.random().toString(36).slice(2)}@example.com`, name: 'T', passwordHash: 'x' });
    session.token = createSession(user.id).token;
    const { body } = await post(pack);
    expect(findLead(body.id as string)?.userId).toBe(user.id);
  });

  it('removes line breaks and control characters before they reach an email', async () => {
    const { body } = await post({ ...pack, name: 'Sam\r\nBcc: x@y.z', company: 'Agency\tLtd\u0000', message: 'Line one\r\nLine two\u0007' });
    expect(findLead(body.id as string)).toMatchObject({ name: 'Sam Bcc: x@y.z', company: 'Agency Ltd', message: 'Line one\nLine two' });
  });

  it('allows each visitor five requests an hour', async () => {
    const same = { 'x-forwarded-for': '198.51.100.9' };
    for (let i = 0; i < 5; i++) expect((await post({}, same)).status).toBe(400);
    expect(await post({}, same)).toMatchObject({ status: 429, body: { code: 'rate_limited' } });
  });
});
