/**
 * Sign-in page: continue with any wallet. Privy's picker lists browser wallets it detects (MetaMask, Coinbase Wallet,
 * Rabby, Brave and others) and phone wallets over WalletConnect, and asks the wallet to sign a message proving it's
 * yours. The server then checks Privy's access token: a known wallet gets a session, a new one picks a username.
 * On /signin?out=1 the Privy session is ended too.
 */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

declare global {
  interface Window { TRIBE: { appId: string } }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j as T;
}

// Arrived from "Sign out" or "Delete account": end the Privy session once, then behave like a normal sign-in page.
let signingOut = new URLSearchParams(location.search).has("out");

function SignIn() {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    // Signed out of Tribe: end the Privy session too, so the next sign-in can pick another wallet.
    if (signingOut) {
      signingOut = false; // only once: connecting a wallet afterwards must sign in, not sign out again
      history.replaceState(null, "", "/signin");
      if (authenticated) { void logout(); return; }
    }
    if (!authenticated || busy) return;
    setBusy(true);
    (async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sign-in expired. Try again.");
      const r = await post<{ redirect: string }>("/api/privy/session", { accessToken });
      location.href = r.redirect;
    })().catch((e) => {
      setError((e as Error).message);
      setBusy(false);
      void logout();
    });
  }, [ready, authenticated]);

  if (!ready || busy) return <p className="mut">{busy ? "Signing you in…" : "Loading…"}</p>;
  return (
    <div className="col" style={{ gap: 10 }}>
      {error && <div className="card bad" role="alert"><b className="down">Couldn't sign in</b><div className="sm" style={{ marginTop: 4 }}>{error}</div></div>}
      <button className="btn p big" onClick={() => { setError(""); login(); }}>Continue with wallet</button>
      <p className="xs dim" style={{ margin: 0, textAlign: "center" }}>MetaMask, Coinbase Wallet, Rainbow, Rabby, or any wallet via WalletConnect</p>
    </div>
  );
}

createRoot(document.getElementById("signin-root")!).render(
  <PrivyProvider
    appId={window.TRIBE.appId}
    config={{
      loginMethods: ["wallet"],
      appearance: { theme: "dark", walletChainType: "ethereum-only", walletList: ["detected_ethereum_wallets", "metamask", "coinbase_wallet", "rainbow", "wallet_connect"] },
      embeddedWallets: { ethereum: { createOnLogin: "off" } },
    }}
  >
    <SignIn />
  </PrivyProvider>,
);
