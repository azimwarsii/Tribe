import { DatabaseSync } from "node:sqlite"; // built into Node >= 22.5, no native build step
import { randomInt } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Trade } from "./flash.js";
import type { FollowRules } from "./rules.js";

export const db = new DatabaseSync(process.env.DB_PATH ?? "tribe.db");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, handle TEXT UNIQUE, address TEXT NOT NULL, pk TEXT NOT NULL, xp INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS follows (
  follower INTEGER NOT NULL, leader INTEGER NOT NULL, rules TEXT NOT NULL, PRIMARY KEY (follower, leader)
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT, leader INTEGER NOT NULL, trade TEXT NOT NULL, at INTEGER NOT NULL, source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, trade_id INTEGER NOT NULL, follower INTEGER NOT NULL, leader INTEGER NOT NULL,
  usd REAL NOT NULL, status TEXT NOT NULL, order_id TEXT, note TEXT, at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, trade_id INTEGER NOT NULL, follower INTEGER NOT NULL, leader INTEGER NOT NULL,
  trade TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS guard_halts (leader INTEGER PRIMARY KEY, reason TEXT NOT NULL, at INTEGER NOT NULL, tx TEXT);
CREATE TABLE IF NOT EXISTS guard_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, leader INTEGER NOT NULL, kind TEXT NOT NULL, reason TEXT, tx TEXT, at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, trade_id INTEGER NOT NULL, trader INTEGER NOT NULL, leader INTEGER NOT NULL,
  role TEXT NOT NULL, order_id TEXT, trade TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', sim INTEGER NOT NULL DEFAULT 0,
  placed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS positions (
  trader INTEGER NOT NULL, token TEXT NOT NULL, qty REAL NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0,
  realized REAL NOT NULL DEFAULT 0, invested REAL NOT NULL DEFAULT 0, PRIMARY KEY (trader, token)
);
CREATE TABLE IF NOT EXISTS snapshots (trader INTEGER NOT NULL, at INTEGER NOT NULL, pnl_pct REAL NOT NULL);
CREATE TABLE IF NOT EXISTS reactions (trade_id INTEGER NOT NULL, user INTEGER NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (trade_id, user, emoji));
CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, trade_id INTEGER NOT NULL, user INTEGER NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user INTEGER NOT NULL, kind TEXT NOT NULL, usd REAL NOT NULL, note TEXT, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cat_chats (id INTEGER PRIMARY KEY AUTOINCREMENT, user INTEGER NOT NULL, title TEXT NOT NULL, source TEXT NOT NULL, state TEXT NOT NULL DEFAULT '{}', at INTEGER NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cat_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, chat INTEGER NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, data TEXT, vote INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cat_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, user INTEGER NOT NULL, text TEXT NOT NULL, source TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS squads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, owner INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS squad_members (user INTEGER PRIMARY KEY, squad INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cre_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, oracle REAL, dex REAL, deviation REAL, verdicts TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cat_reads (id INTEGER PRIMARY KEY AUTOINCREMENT, trade INTEGER NOT NULL, user INTEGER NOT NULL, label TEXT NOT NULL, token TEXT NOT NULL, price REAL NOT NULL, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS season_boards (season INTEGER PRIMARY KEY, hash TEXT NOT NULL, tx TEXT, computed_at INTEGER NOT NULL, ranking TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quest_claims (user INTEGER NOT NULL, quest TEXT NOT NULL, period TEXT NOT NULL, xp INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user, quest, period));
CREATE TABLE IF NOT EXISTS bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT, owner INTEGER NOT NULL, name TEXT NOT NULL, template TEXT NOT NULL, params TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial', reason TEXT, created_at INTEGER NOT NULL, trial_from INTEGER NOT NULL, published_at INTEGER,
  last_check INTEGER, last_why TEXT
);
CREATE TABLE IF NOT EXISTS bot_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, bot INTEGER NOT NULL, owner INTEGER NOT NULL, intent TEXT NOT NULL, why TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS price_ticks (token TEXT NOT NULL, price REAL NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS price_ticks_token_at ON price_ticks (token, at);
CREATE TABLE IF NOT EXISTS strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, owner INTEGER NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, description TEXT,
  public INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
`);

/** Add a column to an existing table if an older database lacks it. */
// Baskets: see baskets.ts.
db.exec(`
CREATE TABLE IF NOT EXISTS baskets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, owner INTEGER NOT NULL, name TEXT NOT NULL, thesis TEXT, stop_pct REAL NOT NULL DEFAULT 0,
  tp_pct REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'live', at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS basket_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, basket INTEGER NOT NULL, n INTEGER NOT NULL, weights TEXT NOT NULL, prices TEXT NOT NULL,
  nav_start REAL NOT NULL, note TEXT, at INTEGER NOT NULL, UNIQUE (basket, n)
);
CREATE TABLE IF NOT EXISTS basket_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, basket INTEGER NOT NULL, follower INTEGER NOT NULL, version INTEGER NOT NULL, usd REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'filling', note TEXT, at INTEGER NOT NULL, closed_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS basket_copy_open ON basket_copies (basket, follower) WHERE status IN ('filling','filled','partial');
CREATE TABLE IF NOT EXISTS basket_legs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, copy_id INTEGER NOT NULL, token TEXT NOT NULL, kind TEXT NOT NULL, trade TEXT NOT NULL,
  usd REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open', note TEXT, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS basket_legs_copy ON basket_legs (copy_id);
CREATE TABLE IF NOT EXISTS basket_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, copy_id INTEGER NOT NULL, basket INTEGER NOT NULL, version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS basket_nav (basket INTEGER NOT NULL, at INTEGER NOT NULL, nav REAL NOT NULL);
CREATE INDEX IF NOT EXISTS basket_nav_by ON basket_nav (basket, at);
CREATE TABLE IF NOT EXISTS basket_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, basket INTEGER NOT NULL, owner INTEGER NOT NULL, kind TEXT NOT NULL, copy_id INTEGER UNIQUE,
  edition INTEGER NOT NULL, tier TEXT NOT NULL DEFAULT 'base', tier_at INTEGER, at INTEGER NOT NULL, UNIQUE (basket, edition)
);
CREATE INDEX IF NOT EXISTS basket_cards_owner ON basket_cards (owner);
`);

// Basket Cards: see cards.ts. Minting is one statement each, so editions can't collide and a repeat does nothing.
export function mintOriginalCard(basket: number, owner: number) {
  db.prepare("INSERT OR IGNORE INTO basket_cards (basket, owner, kind, edition, at) VALUES (?, ?, 'original', 0, ?)").run(basket, owner, Date.now());
}
export function mintCopyCard(copyId: number) {
  db.prepare(`INSERT OR IGNORE INTO basket_cards (basket, owner, kind, copy_id, edition, at)
    SELECT c.basket, c.follower, 'copy', c.id, (SELECT COALESCE(MAX(k.edition), 0) + 1 FROM basket_cards k WHERE k.basket = c.basket), ? FROM basket_copies c WHERE c.id = ?`).run(Date.now(), copyId);
}
/** Cards for baskets and copies from before cards existed, numbered in the order they happened. Safe to run on every start. */
export function backfillCards() {
  db.exec(`INSERT OR IGNORE INTO basket_cards (basket, owner, kind, edition, at) SELECT id, owner, 'original', 0, at FROM baskets;
    INSERT OR IGNORE INTO basket_cards (basket, owner, kind, copy_id, edition, at)
    SELECT c.basket, c.follower, 'copy', c.id, (SELECT COALESCE(MAX(k.edition), 0) FROM basket_cards k WHERE k.basket = c.basket) + ROW_NUMBER() OVER (PARTITION BY c.basket ORDER BY c.id), c.at
    FROM basket_copies c JOIN baskets b ON b.id = c.basket WHERE c.follower != b.owner AND c.status IN ('filled','partial','closed') AND c.id NOT IN (SELECT copy_id FROM basket_cards WHERE copy_id IS NOT NULL);`);
}

function addCol(table: string, col: string, def: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  if (!cols.some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addCol("users", "meta", "TEXT NOT NULL DEFAULT '{}'");
addCol("users", "avatar", "INTEGER NOT NULL DEFAULT 0");
addCol("users", "persona", "TEXT");
addCol("users", "created_at", "INTEGER NOT NULL DEFAULT 0");
// Privy embedded wallet: the user owns it, Tribe signs as a policy-limited signer. Once linked, pk is cleared.
addCol("basket_cards", "chain_tx", "TEXT"); // the mint transaction, once the card is onchain (see card-chain.ts)
addCol("basket_cards", "chain_to", "TEXT"); // who it was minted to; it may have been sold since
addCol("basket_cards", "chain_tier", "TEXT"); // the tier last recorded onchain
addCol("users", "privy_user_id", "TEXT");
addCol("users", "privy_wallet_id", "TEXT");
addCol("users", "privy_policy_id", "TEXT");
// Which wallet trades for the user: "demo" (generated key, practice), "external" (their own MetaMask: every trade is
// approved in the browser, Tribe holds no key) or "privy" (embedded wallet with Tribe as a limited signer).
addCol("users", "wallet_kind", "TEXT NOT NULL DEFAULT 'demo'");
// Accounts deleted before deleting freed their wallet: free it now.
db.prepare("UPDATE users SET address = '0x000000000000000000000000000000000000dEaD', privy_user_id = NULL, privy_wallet_id = NULL, privy_policy_id = NULL WHERE handle LIKE 'deleted\\_%' ESCAPE '\\' AND (privy_user_id IS NOT NULL OR address != '0x000000000000000000000000000000000000dEaD')").run();
// Chats from when Chief was one thread were all titled "Chief": name them by their first question for the history list.
db.exec("UPDATE cat_chats SET title = (SELECT substr(text, 1, 60) FROM cat_msgs WHERE chat = cat_chats.id AND role = 'user' ORDER BY id LIMIT 1) WHERE title IN ('Cat', 'New chat') AND EXISTS (SELECT 1 FROM cat_msgs WHERE chat = cat_chats.id AND role = 'user')");
// Creator bots: which bot placed a trade, and whether it's private (a bot on its trial: not in the feed, not copied).
addCol("trades", "bot_id", "INTEGER");
addCol("trades", "private", "INTEGER NOT NULL DEFAULT 0");
addCol("orders", "price", "REAL");
addCol("orders", "tokens", "REAL");
addCol("orders", "usd", "REAL");
addCol("orders", "pnl", "REAL");
addCol("orders", "filled_at", "INTEGER");
addCol("follows", "created_at", "INTEGER NOT NULL DEFAULT 0");
addCol("trades", "note", "TEXT"); // the trader's (or agent's) one-line thesis
addCol("orders", "tx", "TEXT"); // settlement transaction hash, from Flash fills
addCol("orders", "fee", "REAL"); // integrator fee earned on this order (USD), from Flash fills
addCol("orders", "parent", "INTEGER"); // entry order a protective order belongs to
addCol("orders", "setup", "TEXT"); // approval / setup transaction hashes (JSON array)
addCol("orders", "close_reason", "TEXT"); // why Flash (or Tribe) closed the order, e.g. REASON_MAXIMUM_SLIPPAGE_EXCEEDED
addCol("users", "photo", "TEXT"); // profile picture, a small JPEG data URL (resized in the browser)
addCol("users", "photo_at", "INTEGER NOT NULL DEFAULT 0"); // cache-buster for /avatar/:id
addCol("users", "bio", "TEXT");
// Swipe deck: a trade someone swiped on (left = skip, right = copied) doesn't come back to their deck.
db.exec("CREATE TABLE IF NOT EXISTS swipes (user INTEGER NOT NULL, trade INTEGER NOT NULL, dir TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user, trade))");
// Reactions moved from raw emoji to named badges (src/views/reactions.ts); carry old ones over once.
for (const [from, to] of [["🔥", "fire"], ["💎", "diamond"], ["🎯", "bulb"], ["🙏", "fire"]]) db.prepare("UPDATE OR IGNORE reactions SET emoji = ? WHERE emoji = ?").run(to, from);
db.exec("DELETE FROM reactions WHERE emoji IN ('🔥', '💎', '🎯', '🙏')");
// Free follow: see someone's trades in Following without copying them (copying lives in follows).
db.exec("CREATE TABLE IF NOT EXISTS watches (follower INTEGER NOT NULL, leader INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (follower, leader))");
// Signed-in browsers and AI agent tokens (src/auth.ts). A token names its row; revoking the row signs it out.
db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user INTEGER NOT NULL, kind TEXT NOT NULL, name TEXT, user_agent TEXT,
  created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
)`);
db.exec("CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user, kind)");
// Telegram sign-in links already used (each works once); pruned after a day, past their 15-minute life.
db.exec("CREATE TABLE IF NOT EXISTS used_logins (sig TEXT PRIMARY KEY, at INTEGER NOT NULL)");
// App-wide switches set by the operator (npm run freeze), read fresh on every use so they apply at once.
db.exec("CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY, value TEXT NOT NULL, at INTEGER NOT NULL)");

/** The reason all copying is paused for everyone, or undefined when copying runs. */
export const copyFreeze = () => (db.prepare("SELECT value FROM app_flags WHERE key = 'copy_freeze'").get() as { value: string } | undefined)?.value;
export const setCopyFreeze = (reason: string | undefined) =>
  reason ? db.prepare("INSERT OR REPLACE INTO app_flags (key, value, at) VALUES ('copy_freeze', ?, ?)").run(reason, Date.now()) : db.prepare("DELETE FROM app_flags WHERE key = 'copy_freeze'").run();

export interface User {
  id: number; handle: string; address: `0x${string}`; xp: number; avatar: number; persona: string | null; created_at: number; photo_at: number; bio: string | null;
  /** Demo wallets only: the server-held key. Empty once the user links a Privy wallet. */
  pk: `0x${string}` | "";
  privy_user_id: string | null; privy_wallet_id: string | null; privy_policy_id: string | null;
  wallet_kind: "demo" | "external" | "privy";
}

export interface Meta {
  perm: boolean; // auto-copy permission granted
  permUntil: number;
  pausedAll: boolean;
  defaults: { mode: "ask" | "auto"; max: number; cap: number; stop: boolean; chase: number }; // chase: max % above the leader's entry a copy may pay
  tightApprovals: boolean; // Flash Permit2 + minimal allowance: no standing unlimited approval on the wallet
  strict: "Strict" | "Balanced" | "Relaxed";
  timerSec: number;
  slip: string;
  simBalance: number; // USDC balance used in DRY_RUN
  push: boolean; tg: boolean; email: boolean; quiet: boolean; hideBalance: boolean;
  tgId?: number;
  claimed: number; // creator fee-share already claimed (USD)
  catPersona: "Sharp" | "Chill" | "Degen"; // Chief's tone only; limits and Guard never change
  catMemory: boolean; // use memory in replies
  catForgot: string[]; // learned-memory items the user asked Chief to forget
  seenLevel: number; // highest level the level-up screen has been shown for
  aReq: boolean; aGuard: boolean; aFills: boolean; aHits: boolean; aPayout: boolean; aWeekly: boolean; // which events send alerts
  bot: { on: boolean; usd: number; perDay: number }; // the user's own bot: runs the CRE strategy and trades under their name, tagged Bot
  kyc?: { country: string; at: number }; // creator verified before their first payout
  foundingUntil?: number; // founding creator: the higher fee share until this time
}

export const DEFAULT_META: Meta = {
  perm: true, permUntil: 0, pausedAll: false,
  defaults: { mode: "ask", max: 25, cap: 100, stop: true, chase: 1 },
  tightApprovals: true,
  strict: "Balanced", timerSec: 60, slip: "0.5%", simBalance: 0,
  push: true, tg: false, email: false, quiet: false, hideBalance: false, claimed: 0,
  catPersona: "Sharp", catMemory: true, catForgot: [], seenLevel: 0,
  aReq: true, aGuard: true, aFills: true, aHits: true, aPayout: true, aWeekly: false,
  bot: { on: false, usd: 10, perDay: 2 },
};

export function getMeta(id: number): Meta {
  const r = db.prepare("SELECT meta FROM users WHERE id = ?").get(id) as { meta: string } | undefined;
  const m = r ? (JSON.parse(r.meta) as Partial<Meta>) : {};
  return { ...DEFAULT_META, ...m, defaults: { ...DEFAULT_META.defaults, ...(m.defaults ?? {}) }, bot: { ...DEFAULT_META.bot, ...(m.bot ?? {}) } };
}
export function setMeta(id: number, patch: Partial<Meta>): Meta {
  const next = { ...getMeta(id), ...patch };
  db.prepare("UPDATE users SET meta = ? WHERE id = ?").run(JSON.stringify(next), id);
  return next;
}

/** Demo wallet generated per user. Replace with Privy/embedded wallets so the server never holds keys. */
export function getUser(id: number): User {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as User | undefined;
  if (row) return row;
  const pk = generatePrivateKey();
  const address = privateKeyToAccount(pk).address;
  db.prepare("INSERT INTO users (id, handle, address, pk, created_at) VALUES (?, ?, ?, ?, ?)").run(id, `trader${id}`, address, pk, Date.now());
  return getUser(id);
}

/** Web sign-up without Telegram: allocate a user id above the Telegram id range. */
/** Usernames: 3-20 letters, numbers or _, unique ignoring case (stored lowercase), and not a word the app uses itself. */
const RESERVED = new Set(["admin", "tribe", "cat", "bot", "guard", "copyguard", "support", "system", "chainlink", "flash", "you"]);
export const handleOk = (handle: string, self?: number) => {
  const h = handle.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(h)) return "3-20 letters, numbers or _";
  if (RESERVED.has(h) && !(self !== undefined && userByHandle(h)?.id === self)) return "That name is reserved";
  const taken = userByHandle(h);
  return taken && taken.id !== self ? "That username is taken" : null;
};

export function createWebUser(handle: string, avatar = 0, persona: string | null = null): User | undefined {
  if (handleOk(handle)) return undefined;
  handle = handle.trim().toLowerCase();
  let id: number;
  do id = 10_000_000_000 + randomInt(0, 2_000_000_000); while (db.prepare("SELECT 1 FROM users WHERE id = ?").get(id));
  getUser(id);
  db.prepare("UPDATE users SET handle = ?, avatar = ?, persona = ? WHERE id = ?").run(handle, avatar, persona, id);
  return getUser(id);
}

export const userByHandle = (handle: string) => db.prepare("SELECT * FROM users WHERE handle = ? COLLATE NOCASE").get(handle.replace(/^@/, "")) as unknown as User | undefined;
export const userById = (id: number) => db.prepare("SELECT * FROM users WHERE id = ?").get(id) as unknown as User | undefined;

export function setHandle(id: number, handle: string, seed = false): boolean {
  // The seed may claim reserved demo names (e.g. "you"); people can't.
  const bad = handleOk(handle, id);
  if (bad && !(seed && bad === "That name is reserved")) return false;
  db.prepare("UPDATE users SET handle = ? WHERE id = ?").run(handle.trim().toLowerCase(), id);
  return true;
}

export const allUsers = () => db.prepare("SELECT id, handle, address FROM users").all() as unknown as { id: number; handle: string; address: string }[];
export const tradeById = (id: number) => {
  const r = db.prepare("SELECT id, leader, trade, at, source, note, bot_id, private FROM trades WHERE id = ?").get(id) as any;
  return r ? { ...r, trade: JSON.parse(r.trade) as Trade } : undefined;
};
export const pendingFor = (follower: number) =>
  (db.prepare("SELECT id, trade_id, leader, trade, expires_at FROM pending_copies WHERE follower = ? AND status = 'open' AND expires_at > ? ORDER BY expires_at").all(follower, Date.now()) as any[]).map(
    (r) => ({ ...r, trade: JSON.parse(r.trade) as Trade }),
  );
/** A deleted account lets go of its wallet and Privy login, so neither signs back into it. */
export const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
export const detachDeleted = (uid: number) =>
  db.prepare("UPDATE users SET address = ?, privy_user_id = NULL, privy_wallet_id = NULL, privy_policy_id = NULL WHERE id = ?").run(DEAD_ADDRESS, uid);
export const followCount = (leader: number) => (db.prepare("SELECT COUNT(*) AS n FROM follows WHERE leader = ?").get(leader) as { n: number }).n;
export const isFollowing = (follower: number, leader: number) => !!getFollowRules(follower, leader);

// Free follows (watching): no money moves; their trades show in your Following tab.
export const isWatching = (follower: number, leader: number) => !!db.prepare("SELECT 1 FROM watches WHERE follower = ? AND leader = ?").get(follower, leader);
export const setWatch = (follower: number, leader: number, on: boolean) =>
  on ? db.prepare("INSERT OR IGNORE INTO watches (follower, leader, created_at) VALUES (?, ?, ?)").run(follower, leader, Date.now()) : db.prepare("DELETE FROM watches WHERE follower = ? AND leader = ?").run(follower, leader);
export const watchersCount = (leader: number) => (db.prepare("SELECT COUNT(*) AS n FROM watches WHERE leader = ?").get(leader) as { n: number }).n;
export const watchingOf = (follower: number) => (db.prepare("SELECT leader FROM watches WHERE follower = ?").all(follower) as unknown as { leader: number }[]).map((r) => r.leader);

export const DEFAULT_RULES: FollowRules = {
  mode: "ask",
  ratio: 1,
  maxUsdPerTrade: 50,
  dailyCapUsd: 200,
  tokens: [],
  orderTypes: [],
  copyProtective: true,
  requireStop: false,
  paused: false,
  guardOverride: false,
};

export function setFollow(follower: number, leader: number, patch: Partial<FollowRules> = {}) {
  const rules = { ...DEFAULT_RULES, ...(getFollowRules(follower, leader) ?? {}), ...patch };
  db.prepare("INSERT INTO follows (follower, leader, rules, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (follower, leader) DO UPDATE SET rules = excluded.rules").run(follower, leader, JSON.stringify(rules), Date.now());
  return rules;
}
export const unfollow = (follower: number, leader: number) => db.prepare("DELETE FROM follows WHERE follower = ? AND leader = ?").run(follower, leader);

export function getFollowRules(follower: number, leader: number): FollowRules | undefined {
  const r = db.prepare("SELECT rules FROM follows WHERE follower = ? AND leader = ?").get(follower, leader) as { rules: string } | undefined;
  return r ? ({ ...DEFAULT_RULES, ...JSON.parse(r.rules) } as FollowRules) : undefined;
}

export const followersOf = (leader: number) =>
  (db.prepare("SELECT follower, rules FROM follows WHERE leader = ?").all(leader) as { follower: number; rules: string }[]).map((r) => ({
    follower: r.follower,
    rules: { ...DEFAULT_RULES, ...JSON.parse(r.rules) } as FollowRules,
  }));

export const followingOf = (follower: number) =>
  (db.prepare("SELECT leader, rules FROM follows WHERE follower = ?").all(follower) as { leader: number; rules: string }[]).map((r) => ({
    leader: r.leader,
    rules: { ...DEFAULT_RULES, ...JSON.parse(r.rules) } as FollowRules,
  }));

/** Who placed a trade: the user themselves (Manual), their bot running the CRE strategy, or their own AI agent over MCP. Bot and agent trades are tagged Bot. */
export type TradeSource = "user" | "bot" | "agent";
export function recordTrade(leader: number, trade: Trade, source: TradeSource, note?: string, extra: { bot?: number; private?: boolean } = {}): number {
  const r = db.prepare("INSERT INTO trades (leader, trade, at, source, note, bot_id, private) VALUES (?, ?, ?, ?, ?, ?, ?)").run(leader, JSON.stringify(trade), Date.now(), source, note?.slice(0, 280) ?? null, extra.bot ?? null, extra.private ? 1 : 0);
  return Number(r.lastInsertRowid);
}

const startOfDay = () => new Date().setUTCHours(0, 0, 0, 0);

/** USD already copied by this follower today (approved or executed copies only). */
export function spentToday(follower: number): number {
  const r = db
    .prepare("SELECT COALESCE(SUM(usd), 0) AS s FROM copies WHERE follower = ? AND at >= ? AND status IN ('executed','dry-run')")
    .get(follower, startOfDay()) as { s: number };
  return r.s;
}

export function recordCopy(c: { tradeId: number; follower: number; leader: number; usd: number; status: string; orderId?: string; note?: string }) {
  db.prepare("INSERT INTO copies (trade_id, follower, leader, usd, status, order_id, note, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    c.tradeId, c.follower, c.leader, c.usd, c.status, c.orderId ?? null, c.note ?? null, Date.now(),
  );
}

export function createPending(tradeId: number, follower: number, leader: number, trade: Trade, ttlMs = 60_000): number {
  const r = db
    .prepare("INSERT INTO pending_copies (trade_id, follower, leader, trade, expires_at) VALUES (?, ?, ?, ?, ?)")
    .run(tradeId, follower, leader, JSON.stringify(trade), Date.now() + ttlMs);
  return Number(r.lastInsertRowid);
}

/** Atomically claim an open, unexpired pending copy for its owner. Returns undefined if already handled or expired. */
export function claimPending(id: number, follower: number, status: "approved" | "skipped") {
  const row = db.prepare("SELECT * FROM pending_copies WHERE id = ? AND follower = ? AND status = 'open'").get(id, follower) as
    | { id: number; trade_id: number; leader: number; trade: string; expires_at: number }
    | undefined;
  if (!row) return undefined;
  const live = row.expires_at > Date.now();
  db.prepare("UPDATE pending_copies SET status = ? WHERE id = ?").run(live ? status : "expired", id);
  return live ? { tradeId: row.trade_id, leader: row.leader, trade: JSON.parse(row.trade) as Trade } : undefined;
}

/** Called once when a leader goes from not paused to paused, whichever path saw it first (CRE post, watcher, copy-time read). */
export const haltListeners: ((leader: number) => void)[] = [];
export const haltLeader = (leader: number, reason: string, tx?: string) => {
  const was = haltOf(leader);
  db.prepare("INSERT OR REPLACE INTO guard_halts (leader, reason, at, tx) VALUES (?, ?, ?, ?)").run(leader, reason, Date.now(), tx ?? null);
  if (was) return;
  db.prepare("INSERT INTO guard_events (leader, kind, reason, tx, at) VALUES (?, 'halt', ?, ?, ?)").run(leader, reason, tx ?? null, Date.now());
  for (const fn of haltListeners) fn(leader);
};
export const resumeLeader = (leader: number, tx?: string) => {
  if (haltOf(leader)) db.prepare("INSERT INTO guard_events (leader, kind, reason, tx, at) VALUES (?, 'resume', NULL, ?, ?)").run(leader, tx ?? null, Date.now());
  db.prepare("DELETE FROM guard_halts WHERE leader = ?").run(leader);
};
export const haltOf = (leader: number) =>
  db.prepare("SELECT reason, at, tx FROM guard_halts WHERE leader = ?").get(leader) as { reason: string; at: number; tx: string | null } | undefined;
export const allHalts = () => db.prepare("SELECT leader, reason, at, tx FROM guard_halts").all() as { leader: number; reason: string; at: number; tx: string | null }[];
export const guardEvents = (leader?: number, limit = 20) =>
  (leader === undefined
    ? db.prepare("SELECT leader, kind, reason, tx, at FROM guard_events ORDER BY id DESC LIMIT ?").all(limit)
    : db.prepare("SELECT leader, kind, reason, tx, at FROM guard_events WHERE leader = ? ORDER BY id DESC LIMIT ?").all(leader, limit)) as unknown as {
    leader: number; kind: "halt" | "resume"; reason: string | null; tx: string | null; at: number;
  }[];

export const recentTrades = (limit = 50) =>
  (db.prepare("SELECT id, leader, trade, at, source FROM trades WHERE private = 0 ORDER BY id DESC LIMIT ?").all(limit) as any[]).map((r) => ({ ...r, trade: JSON.parse(r.trade) }));

// Social
export const toggleReaction = (tradeId: number, user: number, emoji: string) => {
  const has = db.prepare("SELECT 1 FROM reactions WHERE trade_id = ? AND user = ? AND emoji = ?").get(tradeId, user, emoji);
  if (has) db.prepare("DELETE FROM reactions WHERE trade_id = ? AND user = ? AND emoji = ?").run(tradeId, user, emoji);
  else db.prepare("INSERT INTO reactions (trade_id, user, emoji) VALUES (?, ?, ?)").run(tradeId, user, emoji);
  return !has;
};
export const recordSwipe = (user: number, trade: number, dir: "left" | "right") =>
  db.prepare("INSERT INTO swipes (user, trade, dir, at) VALUES (?, ?, ?, ?) ON CONFLICT (user, trade) DO UPDATE SET dir = excluded.dir, at = excluded.at").run(user, trade, dir, Date.now());
export const swipedTrades = (user: number) => new Set((db.prepare("SELECT trade FROM swipes WHERE user = ?").all(user) as unknown as { trade: number }[]).map((r) => r.trade));

/** LinkedIn-style: a person has at most one reaction on a trade; picking another replaces it, null removes it. */
export const setReaction = (tradeId: number, user: number, key: string | null) => {
  db.prepare("DELETE FROM reactions WHERE trade_id = ? AND user = ?").run(tradeId, user);
  if (key) db.prepare("INSERT INTO reactions (trade_id, user, emoji) VALUES (?, ?, ?)").run(tradeId, user, key);
};
export const reactionCounts = (tradeId: number, user?: number) => {
  const rows = db.prepare("SELECT emoji, COUNT(*) AS n, SUM(user = ?) AS mine FROM reactions WHERE trade_id = ? GROUP BY emoji").all(user ?? -1, tradeId) as unknown as { emoji: string; n: number; mine: number }[];
  return rows;
};
export const addComment = (tradeId: number, user: number, text: string) =>
  db.prepare("INSERT INTO comments (trade_id, user, text, at) VALUES (?, ?, ?, ?)").run(tradeId, user, text.slice(0, 280), Date.now());
export const commentsOf = (tradeId: number) =>
  db.prepare("SELECT c.id, c.user, c.text, c.at, u.handle FROM comments c JOIN users u ON u.id = c.user WHERE c.trade_id = ? ORDER BY c.id").all(tradeId) as unknown as { id: number; user: number; text: string; at: number; handle: string }[];
export const commentCount = (tradeId: number) => (db.prepare("SELECT COUNT(*) AS n FROM comments WHERE trade_id = ?").get(tradeId) as { n: number }).n;

// Ledger (demo deposits, creator payouts)
export const addLedger = (user: number, kind: string, usd: number, note?: string) =>
  db.prepare("INSERT INTO ledger (user, kind, usd, note, at) VALUES (?, ?, ?, ?, ?)").run(user, kind, usd, note ?? null, Date.now());
export const ledgerOf = (user: number) => db.prepare("SELECT kind, usd, note, at FROM ledger WHERE user = ? ORDER BY id DESC LIMIT 50").all(user) as unknown as { kind: string; usd: number; note: string | null; at: number }[];

// Strategies
export const strategiesOf = (owner: number) => db.prepare("SELECT * FROM strategies WHERE owner = ? ORDER BY id").all(owner) as unknown as { id: number; owner: number; name: string; kind: string; description: string | null; public: number }[];
export const addStrategy = (owner: number, name: string, kind: string, description: string) =>
  Number(db.prepare("INSERT INTO strategies (owner, name, kind, description, created_at) VALUES (?, ?, ?, ?, ?)").run(owner, name.slice(0, 40), kind, description.slice(0, 300), Date.now()).lastInsertRowid);
export const setStrategyPublic = (owner: number, id: number, on: boolean) => db.prepare("UPDATE strategies SET public = ? WHERE id = ? AND owner = ?").run(on ? 1 : 0, id, owner);

// CRE Guard runs: each check the workflow reports, with its price check and every trader's verdict (the Guard log).
export interface CreVerdict { leader: number; handle?: string; severity: "ok" | "warn" | "halt"; risk?: number; reason: string; ai?: boolean; tx?: string | null }
export interface CreRun { id: number; at: number; oracle: number | null; dex: number | null; deviation: number | null; verdicts: CreVerdict[] }
export const addCreRun = (r: Omit<CreRun, "id" | "at">) =>
  db.prepare("INSERT INTO cre_runs (at, oracle, dex, deviation, verdicts) VALUES (?, ?, ?, ?, ?)").run(Date.now(), r.oracle, r.dex, r.deviation, JSON.stringify(r.verdicts));
// Chief's reads: each verdict Chief gave in a chat, with the price at that moment, so its calls can be scored later.
export const addCatRead = (r: { trade: number; user: number; label: string; token: string; price: number }) =>
  db.prepare("INSERT INTO cat_reads (trade, user, label, token, price, at) VALUES (?, ?, ?, ?, ?, ?)").run(r.trade, r.user, r.label, r.token, r.price, Date.now());
/** The first read per trade in the window (a call is made once, however often people ask). */
export const catReadsSince = (since: number) =>
  db.prepare("SELECT trade, label, token, price, MIN(at) AS at FROM cat_reads WHERE at >= ? GROUP BY trade").all(since) as unknown as { trade: number; label: string; token: string; price: number; at: number }[];

export const creRuns = (limit = 5): CreRun[] =>
  (db.prepare("SELECT id, at, oracle, dex, deviation, verdicts FROM cre_runs ORDER BY id DESC LIMIT ?").all(limit) as unknown as (Omit<CreRun, "verdicts"> & { verdicts: string })[]).map((r) => ({ ...r, verdicts: JSON.parse(r.verdicts) }));

// Season boards: rankings the CRE board workflow recomputed from Flash fills and attested onchain.
export interface SeasonBoardRow { season: number; hash: string; tx: string | null; computedAt: number; ranking: { leader: number; handle: string; pnlBps: number; pnlUsd: number; investedUsd: number; fills: number }[] }
export const saveSeasonBoard = (b: SeasonBoardRow) =>
  db.prepare("INSERT OR REPLACE INTO season_boards (season, hash, tx, computed_at, ranking) VALUES (?, ?, ?, ?, ?)").run(b.season, b.hash, b.tx, b.computedAt, JSON.stringify(b.ranking));
export const seasonBoard = (season: number): SeasonBoardRow | undefined => {
  const r = db.prepare("SELECT season, hash, tx, computed_at, ranking FROM season_boards WHERE season = ?").get(season) as { season: number; hash: string; tx: string | null; computed_at: number; ranking: string } | undefined;
  return r ? { season: r.season, hash: r.hash, tx: r.tx, computedAt: r.computed_at, ranking: JSON.parse(r.ranking) } : undefined;
};

// Quests: XP claimed for completed daily and weekly quests, once per period.
export const questClaims = (user: number) => db.prepare("SELECT quest, period, xp, at FROM quest_claims WHERE user = ?").all(user) as unknown as { quest: string; period: string; xp: number; at: number }[];
export const claimQuest = (user: number, quest: string, period: string, xp: number) =>
  Number(db.prepare("INSERT OR IGNORE INTO quest_claims (user, quest, period, xp, at) VALUES (?, ?, ?, ?, ?)").run(user, quest, period, xp, Date.now()).changes) > 0;

// Squads: one squad per user. A squad's score is the XP of its members.
export const squadOf = (user: number) => db.prepare("SELECT s.id, s.name FROM squads s JOIN squad_members m ON m.squad = s.id WHERE m.user = ?").get(user) as unknown as { id: number; name: string } | undefined;
export const squadMembers = (squad: number) => (db.prepare("SELECT user FROM squad_members WHERE squad = ?").all(squad) as unknown as { user: number }[]).map((r) => r.user);
export const allSquads = () => db.prepare("SELECT id, name, owner FROM squads").all() as unknown as { id: number; name: string; owner: number }[];
export function createSquad(owner: number, name: string): number | undefined {
  const n = name.trim();
  if (!/^[\w ]{3,24}$/.test(n) || db.prepare("SELECT 1 FROM squads WHERE name = ?").get(n)) return undefined;
  const id = Number(db.prepare("INSERT INTO squads (name, owner, created_at) VALUES (?, ?, ?)").run(n, owner, Date.now()).lastInsertRowid);
  joinSquad(owner, id);
  return id;
}
export const joinSquad = (user: number, squad: number) => db.prepare("INSERT OR REPLACE INTO squad_members (user, squad) VALUES (?, ?)").run(user, squad);
export const leaveSquad = (user: number) => db.prepare("DELETE FROM squad_members WHERE user = ?").run(user);

// Ask Chief: chats shared by the app and Telegram, per-user rules and feedback
export interface CatMsg { id: number; chat: number; role: "user" | "cat"; text: string; data: Record<string, unknown> | null; vote: number; at: number }
export const createChat = (user: number, title: string, source: string) =>
  Number(db.prepare("INSERT INTO cat_chats (user, title, source, at, updated) VALUES (?, ?, ?, ?, ?)").run(user, title.slice(0, 60), source, Date.now(), Date.now()).lastInsertRowid);
/** The chat Chief carries on in when none is named (Telegram, agents): the one used most recently, or a new one. */
export function currentChatOf(user: number, source = "App"): number {
  const r = db.prepare("SELECT id FROM cat_chats WHERE user = ? ORDER BY updated DESC, id DESC LIMIT 1").get(user) as { id: number } | undefined;
  return r?.id ?? createChat(user, "New chat", source);
}
export const renameChat = (id: number, title: string) => db.prepare("UPDATE cat_chats SET title = ? WHERE id = ?").run(title.slice(0, 60), id);
export const deleteChat = (id: number, user: number) => {
  if (!db.prepare("SELECT 1 FROM cat_chats WHERE id = ? AND user = ?").get(id, user)) return false;
  db.prepare("DELETE FROM cat_msgs WHERE chat = ?").run(id);
  db.prepare("DELETE FROM cat_chats WHERE id = ?").run(id);
  return true;
};
export const chatById = (id: number, user: number) => db.prepare("SELECT * FROM cat_chats WHERE id = ? AND user = ?").get(id, user) as unknown as { id: number; title: string; source: string; state: string; at: number; updated: number } | undefined;
export const chatsOf = (user: number, q = "") =>
  db.prepare("SELECT id, title, source, updated FROM cat_chats WHERE user = ? AND title LIKE ? ORDER BY updated DESC LIMIT 60").all(user, `%${q}%`) as unknown as { id: number; title: string; source: string; updated: number }[];
export const latestChat = (user: number, source: string, withinMs: number) =>
  db.prepare("SELECT id FROM cat_chats WHERE user = ? AND source = ? AND updated >= ? ORDER BY updated DESC LIMIT 1").get(user, source, Date.now() - withinMs) as unknown as { id: number } | undefined;
export const setChatState = (id: number, state: unknown) => db.prepare("UPDATE cat_chats SET state = ?, updated = ? WHERE id = ?").run(JSON.stringify(state), Date.now(), id);
export const addMsg = (chat: number, role: "user" | "cat", text: string, data?: unknown) => {
  db.prepare("UPDATE cat_chats SET updated = ? WHERE id = ?").run(Date.now(), chat);
  return Number(db.prepare("INSERT INTO cat_msgs (chat, role, text, data, at) VALUES (?, ?, ?, ?, ?)").run(chat, role, text, data ? JSON.stringify(data) : null, Date.now()).lastInsertRowid);
};
export const msgsOf = (chat: number) => (db.prepare("SELECT * FROM cat_msgs WHERE chat = ? ORDER BY id").all(chat) as any[]).map((r) => ({ ...r, data: r.data ? JSON.parse(r.data) : null })) as CatMsg[];
export const patchMsgData = (id: number, patch: Record<string, unknown>) => {
  const r = db.prepare("SELECT data FROM cat_msgs WHERE id = ?").get(id) as { data: string | null } | undefined;
  db.prepare("UPDATE cat_msgs SET data = ? WHERE id = ?").run(JSON.stringify({ ...(r?.data ? JSON.parse(r.data) : {}), ...patch }), id);
};
export const voteMsg = (id: number, user: number, vote: number) =>
  db.prepare("UPDATE cat_msgs SET vote = ? WHERE id = ? AND chat IN (SELECT id FROM cat_chats WHERE user = ?)").run(vote, id, user);
export const rulesOf = (user: number) => db.prepare("SELECT id, text, source FROM cat_rules WHERE user = ? ORDER BY id").all(user) as unknown as { id: number; text: string; source: string }[];
export const addRule = (user: number, text: string, source = "app") => db.prepare("INSERT INTO cat_rules (user, text, source, at) VALUES (?, ?, ?, ?)").run(user, text.slice(0, 140), source, Date.now());
export const deleteRule = (user: number, id: number) => db.prepare("DELETE FROM cat_rules WHERE id = ? AND user = ?").run(id, user);
export const wipeCat = (user: number) => {
  db.prepare("DELETE FROM cat_rules WHERE user = ?").run(user);
  db.prepare("DELETE FROM cat_msgs WHERE chat IN (SELECT id FROM cat_chats WHERE user = ?)").run(user);
  db.prepare("DELETE FROM cat_chats WHERE user = ?").run(user);
};
