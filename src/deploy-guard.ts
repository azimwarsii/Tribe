/**
 * Deploy CopyGuard and SeasonBoard to Base Sepolia and wire them up.
 *
 *   npm run guard:deploy              # forwarder = Chainlink MockKeystoneForwarder, for `cre workflow simulate --broadcast`
 *   npm run guard:deploy -- --prod    # forwarder = KeystoneForwarder, for a deployed workflow
 *
 * Needs DEPLOYER_PRIVATE_KEY (funded with Base Sepolia ETH) in .env. Writes the addresses into
 * cre-workflow/{guard,board}-workflow/config.*.json and GUARD_ADDRESS / SEASON_BOARD_ADDRESS into .env.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { compileContract, FORWARDERS } from "./guard-contract.js";

const pk = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!pk) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env (a Base Sepolia wallet with test ETH: https://faucets.chain.link/base-sepolia).");
const account = privateKeyToAccount(pk.startsWith("0x") ? pk : (`0x${pk}` as `0x${string}`));
const transport = http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org");
const pub = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ account, chain: baseSepolia, transport });
const forwarder = process.argv.includes("--prod") ? FORWARDERS.production : FORWARDERS.simulation;

const bal = await pub.getBalance({ address: account.address });
console.log(`Deployer ${account.address} has ${formatEther(bal)} Base Sepolia ETH`);
if (bal === 0n) throw new Error("No Base Sepolia ETH. Use https://faucets.chain.link/base-sepolia first.");

async function deploy(name: "CopyGuard" | "SeasonBoard") {
  const { abi, bytecode } = compileContract(name);
  const hash = await wallet.deployContract({ abi, bytecode, args: [forwarder] });
  console.log(`Deploying ${name} (forwarder ${forwarder})… https://sepolia.basescan.org/tx/${hash}`);
  const { contractAddress } = await pub.waitForTransactionReceipt({ hash });
  if (!contractAddress) throw new Error(`No contract address in the ${name} receipt`);
  console.log(`${name} at ${contractAddress} · https://sepolia.basescan.org/address/${contractAddress}`);
  return contractAddress;
}
const guard = await deploy("CopyGuard");
const board = await deploy("SeasonBoard");

const setConfig = (workflow: string, key: string, value: string) => {
  for (const f of ["staging", "production"]) {
    const path = new URL(`../cre-workflow/${workflow}/config.${f}.json`, import.meta.url);
    const cfg = JSON.parse(readFileSync(path, "utf8"));
    cfg.evm[key] = value;
    writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
  }
};
setConfig("guard-workflow", "guardAddress", guard);
setConfig("board-workflow", "boardAddress", board);

const envPath = new URL("../.env", import.meta.url);
const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const set = (s: string, k: string, v: string) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  return re.test(s) ? s.replace(re, `${k}=${v}`) : `${s.trimEnd()}\n${k}=${v}\n`;
};
writeFileSync(envPath, set(set(set(env, "GUARD_ADDRESS", guard), "GUARD_CHAIN", "base-sepolia"), "SEASON_BOARD_ADDRESS", board));
console.log("Wrote the addresses into the workflow configs and .env.");
