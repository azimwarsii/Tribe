import type { NextFunction, Request, Response } from "express";

/**
 * Fixed-window request limit per client IP, kept in memory (fine for one server). Behind a tunnel or proxy, set
 * TRUST_PROXY=1 so req.ip is the visitor's address rather than the proxy's.
 */
export function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    let h = hits.get(key);
    if (!h || h.reset <= now) {
      h = { n: 0, reset: now + windowMs };
      hits.set(key, h);
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    }
    if (++h.n <= max) return next();
    res.setHeader("Retry-After", String(Math.ceil((h.reset - now) / 1000)));
    res.status(429).json({ error: "Too many requests. Wait a minute and try again." });
  };
}
