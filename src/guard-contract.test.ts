import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createWalletClient, custom, encodeAbiParameters, parseAbiParameters, publicActions, type Abi, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { compileContract, compileCopyGuard } from "./guard-contract.js";

// A real EVM in-process (Ganache): deploy CopyGuard and drive it the way the Chainlink Forwarder would.
const keys = [generatePrivateKey(), generatePrivateKey(), generatePrivateKey()];
const ganache = createRequire(import.meta.url)("ganache");
const provider = ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337 }, wallet: { accounts: keys.map((secretKey) => ({ secretKey, balance: "0x56BC75E2D63100000" })) } });
const byAddr = new Map(keys.map((k) => [privateKeyToAccount(k).address, privateKeyToAccount(k)]));
const [ownerAddr, forwarderAddr, strangerAddr] = [...byAddr.keys()];
const chain = { id: 1337, name: "ganache", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://localhost"] } } } as const;
const wallet = (addr: Hex) => createWalletClient({ account: byAddr.get(addr as `0x${string}`)!, chain, transport: custom(provider) }).extend(publicActions);
const { abi, bytecode } = compileCopyGuard();

const report = (leader: bigint, severity: number, risk: number, at: bigint, reason: string) =>
  encodeAbiParameters(parseAbiParameters("uint256, uint8, uint16, uint64, string"), [leader, severity, risk, at, reason]);

async function deploy() {
  const owner = wallet(ownerAddr);
  const hash = await owner.deployContract({ abi, bytecode, args: [forwarderAddr] });
  return (await owner.waitForTransactionReceipt({ hash })).contractAddress!;
}

async function send(from: Hex, address: Hex, functionName: string, args: unknown[]) {
  const w = wallet(from);
  const hash = await w.writeContract({ address, abi: abi as Abi, functionName, args, gas: 500_000n });
  const receipt = await w.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted`);
  return receipt;
}
const read = (address: Hex, functionName: string, args: unknown[] = []) => wallet(ownerAddr).readContract({ address, abi, functionName, args });

test("CopyGuard: forwarder reports halt and resume, with replay protection", async () => {
  const address = await deploy();
  // ERC-165, which the Keystone Forwarder checks before delivering a report.
  assert.equal(await read(address, "supportsInterface", ["0x805f2132"]), true); // IReceiver.onReport selector
  assert.equal(await read(address, "supportsInterface", ["0x01ffc9a7"]), true); // IERC165
  assert.equal(await read(address, "supportsInterface", ["0xffffffff"]), false);

  const r1 = await send(forwarderAddr, address, "onReport", ["0x", report(7n, 2, 91, 1000n, "22pp drawdown in 24h")]);
  assert.equal(r1.status, "success");
  assert.equal(await read(address, "halted", [7n]), true);
  const s = (await read(address, "status", [7n])) as [boolean, number, bigint, Hex];
  assert.deepEqual([s[0], s[1], s[2]], [true, 91, 1000n]);

  // Replaying the same (or an older) report is rejected.
  await assert.rejects(send(forwarderAddr, address, "onReport", ["0x", report(7n, 0, 10, 1000n, "")]));
  assert.deepEqual(await read(address, "haltedMany", [[7n, 8n]]), [true, false]);
  // A newer clean report resumes.
  await send(forwarderAddr, address, "onReport", ["0x", report(7n, 0, 10, 1300n, "checks passed")]);
  assert.equal(await read(address, "halted", [7n]), false);
});

test("CopyGuard: only the forwarder reports, only the owner moves it", async () => {
  const address = await deploy();
  await assert.rejects(send(strangerAddr, address, "onReport", ["0x", report(1n, 2, 99, 5n, "spoofed")]));
  assert.equal(await read(address, "halted", [1n]), false);
  await assert.rejects(send(strangerAddr, address, "setForwarder", [strangerAddr]));
  await send(ownerAddr, address, "setForwarder", [strangerAddr]);
  await send(strangerAddr, address, "onReport", ["0x", report(1n, 2, 99, 5n, "now allowed")]);
  assert.equal(await read(address, "halted", [1n]), true);
  await send(ownerAddr, address, "resume", [1n]);
  assert.equal(await read(address, "halted", [1n]), false);
});

test("SeasonBoard: attests a ranking once per newer computation", async () => {
  const sb = compileContract("SeasonBoard");
  const owner = wallet(ownerAddr);
  const hash = await owner.deployContract({ abi: sb.abi, bytecode: sb.bytecode, args: [forwarderAddr] });
  const address = (await owner.waitForTransactionReceipt({ hash })).contractAddress!;
  const rep = (at: bigint, top: bigint[], bps: number[]) =>
    encodeAbiParameters(parseAbiParameters("uint32, bytes32, uint64, uint256[], int32[]"), [3, `0x${"ab".repeat(32)}`, at, top, bps]);
  const sendSB = async (from: Hex, args: unknown[]) => {
    const w = wallet(from);
    const r = await w.waitForTransactionReceipt({ hash: await w.writeContract({ address, abi: sb.abi, functionName: "onReport", args, gas: 800_000n }) });
    if (r.status !== "success") throw new Error("reverted");
  };
  await sendSB(forwarderAddr, ["0x", rep(100n, [101n, 102n], [3820, -120])]);
  const b = (await wallet(ownerAddr).readContract({ address, abi: sb.abi, functionName: "board", args: [3] })) as [Hex, bigint, bigint[], number[]];
  assert.deepEqual([b[1], b[2], b[3]], [100n, [101n, 102n], [3820, -120]]);
  await assert.rejects(sendSB(forwarderAddr, ["0x", rep(100n, [102n], [9999])])); // replay
  await assert.rejects(sendSB(strangerAddr, ["0x", rep(200n, [102n], [9999])])); // not the forwarder
  assert.equal(await wallet(ownerAddr).readContract({ address, abi: sb.abi, functionName: "supportsInterface", args: ["0x805f2132"] }), true);
});

test.after(() => provider.disconnect());
