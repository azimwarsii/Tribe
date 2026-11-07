/**
 * Wallet page: turn automatic signing on or off. An outside wallet can't delegate, so this creates the user's embedded
 * wallet and adds Tribe as a signer limited by a per-wallet policy. Only the wallet's owner can add a signer, so this
 * runs here, in their browser, and the server then reads the result back from Privy (src/privy-api.ts).
 * The user can always export the wallet's key: Tribe's policy limits Tribe, not them.
 */
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, useConnectWallet, useCreateWallet, useExportWallet, usePrivy, useSigners, useWallets } from "@privy-io/react-auth";
import { arrived, BASE_CHAIN_ID, GAS_TOP_UP_ETH, GAS_TOP_UP_WEI, parseUsdc, USDC, usdcTransferData, type WalletBalance } from "./fund";

declare global {
  interface Window { TRIBE: { appId: string; auto?: boolean; fundTo?: string; needsGas?: boolean } }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j as T;
}

const balances = () => fetch("/api/wallet/balances", { credentials: "same-origin" }).then((r) => (r.ok ? (r.json() as Promise<WalletBalance>) : Promise.reject(new Error("balance"))));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Move USDC (and a little ETH for fees, when the wallet is low) from the user's outside wallet into their Tribe wallet. */
function AddFunds({ auto, to, needsGas }: { auto: boolean; to?: string; needsGas: boolean }) {
  const { wallets } = useWallets();
  const { connectWallet } = useConnectWallet();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [landed, setLanded] = useState(""); // what reached the wallet
  const [late, setLate] = useState(false); // still not there after the wait
  const outside = wallets.find((w) => w.walletClientType !== "privy");
  const units = parseUsdc(amount);

  // Asks the outside wallet for one transfer, on Base only: funds sent on another network wouldn't arrive.
  const transfer = async (tx: { to: string; data?: string; value?: string }) => {
    if (!outside) return;
    setBusy(true);
    setError("");
    setSent("");
    setLanded("");
    setLate(false);
    try {
      const before = await balances().catch(() => undefined);
      await outside.switchChain(BASE_CHAIN_ID);
      const provider = await outside.getEthereumProvider();
      if (Number(await provider.request({ method: "eth_chainId" })) !== BASE_CHAIN_ID) throw new Error("Switch your wallet to Base, then try again.");
      setSent((await provider.request({ method: "eth_sendTransaction", params: [{ from: outside.address, ...tx }] })) as string);
      setAmount("");
      // Watch the Tribe wallet itself: that's what proves the money got there. A failed read just waits for the next one.
      for (let i = 0; before && i < 40; i++) {
        await pause(3000);
        const what = arrived(before, await balances().catch(() => before));
        if (what) {
          setLanded(what);
          try { sessionStorage.setItem("toast", `${what} reached your Tribe wallet`); } catch {}
          await pause(1800);
          location.reload(); // the balances and the fee warning come from the server
          return;
        }
      }
      setLate(true);
    } catch (e) {
      setError((e as { code?: number }).code === 4001 ? "You cancelled in your wallet." : (e as Error).message);
    }
    setBusy(false);
  };

  const blocked = !auto ? "Turn on automatic signing first, so you have a Tribe wallet to fund." : !to ? "This is a practice server, so it uses simulated funds. Add USDC works on the real-money app." : "";
  return (
    <section className="card col" aria-label="Add USDC" style={{ gap: 10, padding: 16, borderRadius: 18, borderColor: "rgba(255,255,255,.14)" }}>
      <b style={{ fontSize: 17 }}>Add USDC</b>
      {blocked ? (
        <span className="sm mut" style={{ lineHeight: 1.5 }}>{blocked}</span>
      ) : outside ? (
        <>
          {needsGas && (
            <div className="col" style={{ gap: 8, padding: 12, borderRadius: 14, border: "1px solid rgba(252,211,77,.45)", background: "rgba(252,211,77,.06)" }}>
              <span className="sm" style={{ lineHeight: 1.5 }}><b className="warn">Add ETH first.</b> Trades need a little ETH on Base for network fees, even when you have USDC.</span>
              <button className="btn sm" disabled={busy} onClick={() => void transfer({ to: to!, value: GAS_TOP_UP_WEI })}>Add {GAS_TOP_UP_ETH} ETH for fees</button>
            </div>
          )}
          <span className="sm" style={{ lineHeight: 1.5 }}>Real USDC on Base, straight from your wallet.</span>
          <input className="f" aria-label="Amount in USDC" inputMode="decimal" placeholder="Amount in USDC" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {error && <div className="sm down" role="alert">{error}</div>}
          {sent && (
            <div className="col" role="status" style={{ gap: 6, padding: 12, borderRadius: 14, border: `1px solid ${landed ? "rgba(52,211,153,.45)" : "rgba(255,255,255,.14)"}`, background: landed ? "rgba(52,211,153,.08)" : "#151515" }}>
              <b className="sm">{landed ? <span className="up">✓ {landed} reached your Tribe wallet</span> : late ? "Still on its way" : "Sent. Waiting for it to reach your Tribe wallet…"}</b>
              {late && <span className="sm mut" style={{ lineHeight: 1.5 }}>This is taking longer than usual. Check the transaction, then refresh.</span>}
              <div className="row" style={{ gap: 12 }}>
                <a className="sm" href={`https://basescan.org/tx/${sent}`} target="_blank" rel="noopener">View on Basescan ↗</a>
                {late && <button className="btn sm" onClick={() => location.reload()}>Refresh</button>}
              </div>
            </div>
          )}
          <button className="btn p" disabled={busy || units === undefined} onClick={() => void transfer({ to: USDC, data: usdcTransferData(to!, units!) })}>{busy ? (sent ? "Waiting for it to arrive…" : "Check your wallet…") : "Add USDC"}</button>
        </>
      ) : (
        <button className="btn p" onClick={() => connectWallet()}>Connect your wallet</button>
      )}
    </section>
  );
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

  const hero = (control: React.ReactNode, text: string) => (
    <section className="card col" aria-label="Automatic signing" style={{ gap: 10, padding: 16, borderRadius: 18, borderColor: auto ? "rgba(52,211,153,.45)" : "rgba(252,211,77,.45)", background: auto ? "rgba(52,211,153,.07)" : "rgba(252,211,77,.06)" }}>
      <div className="row sp" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <b style={{ fontSize: 17 }}>Automatic signing</b>
          <span className={auto ? "pill ok" : "pill warn"}>{auto ? "On" : "Off"}</span>
        </div>
        {control}
      </div>
      <span className="sm" style={{ lineHeight: 1.5 }}>{text}</span>
      {error && <div className="sm down" role="alert">{error}</div>}
    </section>
  );

  if (!ready || !walletsReady) return hero(null, "Loading…");
  if (!authenticated) return hero(<button className="btn sm p" onClick={login}>Connect wallet</button>, "Connect your wallet again to manage automatic signing and add USDC.");
  return (
    <>
      {hero(
        <button className="sw" role="switch" aria-checked={auto} aria-label="Automatic signing" disabled={busy} style={{ flex: "none", transform: "scale(1.25)", transformOrigin: "right center" }} onClick={auto ? turnOff : turnOn}><i></i></button>,
        busy
          ? "Working… approve anything your wallet asks for."
          : auto
            ? "Tribe places Flash trades from your Tribe wallet without asking each time. It can't send your funds anywhere else."
            : "Trades run without a prompt each time. You get your own Tribe wallet, and you can turn this off at any time.",
      )}
      <AddFunds auto={auto} to={window.TRIBE.fundTo} needsGas={!!window.TRIBE.needsGas} />
      {embedded && <button className="btn sm" disabled={busy} onClick={() => void exportWallet({ address: embedded.address })}>Export wallet key</button>}
    </>
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
