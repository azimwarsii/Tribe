import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const secret = () => process.env.SESSION_SECRET ?? process.env.CRE_SHARED_SECRET ?? "dev-secret";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex").slice(0, 32);

/** Token handed out by the Telegram /web command. Format: <userId>.<expiryMs>.<sig> */
export function makeLoginToken(userId: number, ttlMs = 15 * 60_000): string {
  const body = `${userId}.${Date.now() + ttlMs}`;
  return `${body}.${sign(body)}`;
}

export function verify(token: string | undefined): number | undefined {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) return undefined;
  const [id, exp, sig] = parts;
  const good = sign(`${id}.${exp}`);
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return undefined;
  if (Number(exp) < Date.now()) return undefined;
  return Number(id);
}

/** Session cookie: same signed format with a 30 day expiry. */
export const makeSession = (id: number) => makeLoginToken(id, 30 * 24 * 3600_000);

/** Signed in by the session cookie (the app) or by `Authorization: Bearer <agent token>` (the MCP server and other agents). */
export function currentUser(req: Request): number | undefined {
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "")?.[1];
  if (bearer) return verify(bearer);
  const m = /(?:^|; )tribe=([^;]+)/.exec(req.headers.cookie ?? "");
  return verify(m?.[1]);
}

export function consumeLogin(token: string, res: Response): number | undefined {
  const id = verify(token);
  if (id === undefined) return undefined;
  res.setHeader("Set-Cookie", `tribe=${makeSession(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
  return id;
}
