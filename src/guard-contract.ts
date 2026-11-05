import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Abi, Hex } from "viem";

/** Compile one of contracts/*.sol with solc-js. Used by the deploy script and the contract tests. */
export function compileContract(name: "CopyGuard" | "SeasonBoard"): { abi: Abi; bytecode: Hex } {
  const solc = createRequire(import.meta.url)("solc");
  const source = readFileSync(new URL(`../contracts/${name}.sol`, import.meta.url), "utf8");
  const out = JSON.parse(
    solc.compile(JSON.stringify({
      language: "Solidity",
      sources: { [`${name}.sol`]: { content: source } },
      settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
    })),
  );
  const errors = (out.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e: { formattedMessage: string }) => e.formattedMessage).join("\n"));
  const c = out.contracts[`${name}.sol`][name];
  return { abi: c.abi as Abi, bytecode: `0x${c.evm.bytecode.object}` };
}
export const compileCopyGuard = () => compileContract("CopyGuard");

/** Chainlink forwarders on Base Sepolia (https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory). */
export const FORWARDERS = {
  simulation: "0x82300bd7c3958625581cc2f77bc6464dcecdf3e5", // MockKeystoneForwarder used by `cre workflow simulate --broadcast`
  production: "0xF8344CFd5c43616a4366C34E3EEE75af79a74482", // KeystoneForwarder used by deployed workflows
} as const;
