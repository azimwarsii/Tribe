/**
 * One-time Privy setup. Creates Tribe's authorization key (a P-256 key pair: the private half stays in .env, Privy
 * only gets the public half), registers it as a key quorum, and writes both into .env. Safe to run again: it skips
 * what already exists.
 *
 *   npm run privy:setup
 *
 * Needs PRIVY_APP_ID and PRIVY_APP_SECRET in .env.
 */
import "dotenv/config";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PrivyClient } from "@privy-io/node";

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;
if (!appId || !appSecret) throw new Error("Set PRIVY_APP_ID and PRIVY_APP_SECRET in .env first.");
const privy = new PrivyClient({ appId, appSecret });

const envPath = new URL("../.env", import.meta.url);
const setEnv = (k: string, v: string) => {
  const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const re = new RegExp(`^${k}=.*$`, "m");
  writeFileSync(envPath, re.test(env) ? env.replace(re, `${k}=${v}`) : `${env.trimEnd()}\n${k}=${v}\n`, { mode: 0o600 });
  process.env[k] = v;
};

if (!process.env.PRIVY_AUTH_KEY || !process.env.PRIVY_KEY_QUORUM_ID) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const priv = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  const pub = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const quorum = await privy.keyQuorums().create({ authorization_threshold: 1, display_name: "Tribe server signer", public_keys: [pub] });
  setEnv("PRIVY_AUTH_KEY", priv);
  setEnv("PRIVY_KEY_QUORUM_ID", quorum.id);
  console.log(`Registered Tribe's authorization key as key quorum ${quorum.id} and saved it to .env.`);
} else {
  console.log(`Authorization key already set up (key quorum ${process.env.PRIVY_KEY_QUORUM_ID}).`);
}
