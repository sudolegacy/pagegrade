import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db, now } from '@/lib/server/db';
import { createUser, findUserById, updateUser, type User, type UserFields } from '@/lib/server/users';
import { createClient } from '@/lib/server/clients';
import { createReview, createReviews } from '@/lib/server/reviews';
import { ONBOARDING_MONITORS, agencyOnboarding } from '@/lib/server/onboarding';

const intake = { url: 'https://example.com/', pageType: 'service' as const, goal: 'lead' as const, audience: 'Local firms', context: '' };
const batch = [intake, { ...intake, url: 'https://example.com/prices' }];

let seq = 0;
function newUser(fields: UserFields = {}): User {
  const user = createUser({ email: `onboarding${++seq}@example.com`, name: 'Test', passwordHash: 'x' });
  if (Object.keys(fields).length) updateUser(user.id, fields);
  return findUserById(user.id)!;
}
const agency = (fields: UserFields = {}) => newUser({ plan: 'agency', plan_status: 'active', ...fields });

function addMonitor(userId: string, opts: { active?: boolean } = {}) {
  db().prepare(`INSERT INTO monitors (id, user_id, url, kind, label, page_type, goal, audience, context, active, next_run_at, created_at)
    VALUES (?, ?, ?, 'own', '', 'service', 'lead', 'Local firms', '', ?, ?, ?)`).run(randomUUID(), userId, `https://client${++seq}.example.com/`, opts.active === false ? 0 : 1, now(), now());
}

/** Reads the account again, the way the overview page does on each visit. */
const progress = (user: User, opts?: { admin?: boolean }) => agencyOnboarding(findUserById(user.id)!, opts)!;
const doneIds = (user: User) => progress(user).steps.filter((s) => s.done).map((s) => s.id);

describe('agency onboarding', () => {
  it('starts with four steps in order, none done', () => {
    const o = progress(agency());
    expect(o.steps.map((s) => [s.id, s.href, s.done])).toEqual([
      ['brand', '/app/settings', false], ['client', '/app/clients', false], ['bulk', '/app/bulk', false], ['monitors', '/app/monitoring', false],
    ]);
    expect(o).toMatchObject({ done: 0, complete: false });
  });

  it('counts the brand step once there is a name or a logo', () => {
    const user = agency();
    updateUser(user.id, { brand_name: '   ' });
    expect(doneIds(user)).toEqual([]);
    updateUser(user.id, { brand_name: 'Northlight Digital' });
    expect(doneIds(user)).toEqual(['brand']);
    updateUser(user.id, { brand_name: '', brand_logo: 'logo-file.png' });
    expect(doneIds(user)).toEqual(['brand']);
  });

  it("counts the client step from the account's own first folder", () => {
    const user = agency();
    createClient(agency(), { name: "Someone else's client" });
    expect(doneIds(user)).toEqual([]);
    createClient(user, { name: 'Bright Dental' });
    expect(doneIds(user)).toEqual(['client']);
  });

  it('counts the bulk step only for a bulk batch of its own', () => {
    const user = agency();
    createReview(user, intake);
    createReviews(agency(), batch, { origin: 'bulk' });
    expect(doneIds(user)).toEqual([]);
    createReviews(user, batch, { origin: 'bulk' });
    expect(doneIds(user)).toEqual(['bulk']);
  });

  it('counts the monitors step at five active monitors, showing progress on the way', () => {
    const user = agency();
    expect(progress(user).steps[3].progress).toBeUndefined();

    for (let i = 0; i < ONBOARDING_MONITORS - 1; i++) addMonitor(user.id);
    addMonitor(user.id, { active: false });
    addMonitor(agency().id);
    expect(progress(user).steps[3]).toMatchObject({ id: 'monitors', done: false, progress: '4 of 5' });

    addMonitor(user.id);
    const step = progress(user).steps[3];
    expect(step.done).toBe(true);
    expect(step.progress).toBeUndefined();
  });

  it('is complete only when all four steps are done', () => {
    const user = agency({ brand_name: 'Northlight Digital' });
    createClient(user, { name: 'Bright Dental' });
    createReviews(user, batch, { origin: 'bulk' });
    for (let i = 0; i < ONBOARDING_MONITORS - 1; i++) addMonitor(user.id);
    expect(progress(user)).toMatchObject({ done: 3, complete: false });

    addMonitor(user.id);
    expect(progress(user)).toMatchObject({ done: 4, complete: true });
  });

  it('is for Agency accounts and admins only', () => {
    expect(agencyOnboarding(newUser())).toBeNull();
    expect(agencyOnboarding(newUser({ plan: 'pro', plan_status: 'active' }))).toBeNull();
    expect(agencyOnboarding(agency({ plan_status: 'canceled' }))).toBeNull();
    expect(agencyOnboarding(agency({ plan_status: 'trialing' }))).not.toBeNull();
    expect(agencyOnboarding(agency({ plan_status: 'past_due' }))).not.toBeNull();
    expect(agencyOnboarding(newUser(), { admin: true })).not.toBeNull();
  });
});
