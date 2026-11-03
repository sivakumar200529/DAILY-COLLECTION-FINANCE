import { AsyncLocalStorage } from 'async_hooks';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { NextFunction, Request, Response } from 'express';
import type { User } from './db.ts';

/** The PIN a collector or customer starts with until the office (or they) change it. */
export const STARTING_PIN = '1234';

/**
 * Open sessions, by a hash of the login token (the token itself is never stored). They are kept in a
 * small file beside the data file, written only on login and logout, so a server restart does not sign
 * everyone out; "last seen" stays in memory.
 */
const sessionsFile = path.resolve(
  process.env.KRS_DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'krs_sessions.json'
);
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_ACTIVE_MS = 3 * 60 * 1000;

interface Session {
  userId: string;
  createdAt: number;
  lastSeen: number;
}

const sessions = new Map<string, Session>();
try {
  const saved = JSON.parse(fs.readFileSync(sessionsFile, 'utf8')) as [string, Session][];
  for (const [key, s] of saved) if (Date.now() - s.createdAt < SESSION_MAX_AGE_MS) sessions.set(key, s);
} catch {
  // No sessions yet.
}

function saveSessions() {
  fs.writeFileSync(sessionsFile, JSON.stringify([...sessions]));
}

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function bearerToken(req: Request): string {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

/** A new session for this user; returns the token the app keeps. */
export function openSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(hash(token), { userId, createdAt: Date.now(), lastSeen: Date.now() });
  saveSessions();
  return token;
}

export function closeSession(token: string) {
  if (sessions.delete(hash(token))) saveSessions();
}

/** Signs a person out everywhere (their login was changed, switched off or deleted). */
export function closeSessionsOf(userId: string) {
  let changed = false;
  for (const [key, s] of sessions) if (s.userId === userId) changed = sessions.delete(key) || changed;
  if (changed) saveSessions();
}

/** The user ID behind a token, or undefined when it is unknown or expired. */
export function sessionUser(token: string): string | undefined {
  if (!token) return undefined;
  const s = sessions.get(hash(token));
  if (!s) return undefined;
  if (Date.now() - s.createdAt >= SESSION_MAX_AGE_MS) {
    sessions.delete(hash(token));
    saveSessions();
    return undefined;
  }
  return s.userId;
}

/** The app is open: keeps the session showing as active. */
export function touchSession(token: string): boolean {
  const s = sessions.get(hash(token));
  if (!s) return false;
  s.lastSeen = Date.now();
  return true;
}

export function sessionInfo(userId: string): { active_sessions: number; last_seen_at?: string } {
  const now = Date.now();
  const mine = [...sessions.values()].filter(x => x.userId === userId);
  const lastSeen = Math.max(0, ...mine.map(x => x.lastSeen));
  return {
    active_sessions: mine.filter(x => now - x.lastSeen < SESSION_ACTIVE_MS).length,
    ...(lastSeen ? { last_seen_at: new Date(lastSeen).toISOString() } : {}),
  };
}

/** Compares a typed password with the stored one in constant time. */
export function passwordMatches(user: User, typed: string): boolean {
  const a = Buffer.from(user.password || STARTING_PIN);
  const b = Buffer.from(typed);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The signed-in person for the request being handled (for the audit log and ownership checks). */
const current = new AsyncLocalStorage<User>();
export const actor = (): User | undefined => current.getStore();

type Rule = [method: string, path: RegExp];

/** What a collector's app may call; the office (ADMIN) may call everything. */
const COLLECTOR_ROUTES: Rule[] = [
  ['GET', /^\/api\/collectors$/],
  ['GET', /^\/api\/daily-collections$/],
  ['GET', /^\/api\/daily-collections\/assignment$/],
  ['POST', /^\/api\/daily-collections\/collect$/],
  ['POST', /^\/api\/payments\/[^/]+\/undo$/],
  ['GET', /^\/api\/receipts\/[^/]+$/],
  ['GET', /^\/api\/collector-reports$/],
  ['POST', /^\/api\/collector-reports$/],
];

/** What a customer's app may call (always for their own customer ID). */
const CUSTOMER_ROUTES: Rule[] = [
  ['GET', /^\/api\/customers\/[^/]+\/360$/],
  ['GET', /^\/api\/collectors$/],
  ['GET', /^\/api\/customer\/loan-requests$/],
  ['POST', /^\/api\/customer\/loan-request$/],
  ['POST', /^\/api\/customer\/payment-claim$/],
];

/** Everyone signed in. */
const SHARED_ROUTES: Rule[] = [
  ['GET', /^\/api\/auth\/me$/],
  ['POST', /^\/api\/auth\/(heartbeat|logout)$/],
  ['GET', /^\/api\/notifications$/],
  ['PUT', /^\/api\/notifications\/(read-all|[^/]+\/read)$/],
];

/**
 * Open without signing in: the login itself, signing out (which only ends the session it is given),
 * and the organisation's name and logo for the login page.
 */
const PUBLIC_ROUTES: Rule[] = [
  ['POST', /^\/api\/auth\/(login|logout)$/],
  ['GET', /^\/api\/config$/],
];

const allowed = (rules: Rule[], req: Request) => rules.some(([m, p]) => m === req.method && p.test(req.path));

/**
 * Every /api call needs a signed-in, active user, and collectors and customers only reach their own
 * screens' calls. Their own collector or customer ID is put into the request, so they never see or
 * change anyone else's work.
 */
export function requireSignIn(findUser: (id: string) => User | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/') || allowed(PUBLIC_ROUTES, req)) return next();
    const userId = sessionUser(bearerToken(req));
    const user = userId ? findUser(userId) : undefined;
    if (!user || !user.is_active) return res.status(401).json({ error: 'Please sign in again.' });

    if (user.role !== 'ADMIN' && !allowed(SHARED_ROUTES, req)) {
      const own = user.role === 'COLLECTOR' ? COLLECTOR_ROUTES : CUSTOMER_ROUTES;
      if (!allowed(own, req)) return res.status(403).json({ error: 'You do not have access to this.' });
    }

    const query = req.query as Record<string, unknown>;
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    if (user.role === 'COLLECTOR') {
      if (!user.collector_id) return res.status(403).json({ error: 'This login is not linked to a collector.' });
      query.collector = user.collector_id;
      query.collector_id = user.collector_id;
      if (req.method !== 'GET') body.collector_id = user.collector_id;
    }
    if (user.role === 'CUSTOMER') {
      if (!user.customer_id) return res.status(403).json({ error: 'This login is not linked to a customer.' });
      const pathId = req.path.match(/^\/api\/customers\/([^/]+)\/360$/)?.[1];
      if (pathId && decodeURIComponent(pathId) !== user.customer_id) {
        return res.status(403).json({ error: 'You do not have access to this.' });
      }
      query.customer_id = user.customer_id;
      if (req.method !== 'GET') body.customer_id = user.customer_id;
    }
    if (user.role !== 'ADMIN' && req.path.startsWith('/api/notifications')) query.role = user.role;
    req.body = body;

    current.run(user, next);
  };
}
