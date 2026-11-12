import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/server/db';
import { env } from '@/lib/server/env';
import { HttpError } from '@/lib/server/errors';
import { createUser, findUserById, updateUser, type User, type UserFields } from '@/lib/server/users';
import { createLead, findLead, updateLead } from '@/lib/server/leads';
import { claimNextReview, completeReview, failReview } from '@/lib/server/reviews';
import { createClient, clientLook, deleteClient, getClient, listClients, updateClient, type ClientLook } from '@/lib/server/clients';
import { MAX_LOGO_BYTES, brandFor, brandForReview, removeClientLogo, removeLogo, reportBrand, saveClientLogo, saveLogo } from '@/lib/server/brand';
import { buildPack, packContext, packFolderName, packFor, packReplyText, packStatus, prospectUrls, type PackReview, type PackStatus } from '@/lib/server/packs';
import { GET as getPack, POST as postPack } from '@/app/api/admin/leads/[id]/pack/route';
import { DELETE as deleteClientRoute, PATCH as patchClient } from '@/app/api/clients/[id]/route';
import { DELETE as deleteLogoRoute, POST as postLogo } from '@/app/api/clients/[id]/logo/route';
import { GET as getPdf } from '@/app/api/reviews/[id]/pdf/route';
import type { Report } from '@/lib/engine/report';

// Routes read the signed-in user from the session; the PDF renderer needs a browser, so only its footer is captured.
const session = vi.hoisted(() => ({ user: null as unknown }));
vi.mock('@/lib/server/session', async () => {
  const { HttpError } = await import('@/lib/server/errors');
  const { env } = await import('@/lib/server/env');
  return {
    requireApiUser: async () => {
      if (!session.user) throw new HttpError(401, 'Please sign in to continue.', 'unauthenticated');
      return session.user;
    },
    isAdmin: (user: { email: string } | null) => !!user && env.adminEmails.includes(user.email.toLowerCase()),
  };
});
const pdf = vi.hoisted(() => ({ footers: [] as string[] }));
vi.mock('@/lib/server/pdf', () => ({
  renderReviewPdf: async (_id: string, _userId: string, footer: string) => { pdf.footers.push(footer); return Buffer.from('%PDF-1.4'); },
}));

const ORIGIN = 'http://localhost:3000';
const PROSPECTS = ['https://harbourdental.co.uk/', 'https://www.bluebirdflowers.co.uk/shop', 'https://northsidegym.co.uk/'];

let seq = 0;
function newUser(fields: UserFields = {}): User {
  const u = createUser({ email: `person${++seq}@example.com`, name: 'Test', passwordHash: 'x' });
  if (Object.keys(fields).length) updateUser(u.id, fields);
  return findUserById(u.id)!;
}
const agencyUser = (fields: UserFields = {}) => newUser({ plan: 'agency', plan_status: 'active', ...fields });

let admin: User;
beforeAll(() => { admin = createUser({ email: 'admin@example.com', name: 'Founder', passwordHash: 'x' }); });
beforeEach(() => {
  for (const table of ['reviews', 'clients', 'leads']) db().prepare(`DELETE FROM ${table}`).run();
  session.user = null;
  pdf.footers.length = 0;
});

const packLead = (over: Partial<Parameters<typeof createLead>[0]> = {}) => createLead({
  kind: 'pack', name: 'Sam Carter', email: 'sam@northside.co.uk', company: 'Northside Digital', website: 'https://northside.co.uk/',
  message: 'We build sites for trades in Leeds.', prospects: PROSPECTS, ...over,
});

type ReviewRow = { id: string; url: string; user_id: string; client_id: string | null; batch_id: string | null; origin: string; status: string; page_type: string; goal: string; audience: string; context: string };
const batchRows = (batchId: string) => db().prepare('SELECT id, url, user_id, client_id, batch_id, origin, status, page_type, goal, audience, context FROM reviews WHERE batch_id = ? ORDER BY created_at').all(batchId) as ReviewRow[];

type Outcome = 'complete' | 'failed' | 'queued' | 'running';
const SCORES = [62, 48, 71, 55, 80];
const GRADES = ['C', 'D', 'B', 'C', 'A'];
/** Sets the state of the batch's reviews, in the order the prospects were given. */
function mark(batchId: string, ...outcomes: Outcome[]) {
  const rows = batchRows(batchId);
  outcomes.forEach((outcome, i) => {
    if (outcome === 'complete') db().prepare("UPDATE reviews SET status = 'complete', score = ?, grade = ?, report_json = '{}' WHERE id = ?").run(SCORES[i], GRADES[i], rows[i].id);
    else if (outcome === 'failed') db().prepare("UPDATE reviews SET status = 'failed', error_message = 'The page blocked our browser.' WHERE id = ?").run(rows[i].id);
    else db().prepare('UPDATE reviews SET status = ? WHERE id = ?').run(outcome, rows[i].id);
  });
}

const png = (width = 40, height = 20) => sharp({ create: { width, height, channels: 3, background: '#1f6feb' } }).png().toBuffer();
const logoFile = (file: string) => path.join(env.brandsDir, file);

const request = (url: string, init: { method?: string; body?: BodyInit; json?: unknown; origin?: string | null } = {}) => {
  const headers: Record<string, string> = {};
  if (init.origin !== null) headers.origin = init.origin ?? ORIGIN;
  if (init.json !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`${ORIGIN}${url}`, { method: init.method ?? 'GET', headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
};
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const result = async (res: Response) => ({ status: res.status, body: (await res.json()) as Record<string, unknown> });

describe('buildPack', () => {
  it('files the prospects in a folder named after the agency and queues them as one batch', () => {
    const lead = packLead();
    const built = buildPack(admin, lead.id);
    expect(built.queued).toBe(3);

    expect(getClient(admin.id, built.clientId)).toMatchObject({
      name: 'Northside Digital', website: 'https://northside.co.uk', reviews: 3,
      brand: { name: 'Northside Digital', color: '', logo: null, logoUrl: null },
    });
    const rows = batchRows(built.batchId);
    expect(rows.map((r) => r.url)).toEqual(PROSPECTS);
    for (const r of rows) {
      expect(r).toMatchObject({ user_id: admin.id, client_id: built.clientId, batch_id: built.batchId, origin: 'bulk', status: 'queued', page_type: 'service', goal: 'contact', audience: 'Potential customers of this business' });
      expect(r.context).toBe('Prospect pack for Northside Digital. Note from the agency: We build sites for trades in Leeds.');
    }
    expect(findLead(lead.id)).toMatchObject({ clientId: built.clientId, batchId: built.batchId, status: 'contacted' });
  });

  it('leaves a lead that is further along where it is, and omits an empty message from the context', () => {
    const lead = packLead({ message: '' });
    updateLead(lead.id, { status: 'pack_sent' });
    const built = buildPack(admin, lead.id);
    expect(findLead(lead.id)!.status).toBe('pack_sent');
    expect(batchRows(built.batchId)[0].context).toBe('Prospect pack for Northside Digital.');
  });

  it('keeps the context within the length reviews accept', () => {
    const lead = packLead({ message: 'word '.repeat(400) });
    expect(packContext(findLead(lead.id)!, 'Northside Digital').length).toBeLessThanOrEqual(1000);
  });

  it('gives a one-page pack a batch too, so its reviews can be found', () => {
    const lead = packLead({ prospects: ['https://harbourdental.co.uk/'] });
    const built = buildPack(admin, lead.id);
    expect(built.queued).toBe(1);
    expect(batchRows(built.batchId)).toHaveLength(1);
    expect(packStatus(findLead(lead.id)!)).toMatchObject({ total: 1, running: 1 });
  });

  it('is not held to the admin account\'s own plan', () => {
    expect(findUserById(admin.id)).toMatchObject({ plan: 'free' });
    expect(buildPack(admin, packLead().id).queued).toBe(3);
  });

  it('names the folder after the email domain when the lead has no company', () => {
    const lead = packLead({ company: '', email: 'sam@northside.co.uk' });
    expect(packFolderName(lead)).toBe('northside.co.uk');
    const built = buildPack(admin, lead.id);
    expect(getClient(admin.id, built.clientId)).toMatchObject({ name: 'northside.co.uk', brand: { name: 'northside.co.uk' } });
  });

  it('keeps a long company name within what a folder and its brand allow', () => {
    const built = buildPack(admin, packLead({ company: 'A'.repeat(120) }).id);
    const folder = getClient(admin.id, built.clientId)!;
    expect(folder.name).toHaveLength(80);
    expect(folder.brand.name).toHaveLength(60);
  });

  it('skips repeated prospects and anything that is not a public web page', () => {
    const lead = packLead({ prospects: ['https://harbourdental.co.uk/', 'harbourdental.co.uk', 'ftp://files.co.uk/', 'not a web address', 'http://localhost:3000/'] });
    expect(prospectUrls(lead)).toEqual(['https://harbourdental.co.uk/']);
    expect(buildPack(admin, lead.id).queued).toBe(1);
  });

  it('is idempotent while the batch is running or finished', () => {
    const lead = packLead();
    const first = buildPack(admin, lead.id);
    expect(buildPack(admin, lead.id)).toEqual({ clientId: first.clientId, batchId: first.batchId, queued: 0 });
    mark(first.batchId, 'complete', 'failed', 'running');
    expect(buildPack(admin, lead.id)).toEqual({ clientId: first.clientId, batchId: first.batchId, queued: 0 });
    expect(listClients(admin.id)).toHaveLength(1);
    expect(db().prepare('SELECT COUNT(*) AS n FROM reviews').get()).toEqual({ n: 3 });
  });

  it('queues the prospects again, in the same folder, when every review failed', () => {
    const lead = packLead();
    const first = buildPack(admin, lead.id);
    mark(first.batchId, 'failed', 'failed', 'failed');
    const second = buildPack(admin, lead.id);
    expect(second.queued).toBe(3);
    expect(second.clientId).toBe(first.clientId);
    expect(second.batchId).not.toBe(first.batchId);
    expect(findLead(lead.id)).toMatchObject({ clientId: first.clientId, batchId: second.batchId });
    expect(packStatus(findLead(lead.id)!)).toMatchObject({ total: 3, running: 3, failed: 0 });
    expect(listClients(admin.id)).toHaveLength(1);
  });

  it('queues again when the reviews of the pack were deleted, and makes a new folder if the old one is gone', () => {
    const lead = packLead();
    const first = buildPack(admin, lead.id);
    db().prepare('UPDATE reviews SET deleted_at = ? WHERE batch_id = ?').run(Date.now(), first.batchId);
    deleteClient(admin.id, first.clientId);
    const second = buildPack(admin, lead.id);
    expect(second.queued).toBe(3);
    expect(second.clientId).not.toBe(first.clientId);
    expect(getClient(admin.id, second.clientId)).toMatchObject({ name: 'Northside Digital', reviews: 3 });
  });

  it('rejects requests that are not packs, have no prospects, or do not exist', () => {
    const call = packLead({ kind: 'call' });
    const none = packLead({ prospects: [] });
    expect(() => buildPack(admin, call.id)).toThrowError(expect.objectContaining({ status: 400, code: 'not_a_pack' }));
    expect(() => buildPack(admin, none.id)).toThrowError(expect.objectContaining({ status: 400, code: 'no_prospects' }));
    expect(() => buildPack(admin, 'missing')).toThrowError(expect.objectContaining({ status: 404, code: 'not_found' }));
    expect(listClients(admin.id)).toHaveLength(0);
    expect(findLead(none.id)).toMatchObject({ clientId: null, batchId: null, status: 'new' });
  });

  it('is for admins only', () => {
    const lead = packLead();
    expect(() => buildPack(agencyUser(), lead.id)).toThrowError(expect.objectContaining({ status: 403, code: 'forbidden' }));
    expect(findLead(lead.id)).toMatchObject({ batchId: null });
  });

  it('leaves no folder behind when the reviews cannot be queued', () => {
    for (let i = 0; i < 24; i++) {
      db().prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, status, origin, created_at)
        VALUES (?, ?, 'https://filler.co.uk/', 'saas', 'trial', 'Founders', 'queued', 'bulk', ?)`).run(randomUUID(), admin.id, Date.now() + i);
    }
    const lead = packLead();
    expect(() => buildPack(admin, lead.id)).toThrowError(expect.objectContaining({ status: 409, code: 'too_many_in_progress' }));
    expect(listClients(admin.id)).toHaveLength(0);
    expect(findLead(lead.id)).toMatchObject({ clientId: null, batchId: null, status: 'new' });
  });

  it('runs the caller\'s check only when reviews are about to be queued', () => {
    const check = vi.fn();
    const lead = packLead();
    buildPack(admin, lead.id, { beforeQueue: check });
    expect(check).toHaveBeenCalledTimes(1);
    buildPack(admin, lead.id, { beforeQueue: check });
    expect(() => buildPack(admin, packLead({ prospects: [] }).id, { beforeQueue: check })).toThrowError(expect.objectContaining({ code: 'no_prospects' }));
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('queues nothing and makes no folder when that check refuses', () => {
    const lead = packLead();
    const refuse = () => { throw new HttpError(503, 'Busy', 'capacity'); };
    expect(() => buildPack(admin, lead.id, { beforeQueue: refuse })).toThrowError(expect.objectContaining({ status: 503, code: 'capacity' }));
    expect(listClients(admin.id)).toHaveLength(0);
    expect(db().prepare('SELECT COUNT(*) AS n FROM reviews').get()).toEqual({ n: 0 });
    expect(findLead(lead.id)).toMatchObject({ clientId: null, batchId: null, status: 'new' });
  });
});

describe('packStatus', () => {
  it('is empty until a pack has been built', () => {
    expect(packStatus(packLead())).toEqual({ total: 0, complete: 0, failed: 0, running: 0, reviews: [], folder: null });
    expect(packFor(packLead())).toBeNull();
  });

  it('counts finished, failed and unfinished reviews in the order of the prospects', () => {
    const lead = packLead();
    const built = buildPack(admin, lead.id);
    mark(built.batchId, 'complete', 'failed', 'running');
    const status = packStatus(findLead(lead.id)!);
    expect(status).toMatchObject({ total: 3, complete: 1, failed: 1, running: 1, folder: { id: built.clientId, brandName: 'Northside Digital', hasLogo: false } });
    const [done, failed, running] = status.reviews;
    expect(done).toEqual({ id: expect.any(String), url: PROSPECTS[0], status: 'complete', score: 62, grade: 'C', pdfUrl: `/api/reviews/${done.id}/pdf` });
    expect(failed).toMatchObject({ url: PROSPECTS[1], status: 'failed', score: null, error: 'The page blocked our browser.' });
    expect(running).toMatchObject({ url: PROSPECTS[2], status: 'running' });
    expect(running.error).toBeUndefined();
  });

  it('counts queued reviews as running', () => {
    const lead = packLead();
    buildPack(admin, lead.id);
    expect(packStatus(findLead(lead.id)!)).toMatchObject({ total: 3, running: 3, complete: 0 });
  });

  it('follows reviews through the real queue', () => {
    const lead = packLead();
    const built = buildPack(admin, lead.id);
    const report = { score: 70, grade: 'B', verdict: 'ok', finalUrl: PROSPECTS[0], meta: { usage: { costUsd: 0.02 } } } as unknown as Report;
    const first = claimNextReview('pack-worker', 60_000).claimed!;
    expect(first.id).toBe(batchRows(built.batchId)[0].id);
    expect(packStatus(findLead(lead.id)!)).toMatchObject({ running: 3, complete: 0 });
    completeReview(first.id, 'pack-worker', report, 1000);
    const second = claimNextReview('pack-worker', 60_000).claimed!;
    failReview(second.id, 'pack-worker', 'blocked', 'Blocked');
    expect(packStatus(findLead(lead.id)!)).toMatchObject({ total: 3, complete: 1, failed: 1, running: 1 });
    expect(packStatus(findLead(lead.id)!).reviews[0]).toMatchObject({ score: 70, grade: 'B' });
  });

  it('gives the share address of reviews that were shared, and ignores deleted reviews', () => {
    const lead = packLead();
    const built = buildPack(admin, lead.id);
    mark(built.batchId, 'complete', 'complete', 'complete');
    const [a, b] = batchRows(built.batchId);
    db().prepare("UPDATE reviews SET share_id = 'abcdefghij12' WHERE id = ?").run(a.id);
    db().prepare('UPDATE reviews SET deleted_at = ? WHERE id = ?').run(Date.now(), b.id);
    const status = packStatus(findLead(lead.id)!);
    expect(status.total).toBe(2);
    expect(status.reviews[0].shareUrl).toBe(`${env.appUrl}/r/abcdefghij12`);
    expect(status.reviews[1].shareUrl).toBeUndefined();
  });

  it('notices when the folder has its logo', async () => {
    const lead = packLead();
    const built = buildPack(admin, lead.id);
    await saveClientLogo(admin, built.clientId, await png());
    expect(packStatus(findLead(lead.id)!).folder).toMatchObject({ hasLogo: true });
  });
});

describe('packReplyText', () => {
  const lead = () => packLead();
  const done = (url: string, score: number, grade: string | null, status: PackReview['status'] = 'complete'): PackReview => ({ id: randomUUID(), url, status, score: status === 'complete' ? score : null, grade, pdfUrl: '/api/reviews/x/pdf' });
  const statusOf = (reviews: PackReview[], folder: PackStatus['folder'] = { id: 'c', brandName: 'Northside Digital', hasLogo: true }): PackStatus => ({
    total: reviews.length, complete: reviews.filter((r) => r.status === 'complete').length, failed: reviews.filter((r) => r.status === 'failed').length,
    running: reviews.filter((r) => r.status === 'queued' || r.status === 'running').length, reviews, folder,
  });
  const three = [done(PROSPECTS[0], 62, 'C'), done(PROSPECTS[1], 48, 'D'), done(PROSPECTS[2], 71, 'B')];

  it('reads as a short note naming each business with its score', () => {
    expect(packReplyText(lead(), statusOf(three), 'Alex Morgan', 'https://cal.com/alex/15min')).toBe([
      'Hi Sam,',
      "Thanks for sending these over. The audits are attached as PDFs, branded with Northside Digital's name and logo:",
      '- harbourdental.co.uk: 62/100 (C)\n- bluebirdflowers.co.uk/shop: 48/100 (D)\n- northsidegym.co.uk: 71/100 (B)',
      'Each one has the score, the fixes that matter most and suggested rewrites for the headline and main button, so they are ready to send on.',
      "If you'd like to send audits like these regularly, I can show you how it works in 15 minutes: https://cal.com/alex/15min",
      'Best wishes,\nAlex Morgan',
    ].join('\n\n'));
  });

  it('asks for a reply instead of linking when there is no booking page, and signs off without a name when there is none', () => {
    const text = packReplyText(lead(), statusOf(three), '', '');
    expect(text).toContain("regularly, reply and I'll show you how it works in 15 minutes.");
    expect(text.endsWith('\n\nBest wishes')).toBe(true);
    expect(packReplyText(lead(), statusOf(three), 'Alex', 'not a link')).not.toContain('not a link');
  });

  it('uses the booking link from the environment by default', () => {
    process.env.BOOKING_URL = 'https://cal.com/pagegrade/15min';
    try { expect(packReplyText(lead(), statusOf(three), 'Alex')).toContain('https://cal.com/pagegrade/15min'); }
    finally { delete process.env.BOOKING_URL; }
  });

  it('does not claim a logo the folder does not have, or a brand it does not have', () => {
    expect(packReplyText(lead(), statusOf(three, { id: 'c', brandName: 'Northside Digital', hasLogo: false }), 'A', '')).toContain("branded with Northside Digital's name:");
    const plain = packReplyText(lead(), statusOf(three, null), 'A', '');
    expect(plain).toContain('attached as PDFs:');
    expect(plain).not.toContain('branded');
  });

  it('covers only the reviews that finished, and is empty when none has', () => {
    const text = packReplyText(lead(), statusOf([three[0], done(PROSPECTS[1], 0, null, 'failed'), done(PROSPECTS[2], 0, null, 'running')]), 'A', '');
    expect(text).toContain('harbourdental.co.uk: 62/100 (C)');
    expect(text).not.toContain('bluebird');
    expect(text).not.toContain('northsidegym');
    expect(packReplyText(lead(), statusOf([done(PROSPECTS[1], 0, null, 'failed')]), 'A', '')).toBe('');
    expect(packReplyText(lead(), statusOf([]), 'A', '')).toBe('');
  });

  it('is worded for one audit, and copes with a missing grade or first name', () => {
    const text = packReplyText(packLead({ name: '' }), statusOf([done(PROSPECTS[0], 62, null)]), 'A', '');
    expect(text.startsWith('Hi there,')).toBe(true);
    expect(text).toContain('Thanks for sending this over. The audit is attached as a PDF, branded with');
    expect(text).toContain('- harbourdental.co.uk: 62/100\n');
    expect(text).toContain('It has the score');
    expect(text).toContain('so it is ready to send on.');
  });

  it('comes with the pack for the pipeline, ready only once something has finished', () => {
    const l = packLead();
    const built = buildPack(admin, l.id);
    expect(packFor(findLead(l.id)!)).toMatchObject({ clientId: built.clientId, batchId: built.batchId, reply: '' });
    mark(built.batchId, 'complete', 'complete', 'complete');
    const view = packFor(findLead(l.id)!)!;
    expect(view.status).toMatchObject({ total: 3, complete: 3 });
    expect(view.reply).toContain('harbourdental.co.uk: 62/100 (C)');
    expect(view.reply).toContain('Hi Sam,');
  });
});

describe('brandForReview', () => {
  const look = (over: { name?: string; website?: string; brand?: Partial<ClientLook['brand']> } = {}): ClientLook => ({
    id: 'c1', name: over.name ?? 'Harbour Dental', website: over.website ?? '',
    brand: { name: '', color: '', logo: null, logoUrl: null, ...over.brand },
  });
  const branded = (fields: UserFields = {}) => agencyUser({
    brand_name: 'Bright Studio', brand_color: '#111111', brand_website: 'https://bright.co.uk', brand_logo: 'bright-logo1.png', white_label: 1, ...fields,
  });

  it('prefers the folder\'s name, colour and logo, with the account\'s white label', () => {
    const user = branded();
    const folder = look({ website: 'https://harbourdental.co.uk', brand: { name: 'Harbour Dental', color: '#1f6feb', logo: 'harbour-logo1.png', logoUrl: '/api/brand/logo/harbour-logo1.png' } });
    expect(brandForReview(user, folder)).toEqual({
      name: 'Harbour Dental', color: '#1f6feb', website: 'https://harbourdental.co.uk', logo: 'harbour-logo1.png', logoUrl: '/api/brand/logo/harbour-logo1.png', whiteLabel: true,
    });
    expect(brandForReview(branded({ white_label: 0 }), folder)!.whiteLabel).toBe(false);
  });

  it('does not put the account\'s logo next to a folder that only has a name', () => {
    expect(brandForReview(branded(), look({ brand: { name: 'Harbour Dental' } }))).toMatchObject({ name: 'Harbour Dental', color: '', logo: null, logoUrl: null });
  });

  it('uses the account\'s website when the folder has none', () => {
    expect(brandForReview(branded(), look({ brand: { name: 'Harbour Dental' } }))!.website).toBe('https://bright.co.uk');
  });

  it('falls back to the account\'s branding for a folder without branding of its own, or without a folder', () => {
    const user = branded();
    const own = brandFor(user)!;
    expect(own).toMatchObject({ name: 'Bright Studio', logoUrl: '/api/brand/logo/bright-logo1.png' });
    expect(brandForReview(user, look())).toEqual(own);
    expect(brandForReview(user, look({ brand: { color: '#1f6feb' } }))).toEqual(own);
    expect(brandForReview(user, null)).toEqual(own);
    expect(brandForReview(user, undefined)).toEqual(own);
  });

  it('has nothing to show when neither the folder nor the account is branded', () => {
    expect(brandForReview(agencyUser(), look())).toBeNull();
    expect(brandForReview(null, look({ brand: { name: 'Harbour Dental' } }))).toBeNull();
  });

  it('ignores folder branding when the plan does not include branding', () => {
    const folder = look({ brand: { name: 'Harbour Dental' } });
    const free = newUser({ brand_name: 'Bright Studio' });
    expect(brandForReview(free, folder)).toBeNull();
    expect(brandForReview(newUser({ plan: 'pro', plan_status: 'active' }), folder)).toBeNull();
    expect(brandForReview(agencyUser({ plan_status: 'canceled' }), folder)).toBeNull();
    expect(brandForReview(admin, folder)).toMatchObject({ name: 'Harbour Dental' });
  });

  it('finds the folder through the review\'s client, and only the owner\'s folder', () => {
    const user = branded();
    const folder = createClient(user, { name: 'Harbour Dental', website: 'harbourdental.co.uk', brandName: 'Harbour Dental Ltd', brandColor: '#1F6FEB' });
    expect(reportBrand(user, folder.id)).toMatchObject({ name: 'Harbour Dental Ltd', color: '#1F6FEB', website: 'https://harbourdental.co.uk', whiteLabel: true });
    expect(reportBrand(user, null)).toEqual(brandFor(user));
    expect(reportBrand(user, 'gone')).toEqual(brandFor(user));
    expect(reportBrand(agencyUser(), folder.id)).toBeNull();
    expect(reportBrand(null, folder.id)).toBeNull();
  });
});

describe('client folder branding', () => {
  it('lets admins keep folders without a plan, but not other people without one', () => {
    expect(createClient(admin, { name: 'Prospect' }).name).toBe('Prospect');
    expect(() => createClient(newUser(), { name: 'Prospect' })).toThrowError(expect.objectContaining({ status: 402, code: 'clients_unavailable' }));
  });

  it('starts without branding and stores a name and colour', () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    expect(folder.brand).toEqual({ name: '', color: '', logo: null, logoUrl: null });
    const saved = updateClient(agency.id, folder.id, { brandName: '  Harbour   Dental Ltd ', brandColor: '#1F6FEB' });
    expect(saved).toMatchObject({ name: 'Harbour Dental', brand: { name: 'Harbour Dental Ltd', color: '#1F6FEB' } });
    expect(updateClient(agency.id, folder.id, { brandName: '', brandColor: '' }).brand).toMatchObject({ name: '', color: '' });
  });

  it('checks the name and colour', () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    expect(() => updateClient(agency.id, folder.id, { brandName: 'x'.repeat(61) })).toThrowError(expect.objectContaining({ status: 400, extra: { field: 'brandName' } }));
    for (const color of ['red', '#12345', '#1F6FEBB', '1F6FEB', '#GGGGGG']) {
      expect(() => updateClient(agency.id, folder.id, { brandColor: color }), color).toThrowError(expect.objectContaining({ status: 400, extra: { field: 'brandColor' } }));
    }
    expect(updateClient(agency.id, folder.id, { brandName: 'x'.repeat(60) }).brand.name).toHaveLength(60);
    expect(() => createClient(agency, { name: 'Other', brandColor: 'blue' })).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('changes only what it was given', () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental', website: 'harbourdental.co.uk', brandName: 'Harbour', brandColor: '#1F6FEB' });
    expect(updateClient(agency.id, folder.id, { name: 'Harbour Dental Care' })).toMatchObject({ name: 'Harbour Dental Care', website: 'https://harbourdental.co.uk', brand: { name: 'Harbour', color: '#1F6FEB' } });
    expect(updateClient(agency.id, folder.id, { brandColor: '#000000' })).toMatchObject({ name: 'Harbour Dental Care', brand: { name: 'Harbour', color: '#000000' } });
    expect(() => updateClient(agencyUser().id, folder.id, { brandName: 'Mine now' })).toThrowError(expect.objectContaining({ status: 404 }));
  });

  it('stores a logo as a PNG named for its owner, replaces it and removes it', async () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    const first = await saveClientLogo(agency, folder.id, await png(1200, 400));
    expect(first).toMatch(new RegExp(`^${agency.id}-[0-9a-f]{8}\\.png$`));
    expect(existsSync(logoFile(first))).toBe(true);
    const stored = await sharp(logoFile(first)).metadata();
    expect(stored).toMatchObject({ format: 'png', width: 600, height: 200 });
    expect(clientLook(agency.id, folder.id)!.brand).toEqual({ name: '', color: '', logo: first, logoUrl: `/api/brand/logo/${first}` });
    expect(brandForReview(agency, clientLook(agency.id, folder.id))).toMatchObject({ logo: first, name: '' });

    const second = await saveClientLogo(agency, folder.id, await png());
    expect(second).not.toBe(first);
    expect(existsSync(logoFile(first))).toBe(false);
    expect(existsSync(logoFile(second))).toBe(true);

    await removeClientLogo(agency, folder.id);
    expect(existsSync(logoFile(second))).toBe(false);
    expect(clientLook(agency.id, folder.id)!.brand.logo).toBeNull();
  });

  it('refuses logos that are not images or are too big, and leaves nothing behind', async () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    await expect(saveClientLogo(agency, folder.id, svg)).rejects.toMatchObject({ status: 400, code: 'logo_invalid' });
    await expect(saveClientLogo(agency, folder.id, Buffer.from('not an image'))).rejects.toMatchObject({ status: 400, code: 'logo_invalid' });
    await expect(saveClientLogo(agency, folder.id, Buffer.alloc(MAX_LOGO_BYTES + 1))).rejects.toMatchObject({ status: 413, code: 'logo_too_large' });
    expect(clientLook(agency.id, folder.id)!.brand.logo).toBeNull();
  });

  it('needs branding on the plan, and a folder of the user\'s own', async () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    await expect(saveClientLogo(newUser(), folder.id, await png())).rejects.toMatchObject({ status: 402, code: 'branding_unavailable' });
    await expect(saveClientLogo(agencyUser(), folder.id, await png())).rejects.toMatchObject({ status: 404 });
    await expect(saveClientLogo(agency, 'missing', await png())).rejects.toMatchObject({ status: 404 });
    await expect(removeClientLogo(agencyUser(), folder.id)).rejects.toMatchObject({ status: 404 });
    expect(clientLook(agency.id, folder.id)!.brand.logo).toBeNull();
  });

  it('still stores and replaces the account logo as before', async () => {
    const agency = agencyUser();
    const first = await saveLogo(agency, await png());
    expect(findUserById(agency.id)!.brand.logo).toBe(first);
    expect(existsSync(logoFile(first))).toBe(true);
    const second = await saveLogo(findUserById(agency.id)!, await png(50, 25));
    expect(existsSync(logoFile(first))).toBe(false);
    await expect(saveLogo(newUser(), await png())).rejects.toMatchObject({ status: 402 });
    await removeLogo(findUserById(agency.id)!);
    expect(existsSync(logoFile(second))).toBe(false);
    expect(findUserById(agency.id)!.brand.logo).toBeNull();
  });
});

describe('client branding routes', () => {
  const patch = async (user: User, id: string, json: unknown) => { session.user = user; return result(await patchClient(request(`/api/clients/${id}`, { method: 'PATCH', json }), ctx(id))); };

  it('saves the folder branding and ignores a logo name in the body', async () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    const res = await patch(agency, folder.id, { brandName: 'Harbour Dental Ltd', brandColor: '#1F6FEB', brandLogo: 'someone-else.png' });
    expect(res.status).toBe(200);
    expect(res.body.client).toMatchObject({ brand: { name: 'Harbour Dental Ltd', color: '#1F6FEB', logo: null, logoUrl: null } });
    expect(clientLook(agency.id, folder.id)!.brand.logo).toBeNull();
  });

  it('points at the field that is wrong', async () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    expect(await patch(agency, folder.id, { brandColor: 'blue' })).toMatchObject({ status: 400, body: { field: 'brandColor' } });
    expect(await patch(agency, folder.id, { brandName: 'x'.repeat(61) })).toMatchObject({ status: 400, body: { field: 'brandName' } });
    expect(await patch(agency, 'missing', { brandName: 'Fine' })).toMatchObject({ status: 404 });
  });

  it('needs branding on the plan for the branding fields only', async () => {
    const lapsed = agencyUser();
    const folder = createClient(lapsed, { name: 'Harbour Dental' });
    updateUser(lapsed.id, { plan_status: 'canceled' });
    const user = findUserById(lapsed.id)!;
    expect(await patch(user, folder.id, { brandName: 'Harbour' })).toMatchObject({ status: 402, body: { code: 'branding_unavailable' } });
    expect(await patch(user, folder.id, { name: 'Harbour Dental Care' })).toMatchObject({ status: 200 });
  });

  it('refuses a request from another site', async () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    session.user = agency;
    const res = await patchClient(request(`/api/clients/${folder.id}`, { method: 'PATCH', json: { brandName: 'X' }, origin: 'https://evil.example' }), ctx(folder.id));
    expect(await result(res)).toMatchObject({ status: 403, body: { code: 'bad_origin' } });
  });

  it('uploads and removes the logo, and deletes it with the folder', async () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    session.user = agency;
    const form = new FormData();
    form.set('logo', new File([new Uint8Array(await png())], 'logo.png', { type: 'image/png' }));
    const up = await result(await postLogo(request(`/api/clients/${folder.id}/logo`, { method: 'POST', body: form }), ctx(folder.id)));
    expect(up.status).toBe(200);
    const file = String(up.body.logo);
    expect(up.body.logoUrl).toBe(`/api/brand/logo/${file}`);
    expect(existsSync(logoFile(file))).toBe(true);

    expect((await result(await deleteLogoRoute(request(`/api/clients/${folder.id}/logo`, { method: 'DELETE' }), ctx(folder.id)))).status).toBe(200);
    expect(existsSync(logoFile(file))).toBe(false);

    const again = await saveClientLogo(agency, folder.id, await png());
    expect((await result(await deleteClientRoute(request(`/api/clients/${folder.id}`, { method: 'DELETE' }), ctx(folder.id)))).status).toBe(200);
    expect(existsSync(logoFile(again))).toBe(false);
    expect(getClient(agency.id, folder.id)).toBeNull();
  });

  it('asks for a file, and will not upload to someone else\'s folder or without branding', async () => {
    const agency = agencyUser();
    const folder = createClient(agency, { name: 'Harbour Dental' });
    const upload = async (user: User) => {
      session.user = user;
      const form = new FormData();
      form.set('logo', new File([new Uint8Array(await png())], 'logo.png', { type: 'image/png' }));
      return result(await postLogo(request(`/api/clients/${folder.id}/logo`, { method: 'POST', body: form }), ctx(folder.id)));
    };
    session.user = agency;
    expect(await result(await postLogo(request(`/api/clients/${folder.id}/logo`, { method: 'POST', body: new FormData() }), ctx(folder.id)))).toMatchObject({ status: 400, body: { code: 'logo_missing' } });
    expect(await upload(agencyUser())).toMatchObject({ status: 404 });
    expect(await upload(newUser())).toMatchObject({ status: 402, body: { code: 'branding_unavailable' } });
  });
});

describe('pack routes', () => {
  const asAdmin = () => { session.user = findUserById(admin.id); };
  const post = async (id: string, origin?: string | null) => result(await postPack(request(`/api/admin/leads/${id}/pack`, { method: 'POST', origin }), ctx(id)));
  const get = async (id: string) => result(await getPack(request(`/api/admin/leads/${id}/pack`), ctx(id)));

  it('builds the pack and says where it stands', async () => {
    asAdmin();
    const lead = packLead();
    expect(await get(lead.id)).toMatchObject({ status: 200, body: { built: false, clientId: null, batchId: null, status: null, reply: '' } });

    const built = await post(lead.id);
    expect(built.status).toBe(201);
    expect(built.body).toMatchObject({ queued: 3, status: { total: 3, running: 3, complete: 0 }, reply: '' });
    expect(built.body.clientId).toBe(findLead(lead.id)!.clientId);

    const again = await post(lead.id);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ queued: 0, batchId: built.body.batchId });

    mark(String(built.body.batchId), 'complete', 'complete', 'complete');
    const done = await get(lead.id);
    expect(done.body).toMatchObject({ built: true, batchId: built.body.batchId, status: { total: 3, complete: 3 } });
    expect(String(done.body.reply)).toContain('harbourdental.co.uk: 62/100 (C)');
  });

  it('explains why a request cannot become a pack', async () => {
    asAdmin();
    expect(await post(packLead({ kind: 'partner' }).id)).toMatchObject({ status: 400, body: { code: 'not_a_pack' } });
    expect(await post(packLead({ prospects: [] }).id)).toMatchObject({ status: 400, body: { code: 'no_prospects' } });
    expect(await post('missing')).toMatchObject({ status: 404, body: { code: 'not_found' } });
    expect(await get('missing')).toMatchObject({ status: 404 });
  });

  it('is for admins who are signed in, and refuses requests from other sites', async () => {
    const lead = packLead();
    expect(await post(lead.id)).toMatchObject({ status: 401 });
    session.user = agencyUser();
    expect(await post(lead.id)).toMatchObject({ status: 403, body: { code: 'forbidden' } });
    expect(await get(lead.id)).toMatchObject({ status: 403 });
    asAdmin();
    expect(await post(lead.id, 'https://evil.example')).toMatchObject({ status: 403, body: { code: 'bad_origin' } });
    expect(await post(lead.id, null)).toMatchObject({ status: 403, body: { code: 'bad_origin' } });
    expect(findLead(lead.id)).toMatchObject({ batchId: null });
  });

  it('stops at the daily AI budget like the other review routes, but not for a pack that is already built', async () => {
    asAdmin();
    const built = packLead();
    expect((await post(built.id)).status).toBe(201);
    process.env.AI_DAILY_BUDGET_USD = '0.001';
    process.env.AI_DAILY_HARD_CAP_USD = '100';
    try {
      db().prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, status, origin, cost_usd, finished_at, created_at)
        VALUES (?, ?, 'https://filler.co.uk/', 'saas', 'trial', 'Founders', 'complete', 'app', 0.01, ?, ?)`).run(randomUUID(), admin.id, Date.now(), Date.now());
      const lead = packLead({ email: 'kim@other.co.uk' });
      expect(await post(lead.id)).toMatchObject({ status: 503, body: { code: 'capacity' } });
      expect(listClients(admin.id)).toHaveLength(1);
      expect(findLead(lead.id)).toMatchObject({ clientId: null, batchId: null, status: 'new' });
      expect(await post(built.id)).toMatchObject({ status: 200, body: { queued: 0 } });
    } finally {
      delete process.env.AI_DAILY_BUDGET_USD;
      delete process.env.AI_DAILY_HARD_CAP_USD;
    }
  });
});

describe('PDF and shared report branding', () => {
  const finished = (user: User, clientId: string | null) => {
    const id = randomUUID();
    db().prepare(`INSERT INTO reviews (id, user_id, url, page_type, goal, audience, status, origin, client_id, report_json, score, grade, created_at, finished_at)
      VALUES (?, ?, 'https://harbourdental.co.uk/', 'service', 'contact', 'Customers', 'complete', 'bulk', ?, '{}', 62, 'C', ?, ?)`).run(id, user.id, clientId, Date.now(), Date.now());
    return id;
  };
  const download = async (user: User, id: string) => {
    session.user = user;
    const res = await getPdf(request(`/api/reviews/${id}/pdf`), ctx(id));
    expect(res.status).toBe(200);
    return pdf.footers.at(-1);
  };

  it('puts the folder\'s name in the PDF footer of a white-label review, and the account\'s when it is not filed in a branded folder', async () => {
    const agency = agencyUser({ brand_name: 'Bright Studio', white_label: 1 });
    const branded = createClient(agency, { name: 'Harbour Dental', brandName: 'Harbour Dental Ltd' });
    const plain = createClient(agency, { name: 'Other client' });
    expect(await download(agency, finished(agency, branded.id))).toBe('Harbour Dental Ltd · Review of harbourdental.co.uk');
    expect(await download(agency, finished(agency, plain.id))).toBe('Bright Studio · Review of harbourdental.co.uk');
    expect(await download(agency, finished(agency, null))).toBe('Bright Studio · Review of harbourdental.co.uk');
  });

  it('keeps PageGrade\'s name in the footer unless white label is on', async () => {
    const agency = agencyUser({ brand_name: 'Bright Studio' });
    const folder = createClient(agency, { name: 'Harbour Dental', brandName: 'Harbour Dental Ltd' });
    expect(await download(agency, finished(agency, folder.id))).toBe('PageGrade review of harbourdental.co.uk');
  });

  it.each([
    'app/print/[id]/page.tsx',
    'app/(report)/r/[shareId]/page.tsx',
    'app/(report)/r/[shareId]/layout.tsx',
    'app/api/reviews/[id]/pdf/route.ts',
  ])('%s finds its brand through the review\'s folder', (file) => {
    // The pages are JSX, which the unit-test transform does not handle, so they are checked from the source.
    const source = readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
    expect(source).toMatch(/reportBrand\(.*\.clientId\)/);
    expect(source).not.toMatch(/\bbrandFor\(/);
  });
});
