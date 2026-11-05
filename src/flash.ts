import { createPublicClient, createWalletClient, http, keccak256, parseTransaction, type Hex } from "viem";
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { base } from "viem/chains";

/**
 * Flash API client (https://flash.definitive.fi/docs). Every order is quote -> sign (EIP-712) -> submit,
 * signed by the funder's own key: Flash never takes custody.
 */
const BASE = "https://flash.definitive.fi/v1";
/** The public dev key from Flash's docs works for real orders; set FLASH_API_KEY to be the integrator of record. */
const PUBLIC_KEY = "dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b";
const KEY = () => process.env.FLASH_API_KEY || PUBLIC_KEY;
const FEE = () => String(Math.max(0, Math.min(1000, Number(process.env.FLASH_FEE_BPS ?? "50"))));
const RPC = () => process.env.BASE_RPC || "https://mainnet.base.org";

export type OrderType = "market" | "limit" | "stop" | "stop-loss" | "take-profit" | "bracket" | "twap";

export interface Trade {
  chain: string;
  target: string;
  contra: string;
  side: "buy" | "sell";
  qty: string;
  orderType: OrderType;
  triggers?: { notionalPrice: string; triggerType: "upper" | "lower" }[];
  limitNotionalPrice?: string;
  durationSeconds?: number;
  twapBucketCount?: number;
  /** Take-profit / stop-loss attached to a market, limit or TWAP entry (USD prices). Placed with the entry as one Flash order. */
  attach?: { tp: string; sl: string };
  hasStop?: boolean; // entry that ships with a stop-loss (set by Ask Cat and bracket flows)
  /** Tribe only, never sent to Flash: a copier's own stop-loss price, placed as a stop-loss once this entry fills. */
  followStop?: string;
  /** Good-til-time for limit, trigger and bracket orders (ISO-8601). Quote-only in Flash: never echoed on submit. */
  expireTime?: string;
}

/** Per-wallet authorization style. Tight: Permit2 signatures sized to what's needed, no standing unlimited allowance. */
export interface AuthOpts { tight?: boolean }

export class FlashError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

/**
 * Flash allows 5 requests per second per endpoint per API key, each endpoint its own bucket. A copy fan-out makes
 * 2+ calls per follower, so pace each bucket client-side instead of finding the limit through 429s.
 */
const LIMIT_PER_SEC = 5;
const sent = new Map<string, number[]>();
const bucketOf = (method: string, path: string) => {
  const p = path.split("?")[0];
  return p === "/quote" ? "quote" : p === "/order" ? "order" : p === "/orders/cancel" ? "batchCancel" : p.endsWith("/cancel") ? "cancel"
    : method === "PATCH" ? "update" : p === "/orders" ? "list" : p.startsWith("/orders/") ? "get" : p.split("/")[1] ?? p;
};
export async function pace(bucket: string) {
  for (;;) {
    const now = Date.now();
    const recent = (sent.get(bucket) ?? []).filter((t) => now - t < 1000);
    if (recent.length < LIMIT_PER_SEC) { recent.push(now); sent.set(bucket, recent); return; }
    await new Promise((res) => setTimeout(res, 1000 - (now - recent[0]) + 5));
  }
}

async function call(path: string, init: { method?: string; body?: unknown } = {}, tries = 4): Promise<any> {
  const method = init.method ?? (init.body ? "POST" : "GET");
  await pace(bucketOf(method, path));
  const r = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", "x-definitive-api-key": KEY() },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (r.status === 429 && tries > 1) {
    // Flash's documented header is RateLimit-Reset (seconds); back off with jitter on repeats.
    const reset = Number(r.headers.get("ratelimit-reset") ?? r.headers.get("retry-after") ?? 1) || 1;
    const backoff = Math.min(8, reset * 2 ** (4 - tries)) * (0.5 + Math.random() / 2);
    await new Promise((res) => setTimeout(res, 1000 * backoff));
    return call(path, init, tries - 1);
  }
  const textBody = await r.text();
  let j: any = {};
  try { j = textBody ? JSON.parse(textBody) : {}; } catch { j = { error: { message: textBody.slice(0, 200) } }; }
  if (!r.ok) throw new FlashError(`Flash ${path.split("?")[0]}: ${j?.error?.message ?? r.status}`, r.status, j?.error?.code);
  return j;
}

/** The quote body for a trade. Exported so tests can check it against the API's shape. */
export function quoteBody(t: Trade, funder: string, slippage?: string, auth: AuthOpts = {}) {
  const timed = t.orderType === "twap";
  const expires = t.expireTime && !timed && t.orderType !== "market" ? { expireTime: t.expireTime } : {};
  return {
    targetChain: t.chain,
    contraChain: t.chain,
    targetAsset: t.target,
    contraAsset: t.contra,
    side: t.side,
    qty: t.qty,
    orderType: t.orderType,
    funderAddress: funder,
    flashIntegratorFeeBps: FEE(),
    ...(t.triggers ? { triggers: t.triggers } : {}),
    ...(t.limitNotionalPrice ? { limitNotionalPrice: t.limitNotionalPrice } : {}),
    ...(timed ? { durationSeconds: Math.max(300, t.durationSeconds ?? 300), ...(t.twapBucketCount ? { twapBucketCount: t.twapBucketCount } : {}) } : {}),
    ...(t.orderType === "market" && slippage ? { maxSlippage: slippage } : {}),
    ...(t.attach && ["market", "limit", "twap"].includes(t.orderType) ? { attachedBracket: { takeProfit: { notionalPrice: t.attach.tp }, stopLoss: { notionalPrice: t.attach.sl } } } : {}),
    ...expires,
    ...(auth.tight ? { evmUsePermit2: true, forceMinimalAllowance: true } : {}),
  };
}

export interface Quote {
  quoteId: string;
  from: { amount: string; notional: string };
  to: { amount: string; notional: string };
  fees: { estimatedFeeNotional: string };
  estimatedPriceImpact: string | null;
  wrap: { evmTx: { to: string; data: string; value?: string } } | null;
  evm: { approveTx: { to: string; data: string } | null; permitTypedData: string; orderTypedData: string };
  attachedBracket?: { evm: { approveTx: { to: string; data: string } | null; permitTypedData: string | null; orderTypedData: string }; salt: string; deadline: string; signedMaxFromAmount: string } | null;
  setupTxs?: string[] | null;
}

export const quote = (t: Trade, funder: string, slippage?: string, auth: AuthOpts = {}): Promise<Quote> => call("/quote", { body: quoteBody(t, funder, slippage, auth) });

/**
 * Who signs for a funder: a viem account (a Privy wallet with Tribe as its policy-limited signer, see src/privy.ts)
 * or, for demo wallets and scripts, a raw private key.
 */
export type Signer = LocalAccount | `0x${string}`;
const asAccount = (s: Signer): LocalAccount => (typeof s === "string" ? privateKeyToAccount(s) : s);

const signTyped = (account: LocalAccount, json: string) => {
  const { domain, types, primaryType, message } = JSON.parse(json);
  return account.signTypedData({ domain, types, primaryType, message });
};

const publicClient = () => createPublicClient({ chain: base, transport: http(RPC()) });

/** Send a plain transaction (approval for the attached bracket's exit, or a wrap) from the funder and wait for it. */
async function sendTx(account: LocalAccount, tx: { to: string; data: string; value?: string }) {
  const wallet = createWalletClient({ account, chain: base, transport: http(RPC()) });
  const hash = await wallet.sendTransaction({ to: tx.to as Hex, data: tx.data as Hex, value: tx.value ? BigInt(tx.value) : 0n });
  await publicClient().waitForTransactionReceipt({ hash, timeout: 60_000 });
  return hash;
}

/** Sign each pre-trade setup transaction (usually the token approval) and let Flash broadcast it, no RPC needed. */
async function runSetup(account: LocalAccount, setupTxs: string[]) {
  const hashes: string[] = [];
  for (const raw of setupTxs) {
    const signed = await account.signTransaction(parseTransaction(raw as Hex) as any);
    const r = (await call("/setup-transaction", { body: { signedSetupTx: signed } })) as { status: "confirmed" | "pending" };
    const hash = keccak256(signed);
    if (r.status === "pending") await publicClient().waitForTransactionReceipt({ hash, timeout: 60_000 });
    hashes.push(hash);
  }
  return hashes;
}

/**
 * The trade fields the submit body echoes from the quote: everything except quote-only fields (durationSeconds,
 * expireTime, the authorization flags) and the quote-form attachedBracket, which is replaced by the signed one.
 */
export function submitEcho(t: Trade, funder: string, slippage?: string, auth: AuthOpts = {}) {
  const { durationSeconds: _d, attachedBracket: _ab, expireTime: _e, evmUsePermit2: _p, forceMinimalAllowance: _m, ...echo } = quoteBody(t, funder, slippage, auth) as Record<string, unknown>;
  return echo;
}

export interface Placed { orderId: string; setupTxs: string[]; bracket?: string }

/** quote -> setup (approvals) -> EIP-712 sign -> order. Signed by the funder's own wallet (non-custodial). */
export async function placeOrder(t: Trade, funder: `0x${string}`, signer: Signer, slippage?: string, auth: AuthOpts = {}): Promise<Placed> {
  const account = asAccount(signer);
  let q = await quote(t, funder, slippage, auth);
  const setup: string[] = [];
  // Approvals and wraps change onchain state, so quote again afterwards for fresh signing material.
  if (q.setupTxs?.length) setup.push(...(await runSetup(account, q.setupTxs)));
  else if (q.evm.approveTx) setup.push(await sendTx(account, q.evm.approveTx));
  if (q.wrap?.evmTx) setup.push(await sendTx(account, q.wrap.evmTx));
  if (q.attachedBracket?.evm.approveTx) setup.push(await sendTx(account, q.attachedBracket.evm.approveTx));
  if (setup.length) q = await quote(t, funder, slippage, auth);

  const body: Record<string, unknown> = {
    ...submitEcho(t, funder, slippage, auth),
    quoteId: q.quoteId,
    userSignature: await signTyped(account, q.evm.orderTypedData),
    evmOrderTypedData: q.evm.orderTypedData,
    ...(process.env.BASE_BUILDER_CODE ? { erc8021AttributionCode: process.env.BASE_BUILDER_CODE } : {}),
  };
  if (q.evm.permitTypedData) {
    body.evmPermitTypedData = q.evm.permitTypedData;
    body.evmPermitSignature = await signTyped(account, q.evm.permitTypedData);
  }
  const ab = q.attachedBracket;
  if (t.attach && ab) {
    body.attachedBracket = {
      takeProfit: { notionalPrice: t.attach.tp },
      stopLoss: { notionalPrice: t.attach.sl },
      userSignature: await signTyped(account, ab.evm.orderTypedData),
      salt: ab.salt,
      deadline: ab.deadline,
      signedMaxFromAmount: ab.signedMaxFromAmount,
      ...(ab.evm.permitTypedData ? { evmPermitTypedData: ab.evm.permitTypedData, evmPermitSignature: await signTyped(account, ab.evm.permitTypedData) } : {}),
    };
  }
  const r = (await call("/order", { body })) as { orderId: string; attachedBracket?: { status: string } };
  return { orderId: r.orderId, setupTxs: setup, bracket: r.attachedBracket?.status };
}

export interface FlashAsset { address: string; symbol: string; price: string; riskFlagged: boolean; liquidity: string; priceChange24h: string; volume24h?: string; marketCap?: string }

export async function searchAsset(address: string, chain = "base"): Promise<FlashAsset | undefined> {
  const j = await call(`/search?query=${encodeURIComponent(address)}&chain=${chain}&limit=1`);
  return j.assets?.[0];
}

export type FlashStatus = "ORDER_STATUS_PENDING" | "ORDER_STATUS_ACCEPTED" | "ORDER_STATUS_PARTIALLY_FILLED" | "ORDER_STATUS_FILLED" | "ORDER_STATUS_CANCELLED" | "ORDER_STATUS_REJECTED" | "ORDER_STATUS_TERMINATED" | "ORDER_STATUS_UNSPECIFIED";

export interface FlashOrderInfo {
  status: FlashStatus;
  closeReason: string | null;
  filled: { targetAmount: string | null; contraAmount: string | null; averagePrice: string | null; averageNotionalPrice?: string | null } | null;
  attachedBracket?: { status: string; bracketOrderId: string | null; signedMaxFromAmount: string } | null;
}
export interface FlashFill { transactionId: string; filledAt: string; fillPrice: string; targetAmount: string; contraAmount: string; integratorFeeNotional: string; feeNotional: string; venues: string[] }

/** One order with its fills. Fills carry the settlement transaction hash and the integrator fee earned. */
export async function getOrder(orderId: string, funder: string): Promise<FlashOrderInfo & { fills: FlashFill[] }> {
  const j = await call(`/orders/${orderId}?funderAddress=${funder}`);
  return { ...(j.order as FlashOrderInfo), fills: (j.fills ?? []) as FlashFill[] };
}

/** Cancel a resting order. Gasless: the funder signs a plaintext message (EIP-191). */
export async function cancelOrder(orderId: string, signer: Signer) {
  const cancelMessage = `Definitive Flash v1 — Cancel Order\nOrder: ${orderId}`;
  const userSignature = await asAccount(signer).signMessage({ message: cancelMessage });
  return call(`/orders/${orderId}/cancel`, { body: { cancelMessage, userSignature } });
}

/** The exact text a funder signs to cancel several of their orders at once (one per line, request order, lowercase UUIDs). */
export const batchCancelMessage = (orderIds: string[]) => `Definitive Flash v1 — Cancel Orders\nOrders:\n${orderIds.map((id) => id.toLowerCase()).join("\n")}`;

export interface BatchCancelResult { orderId: string; ok: boolean; errorCode?: string }
/** Cancel up to 25 of one funder's orders with a single signature (POST /orders/cancel). Larger sets go in chunks. */
export async function cancelOrders(orderIds: string[], signer: Signer): Promise<BatchCancelResult[]> {
  const ids = [...new Set(orderIds.map((id) => id.toLowerCase()))];
  const out: BatchCancelResult[] = [];
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    const cancelMessage = batchCancelMessage(chunk);
    const userSignature = await asAccount(signer).signMessage({ message: cancelMessage });
    const r = (await call("/orders/cancel", { body: { orderIds: chunk, cancelMessage, userSignature } })) as { results: BatchCancelResult[] };
    out.push(...(r.results ?? []));
  }
  return out;
}

/** List a funder's (or, without one, every funder's in the portfolio) orders, newest first, one page at a time. */
export async function listOrders(opts: { funder?: string; statuses?: FlashStatus[]; pageSize?: number; pageToken?: string } = {}): Promise<{ orders: (FlashOrderInfo & { orderId: string; funderAddress: string })[]; nextPageToken: string | null }> {
  const q = new URLSearchParams();
  if (opts.funder) q.set("funderAddress", opts.funder);
  if (opts.statuses?.length) q.set("statuses", opts.statuses.join(","));
  q.set("pageSize", String(opts.pageSize ?? 200));
  if (opts.pageToken) q.set("pageToken", opts.pageToken);
  return call(`/orders?${q}`);
}

/** Why Flash closed an order, in words a follower understands. */
export const CLOSE_REASONS: Record<string, string> = {
  REASON_INSUFFICIENT_FUNDER_BALANCE: "Your wallet didn't hold enough of the token to pay for it",
  REASON_INSUFFICIENT_ASSET_BALANCE: "Not enough balance was available to fill it",
  REASON_MAXIMUM_SLIPPAGE_EXCEEDED: "The price moved past your slippage limit, so nothing was bought",
  REASON_EXECUTION_COST_EXCEEDS_LIMIT: "Gas and fees would have been over 30% of the trade, so Flash didn't run it",
  REASON_ORDER_REJECTED_AT_VENUE: "The network was congested and the order couldn't be placed",
  REASON_ORDER_TRIGGERED_ON_ENTRY: "Its trigger price had already been crossed when it was placed",
};
export const closeReasonText = (r: string | null | undefined) => (r ? CLOSE_REASONS[r] ?? r.replace(/^REASON_/, "").toLowerCase().replace(/_/g, " ") : null);

/** Move the trigger of a resting stop-loss / take-profit / stop. Brackets can't be updated (cancel and re-place instead). */
export async function updateTrigger(orderId: string, signer: Signer, triggerType: "lower" | "upper", notionalPrice: string) {
  const updateMessage = ["Definitive Flash — Update Order", `Order: ${orderId}`, `Issued At: ${new Date().toISOString()}`, `Trigger ${triggerType === "lower" ? "Lower" : "Upper"} Notional Price: ${notionalPrice}`].join("\n");
  const userSignature = await asAccount(signer).signMessage({ message: updateMessage });
  return call(`/orders/${orderId}`, { method: "PATCH", body: { trigger: { notionalPrice, triggerType }, updateMessage, userSignature } });
}

export interface FlashBalance { chain: string; address: string; symbol: string; balance: string; notional: string; isNative: boolean }
export async function balances(address: string): Promise<FlashBalance[]> {
  return ((await call(`/balances/${address}`)).balances ?? []) as FlashBalance[];
}

/** Explorer link for a settlement or setup transaction. */
export const txUrl = (hash: string, chain = "base") => (chain === "base" ? `https://basescan.org/tx/${hash}` : `https://${chain}scan.io/tx/${hash}`);
