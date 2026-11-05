import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { db } from "./db.js";

const secret = () => process.env.SESSION_SECRET ?? process.env.CRE_SHARED_SECRET ?? "dev-secret";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex").slice(0, 32);
const sigOk = (sig: string, good: string) => sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good));

/** Short-lived link token (Telegram /web sign-in, Telegram linking). Format: <userId>.<expiryMs>.<sig>. Never a session. */
export function makeLoginToken(userId: number, ttlMs = 15 * 60_000): string {
  const body = `${userId}.${Date.now() + ttlMs}`;
  return `${body}.${sign(body)}`;
}

export function verify(token: string | undefined): number | undefined {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) return undefined;
  const [id, exp, sig] = parts;
  if (!sigOk(sig, sign(`${id}.${exp}`))) return undefined;
  if (Number(exp) < Date.now()) return undefined;
  return Number(id);
}

// ---- Sessions ----
// One row per signed-in browser ("web") or AI agent token ("agent"). The token only names the row, so signing out,
// "sign out everywhere" and revoking an agent token take effect on the very next request.

export type SessionKind = "web" | "agent";
export interface Session { id: string; user: number; kind: SessionKind; name: string | null; user_agent: string | null; created_at: number; last_seen: number; expires_at: number }

const DAY = 86_400_000;
const LIFETIME: Record<SessionKind, number> = { web: 30 * DAY, agent: 90 * DAY };
const TOUCH_MS = 5 * 60_000; // last_seen is refreshed at most this often

/** Start a session and return its token: s.<id>.<sig>. */
export function createSession(user: number, kind: SessionKind, opts: { name?: string; req?: Request } = {}): string {
  const id = randomBytes(18).toString("hex");
  const now = Date.now();
  const ua = opts.req?.headers["user-agent"]?.slice(0, 200) ?? null;
  db.prepare("INSERT INTO sessions (id, user, kind, name, user_agent, created_at, last_seen, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, user, kind, opts.name ?? null, ua, now, now, now + LIFETIME[kind]);
  return `s.${id}.${sign(`s.${id}`)}`;
}

/** The live session a token names, or undefined (bad signature, unknown, revoked or expired). */
export function sessionOf(token: string | undefined): Session | undefined {
  const m = /^s\.([0-9a-f]{36})\.([0-9a-f]{32})$/.exec(token ?? "");
  if (!m || !sigOk(m[2], sign(`s.${m[1]}`))) return undefined;
  const s = db.prepare("SELECT id, user, kind, name, user_agent, created_at, last_seen, expires_at FROM sessions WHERE id = ? AND revoked_at IS NULL").get(m[1]) as Session | undefined;
  const now = Date.now();
  if (!s || s.expires_at < now) return undefined;
  if (now - s.last_seen > TOUCH_MS) db.prepare("UPDATE sessions SET last_seen = ? WHERE id = ?").run(now, s.id);
  return s;
}

const tokenOf = (req: Request) =>
  /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "")?.[1] ?? /(?:^|; )tribe=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];

/** Signed in by the session cookie (the app) or by `Authorization: Bearer <agent token>` (the MCP server and other agents). */
export const currentSession = (req: Request) => sessionOf(tokenOf(req));
export const currentUser = (req: Request): number | undefined => currentSession(req)?.user;
/** Agent tokens can trade and read, but not manage the account (sessions, tokens, wallet, deletion). */
export const isAgent = (req: Request) => currentSession(req)?.kind === "agent";

/** The session cookie. Secure once the app is served over https. */
const cookie = (value: string, maxAgeSec: number) =>
  `tribe=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${(process.env.PUBLIC_URL ?? "").startsWith("https://") ? "; Secure" : ""}`;

/** Sign a browser in: a new web session and its cookie. Returns the Set-Cookie value for callers that set several. */
export function startSession(res: Response, user: number, req?: Request): string {
  const c = cookie(createSession(user, "web", { req }), LIFETIME.web / 1000);
  res.setHeader("Set-Cookie", c);
  return c;
}

/** Sign this browser out: revoke its session and clear the cookie. */
export function endSession(req: Request, res: Response) {
  const s = currentSession(req);
  if (s) revokeSession(s.user, s.id);
  res.setHeader("Set-Cookie", cookie("", 0));
}

export const sessionsOf = (user: number, kind: SessionKind) =>
  db.prepare("SELECT id, user, kind, name, user_agent, created_at, last_seen, expires_at FROM sessions WHERE user = ? AND kind = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen DESC").all(user, kind, Date.now()) as unknown as Session[];
export const revokeSession = (user: number, id: string) =>
  db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND user = ? AND revoked_at IS NULL").run(Date.now(), id, user).changes > 0;
/** Revoke every session of a kind (or all), except one (the caller's own browser). Returns how many ended. */
export const revokeSessions = (user: number, opts: { kind?: SessionKind; except?: string } = {}) =>
  Number(db.prepare(`UPDATE sessions SET revoked_at = ? WHERE user = ? AND revoked_at IS NULL${opts.kind ? " AND kind = ?" : ""} AND id <> ?`).run(Date.now(), user, ...(opts.kind ? [opts.kind] : []), opts.except ?? "").changes);

/** Sign in with a Telegram link token. Each link works once, then a web session replaces it. */
export function consumeLogin(token: string, res: Response, req?: Request): number | undefined {
  const id = verify(token);
  if (id === undefined) return undefined;
  const used = db.prepare("INSERT OR IGNORE INTO used_logins (sig, at) VALUES (?, ?)").run(token.split(".")[2], Date.now()).changes;
  if (!used) return undefined;
  db.prepare("DELETE FROM used_logins WHERE at < ?").run(Date.now() - DAY);
  startSession(res, id, req);
  return id;
}

// A new agent token is shown once, on the next Settings view within 5 minutes, then forgotten (only its row is kept).
const reveals = new Map<number, { token: string; at: number }>();
export const revealOnce = (user: number, token: string) => reveals.set(user, { token, at: Date.now() });
export function takeReveal(user: number): string | undefined {
  const r = reveals.get(user);
  reveals.delete(user);
  return r && Date.now() - r.at < TOUCH_MS ? r.token : undefined;
}

// ---- Sign-up ticket ----
// A new wallet has signed in through Privy but has no account yet. This short-lived signed cookie carries the Privy
// identity and the proven wallet to sign-up, where the user picks a username and the account is created with both.

const TICKET_MS = 30 * 60_000;
export interface SignupTicket { privy: string; wallet?: `0x${string}` }
const b64 = (s: string) => Buffer.from(s).toString("base64url");
export function makeSignupTicket(t: SignupTicket): string {
  const body = `su.${b64(t.privy)}.${t.wallet?.toLowerCase() ?? "-"}.${Date.now() + TICKET_MS}`;
  return `${body}.${sign(body)}`;
}
export function signupTicketOf(req: Request): SignupTicket | undefined {
  const t = /(?:^|; )tribe_signup=([^;]+)/.exec(req.headers.cookie ?? "")?.[1] ?? "";
  const m = /^su\.([A-Za-z0-9_-]+)\.(0x[0-9a-f]{40}|-)\.(\d+)\.([0-9a-f]{32})$/.exec(t);
  if (!m || !sigOk(m[4], sign(`su.${m[1]}.${m[2]}.${m[3]}`)) || Number(m[3]) < Date.now()) return undefined;
  return { privy: Buffer.from(m[1], "base64url").toString(), ...(m[2] === "-" ? {} : { wallet: m[2] as `0x${string}` }) };
}
export const signupTicketCookie = (t: SignupTicket) => `tribe_signup=${makeSignupTicket(t)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TICKET_MS / 1000}`;
export const clearSignupTicket = "tribe_signup=; Path=/; Max-Age=0";
