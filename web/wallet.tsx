/**
 * Wallet page: turn automatic signing on or off. An outside wallet can't delegate, so this creates the user's embedded
 * wallet and adds Tribe as a signer limited by a per-wallet policy. Only the wallet's owner can add a signer, so this
 * runs here, in their browser, and the server then reads the result back from Privy (src/privy-api.ts).
 * The user can always export the wallet's key: Tribe's policy limits Tribe, not them.
 */
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, useCreateWallet, useExportWallet, usePrivy, useSigners, useWallets } from "@privy-io/react-auth";

declare global {
  interface Window { TRIBE: { appId: string; auto?: boolean } }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j as T;
}

function Signing() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { addSigners, removeSigners } = useSigners();
  const { exportWallet } = useExportWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const embedded = wallets.find((w) => w.walletClientType === "privy");
  // addSigners looks the wallet up in the user it was rendered with, so a wallet made a moment ago needs the next render's.
  const latest = useRef({ addSigners, user });
  latest.current = { addSigners, user };
  const seenByPrivy = async (address: string) => {
    for (let i = 0; i < 50; i++) {
      if (latest.current.user?.linkedAccounts.some((a) => a.type === "wallet" && a.address === address)) return;
      await new Promise((done) => setTimeout(done, 200));
    }
    throw new Error("Your Tribe wallet is still being set up. Refresh and try again.");
  };
  const auto = !!window.TRIBE.auto;

  const run = (fn: (accessToken: string) => Promise<void>) => async () => {
    setBusy(true);
    setError("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Your wallet session expired. Sign in again.");
      await fn(accessToken);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const turnOn = run(async (accessToken) => {
    const address = embedded?.address ?? (await createWallet()).address;
    const p = await post<{ signerId: string; policyId: string; added: boolean }>("/api/privy/wallet/prepare", { accessToken });
    if (!p.added) {
      await seenByPrivy(address);
      await latest.current.addSigners({ address, signers: [{ signerId: p.signerId, policyIds: [p.policyId] }] });
    }
    location.href = (await post<{ redirect: string }>("/api/privy/wallet/confirm", { accessToken })).redirect;
  });

  const turnOff = run(async (accessToken) => {
    if (embedded) await removeSigners({ address: embedded.address });
    location.href = (await post<{ redirect: string }>("/api/privy/wallet/disable", { accessToken })).redirect;
  });

  if (!ready || !walletsReady) return <div className="card"><span className="sm mut">Loading…</span></div>;
  if (!authenticated) {
    return (
      <div className="card col" style={{ gap: 8 }}>
        <b>Automatic signing</b>
        <span className="sm" style={{ lineHeight: 1.5 }}>Connect your wallet again to manage automatic signing.</span>
        <button className="btn" onClick={login}>Connect wallet</button>
      </div>
    );
  }
  return (
    <div className="card col" style={{ gap: 8 }}>
      <b>Automatic signing</b>
      <span className="sm" style={{ lineHeight: 1.5 }}>
        {auto
          ? "On. Tribe can place Flash trades from this wallet without asking each time. Turning it off removes Tribe as a signer. Funds stay in this wallet."
          : "Lets Tribe place trades without a prompt each time. You get a Tribe wallet of your own, and you move USDC into it from MetaMask. Tribe can only sign Flash trades that pay back to that wallet. It can't send your funds anywhere else, and you can turn this off at any time."}
      </span>
      {error && <div className="sm down" role="alert">{error}</div>}
      <button className={auto ? "btn" : "btn p"} disabled={busy} onClick={auto ? turnOff : turnOn}>
        {busy ? "Working…" : auto ? "Turn off automatic signing" : "Turn on automatic signing"}
      </button>
      {embedded && <button className="btn sm" disabled={busy} onClick={() => void exportWallet({ address: embedded.address })}>Export wallet key</button>}
    </div>
  );
}

createRoot(document.getElementById("wallet-root")!).render(
  <PrivyProvider
    appId={window.TRIBE.appId}
    config={{
      loginMethods: ["wallet"],
      appearance: { theme: "dark", walletChainType: "ethereum-only", walletList: ["detected_ethereum_wallets", "metamask", "coinbase_wallet", "rainbow", "wallet_connect"] },
      embeddedWallets: { ethereum: { createOnLogin: "off" } },
    }}
  >
    <Signing />
  </PrivyProvider>,
);
