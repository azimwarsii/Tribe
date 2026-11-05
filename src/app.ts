import express, { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { catAsk, catConfirm } from "./cat.js";
import { handleEntry } from "./research.js";
import { consumeLogin, currentUser, makeLoginToken, makeSession } from "./auth.js";
import { copyOne, execute, mirror, type PendingNotice } from "./copy.js";
import { activeHtml, briefHtml, deckCards, deckLive, deckPage, deckTab } from "./views/deck.js";
import { publicSignalPage, signalCommentHtml, signalsPage, signalTab } from "./views/signals.js";
import { addSignalComment, postSignal, setSignalReaction, signalById, signalComments, signalExists } from "./signals.js";
import { CLIENT_JS } from "./client.js";
import { isReaction, reactBar, REACT_JS } from "./views/reactions.js";
import {
  addComment, addLedger, addRule, deleteRule, voteMsg, wipeCat, createSquad, joinSquad, leaveSquad, squadOf, claimQuest, addStrategy, claimPending, commentsOf, createWebUser, db, DEFAULT_RULES, getFollowRules, getMeta, getUser, ledgerOf, recordTrade, setFollow, setHandle, setMeta,
  setStrategyPublic, setReaction, tradeById, unfollow, userByHandle, userById, type Meta, allHalts, followingOf, haltOf, handleOk, isWatching, setWatch, recordSwipe,
} from "./db.js";
import { openPositions, portfolio, profile, symOf, topTraders, tradeCard } from "./data.js";
import { lastOracleCheck } from "./guard.js";
import { placeAndTrack, isDry, heldTokens, cancelProtective } from "./tracker.js";
import { updateTrigger, type Trade } from "./flash.js";
import { RISK_LINE } from "./rules.js";
import { creatorEarnings, activityCsv, activityPage, alertsPage, creatorPage, fundsPage, mePage, newStrategyPage, seasonPage, settingsPage, transferPage } from "./views/me.js";
import { onboardingPage, introPage, splashPage } from "./views/auth.js";
import { guardPage, ranksPage } from "./views/social.js";
import { catChatPage, catHomePage, catMemoryPage, catVoicePage, ctxBarHtml } from "./views/cat.js";
import { svgToPng, storySvg, copyPage, myTradersPage, ogSvg, positionsPage, profilePage, publicPage, requestsPage, sharePage, simulateCopy, threadPage, commentHtml } from "./views/trader.js";
import { esc, icon, notFound, page, SIDE_JS } from "./ui.js";
import { finalize } from "./views/chrome.js";
import { botPage, profileEditPage } from "./views/profile.js";
import { landingPage, portfolioPage, signinPage, topPage, topSvg } from "./views/web.js";
import { badgesPage, levelUpPage, progressPage, squadPage } from "./views/game.js";
import { questsOf, traderStats } from "./stats.js";
import { BEATS, runBeat } from "./director.js";
import { getPrice } from "./prices.js";

const BOT = () => process.env.BOT_USERNAME ?? "TribeTradeBot";

let notifier: ((p: PendingNotice[], leader: number) => void) | undefined;
/** Set by index.ts so web-initiated trades can push Telegram approval prompts. */
export const onPending = (fn: typeof notifier) => (notifier = fn);

const PERSONA: Record<string, { max: number; cap: number; stop: boolean; strict: Meta["strict"] }> = {
  Guardian: { max: 10, cap: 40, stop: true, strict: "Strict" },
  Hodler: { max: 20, cap: 80, stop: true, strict: "Balanced" },
  Sniper: { max: 25, cap: 100, stop: true, strict: "Balanced" },
  Degen: { max: 50, cap: 200, stop: false, strict: "Relaxed" },
};

const num = (v: unknown, d: number) => (Number(v) > 0 ? Number(v) : d);

export function appRouter(): Router {
  const r = Router();
  const json = express.json();
  /** Every page goes through finalize(): signed-in visitors get the web chrome (sidebar, top bar, rail) around the app column. */
  const html = async (res: Response, s: string, status = 200) => {
    try {
      const req = res.req;
      res.status(status).type("html").send(await finalize(s, currentUser(req), req.path));
    } catch (e) {
      console.error("render", e);
      if (!res.headersSent) res.status(500).send("Something went wrong");
    }
  };
  const me = (req: Request) => currentUser(req);

  /** Page route that needs a session; otherwise sends the visitor to the splash. */
  const authed = (fn: (uid: number, req: Request, res: Response) => Promise<string> | string) => async (req: Request, res: Response) => {
    const uid = me(req);
    if (uid === undefined) return res.redirect("/splash");
    try {
      html(res, await fn(uid, req, res));
    } catch (e) {
      console.error(req.path, e);
      html(res, notFound("Something went wrong"), 500);
    }
  };
  /** JSON action that needs a session. */
  const act = (fn: (uid: number, req: Request, res: Response) => Promise<unknown> | unknown) => async (req: Request, res: Response) => {
    const uid = me(req);
    if (uid === undefined) return res.status(401).json({ error: "Sign in first", redirect: "/splash" });
    try {
      res.json((await fn(uid, req, res)) ?? { ok: true });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  };

  r.get("/app.js", (_q, res) => res.type("application/javascript").set("Cache-Control", "no-cache").send(`${CLIENT_JS};\n${REACT_JS};\n${SIDE_JS}`));
  r.get("/", (req, res) => (me(req) === undefined ? html(res, landingPage()) : res.redirect("/feed")));
  r.get("/signin", (_q, res) => html(res, signinPage(process.env.DEMO === "true")));
  r.get("/portfolio", authed((uid) => portfolioPage(uid)));
  r.get("/splash", (req, res) => (me(req) !== undefined ? res.redirect("/feed") : html(res, splashPage())));
  r.get("/intro", (_q, res) => html(res, introPage()));
  r.get("/onboarding", (req, res) => html(res, onboardingPage(process.env.DEMO === "true" || isDry(), req.query.retake === "1", String(req.query.follow ?? ""))));
  r.get("/login", (req, res) => (consumeLogin(String(req.query.t ?? ""), res) !== undefined ? res.redirect("/feed") : html(res, notFound("Link expired. Send /web to the bot for a new one."), 400)));

  // Demo shortcut: sign in as the seeded viewer.
  if (process.env.DEMO === "true") {
    r.get("/demo", (_q, res) => {
      const u = userByHandle("you");
      if (!u) return res.status(404).send("Run npm run seed first");
      res.setHeader("Set-Cookie", `tribe=${makeSession(u.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
      res.redirect("/feed");
    });
  }

  // Demo director: a control panel for recording the demo video. Only exists when DEMO=true.
  if (process.env.DEMO === "true") {
    r.get("/director", async (_q, res) => {
      const price = await getPrice("0x4200000000000000000000000000000000000006");
      const beats = BEATS.map((b) => `<div class="card col" style="gap:8px"><b>${esc(b.title)}</b><div class="sm mut" style="line-height:1.5">${esc(b.say)}</div><button class="btn p" data-act="/api/director" data-body='{"beat":"${b.id}"}'>${icon("play", 14)}Run</button></div>`).join("");
      html(res, page({ title: "Demo director", body: `<header class="hd"><div class="grow"><h1>Demo director</h1><div class="sub">ETH $${price.toFixed(2)} · DEMO mode</div></div><a class="ic" href="/demo" aria-label="Open app as viewer">${icon("home", 18)}</a></header><main class="main" style="padding-bottom:40px">${beats}<p class="note">Open the app as the viewer in another window (/demo), then run beats in order. Each beat triggers the same code paths as real events.</p></main>` }));
    });
    r.post("/api/director", json, async (req, res) => {
      try {
        res.json({ toast: await runBeat(String(req.body.beat)) });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });
  }

  // Pages
  // The feed is the live deck only. Past trades live in Portfolio (yours) and on each trader's profile portfolio.
  r.get("/feed", authed((uid, req) => deckPage(uid, deckTab(req.query.tab))));
  // Top-bar search: straight to a trader's profile, else the leaderboard.
  r.get("/search", (req, res) => {
    const q = String(req.query.q ?? "").trim().replace(/^@/, "");
    const u = q ? userByHandle(q) : undefined;
    res.redirect(u ? `/u/${encodeURIComponent(u.handle)}` : "/ranks");
  });
  r.get("/u/:handle", async (req, res) => {
    const uid = me(req);
    if (uid === undefined) return html(res, await publicPage(req.params.handle));
    html(res, await profilePage(uid, req.params.handle, req.query as Record<string, unknown>));
  });
  r.get("/copy/:handle", authed((uid, req) => copyPage(uid, req.params.handle, req.query.done === "1", req.query.embed === "1")));
  r.get("/requests", authed((uid, req) => requestsPage(uid, req.query as Record<string, unknown>)));
  r.get("/positions", authed((uid, req) => positionsPage(uid, String(req.query.tab ?? "open"))));
  r.get("/traders", authed((uid) => myTradersPage(uid)));
  r.get("/guard", authed((uid) => guardPage(uid)));
  r.get("/cat", authed((uid) => catHomePage(uid)));
  r.get("/cat/chat", authed((uid, req) => catChatPage(uid, req.query.id ? Number(req.query.id) : undefined, String(req.query.q ?? ""), req.query.trade ? Number(req.query.trade) : undefined)));
  r.get("/profile/edit", authed((uid) => profileEditPage(uid)));
  r.get("/bot", authed((uid) => botPage(uid)));
  r.get("/cat/ctxbar/:id", authed((uid, req) => ctxBarHtml(uid, Number(req.params.id))));
  r.get("/cat/voice", authed((uid) => catVoicePage(uid)));
  r.get("/cat/memory", authed((uid) => catMemoryPage(uid)));
  r.get("/signals", authed((uid, req) => signalsPage(uid, signalTab(req.query.tab))));
  r.get("/ranks", authed((uid, req) => ranksPage(uid, req.query as Record<string, unknown>)));
  r.get("/season", authed((uid) => seasonPage(uid)));
  r.get("/progress", authed((uid, req) => progressPage(uid, String(req.query.tab ?? "Daily"))));
  r.get("/badges", authed((uid) => badgesPage(uid)));
  r.get("/squad", authed((uid) => squadPage(uid, "mine", "")));
  r.get("/squads", authed((uid, req) => squadPage(uid, "find", String(req.query.q ?? ""))));
  r.get("/levelup", authed((uid) => levelUpPage(uid)));
  r.get("/me", authed((uid) => mePage(uid)));
  r.get("/settings", authed((uid) => settingsPage(uid)));
  r.get("/funds", authed((uid, req) => fundsPage(uid, String(req.query.tab ?? "add"))));
  r.get("/transfer", authed((uid, req) => transferPage(uid, String(req.query.dir ?? "add"), String(req.query.m ?? ""))));
  r.get("/activity", authed((uid, req) => activityPage(uid, String(req.query.tab ?? "All"))));
  r.get("/activity.csv", (req, res) => {
    const uid = me(req);
    if (uid === undefined) return res.redirect("/splash");
    res.type("text/csv").attachment("activity.csv").send(activityCsv(uid, String(req.query.tab ?? "All")));
  });
  r.get("/alerts", authed((uid) => alertsPage(uid, uid < 1e10 ? null : `https://t.me/${BOT()}?start=link_${makeLoginToken(uid)}`, BOT())));
  r.get("/creator", authed((uid) => creatorPage(uid)));
  r.get("/strategy/new", authed((uid) => newStrategyPage(uid)));
  r.get("/thread/:id", authed((uid, req) => threadPage(uid, Number(req.params.id))));
  r.get("/share/:who", authed((uid, req) => sharePage(uid, req.params.who)));
  r.get("/top", (req, res) => html(res, topPage(me(req) !== undefined)));
  r.get("/og/top.png", (_q, res) => res.type("image/png").set("Cache-Control", "public, max-age=300").send(svgToPng(topSvg())));
  // A shared signal: public, so the link works for anyone it was sent to (and for link previews).
  r.get("/signal/:id", async (req, res) => {
    const sig = await signalById(Number(req.params.id));
    if (!sig) return html(res, notFound("Signal not found"), 404);
    html(res, await publicSignalPage(sig, me(req)));
  });
  r.get("/s/:id", async (req, res) => {
    const t = await tradeCard(Number(req.params.id));
    if (!t) return html(res, notFound("Trade not found"), 404);
    const uid = me(req);
    html(res, uid === undefined ? await publicPage(t.handle, t.id) : await sharePage(uid, t.handle, t.id));
  });
  r.get("/og/u/:handle.svg", async (req, res) => {
    const s = await ogSvg(req.params.handle);
    s ? res.type("image/svg+xml").send(s) : res.sendStatus(404);
  });
  r.get("/og/t/:id.svg", async (req, res) => {
    const t = await tradeCard(Number(req.params.id));
    const s = t ? await ogSvg(t.handle, t.id) : undefined;
    s ? res.type("image/svg+xml").send(s) : res.sendStatus(404);
  });
  r.get("/og/u/:handle.png", async (req, res) => {
    const s = req.query.f === "story" ? await storySvg(req.params.handle) : await ogSvg(req.params.handle);
    s ? res.type("image/png").set("Cache-Control", "public, max-age=300").send(svgToPng(s)) : res.sendStatus(404);
  });
  r.get("/og/t/:id.png", async (req, res) => {
    const t = await tradeCard(Number(req.params.id));
    const s = t ? await (req.query.f === "story" ? storySvg : ogSvg)(t.handle, t.id) : undefined;
    s ? res.type("image/png").set("Cache-Control", "public, max-age=300").send(svgToPng(s)) : res.sendStatus(404);
  });
  r.get("/api/feed", (_q, res) => res.json(db.prepare("SELECT id, leader, at FROM trades ORDER BY id DESC LIMIT 50").all()));

  // ---- JSON reads for agents (the Tribe MCP server, src/mcp.ts). Auth: session cookie or `Authorization: Bearer <agent token>`. ----
  r.get("/api/v1/top", act(async (_uid, req) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    return { days, traders: topTraders(days, 20).map((t) => ({ handle: t.handle, persona: t.persona, realisedPct: Number(t.pct.toFixed(2)), fills: t.n, guardPaused: !!haltOf(t.id) })) };
  }));
  r.get("/api/v1/traders/:handle", act(async (_uid, req) => {
    const u = userByHandle(String(req.params.handle).replace(/^@/, ""));
    if (!u) throw new Error("Trader not found");
    const p = await profile(u.id);
    const h = haltOf(u.id);
    return { handle: u.handle, persona: u.persona, totalPct: Number(p.pnlPct.toFixed(2)), winRate: p.winRate, maxDrawdownPp: Number(p.maxDd.toFixed(2)), trades: p.trades, followers: p.followers, daysOnTribe: p.days, risk: p.risk, guard: h ? { paused: true, reason: h.reason, tx: h.tx } : { paused: false } };
  }));
  r.get("/api/v1/guard", act(async (uid) => {
    const follows = followingOf(uid);
    return { oracleCheck: lastOracleCheck, paused: allHalts().map((h) => ({ handle: userById(h.leader)?.handle, reason: h.reason, tx: h.tx, since: new Date(h.at).toISOString(), youCopy: follows.some((f) => f.leader === h.leader) })) };
  }));
  r.get("/api/v1/me", act(async (uid) => {
    const pf = await portfolio(uid);
    const open = await openPositions(uid);
    return {
      handle: getUser(uid).handle, balanceUsd: Number(pf.total.toFixed(2)), freeUsd: Number(pf.free.toFixed(2)),
      positions: open.map((p) => ({ token: p.symbol, sizeUsd: Number(p.sizeUsd.toFixed(2)), pnlPct: Number(p.pnlPct.toFixed(2)), stopPct: p.stopPct, targetPct: p.tpPct, from: p.from })),
      copying: followingOf(uid).map((f) => ({ handle: userById(f.leader)?.handle, mode: f.rules.mode, maxPerTrade: f.rules.maxUsdPerTrade, dailyCap: f.rules.dailyCapUsd, requireStop: f.rules.requireStop, paused: f.rules.paused })),
    };
  }));

  // ---- Account ----
  r.get("/api/handle", (req, res) => {
    const why = handleOk(String(req.query.h ?? ""), me(req));
    res.json({ free: !why, why });
  });

  // ---- Profile: photo, bio, free follow, bot ----
  r.get("/avatar/:id", (req, res) => {
    const row = db.prepare("SELECT photo FROM users WHERE id = ?").get(Number(req.params.id)) as { photo: string | null } | undefined;
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(row?.photo ?? "");
    if (!m) return res.sendStatus(404);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); // the URL carries ?v=photo_at
    res.type(m[1]).send(Buffer.from(m[2], "base64"));
  });
  r.post("/api/photo", express.json({ limit: "400kb" }), act((uid, req) => {
    if (req.body?.remove) {
      db.prepare("UPDATE users SET photo = NULL, photo_at = 0 WHERE id = ?").run(uid);
      return { reload: true, toast: "Photo removed" };
    }
    const url = String(req.body?.photo ?? "");
    // The browser crops and resizes to 256px JPEG first; anything else is refused.
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url) || url.length > 300_000) throw new Error("Use a JPEG, PNG or WebP image");
    db.prepare("UPDATE users SET photo = ?, photo_at = ? WHERE id = ?").run(url, Date.now(), uid);
    return { reload: true, toast: "Photo updated" };
  }));
  r.post("/api/profile", express.urlencoded({ extended: false }), json, act((uid, req) => {
    const handle = String(req.body?.handle ?? "").trim();
    if (handle && handle.toLowerCase() !== getUser(uid).handle) {
      const why = handleOk(handle, uid);
      if (why) throw new Error(why);
      setHandle(uid, handle);
    }
    if (req.body?.bio !== undefined) db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(String(req.body.bio).trim().slice(0, 160) || null, uid);
    return { reload: true, toast: "Profile saved" };
  }));
  r.post("/api/watch", json, act((uid, req) => {
    const lu = userByHandle(String(req.body?.leader ?? ""));
    if (!lu || lu.id === uid) throw new Error("Trader not found");
    const on = !isWatching(uid, lu.id);
    setWatch(uid, lu.id, on);
    return { reload: true, toast: on ? `Following @${lu.handle}` : `Unfollowed @${lu.handle}` };
  }));
  r.post("/api/bot", json, act((uid, req) => {
    const cur = getMeta(uid).bot;
    const usd = req.body?.usd === undefined ? cur.usd : Math.round(Number(req.body.usd));
    const perDay = req.body?.perDay === undefined ? cur.perDay : Math.round(Number(req.body.perDay));
    if (!(usd >= 5 && usd <= 500)) throw new Error("Bot size is $5 to $500 per trade");
    if (!(perDay >= 1 && perDay <= 10)) throw new Error("1 to 10 bot trades a day");
    const on = req.body?.on === undefined ? cur.on : !!req.body.on;
    setMeta(uid, { bot: { on, usd, perDay } });
    return { reload: true, toast: on ? (cur.on ? "Bot updated" : "Your bot is on") : "Your bot is off" };
  }));

  r.post("/api/signup", json, (req, res) => {
    const b = req.body as { handle?: string; avatar?: number; persona?: string; follow?: string };
    const persona = PERSONA[String(b.persona)] ? String(b.persona) : "Hodler";
    const u = createWebUser(String(b.handle ?? ""), Number(b.avatar) || 0, persona);
    if (!u) return res.status(400).json({ error: "That handle is taken or invalid." });
    const p = PERSONA[persona];
    setMeta(u.id, { defaults: { mode: "ask", max: p.max, cap: p.cap, stop: p.stop, chase: 1 }, strict: p.strict, permUntil: Date.now() + 30 * 86400e3, simBalance: isDry() ? 1000 : 0 });
    if (isDry()) addLedger(u.id, "deposit", 1000, "Demo credit (simulated USDC)");
    res.setHeader("Set-Cookie", `tribe=${makeSession(u.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
    const f = b.follow && userByHandle(b.follow) ? `/copy/${userByHandle(b.follow)!.handle}` : "/feed";
    res.json({ redirect: f });
  });

  r.post("/api/persona", json, act((uid, req) => {
    const persona = PERSONA[String(req.body.persona)] ? String(req.body.persona) : "Hodler";
    const p = PERSONA[persona];
    db.prepare("UPDATE users SET persona = ? WHERE id = ?").run(persona, uid);
    setMeta(uid, { defaults: { ...getMeta(uid).defaults, max: p.max, cap: p.cap, stop: p.stop }, strict: p.strict });
    return { redirect: "/me", toast: `You're a ${persona}. Defaults updated.` };
  }));

  r.post("/api/signout", json, (_q, res) => res.setHeader("Set-Cookie", "tribe=; Path=/; Max-Age=0").json({ redirect: "/splash" }));
  r.post("/api/delete-account", json, act((uid, _req, res) => {
    for (const sql of ["DELETE FROM follows WHERE follower = ? OR leader = ?", "DELETE FROM pending_copies WHERE follower = ?", "DELETE FROM strategies WHERE owner = ?"]) {
      const n = (sql.match(/\?/g) ?? []).length;
      db.prepare(sql).run(...Array(n).fill(uid));
    }
    db.prepare("UPDATE users SET handle = ? WHERE id = ?").run(`deleted_${uid}`, uid);
    res.setHeader("Set-Cookie", "tribe=; Path=/; Max-Age=0");
    return { redirect: "/splash" };
  }));
  r.post("/api/handle", express.urlencoded({ extended: false }), json, act((uid, req) => {
    const why = handleOk(String(req.body.handle ?? ""), uid);
    if (why || !setHandle(uid, String(req.body.handle ?? "").trim())) throw new Error(why ?? "3-20 letters, numbers or _");
    return { reload: true, toast: "Handle updated" };
  }));

  r.post("/api/meta", json, act((uid, req) => {
    const b = req.body as Record<string, unknown>;
    const m = getMeta(uid);
    const TOGGLES = ["push", "tg", "email", "quiet", "hideBalance", "aReq", "aGuard", "aFills", "aHits", "aPayout", "aWeekly", "tightApprovals"] as const;
    if (typeof b.key === "string" && (TOGGLES as readonly string[]).includes(b.key)) {
      const k = b.key as (typeof TOGGLES)[number];
      setMeta(uid, { [k]: typeof b.value === "boolean" ? b.value : !m[k] });
      return { toast: "Saved" };
    }
    const patch: Partial<Meta> = {};
    if (typeof b.slip === "string" && ["0.3%", "0.5%", "1%"].includes(b.slip)) patch.slip = b.slip;
    if (typeof b.strict === "string" && b.strict in RISK_LINE) patch.strict = b.strict as Meta["strict"];
    if (typeof b.mode === "string") patch.defaults = { ...m.defaults, mode: b.mode === "Auto" ? "auto" : "ask" };
    if (typeof b.chase === "string" && ["Off", "0.5%", "1%", "2%"].includes(b.chase)) patch.defaults = { ...(patch.defaults ?? m.defaults), chase: b.chase === "Off" ? 0 : parseFloat(b.chase) };
    if (typeof b.timer === "string") patch.timerSec = ({ "30s": 30, "2m": 120, "120s": 120, "5m": 300 } as Record<string, number>)[b.timer] ?? 60;
    setMeta(uid, patch);
    return { reload: true, toast: "Saved" };
  }));
  r.post("/api/pause-all", json, act((uid, req) => {
    setMeta(uid, { pausedAll: !!req.body.value });
    return { reload: true, toast: req.body.value ? "All copying paused" : "Copying resumed" };
  }));
  r.post("/api/perm", json, act((uid, req) => {
    const on = !!req.body.value;
    setMeta(uid, { perm: on, permUntil: on ? Date.now() + 30 * 86400e3 : 0 });
    return { reload: true, toast: on ? "Auto-copy permission granted" : "Auto-copy permission revoked" };
  }));

  // ---- Copying ----
  r.post("/api/follow", json, act((uid, req) => {
    const b = req.body as Record<string, unknown>;
    const lu = userByHandle(String(b.leader ?? ""));
    if (!lu || lu.id === uid) throw new Error("Trader not found");
    getUser(uid);
    const mode = b.mode === "auto" ? "auto" : "ask";
    setFollow(uid, lu.id, {
      mode, ratio: num(b.ratio, 1), budgetUsd: num(b.budget, 250), maxUsdPerTrade: num(b.max, 25), dailyCapUsd: num(b.cap, 100), requireStop: String(b.stop) === "1" || b.stop === true, paused: false,
    });
    if (mode === "auto") setMeta(uid, { perm: true, permUntil: Date.now() + 30 * 86400e3 });
    return { redirect: `/copy/${lu.handle}?done=1` };
  }));
  r.post("/api/follow-pause", json, act((uid, req) => {
    if (!getFollowRules(uid, Number(req.body.leader))) throw new Error("Not copying them");
    setFollow(uid, Number(req.body.leader), { paused: !!req.body.value });
    return { reload: true, toast: req.body.value ? "Paused" : "Resumed" };
  }));
  r.post("/api/unfollow", json, act((uid, req) => {
    unfollow(uid, Number(req.body.leader));
    return { reload: true, toast: "Stopped copying. Open positions keep their stops." };
  }));
  r.post("/api/guard-override", json, act((uid, req) => {
    setFollow(uid, Number(req.body.leader), { guardOverride: !!req.body.value });
    return { reload: true, toast: "Resumed against Guard's advice" };
  }));
  r.get("/api/simulate", async (req, res) => {
    const uid = me(req);
    if (uid === undefined) return res.sendStatus(401);
    res.json(await simulateCopy(Number(req.query.leader), { ...DEFAULT_RULES, maxUsdPerTrade: num(req.query.max, 25), dailyCapUsd: num(req.query.cap, 100), requireStop: req.query.stop === "1", ratio: num(req.query.ratio, 1) }));
  });

  r.post("/api/pending", json, act(async (uid, req) => {
    const { id, action, always } = req.body as { id: number; action: "approve" | "skip"; always?: boolean };
    const c = claimPending(Number(id), uid, action === "approve" ? "approved" : "skipped");
    if (!c) return { redirect: "/requests", toast: "That request already expired or was handled" };
    const back = typeof req.body.back === "string" && req.body.back.startsWith("/") ? req.body.back : undefined;
    if (action !== "approve") return { redirect: back ?? "/requests?result=skipped" };
    if (always) setFollow(uid, c.leader, { mode: "auto" });
    const out = await execute(c.tradeId, uid, c.leader, c.trade);
    if (back && !out.startsWith("failed")) return { redirect: back, toast: "Copied" };
    if (out.startsWith("failed")) return { redirect: `/requests?result=${/free balance/i.test(out) ? "insufficient" : "failed"}&msg=${encodeURIComponent(out.replace("failed: ", ""))}` };
    return { redirect: "/requests?result=ok" };
  }));

  // ---- Positions ----
  r.post("/api/position-close", json, act(async (uid, req) => {
    const token = String(req.body.token).toLowerCase();
    const qty = heldTokens(uid, token);
    if (qty <= 0) throw new Error("Nothing to close");
    const t: Trade = { chain: "base", target: token, contra: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", side: "sell", qty: String(qty), orderType: "market" };
    // Cancel the resting stop / target first (gasless signed cancel at Flash), so they can't fire on a closed position.
    await cancelProtective(uid, token);
    await placeAndTrack(0, uid, uid, "own", t);
    return { reload: true, toast: `Closed ${symOf(token)} at market` };
  }));
  r.post("/api/position-stop", json, act(async (uid, req) => {
    const token = String(req.body.token).toLowerCase();
    const pct = Number(req.body.stop);
    if (!(pct > 0 && pct < 90)) throw new Error("Enter a stop between 0.5% and 90%");
    const p = db.prepare("SELECT qty, cost FROM positions WHERE trader = ? AND token = ?").get(uid, token) as { qty: number; cost: number } | undefined;
    if (!p || p.qty <= 0) throw new Error("No open position");
    const price = (p.cost / p.qty) * (1 - pct / 100);
    if (price >= (await getPrice(token))) throw new Error("That stop is above the current price, so it would fire at once. Pick a lower one.");
    const open = db.prepare("SELECT id, order_id, trade, sim FROM orders WHERE trader = ? AND status = 'open' AND json_extract(trade, '$.target') = ? AND json_extract(trade, '$.orderType') IN ('bracket','stop-loss') ORDER BY id DESC LIMIT 1").get(uid, token) as { id: number; order_id: string; trade: string; sim: number } | undefined;
    if (open && !open.sim) {
      const t = JSON.parse(open.trade) as Trade;
      if (t.orderType === "stop-loss") {
        await updateTrigger(open.order_id, getUser(uid).pk, "lower", price.toFixed(2));
        t.triggers = [{ notionalPrice: price.toFixed(2), triggerType: "lower" }];
        db.prepare("UPDATE orders SET trade = ? WHERE id = ?").run(JSON.stringify(t), open.id);
      } else {
        // Flash can't update a bracket: cancel it and place a new one with the same target and the new stop.
        await cancelProtective(uid, token);
        t.triggers = (t.triggers ?? []).filter((x) => x.triggerType !== "lower").concat({ notionalPrice: price.toFixed(2), triggerType: "lower" });
        await placeAndTrack(0, uid, uid, "own", { ...t, qty: String(p.qty) });
      }
    } else if (open) {
      const t = JSON.parse(open.trade) as Trade;
      t.triggers = (t.triggers ?? []).filter((x) => x.triggerType !== "lower").concat({ notionalPrice: price.toFixed(2), triggerType: "lower" });
      db.prepare("UPDATE orders SET trade = ? WHERE id = ?").run(JSON.stringify(t), open.id);
    } else {
      const t: Trade = { chain: "base", target: token, contra: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", side: "sell", qty: String(p.qty), orderType: "stop-loss", triggers: [{ notionalPrice: price.toFixed(2), triggerType: "lower" }] };
      await placeAndTrack(0, uid, uid, "own", t);
    }
    return { reload: true, toast: `Stop moved to −${pct}%` };
  }));

  // ---- Social ----
  // Swipe deck: left skips a trade for good; right copies it once (same Guard, cap and stop rules as auto-copy).
  r.post("/api/signal", json, act((uid, req) => postSignal(uid, req.body ?? {})));
  r.post("/api/swipe", json, act((uid, req) => {
    const trade = Number(req.body?.trade);
    if (!tradeById(trade)) throw new Error("Trade not found");
    recordSwipe(uid, trade, req.body?.dir === "right" ? "right" : "left");
    return { ok: true };
  }));
  // The live deck: new cards as trades are placed, and fresh numbers for the cards on screen.
  const idList = (v: unknown) => String(v ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  r.get("/api/deck/cards", act((uid, req) => deckCards(uid, new Set(idList(req.query.have)), deckTab(req.query.tab))));
  r.get("/api/deck/live", act((uid, req) => deckLive(uid, idList(req.query.ids))));
  r.get("/api/deck/brief", act((_uid, req) => briefHtml(String(req.query.h ?? ""))));
  r.get("/api/deck/active", act(async (uid) => ({ html: await activeHtml(uid) })));
  r.post("/api/copy-trade", json, act(async (uid, req) => {
    const out = await copyOne(uid, Number(req.body?.trade), Number(req.body?.usd));
    recordSwipe(uid, Number(req.body.trade), "right");
    return { ok: true, toast: `Copied $${out.usd} of @${out.handle}'s trade with Flash` };
  }));
  // One reaction per person per trade; an empty emoji removes it. Returns the re-rendered control.
  r.post("/api/react", json, act((uid, req) => {
    const key = String(req.body.emoji ?? "");
    if (key && !isReaction(key)) throw new Error("Unknown reaction");
    if (req.body.signal !== undefined) {
      const sig = Number(req.body.signal);
      if (!signalExists(sig)) throw new Error("Signal not found");
      setSignalReaction(sig, uid, key || null);
      return { html: reactBar(sig, uid, "signal") };
    }
    const trade = Number(req.body.trade);
    if (!tradeById(trade)) throw new Error("Trade not found");
    setReaction(trade, uid, key || null);
    return { html: reactBar(trade, uid) };
  }));
  r.post("/api/signal-comment", json, act((uid, req) => {
    const sig = Number(req.body?.signal);
    addSignalComment(sig, uid, String(req.body?.text ?? ""));
    return { html: signalCommentHtml(signalComments(sig).at(-1)!), count: signalComments(sig).length };
  }));
  r.post("/api/comment", express.urlencoded({ extended: false }), json, act((uid, req) => {
    const text = String(req.body.text ?? "").trim();
    if (!text) throw new Error("Write something first");
    addComment(Number(req.body.trade), uid, text);
    const c = commentsOf(Number(req.body.trade)).at(-1)!;
    return { append: { target: "cm", html: commentHtml(new Set())(c) } };
  }));

  // ---- Squads ----
  r.post("/api/squad", express.urlencoded({ extended: false }), json, act((uid, req) => {
    const name = String(req.body.name ?? "").trim();
    if (!createSquad(uid, name)) throw new Error(db.prepare("SELECT 1 FROM squads WHERE name = ?").get(name) ? "That name is taken." : "Use 3 to 24 letters, numbers or spaces.");
    return { redirect: "/squad", toast: `Squad ${name} created` };
  }));
  r.post("/api/squad-join", json, act((uid, req) => {
    const sq = db.prepare("SELECT name FROM squads WHERE id = ?").get(Number(req.body.id)) as { name: string } | undefined;
    if (!sq) throw new Error("Squad not found");
    joinSquad(uid, Number(req.body.id));
    return { redirect: "/squad", toast: `You joined ${sq.name}` };
  }));
  r.post("/api/squad-leave", json, act((uid) => {
    const sq = squadOf(uid);
    leaveSquad(uid);
    return { redirect: "/squads", toast: sq ? `You left ${sq.name}` : "Left the squad" };
  }));

  // ---- Game ----
  r.post("/api/quest-claim", json, act(async (uid, req) => {
    const q = questsOf(uid).find((x) => x.id === String(req.body.id));
    if (!q) throw new Error("Unknown quest");
    if (q.done < q.of) throw new Error("Finish the quest first");
    const before = (await traderStats(uid)).level;
    if (!claimQuest(uid, q.id, q.key, q.xp)) throw new Error("Already claimed");
    const after = (await traderStats(uid)).level;
    if (after > before) {
      setMeta(uid, { seenLevel: after });
      return { redirect: "/levelup", toast: `Level ${after} reached` };
    }
    return { reload: true, toast: `+${q.xp} XP` };
  }));

  // ---- Ask Cat ----
  r.post("/api/cat/ask", json, act((uid, req) => catAsk(uid, String(req.body?.text ?? ""), { chatId: req.body?.chat ? Number(req.body.chat) : undefined, source: "App", live: req.body?.live !== false, trade: req.body?.trade ? Number(req.body.trade) : req.body?.handle ? handleEntry(String(req.body.handle)) : undefined })));
  // A Bearer token means the user's AI agent (the MCP server) confirmed it: the trade is theirs, tagged Bot.
  r.post("/api/cat/confirm", json, act((uid, req) => catConfirm(uid, String(req.body?.id), (p, l) => notifier?.(p, l), req.headers.authorization?.startsWith("Bearer ") ? "agent" : "user")));
  r.post("/api/cat/vote", json, act((uid, req) => { voteMsg(Number(req.body.msg), uid, Math.max(-1, Math.min(1, Number(req.body.vote) || 0))); }));
  r.post("/api/cat/persona", json, act((uid, req) => {
    if (!["Sharp", "Chill", "Degen"].includes(String(req.body.persona))) throw new Error("Unknown personality");
    setMeta(uid, { catPersona: req.body.persona });
    return { reload: true, toast: `Cat is ${req.body.persona} now. Limits and Guard are unchanged.` };
  }));
  r.post("/api/cat/memory", express.urlencoded({ extended: false }), json, act((uid, req) => {
    const b = req.body as Record<string, unknown>;
    const m = getMeta(uid);
    switch (b.op) {
      case "toggle": setMeta(uid, { catMemory: !m.catMemory }); return { reload: true };
      case "forget": setMeta(uid, { catForgot: [...new Set([...m.catForgot, String(b.key)])] }); return { reload: true, toast: "Forgot it" };
      case "rule": {
        const text = String(b.text ?? "").trim();
        if (text.length < 3) throw new Error("Write the rule first");
        addRule(uid, text);
        return { reload: true, toast: "Cat will remember that" };
      }
      case "delrule": deleteRule(uid, Number(b.id)); return { reload: true, toast: "Forgot it" };
      case "wipe": wipeCat(uid); setMeta(uid, { catForgot: [] }); return { reload: true, toast: "Cat forgot everything" };
      default: throw new Error("Unknown action");
    }
  }));
  // Older clients and tests: same Cat, single endpoint pair.
  r.post("/api/ask", json, act((uid, req) => catAsk(uid, String(req.body?.text ?? ""), { source: "App" })));
  r.post("/api/confirm", json, act((uid, req) => catConfirm(uid, String(req.body?.id), (p, l) => notifier?.(p, l))));

  // ---- Money & creator ----
  r.post("/api/demo-funds", json, act((uid, req) => {
    if (!isDry()) throw new Error("Test funds are only available in demo mode.");
    const amt = Math.min(5000, num(req.body.amt, 100));
    setMeta(uid, { simBalance: getMeta(uid).simBalance + amt });
    addLedger(uid, "deposit", amt, "Test funds (simulated USDC)");
    return { redirect: "/funds", toast: `Added $${amt} test funds` };
  }));
  r.post("/api/withdraw", json, act((uid, req) => {
    if (!isDry()) throw new Error("Withdrawals need Privy embedded wallets, which aren't connected yet.");
    const amt = num(req.body.amt, 100);
    const m = getMeta(uid);
    if (amt > m.simBalance) throw new Error("Not enough free balance");
    setMeta(uid, { simBalance: m.simBalance - amt });
    addLedger(uid, "withdraw", -amt, "Simulated withdrawal");
    return { redirect: "/funds?tab=out", toast: `Withdrew $${amt} (simulated)` };
  }));
  r.post("/api/claim", json, act((uid) => {
    const cr = creatorEarnings(uid);
    if (cr.claimable < 0.01) throw new Error("Nothing to claim yet");
    if (!isDry()) throw new Error("Onchain fee-share payouts aren't built yet.");
    setMeta(uid, { claimed: cr.accrued, simBalance: getMeta(uid).simBalance + cr.claimable });
    addLedger(uid, "payout", cr.claimable, "Fee-share (demo payout)");
    return { reload: true, toast: `$${cr.claimable.toFixed(2)} added to your balance` };
  }));
  r.post("/api/strategy", json, act((uid, req) => {
    const name = String(req.body.name ?? "").trim();
    if (name.length < 3) throw new Error("Give it a name (3+ characters)");
    addStrategy(uid, name, req.body.kind === "trades" ? "trades" : "bot", String(req.body.description ?? ""));
    return { redirect: "/creator", toast: `${name} is live` };
  }));
  r.post("/api/strategy-public", json, act((uid, req) => {
    const s = db.prepare("SELECT public FROM strategies WHERE id = ? AND owner = ?").get(Number(req.body.id), uid) as { public: number } | undefined;
    if (!s) throw new Error("Not found");
    setStrategyPublic(uid, Number(req.body.id), !s.public);
    return { reload: true };
  }));

  void ledgerOf; void esc; void recordTrade; void userById;
  return r;
}
