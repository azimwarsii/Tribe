process.env.DB_PATH = ":memory:";
process.env.DRY_RUN = "true";

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createWalletClient, custom, publicActions, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { compileContract } from "./guard-contract.js";

const { db } = await import("./db.js");
const { syncCards } = await import("./card-chain.js");

// A real EVM in-process (Ganache), as in guard-contract.test.ts.
const keys = [generatePrivateKey(), generatePrivateKey(), generatePrivateKey(), generatePrivateKey()];
const provider = createRequire(import.meta.url)("ganache").provider({ logging: { quiet: true }, chain: { chainId: 1337 }, wallet: { accounts: keys.map((secretKey) => ({ secretKey, balance: "0x56BC75E2D63100000" })) } });
const [tribe, alice, bob, stranger] = keys.map((k) => privateKeyToAccount(k));
const chain = { id: 1337, name: "ganache", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://localhost"] } } } as const;
const as = (account: typeof tribe) => createWalletClient({ account, chain, transport: custom(provider) }).extend(publicActions);
const { abi, bytecode } = compileContract("BasketCards");

async function deploy() {
  const hash = await as(tribe).deployContract({ abi, bytecode, args: ["https://tribe.example/card/"] });
  return (await as(tribe).waitForTransactionReceipt({ hash })).contractAddress!;
}
const send = async (who: typeof tribe, address: Hex, functionName: string, args: unknown[]) => {
  const w = as(who);
  const hash = await w.writeContract({ address, abi, functionName, args, gas: 500_000n });
  const r = await w.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} reverted`);
};
const read = (address: Hex, functionName: string, args: unknown[] = []) => as(tribe).readContract({ address, abi, functionName, args }) as Promise<unknown>;

test("BasketCards: only Tribe mints, once per card, and it reads as a standard NFT", async () => {
  const c = await deploy();
  await assert.rejects(send(alice, c, "mint", [alice.address, 1n, 0]));
  await send(tribe, c, "mint", [alice.address, 1n, 0]);
  await assert.rejects(send(tribe, c, "mint", [bob.address, 1n, 0]), "a card id can't be minted twice");
  assert.equal(await read(c, "ownerOf", [1n]), alice.address);
  assert.equal(await read(c, "balanceOf", [alice.address]), 1n);
  assert.equal(await read(c, "tokenURI", [1n]), "https://tribe.example/card/1.json");
  await assert.rejects(read(c, "tokenURI", [2n]));
  for (const id of ["0x01ffc9a7", "0x80ac58cd", "0x5b5e139f", "0x49064906"]) assert.equal(await read(c, "supportsInterface", [id]), true);
  assert.equal(await read(c, "supportsInterface", ["0xffffffff"]), false);
});

test("BasketCards: a holder can transfer or approve a sale, and nobody else can move the card", async () => {
  const c = await deploy();
  await send(tribe, c, "mint", [alice.address, 1n, 1]);
  await assert.rejects(send(stranger, c, "transferFrom", [alice.address, stranger.address, 1n]));
  await assert.rejects(send(tribe, c, "transferFrom", [alice.address, tribe.address, 1n]), "Tribe owns the contract, not the cards");
  await send(alice, c, "transferFrom", [alice.address, bob.address, 1n]);
  assert.equal(await read(c, "ownerOf", [1n]), bob.address);
  assert.deepEqual([await read(c, "balanceOf", [alice.address]), await read(c, "balanceOf", [bob.address])], [0n, 1n]);

  await send(bob, c, "approve", [stranger.address, 1n]);
  await send(stranger, c, "safeTransferFrom", [bob.address, alice.address, 1n]);
  assert.equal(await read(c, "ownerOf", [1n]), alice.address);
  assert.equal(await read(c, "getApproved", [1n]), "0x0000000000000000000000000000000000000000", "an approval ends with the transfer");
  await assert.rejects(send(stranger, c, "transferFrom", [alice.address, stranger.address, 1n]));

  await send(alice, c, "setApprovalForAll", [bob.address, true]);
  await send(bob, c, "transferFrom", [alice.address, bob.address, 1n]);
  assert.equal(await read(c, "ownerOf", [1n]), bob.address);
  await assert.rejects(send(bob, c, "safeTransferFrom", [bob.address, c, 1n]), "a contract that can't hold NFTs is refused");
});

test("BasketCards: a tier only moves up, even after the card has been sold", async () => {
  const c = await deploy();
  await send(tribe, c, "mint", [alice.address, 1n, 0]);
  await send(alice, c, "transferFrom", [alice.address, bob.address, 1n]);
  await assert.rejects(send(alice, c, "setTier", [1n, 1]));
  await send(tribe, c, "setTier", [1n, 2]);
  assert.equal(await read(c, "tierOf", [1n]), 2);
  await assert.rejects(send(tribe, c, "setTier", [1n, 1]));
  await assert.rejects(send(tribe, c, "setTier", [1n, 3]));
  await assert.rejects(send(tribe, c, "setTier", [2n, 1]));
});

// The worker against a fake chain.
function fakeChain() {
  const cards = new Map<number, { to: string; tier: number }>();
  const log: string[] = [];
  return {
    cards, log,
    read: async (id: number) => ({ exists: cards.has(id), tier: cards.get(id)?.tier ?? 0 }),
    mint: async (to: `0x${string}`, id: number, tier: number) => { if (id === 13) throw new Error("rpc down"); cards.set(id, { to, tier }); log.push(`mint ${id}`); return `0xtx${id}`; },
    setTier: async (id: number, tier: number) => { cards.get(id)!.tier = tier; log.push(`tier ${id}`); return "0x"; },
  };
}
const addCard = (id: number, owner: number, tier = "base") => db.prepare("INSERT INTO basket_cards (id, basket, owner, kind, edition, tier, at) VALUES (?, ?, ?, 'original', 0, ?, 1)").run(id, id, owner, tier);
const card = (id: number) => ({ ...(db.prepare("SELECT chain_tx, chain_to, chain_tier FROM basket_cards WHERE id = ?").get(id) as Record<string, string | null>) });
const user = (id: number, handle: string) => {
  db.prepare("INSERT INTO users (id, handle, address, pk, created_at) VALUES (?, ?, ?, '', 1)").run(id, handle, alice.address);
};

test("the worker mints once, records upgrades, repairs a lost save, and carries on past a failure", async () => {
  user(9001, "cardholder");
  user(9002, "deleted_9002");
  addCard(11, 9001);
  addCard(12, 9002);
  addCard(13, 9001);
  addCard(14, 9001, "glitter");
  const c = fakeChain();
  c.cards.set(14, { to: bob.address, tier: 1 }); // minted before a crash, and sold since

  await syncCards(c);
  assert.deepEqual(c.log, ["mint 11"], "a deleted account gets nothing, and card 13's failure doesn't stop the pass");
  assert.deepEqual(card(11), { chain_tx: "0xtx11", chain_to: alice.address, chain_tier: "base" });
  assert.equal(card(13).chain_tx, null, "tried again next pass");
  assert.equal(card(14).chain_tx, "unknown");
  assert.equal(c.cards.get(14)!.to, bob.address, "a card that was sold is left alone");

  await syncCards(c);
  assert.deepEqual(c.log, ["mint 11"], "nothing is sent twice");

  db.prepare("UPDATE basket_cards SET tier = 'holo' WHERE id = 11").run();
  await syncCards(c);
  assert.deepEqual(c.log, ["mint 11", "tier 11"]);
  assert.equal(c.cards.get(11)!.tier, 2);
  assert.equal(card(11).chain_tx, "0xtx11", "the mint transaction stays on record");
});
