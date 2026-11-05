process.env.DB_PATH = ":memory:";
process.env.DRY_RUN = "true";

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createWalletClient, encodeAbiParameters, http, parseAbiParameters, publicActions, type Abi, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// The copy-time gate reads CopyGuard over JSON-RPC like it would on Base: a Ganache server, the real contract, the real copy engine.
const keys = [generatePrivateKey(), generatePrivateKey()];
const ganache = createRequire(import.meta.url)("ganache");
const server = ganache.server({ logging: { quiet: true }, chain: { chainId: 1337 }, wallet: { accounts: keys.map((secretKey) => ({ secretKey, balance: "0x56BC75E2D63100000" })) } });
await new Promise<void>((ok, fail) => server.listen(0, (e: Error | null) => (e ? fail(e) : ok())));
const rpc = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

const chain = { id: 1337, name: "ganache", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } } as const;
const [owner, forwarder] = keys.map((k) => createWalletClient({ account: privateKeyToAccount(k), chain, transport: http(rpc) }).extend(publicActions));

const { compileCopyGuard } = await import("./guard-contract.js");
const { abi, bytecode } = compileCopyGuard();
const address = (await owner.waitForTransactionReceipt({ hash: await owner.deployContract({ abi, bytecode, args: [forwarder.account.address] }) })).contractAddress!;
process.env.GUARD_ADDRESS = address;
process.env.GUARD_RPC = rpc;

const prices = await import("./prices.js");
prices.setPriceProvider(async () => 2500);
const db = await import("./db.js");
const { guardGate, guardHeartbeat } = await import("./guard.js");
const { mirror } = await import("./copy.js");
const { parseTrade } = await import("./parse.js");

const halt = async (leader: number, at: bigint) => {
  const r = encodeAbiParameters(parseAbiParameters("uint256, uint8, uint16, uint64, string"), [BigInt(leader), 2, 90, at, "22pp drawdown"]);
  const hash = await forwarder.writeContract({ address, abi: abi as Abi, functionName: "onReport", args: ["0x", r], gas: 500_000n });
  assert.equal((await forwarder.waitForTransactionReceipt({ hash })).status, "success");
};
const recentRun = () => db.addCreRun({ oracle: 2500, dex: 2501, deviation: 0.04, verdicts: [] });

test("copy-time gate: the onchain CopyGuard wins over the local mirror", async () => {
  const [lead, fol] = [9001, 9002];
  for (const id of [lead, fol]) { db.getUser(id); db.setMeta(id, { simBalance: 1000, perm: true, permUntil: Date.now() + 86400e3 }); }
  db.setFollow(fol, lead, { mode: "auto", maxUsdPerTrade: 20 });
  recentRun();

  // Clear onchain and locally: the auto-copy goes through.
  assert.deepEqual(await guardGate(lead), { halted: false, stale: false, reason: undefined });
  const ok = await mirror(lead, { ...parseTrade(["buy", "ETH", "20"]), hasStop: true });
  assert.equal(ok.executed.length, 1);

  // CRE halts the trader onchain; the app's event watcher hasn't caught up (it isn't even running here).
  await halt(lead, 1000n);
  assert.equal(db.haltOf(lead), undefined);
  const blocked = await mirror(lead, { ...parseTrade(["buy", "ETH", "20"]), hasStop: true });
  assert.equal(blocked.executed.length, 0);
  assert.match(blocked.skipped[0], /CopyGuard/);
  assert.ok(db.haltOf(lead), "the local mirror is healed from the chain");

  // Clearing the app's database (a bad API post, a manual edit) can't unblock what the contract still halts.
  db.resumeLeader(lead);
  const still = await mirror(lead, { ...parseTrade(["buy", "ETH", "20"]), hasStop: true });
  assert.deepEqual([still.executed.length, still.pending.length], [0, 0]);
});

test("copy-time gate: an unreadable chain or a silent CRE holds auto-copies for approval", async () => {
  const [lead, fol] = [9011, 9012];
  for (const id of [lead, fol]) { db.getUser(id); db.setMeta(id, { simBalance: 1000, perm: true, permUntil: Date.now() + 86400e3 }); }
  db.setFollow(fol, lead, { mode: "auto", maxUsdPerTrade: 20 });

  // CopyGuard silent for longer than GUARD_MAX_SILENCE_MIN (30 by default once a contract is set).
  db.db.prepare("UPDATE cre_runs SET at = ?").run(Date.now() - 45 * 60_000);
  const gate = await guardGate(lead);
  assert.equal(gate.stale, true);
  assert.match(gate.reason!, /hasn't reported for 45 min/);
  assert.equal(guardHeartbeat().held, true);
  const held = await mirror(lead, { ...parseTrade(["buy", "ETH", "20"]), hasStop: true });
  assert.deepEqual([held.executed.length, held.pending.length], [0, 1]);

  // A fresh report releases it; then an RPC outage holds it again.
  recentRun();
  assert.equal((await guardGate(lead)).stale, false);
  process.env.GUARD_RPC = "http://127.0.0.1:1";
  const down = await guardGate(lead);
  process.env.GUARD_RPC = rpc;
  assert.equal(down.stale, true);
  assert.match(down.reason!, /couldn't read CopyGuard onchain/);
});
