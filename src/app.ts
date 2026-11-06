import express, { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { getAddress } from "viem";
import { handleEntry } from "./research.js";
import { clearSignupTicket, consumeLogin, createSession, currentSession, currentUser, endSession, isAgent, makeLoginToken, revealOnce, revokeSession, revokeSessions, signupTicketOf, startSession } from "./auth.js";
import { linkWallet, userByWallet } from "./wallet-api.js";
import { userByPrivy } from "./privy-api.js";
import { execute, mirror, mirrorStopMove, type PendingNotice } from "./copy.js";
import { assetFilter, matchesFilter } from "./assets.js";
import { approveRebalance, basketBoard, basketView, closeCopy, copyBasket, createBasket, liveCapUsd, publishBasket, retireBasket, retryCopy, skipRebalance, tokensText, updateWeights } from "./baskets.js";
import { basketBuilderPage, basketOgSvg, basketPage, collectionPage, collectionTab } from "./views/baskets.js";
import { cardById, cardFor, cardMetadata, cardOfCopy, cardView, unlockOf, type CardView } from "./cards.js";
import { cardSvg } from "./views/card.js";
import { activeHtml, briefHtml, deckCards, deckLive, deckPage, feedTopPage } from "./views/deck.js";
import { CLIENT_JS } from "./client.js";
import { isReaction, reactBar, REACT_JS } from "./views/reactions.js";
import {
  addComment, addLedger, addRule, chatById, deleteChat, deleteRule, setChatState, voteMsg, wipeCat, detachDeleted, createSquad, joinSquad, leaveSquad, squadOf, claimQuest, addStrategy, claimPending, commentsOf, createWebUser, db, DEFAULT_RULES, getFollowRules, getMeta, getUser, ledgerOf, recordTrade, setFollow, setHandle, setMeta,
  setStrategyPublic, setReaction, tradeById, unfollow, userByHandle, userById, type Meta, allHalts, followingOf, haltOf, handleOk, isWatching, setWatch, recordSwipe,
} from "./db.js";
import { freeBalance, openPositions, portfolio, profile, symOf, topTraders, tradeCard } from "./data.js";
import { lastOracleCheck } from "./guard.js";
import { placeAndTrack, isDry, heldTokens, cancelProtective, moveStop } from "./tracker.js";
import type { Trade } from "./flash.js";
import { RISK_LINE } from "./rules.js";
import { creatorEarnings, activityCsv, activityPage, alertsPage, creatorPage, fundsPage, mePage, newStrategyPage, seasonPage, settingsPage, transferPage } from "./views/me.js";
import { onboardingPage, introPage, splashPage } from "./views/auth.js";
import { guardPage } from "./views/social.js";
import { svgToPng, storySvg, copyPage, myTradersPage, ogSvg, positionsPage, profilePage, publicPage, requestsPage, sharePage, simulateCopy, threadPage, commentHtml } from "./views/trader.js";
import { esc, icon, notFound, page, SIDE_JS } from "./ui.js";
import { finalize } from "./views/chrome.js";
import { tradePage } from "./views/tradepage.js";
import { isExternal } from "./wallet.js";
import { answerRequest, interactive, nextRequest } from "./browsersign.js";
import { popularTokens, searchTokens, tradableToken } from "./tokens.js";
import { trendingTokens } from "./market.js";
import { answerSignal, botById, controlBot, createBot, fastForwardTrial, publishBot, runBot, updateBot } from "./creator.js";
import { BLOCKED_COUNTRIES, botBuilderPage, botDetailPage, verifyPage } from "./views/creator.js";
import { buildProposal } from "./ask.js";
import { botPage, profileEditPage } from "./views/profile.js";
import { landingPage, portfolioPage, portfolioTab, signinPage, topPage, topSvg } from "./views/web.js";
import { badgesPage, levelUpPage, progressPage, squadPage } from "./views/game.js";
import { questsOf, traderStats } from "./stats.js";
import { BEATS, runBeat } from "./director.js";
import { getPrice } from "./prices.js";
import { pwaRouter } from "./pwa.js";

/** Accounts without a wallet: only for the test suite (ALLOW_PLAIN_SIGNUP=1). The seeded demo viewer uses /demo. */
const plainSignupAllowed = () => process.env.ALLOW_PLAIN_SIGNUP === "1";

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
      const uid = currentUser(req);
      let out = await finalize(s, uid, req.path);
      // Live MetaMask accounts: the page carries the bridge that asks MetaMask when an order needs a signature.
      if (uid !== undefined && !isDry() && isExternal(uid)) out = out.replace('<script src="/app.js">', `<script>window.TRIBE_SIGNER=${JSON.stringify({ address: getUser(uid).address })}</script><script src="/app.js">`);
      res.status(status).type("html").send(out);
    } catch (e) {
      console.error("render", e);
      if (!res.headersSent) res.status(500).send("Something went wrong");
    }
  };
  const me = (req: Request) => currentUser(req);

  /** Page route that needs a session; otherwise sends the visitor to sign-in. */
  const authed = (fn: (uid: number, req: Request, res: Response) => Promise<string> | string) => async (req: Request, res: Response) => {
    const uid = me(req);
    if (uid === undefined) return res.redirect("/signin");
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
    if (uid === undefined) return res.status(401).json({ error: "Sign in first", redirect: "/signin" });
    try {
      // Inside an action the user's own browser wallet (MetaMask) may be asked to sign; see browsersign.ts.
      res.json((await interactive(uid, () => fn(uid, req, res))) ?? { ok: true });
    } catch (e) {
      console.error(`${new Date().toISOString()} ${req.method} ${req.path} (user ${uid}) failed: ${(e as Error).message}`);
      res.status(400).json({ error: (e as Error).message });
    }
  };

  // The open tab's MetaMask bridge: wait for the next signature this user's action needs, then send back the answer.
  r.get("/api/sign/wait", async (req, res) => {
    const uid = me(req);
    if (uid === undefined) {
      // A slow no: a tab left open from an older build keeps asking, and this paces its loop to one call every few seconds.
      await new Promise((done) => setTimeout(done, 3000));
      return res.status(401).json({ error: "Sign in first" });
    }
    res.json({ req: await nextRequest(uid, String(req.query.tab ?? "").slice(0, 40)) });
  });
  r.post("/api/sign/:id", json, (req, res) => {
    const uid = me(req);
    if (uid === undefined) return res.status(401).json({ error: "Sign in first" });
    try {
      answerRequest(uid, String(req.params.id), { result: req.body?.result ? String(req.body.result) : undefined, error: req.body?.error ? String(req.body.error).slice(0, 200) : undefined });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  r.use(pwaRouter());
  r.get("/app.js", (_q, res) => res.type("application/javascript").set("Cache-Control", "no-cache").send(`${CLIENT_JS};\n${REACT_JS};\n${SIDE_JS}`));
  r.get("/", (req, res) => (me(req) === undefined ? html(res, landingPage()) : res.redirect("/feed")));
  r.get("/signin", (_q, res) => html(res, signinPage(process.env.DEMO === "true")));
  r.get("/trades", authed((uid, req) => collectionPage(uid, collectionTab(req.query.tab))));
  // Old links: this page was /collection, and the builder /baskets/new. A new trade of any size starts in the builder.
  r.get("/collection", (req, res) => res.redirect(301, req.url.replace("/collection", "/trades")));
  r.get("/baskets/new", (_q, res) => res.redirect(301, "/trades/new"));
  r.get("/trade/new", (_q, res) => res.redirect(302, "/trades/new"));
  r.get("/portfolio", authed((uid, req) => portfolioPage(uid, portfolioTab(req.query.tab))));
  // New accounts see the splash and the intro right after sign-up, then land on `next` (the feed, or the trader they
  // came to copy). Signed out, the intro ends at sign-in.
  const nextOf = (req: Request) => {
    const n = String(req.query.next ?? "");
    return n.startsWith("/") && !n.startsWith("//") ? n : "/feed";
  };
  r.get("/splash", (req, res) => html(res, splashPage(nextOf(req))));
  r.get("/intro", (req, res) => html(res, introPage(me(req) !== undefined ? nextOf(req) : "/signin")));
  r.get("/onboarding", (req, res) => {
    // Sign-up only: signed-in users are done, and a new account starts by signing in with a wallet.
    if (me(req) !== undefined) return res.redirect("/feed");
    const t = signupTicketOf(req);
    if (!t && !plainSignupAllowed()) return res.redirect("/signin");
    html(res, onboardingPage(t?.wallet && getAddress(t.wallet), String(req.query.follow ?? "")));
  });
  // Old Telegram sign-in links: sign-in is wallet-only now (demo mode keeps them for the seeded Telegram users).
  r.get("/login", (req, res) => {
    if (process.env.DEMO !== "true") return res.redirect("/signin");
    consumeLogin(String(req.query.t ?? ""), res, req) !== undefined ? res.redirect("/feed") : html(res, notFound("This sign-in link has expired or was already used."), 400);
  });

  // Demo shortcut: sign in as the seeded viewer.
  if (process.env.DEMO === "true") {
    r.get("/demo", (req, res) => {
      const u = userByHandle("you");
      if (!u) return res.status(404).send("Run npm run seed first");
      startSession(res, u.id, req);
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
  r.get("/feed", authed((uid, req) => {
    return req.query.tab === "top" ? feedTopPage(uid, req.query as Record<string, unknown>) : deckPage(uid);
  }));
  // Top-bar search: straight to a trader's profile, else the leaderboard.
  r.get("/search", (req, res) => {
    const q = String(req.query.q ?? "").trim().replace(/^@/, "");
    const u = q ? userByHandle(q) : undefined;
    res.redirect(u ? `/u/${encodeURIComponent(u.handle)}` : "/feed?tab=top");
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
  // Ask Chief is switched off (see chief-api.ts). Old links land on the feed.
  for (const p of ["/cat", "/cat/chat", "/cat/voice", "/cat/memory", "/settings/chief"]) r.get(p, (_q, res) => res.redirect("/feed"));
  r.get("/profile/edit", authed((uid) => profileEditPage(uid)));
  r.get("/bot", authed((uid) => botPage(uid)));
  // The leaderboard is the feed's Top tab now; old links keep their board, period and search.
  r.get("/ranks", (req, res) => {
    const q = new URLSearchParams({ tab: "top" });
    for (const [from, to] of [["tab", "board"], ["period", "period"], ["guard", "guard"], ["q", "q"]]) if (req.query[from]) q.set(to, String(req.query[from]));
    res.redirect(`/feed?${q}`);
  });
  r.get("/season", authed((uid) => seasonPage(uid)));
  r.get("/progress", authed((uid, req) => progressPage(uid, String(req.query.tab ?? "Daily"))));
  r.get("/badges", authed((uid) => badgesPage(uid)));
  r.get("/squad", authed((uid) => squadPage(uid, "mine", "")));
  r.get("/squads", authed((uid, req) => squadPage(uid, "find", String(req.query.q ?? ""))));
  r.get("/levelup", authed((uid) => levelUpPage(uid)));
  r.get("/me", authed((uid) => mePage(uid)));
  r.get("/settings", authed((uid, req) => settingsPage(uid, currentSession(req)?.id)));
  r.get("/funds", authed((uid, req) => fundsPage(uid, String(req.query.tab ?? "add"))));
  r.get("/transfer", authed((uid, req) => transferPage(uid, String(req.query.dir ?? "add"), String(req.query.m ?? ""))));
  r.get("/activity", authed((uid, req) => activityPage(uid, String(req.query.tab ?? "All"))));
  r.get("/activity.csv", (req, res) => {
    const uid = me(req);
    if (uid === undefined) return res.redirect("/signin");
    res.type("text/csv").attachment("activity.csv").send(activityCsv(uid, String(req.query.tab ?? "All")));
  });
  r.get("/alerts", authed((uid) => alertsPage(uid, uid < 1e10 ? null : `https://t.me/${BOT()}?start=link_${makeLoginToken(uid)}`, BOT())));
  // Creating (a tab of Portfolio): post trades by hand, build bots, publish them, get paid.
  r.get("/creator", (_q, res) => res.redirect("/portfolio?tab=creating")); // merged into Portfolio; old links keep working
  r.get("/creator/verify", authed((uid) => verifyPage(uid)));
  r.get("/bots/new", authed((uid) => botBuilderPage(uid)));
  r.get("/bots/:id", async (req, res) => {
    const uid = me(req);
    if (uid === undefined) return res.redirect("/signin");
    const out = await botDetailPage(uid, Number(req.params.id));
    return out ? html(res, out) : html(res, notFound("Bot not found"), 404);
  });
  r.get("/strategy/new", authed((uid) => newStrategyPage(uid)));
  // Every trade has one page, open to anyone: /t/<id>. The older thread and share links forward to it.
  r.get("/trades/new", authed((uid) => basketBuilderPage(uid)));
  r.get("/b/:id/edit", authed((uid, req) => basketBuilderPage(uid, Number(req.params.id))));
  r.get("/b/:id", async (req, res) => {
    try {
      html(res, await basketPage(Number(req.params.id), me(req)));
    } catch (e) {
      console.error(req.path, e);
      html(res, notFound("Something went wrong"), 500);
    }
  });
  r.get("/t/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!(await tradeCard(id))) return html(res, notFound("Trade not found"), 404);
    // A bot's trial trades are private to its owner.
    const priv = db.prepare("SELECT leader FROM trades WHERE id = ? AND private = 1").get(id) as { leader: number } | undefined;
    if (priv && priv.leader !== me(req)) return html(res, notFound("Trade not found"), 404);
    html(res, await tradePage(id, me(req)));
  });
  r.get("/thread/:id", (req, res) => res.redirect(301, `/t/${Number(req.params.id)}#comments`));
  r.get("/share/:who", authed((uid, req) => sharePage(uid, req.params.who)));
  r.get("/top", (req, res) => html(res, topPage(me(req) !== undefined)));
  r.get("/og/top.png", (_q, res) => res.type("image/png").set("Cache-Control", "public, max-age=300").send(svgToPng(topSvg())));
  r.get("/s/:id", (req, res) => res.redirect(301, `/t/${Number(req.params.id)}`));
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
  r.get("/og/b/:id.png", async (req, res) => {
    const v = await basketView(Number(req.params.id));
    v ? res.type("image/png").set("Cache-Control", "public, max-age=300").send(svgToPng(basketOgSvg(v))) : res.sendStatus(404);
  });
  // A card is public by link, like a basket. It carries no handle or dollar amount.
  const cardRoute = (send: (v: CardView, res: express.Response) => void): express.RequestHandler => async (req, res) => {
    try {
      const row = cardById(Number(req.params.id));
      const v = row && (await cardView(row));
      v ? send(v, res.set("Cache-Control", "public, max-age=300")) : res.sendStatus(404);
    } catch (e) {
      console.error(req.path, e);
      res.sendStatus(500);
    }
  };
  r.get("/card/:id.svg", cardRoute((v, res) => res.type("image/svg+xml").send(cardSvg(v))));
  r.get("/card/:id.json", cardRoute((v, res) => res.json(cardMetadata(v, process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`))));
  r.get("/og/t/:id.png", async (req, res) => {
    const t = await tradeCard(Number(req.params.id));
    const s = t ? await (req.query.f === "story" ? storySvg : ogSvg)(t.handle, t.id) : undefined;
    s ? res.type("image/png").set("Cache-Control", "public, max-age=300").send(svgToPng(s)) : res.sendStatus(404);
  });
  r.get("/api/feed", (_q, res) => res.json(db.prepare("SELECT id, leader, at FROM trades WHERE private = 0 ORDER BY id DESC LIMIT 50").all()));

  // ---- JSON reads for agents (the Tribe MCP server, src/mcp.ts). Auth: session cookie or `Authorization: Bearer <agent token>`. ----
  r.get("/api/v1/top", act(async (_uid, req) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    return { days, traders: topTraders(days, 20).map((t) => ({ handle: t.handle, persona: t.persona, realisedPct: Number(t.pct.toFixed(2)), fills: t.n, guardPaused: !!haltOf(t.id) })) };
  }));
  r.get("/api/v1/baskets", act(async (_uid, req) => ({ baskets: (await basketBoard(50)).filter((v) => matchesFilter(v, assetFilter(req.query.asset))).slice(0, 20).map((v) => ({ id: v.id, name: v.name, creator: v.handle, mix: v.mix.map((m) => ({ assetClass: m.label, pct: m.pct })), risk: v.risk, tokens: v.weights.map((w) => ({ symbol: w.symbol, weight: w.weight })), returnPct: Number(v.returnPct.toFixed(2)), stopPct: v.stopPct, targetPct: v.tpPct, copiers: v.copiers, guardPaused: !!haltOf(v.owner) })) })));
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
    // New accounts: a wallet signed in through Privy (the sign-up ticket carries it), and the username is picked here.
    // Only the test suite creates plain accounts with a practice wallet.
    const t = signupTicketOf(req);
    if (!plainSignupAllowed()) {
      if (!t) return res.status(400).json({ error: "Sign in with your wallet first.", redirect: "/signin" });
      if (!t.wallet) return res.status(400).json({ error: "Connect your wallet first." });
      if (userByPrivy(t.privy) !== undefined) return res.status(400).json({ error: "You already have an account. Sign in instead.", redirect: "/signin" });
      if (userByWallet(t.wallet) !== undefined) return res.status(400).json({ error: "That wallet already belongs to another account. Connect a different one." });
    }
    // No risk quiz: balanced starting limits, changed any time in Settings or per trader.
    const persona = PERSONA[String(b.persona)] ? String(b.persona) : undefined;
    const u = createWebUser(String(b.handle ?? ""), Number(b.avatar) || 0, persona ?? null);
    if (!u) return res.status(400).json({ error: "That username is taken or invalid." });
    const p = PERSONA[persona ?? "Hodler"];
    setMeta(u.id, { defaults: { mode: "ask", max: p.max, cap: p.cap, stop: p.stop, chase: 1 }, strict: p.strict, permUntil: Date.now() + 30 * 86400e3, simBalance: isDry() ? 1000 : 0 });
    if (isDry()) addLedger(u.id, "deposit", 1000, "Demo credit (simulated USDC)");
    if (t) db.prepare("UPDATE users SET privy_user_id = ? WHERE id = ?").run(t.privy, u.id);
    if (t?.wallet) linkWallet(u.id, t.wallet);
    const session = startSession(res, u.id, req);
    if (t) res.setHeader("Set-Cookie", [session, clearSignupTicket]);
    const f = b.follow && userByHandle(b.follow) ? `/copy/${userByHandle(b.follow)!.handle}` : "/feed";
    res.json({ redirect: `/splash?next=${encodeURIComponent(f)}` }); // first time: splash and intro, then the app
  });

  r.post("/api/persona", json, act((uid, req) => {
    const persona = PERSONA[String(req.body.persona)] ? String(req.body.persona) : "Hodler";
    const p = PERSONA[persona];
    db.prepare("UPDATE users SET persona = ? WHERE id = ?").run(persona, uid);
    setMeta(uid, { defaults: { ...getMeta(uid).defaults, max: p.max, cap: p.cap, stop: p.stop }, strict: p.strict });
    return { redirect: "/me", toast: `You're a ${persona}. Defaults updated.` };
  }));

  r.post("/api/signout", json, (req, res) => {
    endSession(req, res);
    res.json({ redirect: "/signin?out=1" }); // the sign-in page also ends the Privy wallet session
  });

  // ---- Signed-in devices and AI agent tokens (Settings). An agent token can't mint, list or revoke access. ----
  const ownerOnly = (fn: (uid: number, req: Request, res: Response) => unknown) =>
    act((uid, req, res) => {
      if (isAgent(req)) throw new Error("Agent tokens can't manage account access. Use the app.");
      return fn(uid, req, res);
    });
  r.post("/api/sessions/revoke", json, ownerOnly((uid, req) => {
    if (!revokeSession(uid, String(req.body?.id))) throw new Error("That device is already signed out");
    return { reload: true, toast: "Signed out that device" };
  }));
  r.post("/api/sessions/revoke-others", json, ownerOnly((uid, req) => {
    const n = revokeSessions(uid, { kind: "web", except: currentSession(req)!.id });
    return { reload: true, toast: n ? `Signed out ${n} other device${n === 1 ? "" : "s"}` : "No other devices were signed in" };
  }));
  r.post("/api/agent-tokens", json, ownerOnly((uid, req) => {
    const name = String(req.body?.name ?? "").trim().slice(0, 40) || "My agent";
    revealOnce(uid, createSession(uid, "agent", { name, req }));
    return { reload: true, toast: "Token created. Copy it now: it's shown only once." };
  }));
  r.post("/api/agent-tokens/revoke", json, ownerOnly((uid, req) => {
    if (!revokeSession(uid, String(req.body?.id))) throw new Error("That token is already revoked");
    return { reload: true, toast: "Token revoked. Agents using it are signed out." };
  }));
  r.post("/api/delete-account", json, ownerOnly((uid, _req, res) => {
    for (const sql of ["DELETE FROM follows WHERE follower = ? OR leader = ?", "DELETE FROM pending_copies WHERE follower = ?", "DELETE FROM strategies WHERE owner = ?"]) {
      const n = (sql.match(/\?/g) ?? []).length;
      db.prepare(sql).run(...Array(n).fill(uid));
    }
    db.prepare("UPDATE users SET handle = ? WHERE id = ?").run(`deleted_${uid}`, uid);
    detachDeleted(uid); // the wallet and Privy login are free again: signing in with them makes a new account
    db.prepare("UPDATE bots SET status = 'stopped', reason = 'Account deleted' WHERE owner = ?").run(uid);
    wipeCat(uid);
    revokeSessions(uid); // every browser and agent token
    res.setHeader("Set-Cookie", "tribe=; Path=/; Max-Age=0");
    return { redirect: "/signin?out=1" }; // also ends the Privy wallet session in this browser
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
    // MetaMask users approve every copy themselves: Tribe can't sign for their wallet, so there's no auto mode.
    const mode = b.mode === "auto" && getUser(uid).wallet_kind !== "external" ? "auto" : "ask";
    setFollow(uid, lu.id, {
      mode, ratio: num(b.ratio, 1), budgetUsd: num(b.budget, 250), maxUsdPerTrade: num(b.max, 25), dailyCapUsd: num(b.cap, 100), requireStop: String(b.stop) === "1" || b.stop === true, paused: false,
      // Callers that don't send these (the MCP tool) keep what the follower set.
      ...(b.stopPct !== undefined ? { stopPct: Math.min(50, Math.max(0, num(b.stopPct, 0))) || undefined } : {}),
      ...(b.close !== undefined ? { closeOnPause: String(b.close) === "1" || b.close === true } : {}),
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
    // "Always copy" switches to auto, which only works where Tribe can sign: never for the user's own wallet.
    if (always && getUser(uid).wallet_kind !== "external") setFollow(uid, c.leader, { mode: "auto" });
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
    // A close is a sell like any other: everyone holding a copy of this position sells the same share of their copy.
    const m = await mirror(uid, t, "user", "Closed the position");
    if (m.own.startsWith("failed")) throw new Error(m.own.replace(/^failed: /, "Couldn't close it: "));
    notifier?.(m.pending, uid);
    const n = m.pending.length + m.executed.length;
    return { reload: true, toast: `Closed ${symOf(token)} at market${n ? ` · ${n} copier${n === 1 ? "" : "s"} selling too` : ""}` };
  }));
  r.post("/api/position-stop", json, act(async (uid, req) => {
    const token = String(req.body.token).toLowerCase();
    const pct = Number(req.body.stop);
    if (!(pct > 0 && pct < 90)) throw new Error("Enter a stop between 0.5% and 90%");
    const p = db.prepare("SELECT qty, cost FROM positions WHERE trader = ? AND token = ?").get(uid, token) as { qty: number; cost: number } | undefined;
    if (!p || p.qty <= 0) throw new Error("No open position");
    const price = (p.cost / p.qty) * (1 - pct / 100);
    if (price >= (await getPrice(token))) throw new Error("That stop is above the current price, so it would fire at once. Pick a lower one.");
    await moveStop(uid, token, price, p.qty);
    // Copiers' stops on this token follow it up, never down.
    const raised = await mirrorStopMove(uid, token, price);
    return { reload: true, toast: `Stop moved to −${pct}%${raised ? ` · raised for ${raised} copier${raised === 1 ? "" : "s"}` : ""}` };
  }));

  // ---- Social ----
  // Swipe deck: left skips a trade for good; right copies it once (same Guard, cap and stop rules as auto-copy).
  r.post("/api/swipe", json, act((uid, req) => {
    // A basket's swipe is kept on its negative id.
    if (req.body?.basket !== undefined) {
      recordSwipe(uid, -Number(req.body.basket), "left");
      return { ok: true };
    }
    const trade = Number(req.body?.trade);
    if (!tradeById(trade)) throw new Error("Trade not found");
    recordSwipe(uid, trade, req.body?.dir === "right" ? "right" : "left");
    return { ok: true };
  }));
  // The live deck: new cards as trades are placed, and fresh numbers for the cards on screen.
  const idList = (v: unknown) => String(v ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  r.get("/api/deck/cards", act((uid, req) => {
    const have = String(req.query.have ?? "").split(",");
    return deckCards(uid, new Set(idList(have.filter((x) => !x.startsWith("b")).join(","))), new Set(idList(have.filter((x) => x.startsWith("b")).map((x) => x.slice(1)).join(","))));
  }));
  r.get("/api/deck/live", act((_uid, req) => deckLive(idList(req.query.ids))));
  r.get("/api/deck/brief", act((_uid, req) => briefHtml(String(req.query.h ?? ""))));
  r.get("/api/deck/active", act(async (uid) => ({ html: await activeHtml(uid) })));
  // ---- Baskets ----
  r.post("/api/baskets", json, act(async (uid, req) => {
    const b = req.body ?? {};
    const input = { name: b.name, thesis: b.thesis, stopPct: b.stopPct, tpPct: b.tpPct, weights: b.weights };
    // With real money a basket is published by buying it. Practice mode can still publish an empty one.
    if (b.usd === undefined && isDry()) return { redirect: `/b/${await createBasket(uid, input)}`, toast: "Trade published" };
    const out = await publishBasket(uid, { ...input, usd: Number(b.usd) });
    return { redirect: `/b/${out.id}#yours`, unlock: unlockOf(cardFor(uid, out.id), out.id), toast: out.failed ? `Published. ${out.placed} of ${tokensText(out.placed + out.failed)} bought: try the rest from your holding` : `Published, and bought $${out.usd} across ${tokensText(out.placed)}` };
  }));
  r.post("/api/baskets/:id/weights", json, act(async (uid, req) => {
    const id = Number(req.params.id);
    const out = await updateWeights(uid, id, req.body?.weights, String(req.body?.note ?? "").trim() || undefined);
    return { redirect: `/b/${id}`, toast: `Version ${out.version} published${out.asked ? ` · ${out.asked} copier${out.asked === 1 ? "" : "s"} asked to rebalance` : ""}` };
  }));
  r.post("/api/baskets/:id/retire", json, act((uid, req) => {
    retireBasket(uid, Number(req.params.id));
    return { reload: true, toast: "Trade retired" };
  }));
  r.post("/api/basket-copy", express.urlencoded({ extended: false }), json, act(async (uid, req) => {
    const basket = Number(req.body?.basket);
    const out = await copyBasket(uid, basket, Number(req.body?.usd));
    if (out.status === "failed") throw new Error("None of the tokens could be bought, so nothing was copied");
    return { redirect: `/b/${basket}#yours`, unlock: unlockOf(cardOfCopy(out.copy), basket), toast: out.failed ? `${out.placed} of ${tokensText(out.placed + out.failed)} filled. Try the rest from your copy.` : `Copied $${out.usd} across ${tokensText(out.placed)}` };
  }));
  r.post("/api/basket-copy/:id/retry", json, act(async (uid, req) => {
    const out = await retryCopy(uid, Number(req.params.id));
    return { reload: true, toast: out.failed ? `${out.failed} still didn't fill` : "Every token filled" };
  }));
  r.post("/api/basket-copy/:id/close", json, act(async (uid, req) => {
    const out = await closeCopy(uid, Number(req.params.id));
    return { redirect: "/portfolio", toast: out.failed ? `${out.failed} couldn't be sold. Try closing again.` : `Sold ${tokensText(out.sold)} at market` };
  }));
  r.post("/api/basket-rebalance", json, act(async (uid, req) => {
    const id = Number(req.body?.id);
    if (req.body?.action === "skip") {
      skipRebalance(uid, id);
      return { reload: true, toast: "Kept what you hold" };
    }
    const out = await approveRebalance(uid, id);
    return { reload: true, toast: out.failed ? `${out.failed} order${out.failed === 1 ? "" : "s"} didn't fill. Try again from your copy.` : "Rebalanced" };
  }));
  // One reaction per person per trade; an empty emoji removes it. Returns the re-rendered control.
  r.post("/api/react", json, act((uid, req) => {
    const key = String(req.body.emoji ?? "");
    if (key && !isReaction(key)) throw new Error("Unknown reaction");
    const trade = Number(req.body.trade);
    if (!tradeById(trade)) throw new Error("Trade not found");
    setReaction(trade, uid, key || null);
    return { html: reactBar(trade, uid) };
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
    if (!getMeta(uid).kyc) return { redirect: "/creator/verify", toast: "Verify once before your first payout" };
    if (!isDry()) throw new Error("Onchain fee-share payouts aren't built yet.");
    setMeta(uid, { claimed: cr.claimed + cr.claimable, simBalance: getMeta(uid).simBalance + cr.claimable });
    addLedger(uid, "payout", cr.claimable, "Fee-share (demo payout)");
    return { reload: true, toast: `$${cr.claimable.toFixed(2)} added to your balance` };
  }));
  // A trade by hand from the trade ticket: always with a stop; copied to followers by their own rules.
  r.post("/api/trade/new", json, act(async (uid, req) => {
    const usd = Number(req.body?.usd), stop = Number(req.body?.stop), tp = Number(req.body?.tp ?? 0);
    const note = String(req.body?.note ?? "").trim().slice(0, 200);
    if (!(usd >= 1 && usd <= 10000)) throw new Error("Amount is $1 to $10,000");
    const free = await freeBalance(uid);
    if (usd > free + 1e-6) throw new Error(`You have $${free.toFixed(2)} USDC on Base. Lower the amount or add funds.`);
    if (!(stop >= 0.5 && stop <= 50)) throw new Error("Every trade needs a stop between 0.5% and 50%");
    if (!(tp === 0 || (tp >= 0.5 && tp <= 500))) throw new Error("Target is none, or 0.5% to 500%");
    // ETH, or any Base token picked from Flash search: checked again here (not flagged, liquid enough).
    const raw = String(req.body?.token ?? "ETH");
    const token = raw.toUpperCase() === "ETH" ? "ETH" : (await tradableToken(raw)).address;
    // How it enters (market, limit, breakout or TWAP) and how it exits (a fixed stop, or one trailing the peak).
    const b = req.body ?? {};
    const entry = (["market", "limit", "stop", "twap"] as const).find((x) => x === b.type) ?? "market";
    const trail = (["trailing-stop", "trailing-stop-limit"] as const).find((x) => x === b.stopType);
    const proposal = await buildProposal({
      side: "buy", usd, token, stopPct: stop, tpPct: trail ? undefined : tp || undefined,
      entry, price: Number(b.price) || undefined, minutes: Number(b.minutes) || undefined, trail, activation: trail ? Number(b.activation) || undefined : undefined,
    }, { oneOrder: isExternal(uid) && !isDry() });
    let first: number | undefined;
    let offers = 0;
    for (const t of proposal.trades) {
      const m = await mirror(uid, t, "user", note || undefined);
      if (m.own.startsWith("failed")) throw new Error(m.own.replace(/^failed: /, "Couldn't place it: "));
      first ??= m.tradeId;
      offers += m.pending.length + m.executed.length;
      notifier?.(m.pending, uid);
    }
    return { redirect: `/t/${first}`, toast: `Placed${offers ? ` · ${offers} copier${offers === 1 ? "" : "s"} copying or asked` : ""}` };
  }));
  // Token picker: popular Base tokens, or Flash search results, each marked tradable or not (and why).
  r.get("/api/tokens", async (req, res) => {
    if (me(req) === undefined) return res.status(401).json({ error: "Sign in first" });
    const q = String(req.query.q ?? "").trim();
    try {
      res.json({ tokens: q ? await searchTokens(q) : await popularTokens() });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  r.post("/api/bots", json, act(async (uid, req) => {
    const b = req.body ?? {};
    const tpl = String(b.template ?? "");
    const bot = await createBot(uid, String(b.name ?? ""), tpl, { usd: b.usd, perDay: b.perDay, stopPct: b.stopPct, tpPct: b.tpPct, maxDdPct: b.maxDdPct, p: b[`p_${tpl}`] ?? b.p });
    return { redirect: `/bots/${bot.id}`, toast: `${bot.name} started its private trial` };
  }));
  r.post("/api/bots/:id/:action", json, act(async (uid, req) => {
    const id = Number(req.params.id), action = String(req.params.action);
    const b = botById(id);
    if (!b || b.owner !== uid) throw new Error("Bot not found");
    if (action === "publish") return { reload: true, toast: `${await publishBot(uid, id)} is live: people can copy it now` };
    if (action === "fastforward") { fastForwardTrial(uid, id); return { reload: true, toast: "Trial time skipped (demo)" }; }
    if (action === "check" || action === "run") {
      if (b.status !== "trial" && b.status !== "live") throw new Error("Resume the bot first");
      const r = await runBot(b, { force: action === "run" });
      return { reload: true, toast: r.why };
    }
    if (action === "update") { updateBot(uid, id, req.body ?? {}); return { reload: true, toast: "Saved" }; }
    return { reload: true, toast: controlBot(uid, id, action) };
  }));
  r.post("/api/bot-signals/:id", json, act(async (uid, req) => {
    const r = await answerSignal(uid, Number(req.params.id), !!req.body?.approve);
    return { reload: true, toast: r.why };
  }));
  r.post("/api/creator/verify", json, act((uid, req) => {
    const country = String(req.body?.country ?? "").toUpperCase();
    if (!country) throw new Error("Choose where you live");
    if (req.body?.adult !== true || req.body?.honest !== true) throw new Error("Tick both boxes to continue");
    if (BLOCKED_COUNTRIES().includes(country)) throw new Error("Creator payouts aren't available where you live yet. You can still post trades and run bots.");
    setMeta(uid, { kyc: { country, at: Date.now() } });
    return { redirect: "/portfolio?tab=creating", toast: "Verified. You can claim payouts now." };
  }));
  r.post("/api/strategy", json, act((uid, req) => {
    const name = String(req.body.name ?? "").trim();
    if (name.length < 3) throw new Error("Give it a name (3+ characters)");
    addStrategy(uid, name, req.body.kind === "trades" ? "trades" : "bot", String(req.body.description ?? ""));
    return { redirect: "/portfolio?tab=creating", toast: `${name} is live` };
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
