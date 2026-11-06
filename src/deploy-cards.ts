/**
 * Deploy BasketCards to Base Sepolia and save its address.
 *
 *   npm run cards:deploy
 *
 * Needs DEPLOYER_PRIVATE_KEY (funded with Base Sepolia ETH) in .env. That wallet owns the contract and mints the cards.
 * Card metadata lives at PUBLIC_URL/card/<id>.json, so that address is what wallets and marketplaces will fetch.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { compileContract } from "./guard-contract.js";

const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env (a Base Sepolia wallet with test ETH).");
if (process.env.BASKET_CARDS_ADDRESS) throw new Error(`BasketCards is already deployed at ${process.env.BASKET_CARDS_ADDRESS}. Remove BASKET_CARDS_ADDRESS from .env to deploy a new one.`);
const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
const transport = http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org");
const pub = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ account, chain: baseSepolia, transport });

const baseURI = `${(process.env.PUBLIC_URL ?? "http://localhost:8787").replace(/\/$/, "")}/card/`;
const { abi, bytecode } = compileContract("BasketCards");
const hash = await wallet.deployContract({ abi, bytecode, args: [baseURI] });
console.log(`Deploying BasketCards… https://sepolia.basescan.org/tx/${hash}`);
const { contractAddress, status } = await pub.waitForTransactionReceipt({ hash });
if (status !== "success" || !contractAddress) throw new Error("The deployment failed.");
console.log(`BasketCards at ${contractAddress} · https://sepolia.basescan.org/address/${contractAddress}`);

const envPath = new URL("../.env", import.meta.url);
const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
writeFileSync(envPath, `${env.trimEnd()}\nBASKET_CARDS_ADDRESS=${contractAddress}\n`);
console.log("Saved BASKET_CARDS_ADDRESS to .env.");
