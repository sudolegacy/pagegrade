import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { db, now } from './db';
import { env } from './env';
import { randomId, sha256 } from './ids';
import { toUser, type User } from './users';
import { HttpError } from './errors';

const DAY = 24 * 60 * 60 * 1000;
const TTL = 30 * DAY;
export const sessionCookieName = () => (env.appUrl.startsWith('https://') ? '__Host-pg_session' : 'pg_session');

export function createSession(userId: string, userAgent = ''): { token: string; expires: Date } {
  const token = randomId(32);
  const t = now();
  db().prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)').run(sha256(token), userId, t, t + TTL, t, userAgent.slice(0, 200));
  if (Math.random() < 0.05) db().prepare('DELETE FROM sessions WHERE expires_at < ?').run(t);
  return { token, expires: new Date(t + TTL) };
}

export function setSessionCookie(res: NextResponse, session: { token: string; expires: Date }) {
  res.cookies.set(sessionCookieName(), session.token, { httpOnly: true, secure: env.appUrl.startsWith('https://'), sameSite: 'lax', path: '/', expires: session.expires });
}
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(sessionCookieName(), '', { httpOnly: true, secure: env.appUrl.startsWith('https://'), sameSite: 'lax', path: '/', maxAge: 0 });
}

/** Resolves a session token to its user, sliding the expiry forward at most once a day. */
export function userFromToken(token: string | undefined | null): User | null {
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const row = db().prepare('SELECT s.expires_at AS s_expires, s.last_seen_at AS s_seen, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?').get(id) as (Record<string, unknown> & { s_expires: number; s_seen: number }) | undefined;
  if (!row) return null;
  const t = now();
  if (row.s_expires < t) { db().prepare('DELETE FROM sessions WHERE id = ?').run(id); return null; }
  if (t - row.s_seen > DAY) db().prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?').run(t, t + TTL, id);
  return toUser(row as never);
}

export function destroySession(token: string | undefined | null) {
  if (token) db().prepare('DELETE FROM sessions WHERE id = ?').run(sha256(token));
}
export function destroyAllSessions(userId: string, exceptToken?: string) {
  if (exceptToken) db().prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(userId, sha256(exceptToken));
  else db().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

/** Current user in server components and route handlers. */
export async function currentUser(): Promise<User | null> {
  const store = await cookies();
  return userFromToken(store.get(sessionCookieName())?.value);
}
export async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function requireApiUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Please sign in to continue.', 'unauthenticated');
  return user;
}

export const isAdmin = (user: User | null) => !!user && env.adminEmails.includes(user.email.toLowerCase());
