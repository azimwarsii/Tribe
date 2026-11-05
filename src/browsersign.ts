import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Hex } from "viem";
import type { RemoteSigner } from "./flash.js";

/**
 * Signing with the user's own browser wallet (MetaMask). Tribe never holds that key: when an order needs a signature,
 * the server queues a request, the user's open Tribe tab picks it up, MetaMask shows it, and the answer comes back here.
 *
 * Only while the user is acting in the app (a request they made, see `interactive`) can Tribe ask for a signature.
 * Background work (stop moves, closing copies on a Guard pause) can't pop up MetaMask, so for these wallets it doesn't
 * sign at all and says so.
 */

export type SignKind = "typed" | "tx" | "message";
export interface SignRequest { id: string; user: number; kind: SignKind; payload: unknown; label: string; at: number; claimedBy?: string }

const TIMEOUT_MS = 150_000;
const queue = new Map<string, SignRequest & { resolve: (v: Hex) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
const waiters = new Map<number, Set<() => void>>();

const ctx = new AsyncLocalStorage<{ user: number }>();
/** Run an API action as the signed-in user acting in the app: their browser wallet may be asked to sign meanwhile. */
export const interactive = <T>(user: number, fn: () => T): T => ctx.run({ user }, fn);
export const canAsk = (user: number) => ctx.getStore()?.user === user;

function ask(user: number, kind: SignKind, payload: unknown, label: string): Promise<Hex> {
  return new Promise<Hex>((resolve, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      queue.delete(id);
      reject(new Error("MetaMask didn't answer in time, so nothing was placed. Keep this tab open and try again."));
    }, TIMEOUT_MS);
    queue.set(id, { id, user, kind, payload, label, at: Date.now(), resolve, reject, timer });
    for (const w of waiters.get(user) ?? []) w();
  });
}

/** A signer that asks the user's browser wallet. Order: approvals (sent as transactions), then the order signatures. */
export function browserSigner(user: number, address: Hex): RemoteSigner {
  return {
    remote: true,
    address,
    signTypedData: (json, label = "Sign the order") => ask(user, "typed", { address, json }, label),
    sendTransaction: (tx, label = "Approve") => ask(user, "tx", { address, ...tx }, label),
    signMessage: (message, label = "Sign") => ask(user, "message", { address, message }, label),
  };
}

const view = (r: SignRequest) => ({ id: r.id, kind: r.kind, payload: r.payload, label: r.label });

/** The next unclaimed request for this user, waiting up to `ms` for one. One tab claims it, so only one MetaMask pops up. */
export async function nextRequest(user: number, tab: string, ms = 25_000): Promise<ReturnType<typeof view> | null> {
  const take = () => {
    for (const r of queue.values()) if (r.user === user && (!r.claimedBy || r.claimedBy === tab)) { r.claimedBy = tab; return view(r); }
    return null;
  };
  const now = take();
  if (now) return now;
  return new Promise((resolve) => {
    const set = waiters.get(user) ?? new Set();
    waiters.set(user, set);
    const done = () => { clearTimeout(t); set.delete(wake); resolve(take()); };
    const wake = () => done();
    const t = setTimeout(done, ms);
    set.add(wake);
  });
}

/** The browser's answer: a signature or transaction hash, or the reason it didn't sign (rejected in MetaMask, wrong account). */
export function answerRequest(user: number, id: string, a: { result?: string; error?: string }) {
  const r = queue.get(id);
  if (!r || r.user !== user) throw new Error("That signature request is no longer waiting");
  queue.delete(id);
  clearTimeout(r.timer);
  if (a.result && /^0x[0-9a-fA-F]+$/.test(a.result)) r.resolve(a.result as Hex);
  else r.reject(new Error(a.error ? `Not signed: ${a.error}` : "Not signed"));
}
