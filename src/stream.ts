import { db } from "./db.js";
import { refreshOrder, useStreamHealth, type OrderRow } from "./tracker.js";

/**
 * Flash's orders stream (wss://flash.definitive.fi/v1/ws). One org-wide subscription covers every Tribe wallet, so a
 * fill, a TWAP slice, a bracket activating or an order closing reaches Tribe within a second instead of on the next
 * poll. On each change Tribe fetches that one order (for its fills: settlement tx and fees) and applies it.
 * Heartbeats tell a quiet connection from a dead one; if the stream is down, polling takes over (useStreamHealth).
 */
const URL_ = "wss://flash.definitive.fi/v1/ws";
const KEY = () => process.env.FLASH_API_KEY || "dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b";

interface OrderUpdate { orderId: string; status: string; filled?: { targetAmount?: string | null } | null; attachedBracket?: { status?: string } | null }

let lastBeat = 0;
let attempts = 0;
let stopped = false;
let socket: WebSocket | undefined;
const seen = new Map<string, string>();

export const streamHealthy = () => Date.now() - lastBeat < 5_000;

/** A change worth fetching: new status, more filled, or the attached bracket moved on. */
const fingerprint = (o: OrderUpdate) => `${o.status}|${o.filled?.targetAmount ?? ""}|${o.attachedBracket?.status ?? ""}`;

async function onOrders(list: OrderUpdate[]) {
  for (const u of list) {
    const fp = fingerprint(u);
    if (seen.get(u.orderId) === fp) continue;
    seen.set(u.orderId, fp);
    const row = db.prepare("SELECT id, trade_id, trader, leader, role, order_id, trade, sim, status FROM orders WHERE order_id = ? AND status = 'open'").get(u.orderId) as OrderRow | undefined;
    if (!row) continue; // not a Tribe order, or already settled
    await refreshOrder(row).catch((e) => console.error(`stream order ${u.orderId}:`, (e as Error).message));
  }
}

function connect() {
  if (stopped) return;
  const ws = new WebSocket(URL_);
  socket = ws;
  ws.onopen = () => {
    ws.send(JSON.stringify({ channel: "heartbeats", type: "subscribe", apiKey: KEY() }));
    ws.send(JSON.stringify({ channel: "orders", type: "subscribe", apiKey: KEY() })); // whole portfolio: every funder
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(String(ev.data)) as { channel?: string; type: string; orders?: OrderUpdate[]; code?: string; message?: string };
    if (m.channel === "heartbeats") { lastBeat = Date.now(); attempts = 0; return; }
    if (m.type === "error") {
      console.error(`flash stream: ${m.code} ${m.message ?? ""}`);
      if (m.code === "UNAUTHORIZED") stopped = true; // a bad key won't fix itself; polling carries on
      return; // STREAMING_UNAVAILABLE and transient errors: polling covers it, the close handler reconnects
    }
    if (m.channel === "orders" && m.orders) void onOrders(m.orders);
  };
  ws.onclose = () => {
    if (stopped) return;
    // Exponential backoff with equal jitter, as Flash's example client does.
    const cap = Math.min(30_000, 1_000 * 2 ** attempts++);
    setTimeout(connect, cap / 2 + Math.random() * (cap / 2));
  };
  ws.onerror = () => ws.close();
}

export function startOrderStream() {
  stopped = false;
  useStreamHealth(streamHealthy);
  connect();
  return () => { stopped = true; socket?.close(); };
}
