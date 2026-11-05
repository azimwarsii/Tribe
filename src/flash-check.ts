/**
 * Flash integration check. Without arguments: for every order type Tribe uses, quotes it against the live API, signs
 * every payload with a fresh, empty throwaway wallet, and submits it. Flash validates the request and the signatures,
 * then refuses it for the empty balance: that refusal (FAILED_PRECONDITION, insufficient balance) proves the full
 * submit path is accepted, with no funds and nothing executed.
 *
 *   npm run flash:check
 *   npm run flash:check -- --live 5     # places a real $5 market buy with a bracket from LIVE_WALLET_PRIVATE_KEY (Base mainnet)
 */
import "dotenv/config";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { batchCancelMessage, getOrder, listOrders, placeOrder, quote, searchAsset, submitEcho, txUrl, type AuthOpts, type Trade } from "./flash.js";
import { TOKENS, USDC } from "./parse.js";

const WETH = TOKENS.ETH;
const args = process.argv.slice(2);
const live = args.includes("--live");

const price = Number((await searchAsset(WETH))?.price);
if (!price) throw new Error("Flash /search returned no WETH price");
console.log(`WETH on Base: $${price.toFixed(2)} (Flash /search)`);
const p = (k: number) => (price * k).toFixed(2);
const base = { chain: "base", target: WETH, contra: USDC } as const;

const inAnHour = new Date(Date.now() + 3600e3).toISOString();
const cases: [string, Trade, AuthOpts?][] = [
  ["market buy + attached bracket", { ...base, side: "buy", qty: "5", orderType: "market", attach: { tp: p(1.12), sl: p(0.95) }, hasStop: true }],
  ["limit buy", { ...base, side: "buy", qty: "5", orderType: "limit", limitNotionalPrice: p(0.9) }],
  ["stop-loss sell", { ...base, side: "sell", qty: "0.002", orderType: "stop-loss", triggers: [{ notionalPrice: p(0.95), triggerType: "lower" }] }],
  ["take-profit sell", { ...base, side: "sell", qty: "0.002", orderType: "take-profit", triggers: [{ notionalPrice: p(1.12), triggerType: "upper" }] }],
  ["bracket sell", { ...base, side: "sell", qty: "0.002", orderType: "bracket", triggers: [{ notionalPrice: p(1.12), triggerType: "upper" }, { notionalPrice: p(0.95), triggerType: "lower" }] }],
  ["TWAP buy", { ...base, side: "buy", qty: "10", orderType: "twap", durationSeconds: 600, twapBucketCount: 5 }],
  ["stop buy (breakout)", { ...base, side: "buy", qty: "5", orderType: "stop", triggers: [{ notionalPrice: p(1.05), triggerType: "upper" }] }],
  // Unused-until-now Flash features Tribe relies on for copies:
  ["limit buy, good for 1 hour (expireTime): the chase-limit copy", { ...base, side: "buy", qty: "5", orderType: "limit", limitNotionalPrice: p(1.005), expireTime: inAnHour }],
  ["market buy, tight approvals (Permit2, minimal allowance)", { ...base, side: "buy", qty: "5", orderType: "market" }, { tight: true }],
];

if (!live) {
  const account = privateKeyToAccount(generatePrivateKey());
  let failed = 0;
  for (const [name, t, auth] of cases) {
    try {
      const q = await quote(t, account.address, "0.01", auth);
      const sign = async (json: string) => {
        const { domain, types, primaryType, message } = JSON.parse(json);
        return account.signTypedData({ domain, types, primaryType, message });
      };
      const body = {
        ...submitEcho(t, account.address, "0.01", auth), quoteId: q.quoteId, userSignature: await sign(q.evm.orderTypedData), evmOrderTypedData: q.evm.orderTypedData,
        ...(q.evm.permitTypedData ? { evmPermitTypedData: q.evm.permitTypedData, evmPermitSignature: await sign(q.evm.permitTypedData) } : {}),
        ...(q.attachedBracket && t.attach ? { attachedBracket: { takeProfit: { notionalPrice: t.attach.tp }, stopLoss: { notionalPrice: t.attach.sl }, userSignature: await sign(q.attachedBracket.evm.orderTypedData), salt: q.attachedBracket.salt, deadline: q.attachedBracket.deadline, signedMaxFromAmount: q.attachedBracket.signedMaxFromAmount } } : {}),
      };
      const r = await fetch("https://flash.definitive.fi/v1/order", { method: "POST", headers: { "content-type": "application/json", "x-definitive-api-key": process.env.FLASH_API_KEY || "dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { orderId?: string; error?: { code: string; message: string } };
      const accepted = j.error?.code === "FAILED_PRECONDITION" && /balance/i.test(j.error.message);
      if (!accepted) throw new Error(`submit: ${r.status} ${j.error?.code ?? ""} ${j.error?.message ?? JSON.stringify(j)}`);
      console.log(`  ok  ${name}: ${q.from.amount} -> ${Number(q.to.amount).toPrecision(5)}, fee ~$${q.fees.estimatedFeeNotional}${q.attachedBracket ? `, bracket protects up to ${q.attachedBracket.signedMaxFromAmount}` : ""} · submit accepted, refused only for the empty balance`);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${name}: ${(e as Error).message}`);
    }
  }
  console.log(failed ? `${failed} of ${cases.length} failed` : `All ${cases.length} order types quote, sign and pass Flash's submit validation. Nothing executed (empty wallet).`);
  failed += await extras(account);
  process.exit(failed ? 1 : 0);
}

const pk = process.env.LIVE_WALLET_PRIVATE_KEY as `0x${string}` | undefined;
if (!pk) throw new Error("Set LIVE_WALLET_PRIVATE_KEY (a Base mainnet wallet holding USDC and a little ETH for the one-time approval).");
const usd = args[args.indexOf("--live") + 1] ?? "5";
const funder = privateKeyToAccount(pk).address;
const t: Trade = { ...base, side: "buy", qty: usd, orderType: "market", attach: { tp: p(1.12), sl: p(0.95) }, hasStop: true };
console.log(`Placing a real $${usd} WETH buy with take-profit $${t.attach!.tp} / stop $${t.attach!.sl} from ${funder}…`);
const placed = await placeOrder(t, funder, pk, "0.01");
for (const h of placed.setupTxs) console.log(`  setup tx ${txUrl(h)}`);
console.log(`  order ${placed.orderId} (bracket: ${placed.bracket ?? "none"})`);
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const o = await getOrder(placed.orderId, funder);
  if (o.fills.length || o.status === "ORDER_STATUS_FILLED") {
    for (const f of o.fills) console.log(`  filled ${f.targetAmount} WETH at $${Number(f.fillPrice).toFixed(2)} · ${txUrl(f.transactionId)} · integrator fee $${f.integratorFeeNotional}`);
    console.log(`  status ${o.status}, bracket ${o.attachedBracket?.status ?? "n/a"} ${o.attachedBracket?.bracketOrderId ?? ""}`);
    process.exit(0);
  }
  if (["ORDER_STATUS_CANCELLED", "ORDER_STATUS_REJECTED", "ORDER_STATUS_TERMINATED"].includes(o.status)) throw new Error(`order ${o.status}: ${o.closeReason}`);
}
console.log("  still waiting for a fill; check later with getOrder");

/** Batch cancel, order listing and the orders stream, checked against the live API with the same empty wallet. */
async function extras(account: ReturnType<typeof privateKeyToAccount>): Promise<number> {
  let failed = 0;
  const KEY = process.env.FLASH_API_KEY || "dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b";
  try {
    const ids = [crypto.randomUUID(), crypto.randomUUID()];
    const cancelMessage = batchCancelMessage(ids);
    const r = await fetch("https://flash.definitive.fi/v1/orders/cancel", { method: "POST", headers: { "content-type": "application/json", "x-definitive-api-key": KEY }, body: JSON.stringify({ orderIds: ids, cancelMessage, userSignature: await account.signMessage({ message: cancelMessage }) }) });
    const j = (await r.json()) as { results?: { orderId: string; ok: boolean; errorCode?: string }[]; error?: { code: string; message: string } };
    if (!r.ok || j.results?.length !== 2) throw new Error(`${r.status} ${j.error?.code ?? ""} ${j.error?.message ?? JSON.stringify(j)}`);
    console.log(`  ok  batch cancel (POST /orders/cancel): message and signature accepted, per-order results ${j.results.map((x) => x.errorCode ?? (x.ok ? "ok" : "?")).join(", ")}`);
  } catch (e) { failed++; console.log(`  FAIL batch cancel: ${(e as Error).message}`); }
  try {
    const l = await listOrders({ funder: account.address, statuses: ["ORDER_STATUS_PENDING", "ORDER_STATUS_ACCEPTED", "ORDER_STATUS_PARTIALLY_FILLED"], pageSize: 10 });
    console.log(`  ok  list orders (GET /orders): ${l.orders.length} open for the empty wallet`);
  } catch (e) { failed++; console.log(`  FAIL list orders: ${(e as Error).message}`); }
  try {
    const got = await new Promise<string>((resolve, reject) => {
      const ws = new WebSocket("wss://flash.definitive.fi/v1/ws");
      const t = setTimeout(() => { ws.close(); reject(new Error("no snapshot or heartbeat within 8s")); }, 8000);
      const seen = new Set<string>();
      ws.onopen = () => { ws.send(JSON.stringify({ channel: "heartbeats", type: "subscribe", apiKey: KEY })); ws.send(JSON.stringify({ channel: "orders", type: "subscribe", funderAddress: account.address, apiKey: KEY })); };
      ws.onmessage = (ev) => {
        const m = JSON.parse(String(ev.data)) as { channel?: string; type: string; code?: string; message?: string };
        if (m.type === "error") { clearTimeout(t); ws.close(); reject(new Error(`${m.code}: ${m.message}`)); return; }
        seen.add(`${m.channel}:${m.type}`);
        if (seen.has("orders:snapshot") && seen.has("heartbeats:heartbeat")) { clearTimeout(t); ws.close(); resolve([...seen].join(", ")); }
      };
      ws.onerror = () => { clearTimeout(t); reject(new Error("websocket error")); };
    });
    console.log(`  ok  orders stream (wss /v1/ws): ${got}`);
  } catch (e) { failed++; console.log(`  FAIL orders stream: ${(e as Error).message}`); }
  return failed;
}
