import { basketBoard, basketById, basketRead, basketsBy, basketView, copiesOf, copyValue, MAX_TOKENS, navSeries, openCopy, rebalancePlan, rebalanceRequests, versionOf, versionsOf, type BasketRead, type BasketView, type CopyRow, type CopyValue, type RequestRow, type Weight } from "../baskets.js";
import { copyFee } from "../creator.js";
import { ago, face, initials, money, pct } from "../data.js";
import { getMeta, haltOf, isWatching } from "../db.js";
import { priceStr } from "../numfmt.js";
import { esc, header, icon, notFound, page, polyline, signCls, split, stat } from "../ui.js";

/** A colour per slice, in weight order, so a token keeps its place across a basket's bar and list. */
const SLICE = ["#34D399", "#60A5FA", "#FBBF24", "#F472B6", "#A78BFA", "#22D3EE", "#FB923C", "#A3E635", "#F87171", "#94A3B8"];
const px = (n: number) => `$${n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : priceStr(n)}`;
const flatCls = (n: number) => (Math.abs(n) < 0.05 ? "mut" : signCls(n));
const flatPct = (n: number) => (Math.abs(n) < 0.05 ? "flat" : pct(n));
const TONE = { ok: "#34D399", warn: "#FCD34D", bad: "#F87171" };

/** The basket's make-up as one bar. */
export const allocBar = (weights: { symbol: string; weight: number }[]) =>
  `<div class="alloc" role="img" aria-label="${esc(weights.map((w) => `${w.symbol} ${w.weight}%`).join(", "))}">${weights.map((w, i) => `<i style="width:${w.weight}%;background:${SLICE[i % SLICE.length]}"></i>`).join("")}</div>`;
/** The same make-up as a compact key, for cards. */
const allocKey = (weights: { symbol: string; weight: number }[], limit = 5) => {
  const shown = weights.slice(0, limit), more = weights.length - shown.length;
  return `<div class="allockey">${shown.map((w, i) => `<span><i style="background:${SLICE[i % SLICE.length]}"></i>${esc(w.symbol)} <b>${w.weight}%</b></span>`).join("")}${more > 0 ? `<span class="mut">+${more} more</span>` : ""}</div>`;
};

const readHtml = (r: BasketRead) => {
  const tone = TONE[r.tone];
  const checks = [...r.checks.filter((c) => !c.ok), ...r.checks.filter((c) => c.ok)].slice(0, 3);
  return `<section class="swread" style="border-color:${tone}55"><div class="row sp"><span class="row" style="gap:8px"><span class="orb" aria-hidden="true" style="width:20px;height:20px"><i></i></span><b class="sm">Chief’s read</b></span><span class="pill" style="color:${tone};border:1px solid ${tone}66;background:${tone}14">${esc(r.label)}</span></div><ul class="vchecks" style="margin-top:8px">${checks.map((x) => `<li class="${x.ok ? "ok" : "bad"}"><i aria-hidden="true">${x.ok ? icon("check", 11, "currentColor", 3.2) : "!"}</i>${esc(x.t)}</li>`).join("")}</ul></section>`;
};

const askLink = (v: BasketView) => `/cat/chat?new=1&q=${encodeURIComponent(`Is the basket "${v.name}" worth copying?`)}`;

/** A basket in the swipe deck. */
export async function basketCardHtml(v: BasketView, viewer: number, social = ""): Promise<string> {
  const meta = getMeta(viewer);
  const max = meta.defaults.max;
  const usd = Math.min(25, max);
  const needStop = meta.defaults.stop && !(v.stopPct > 0);
  const fee = copyFee(v.owner, 1);
  const read = await basketRead(v);
  const following = isWatching(viewer, v.owner);
  return `<article class="swcard" data-basket="${v.id}" data-handle="${esc(v.handle)}" data-symbol="${esc(v.name)}" data-legs="${v.weights.length}" data-usd="${usd}" data-max="${max}" data-needstop="${needStop ? 1 : ""}" data-fee="${fee.bps}" data-share="${fee.sharePct}" data-sl="${v.stopPct || ""}" data-tp="${v.tpPct || ""}" data-ask="${esc(askLink(v))}" data-following="${following ? 1 : ""}" data-verdict="${esc(read.label)}" data-tone="${read.tone}" data-ini="${initials(v.handle)}" aria-label="${esc(v.name)} by @${esc(v.handle)}, ${v.weights.length} tokens">
<span class="stamp copy" aria-hidden="true">COPY</span><span class="stamp skip" aria-hidden="true">SKIP</span><span class="stamp ask" aria-hidden="true">ASK CHIEF</span>
<div class="freshband" role="status">${icon("list", 13, "currentColor", 2)}Basket · ${v.weights.length} tokens · launched ${ago(v.at)} ago</div>
${social}
<div class="row"><a href="/u/${esc(v.handle)}" class="av w">${face(v.handle)}</a><div class="grow" style="min-width:0"><a href="/u/${esc(v.handle)}" style="color:#F5F5F5;font-weight:600">@${esc(v.handle)}</a><div class="sm mut">${v.version > 1 ? `Rebalanced ${ago(v.versionAt)} ago` : "Creator"}</div></div><span class="pill ok">${icon("shield", 11, "currentColor", 2)}Guard passed</span></div>
<div class="row sp" style="align-items:flex-end;gap:12px"><div style="min-width:0"><div class="mut" style="font-size:14px">Basket</div><div style="font-size:28px;font-weight:700;letter-spacing:-.02em;line-height:1.15">${esc(v.name)}</div></div>
<div style="text-align:right;flex:none" data-live="since">${sinceHtml(v.returnPct)}</div></div>
${allocBar(v.weights)}${allocKey(v.weights)}
${v.thesis ? `<p class="md" style="margin:0;line-height:1.45;color:#D4D4D4">“${esc(v.thesis)}”</p>` : ""}
${needStop ? `<div class="sm warn row" style="gap:6px">${icon("shield", 13, "currentColor", 2)}No stop-loss: your rules won't copy this one</div>` : ""}
<div class="grid3"><div class="tile"><div class="k">You'd copy</div><div class="v">${money(usd)}</div></div><div class="tile"><div class="k">Worst case</div><div class="v ${v.stopPct ? "down" : "warn"}">${v.stopPct ? `−${money((usd * v.stopPct) / 100)}` : "No stop"}</div></div><div class="tile"><div class="k">Copied by</div><div class="v" data-live="copiers">${copiersText(v.copiers)}</div></div></div>
${readHtml(read)}
</article>`;
}
const copiersText = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const sinceHtml = (r: number) => `<div class="${flatCls(r)}" style="font-size:26px;font-weight:600">${flatPct(r)}</div><div class="xs mut">since launch</div>`;

/** What changes on a basket's card while you look at it. */
export async function basketLive(ids: number[]) {
  const out: Record<number, { since: string; copiers: string }> = {};
  for (const id of ids.slice(0, 20)) {
    const v = await basketView(id);
    if (v) out[id] = { since: sinceHtml(v.returnPct), copiers: copiersText(v.copiers) };
  }
  return out;
}

/** A compact row for lists: name, make-up, return. */
export const basketRow = (v: BasketView) =>
  `<a class="card col" href="/b/${v.id}" style="gap:8px;padding:12px;color:#F5F5F5"><div class="row sp" style="gap:10px"><span class="grow" style="min-width:0"><b class="md" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.name)}</b><span class="xs mut">@${esc(v.handle)} · ${v.weights.length} tokens · ${copiersText(v.copiers)}${v.status === "retired" ? " · retired" : ""}</span></span><b class="${flatCls(v.returnPct)}">${flatPct(v.returnPct)}</b></div>${allocBar(v.weights)}</a>`;

/** The index as a line, green if it's above where it started. */
function navChart(series: number[]): string {
  if (series.length < 2) return `<div class="sm mut" style="padding:8px 0">The chart fills in as the basket trades.</div>`;
  const up = series[series.length - 1] >= 100;
  return `<svg viewBox="0 0 300 80" preserveAspectRatio="none" style="width:100%;height:96px;display:block" role="img" aria-label="Basket value over time"><path d="${polyline(series, 300, 80)}" fill="none" stroke="${up ? "#34D399" : "#F87171"}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

const holdingRows = (value: CopyValue) =>
  value.holdings.map((h) => `<div class="line"><span class="grow" style="min-width:0"><b class="sm">${esc(h.symbol)}</b><span class="xs mut" style="display:block">${h.weightPct.toFixed(1)}% now · target ${h.targetPct}%</span></span><span style="text-align:right"><b class="sm">${money(h.value)}</b><span class="xs ${flatCls(h.pnlPct)}" style="display:block">${flatPct(h.pnlPct)}</span></span></div>`).join("");

async function rebalancePanel(r: RequestRow, name: string): Promise<string> {
  const plan = await rebalancePlan(r.copy_id, r.version);
  const v = versionOf(r.basket, r.version);
  const lines = [...plan.sells.map((s) => `<div class="row sp sm"><span>Sell ${esc(s.symbol)}</span><b class="down">−${money(s.usd)}</b></div>`), ...plan.buys.map((b) => `<div class="row sp sm"><span>Buy ${esc(b.symbol)}</span><b class="up">+${money(b.usd)}</b></div>`)].join("");
  return `<section class="card col" style="gap:10px;border-color:rgba(252,211,77,.45)"><div class="row" style="gap:8px">${icon("inbox", 15, "#FCD34D", 2)}<b class="md grow">Rebalance ${esc(name)}</b><span class="xs mut">Version ${v.n}</span></div>
${v.note ? `<p class="sm" style="margin:0;color:#D4D4D4">“${esc(v.note)}”</p>` : ""}${allocBar(v.weights)}${allocKey(v.weights, MAX_TOKENS)}
<div class="col" style="gap:4px">${lines || `<span class="sm mut">Your copy is already close enough to these weights.</span>`}</div>
<p class="xs mut" style="margin:0">Sells go first, then buys with what they raise. Nothing moves until you approve.</p>
<div class="grid2"><button class="btn" data-act="/api/basket-rebalance" data-body='{"id":${r.id},"action":"skip"}'>Keep what I hold</button><button class="btn p" data-act="/api/basket-rebalance" data-body='{"id":${r.id},"action":"approve"}'>${icon("bolt", 14)}Approve</button></div></section>`;
}

function copyPanel(c: CopyRow, value: CopyValue, name: string): string {
  const partial = c.status === "partial";
  return `<section class="card col" style="gap:10px" id="yours"><div class="row sp"><b class="md">Your copy</b><span class="xs mut">${money(c.usd)} in · ${ago(c.at)} ago</span></div>
<div class="grid2">${stat("Value", money(value.value))}${stat("Profit", `${value.pnlUsd >= 0 ? "+" : "−"}${money(Math.abs(value.pnlUsd))}`, signCls(value.pnlUsd))}</div>
${partial ? `<div class="sm warn row" style="gap:6px">${icon("shield", 13, "currentColor", 2)}${esc(c.note ?? "Some tokens didn't fill")}. Try them again, or close to sell what filled.</div>` : ""}
<div class="col">${holdingRows(value) || `<span class="sm mut">Nothing held yet.</span>`}</div>
<div class="${partial ? "grid2" : ""}">${partial ? `<button class="btn p" data-act="/api/basket-copy/${c.id}/retry">Try again</button>` : ""}<button class="btn" data-act="/api/basket-copy/${c.id}/close" data-confirm="${esc(`Sell everything in ${name} at market?`)}">Close this copy</button></div></section>`;
}

/** One basket's own page, open to anyone with the link. */
export async function basketPage(id: number, viewer: number | undefined): Promise<string> {
  const v = await basketView(id);
  if (!v) return notFound("Basket not found");
  const signedIn = viewer !== undefined;
  const own = viewer === v.owner;
  const paused = !!haltOf(v.owner);
  const read = await basketRead(v);
  const mine = signedIn ? openCopy(viewer!, id) : undefined;
  const value = mine ? await copyValue(mine.id) : undefined;
  const request = mine ? (rebalanceRequests(viewer!).find((r) => r.copy_id === mine.id)) : undefined;
  const fee = copyFee(v.owner, 1);
  const max = signedIn ? getMeta(viewer!).defaults.max : 25;
  const needStop = signedIn && getMeta(viewer!).defaults.stop && !(v.stopPct > 0);
  const summary = `<section class="card col" style="gap:10px"><div class="row sp" style="align-items:flex-end;gap:12px"><div style="min-width:0"><div class="sm mut">Index ${v.nav.toFixed(2)} · started at 100</div><div style="font-size:30px;font-weight:700" class="${flatCls(v.returnPct)}">${flatPct(v.returnPct)}</div></div><span class="pill ${paused ? "bad" : "ok"}">${icon("shield", 11, "currentColor", 2)}${paused ? "Paused by Guard" : "Guard passed"}</span></div>${navChart(navSeries(id))}
${v.thesis ? `<p class="md" style="margin:0;line-height:1.45;color:#D4D4D4">“${esc(v.thesis)}”</p>` : ""}</section>`;
  const makeup = `<section class="card col" style="gap:10px" aria-label="What's in it"><div class="row sp"><b class="md">What's in it</b><span class="xs mut">Version ${v.version}</span></div>${allocBar(v.weights)}<div class="col">${v.weights.map((w, i) => `<div class="line"><i aria-hidden="true" style="width:10px;height:10px;border-radius:3px;flex:none;background:${SLICE[i % SLICE.length]}"></i><span class="grow" style="min-width:0"><b class="sm">${esc(w.symbol)}</b><span class="xs mut" style="display:block">${px(w.price)}</span></span><span style="text-align:right"><b class="sm">${w.weight}%</b><span class="xs ${flatCls(w.changePct)}" style="display:block">${flatPct(w.changePct)}</span></span></div>`).join("")}</div></section>`;
  const config = `<div class="grid3">${stat("Stop per token", v.stopPct ? `−${v.stopPct}%` : "None", v.stopPct ? "" : "warn")}${stat("Target per token", v.tpPct ? `+${v.tpPct}%` : "None")}${stat("Copied by", copiersText(v.copiers))}</div>`;
  const history = versionsOf(id);
  const versions = history.length > 1 ? `<section class="flat col" style="gap:8px"><h2 style="font-size:16px">Changes</h2>${history.map((h) => `<div class="col" style="gap:4px"><div class="row sp xs mut"><span>Version ${h.n}${h.note ? ` · ${esc(h.note)}` : ""}</span><span>${ago(h.at)} ago</span></div>${allocBar(h.weights)}</div>`).join("")}</section>` : "";

  const copyBox = !signedIn
    ? `<section class="card row" style="gap:10px;padding:12px"><span class="grow sm" style="line-height:1.4">Copy this basket at your size, from your own wallet.</span><a class="btn p sm" style="width:auto" href="/signin">${icon("wallet", 14)}Sign in to copy</a></section>`
    : own
      ? `<section class="card col" style="gap:8px;padding:12px"><b class="sm">Your basket</b><div class="grid2"><a class="btn p" href="/b/${id}/edit">Change weights</a>${v.status === "live" ? `<button class="btn" data-act="/api/baskets/${id}/retire" data-confirm="Retire this basket? Nobody new can copy it. People already in it keep what they hold.">Retire</button>` : `<span class="btn" aria-disabled="true">Retired</span>`}</div></section>`
      : mine
        ? ""
        : v.status !== "live"
          ? `<section class="card sm mut" style="padding:12px">This basket is retired, so it can't be copied.</section>`
          : paused
            ? `<section class="card sm" style="padding:12px;line-height:1.4">Guard paused @${esc(v.handle)}: copies are blocked.</section>`
            : `<section class="card col" style="gap:8px;padding:12px" id="copy"><div class="row sp"><b class="sm">Copy this basket</b><span class="xs dim">Your max per copy is ${money(max)}</span></div>
<form data-form action="/api/basket-copy" class="col" style="gap:8px"><input type="hidden" name="basket" value="${id}"><label class="chip camt" style="width:100%"><span>$</span><input name="usd" type="number" inputmode="decimal" min="1" max="${max}" step="any" value="${Math.min(25, max)}" aria-label="Amount in dollars" required style="width:100%"></label>
<p class="xs mut" style="margin:0">${needStop ? "This basket has no stop-loss, and your rules only copy baskets with one. Change that in Settings." : `${v.weights.length} Flash orders from your wallet, one per token${v.stopPct ? `, each with a −${v.stopPct}% stop` : ", with no stop-loss"}. CopyGuard checks @${esc(v.handle)} again right before they're placed.${fee.bps ? ` Fee ${fee.bps / 100}%, and @${esc(v.handle)} gets ${fee.sharePct}% of it.` : ""}`}</p>
<button class="btn p"${needStop ? " disabled" : ""}>${icon("bolt", 14)}Copy with Flash</button></form></section>`;

  const main = `<main class="main" style="gap:10px">${request ? await rebalancePanel(request, v.name) : ""}${mine && value ? copyPanel(mine, value, v.name) : ""}${summary}${copyBox}${makeup}${config}${versions}</main>`;
  const aside = `<section class="card col" style="gap:12px"><div class="row" style="gap:12px"><span class="av w lg">${face(v.handle)}</span><div class="grow"><b style="display:block;font-size:16px">@${esc(v.handle)}</b><span class="sm mut">Launched ${ago(v.at)} ago</span></div></div><a class="btn" href="/u/${esc(v.handle)}">View profile</a></section>${readHtml(read)}<a class="btn" href="${esc(askLink(v))}"><span class="orb" aria-hidden="true" style="width:16px;height:16px"><i></i></span>Ask Chief</a>`;
  const desc = `${v.weights.map((w) => `${w.symbol} ${w.weight}%`).join(", ")}. ${flatPct(v.returnPct)} since launch.`;
  const url = `${process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`}/b/${id}`;
  const img = url.replace(`/b/${id}`, `/og/b/${id}.png`);
  const head = `<meta property="og:title" content="${esc(`${v.name} by @${v.handle} on Tribe`)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">`;
  const share = `<a class="ic" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(`${v.name} by @${v.handle} on Tribe: ${desc}`)}&url=${encodeURIComponent(url)}" aria-label="Share on X">${icon("share", 17, "currentColor", 2)}</a>`;
  return page({ title: v.name, body: `${header(v.name, `@${v.handle} · ${v.weights.length} tokens`, signedIn ? "/baskets" : "/", share)}${split(main, aside, "About this basket")}`, head, split: true, ...(signedIn ? {} : { extraClass: "pub" }) });
}

/** The share image: name, make-up and return. */
export function basketOgSvg(v: BasketView): string {
  const x = (s: string) => esc(s);
  let left = 60;
  const bar = v.weights.map((w, i) => {
    const width = (w.weight / 100) * 1080;
    const r = `<rect x="${left.toFixed(1)}" y="350" width="${Math.max(2, width - 3).toFixed(1)}" height="28" fill="${SLICE[i % SLICE.length]}"/>`;
    left += width;
    return r;
  }).join("");
  const key = v.weights.slice(0, 6).map((w) => `${w.symbol} ${w.weight}%`).join("  ·  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0A0A0A"/>
<text x="60" y="110" fill="#8A8A8A" font-size="30" font-family="sans-serif">Basket by @${x(v.handle)}</text>
<text x="60" y="200" fill="#F5F5F5" font-size="68" font-weight="700" font-family="sans-serif">${x(v.name)}</text>
<text x="60" y="300" fill="${v.returnPct >= 0 ? "#34D399" : "#F87171"}" font-size="60" font-weight="700" font-family="sans-serif">${x(pct(v.returnPct))} since launch</text>
${bar}<text x="60" y="430" fill="#D4D4D4" font-size="30" font-family="sans-serif">${x(key)}</text>
<text x="60" y="570" fill="#8A8A8A" font-size="26" font-family="sans-serif">Copy it on Tribe · guarded onchain by Chainlink CRE · powered by Flash</text></svg>`;
}

/** Everything about baskets for one person: what needs a decision, what they hold, what they built, what's doing well. */
export async function basketsPage(uid: number): Promise<string> {
  const copies = await copiesOf(uid);
  const requests = await Promise.all(copies.filter((c) => c.request).map((c) => rebalancePanel(c.request!, c.basket.name)));
  const mine = await basketsBy(uid);
  const board = (await basketBoard(20)).filter((v) => v.owner !== uid);
  const holding = copies.map(({ copy, basket, value }) => `<a class="card col" href="/b/${basket.id}#yours" style="gap:6px;padding:12px;color:#F5F5F5"><div class="row sp" style="gap:10px"><span class="grow" style="min-width:0"><b class="md">${esc(basket.name)}</b><span class="xs mut" style="display:block">${money(copy.usd)} in · ${value.holdings.length} tokens${copy.status === "partial" ? " · <span class='warn'>partly filled</span>" : ""}</span></span><span style="text-align:right"><b>${money(value.value)}</b><span class="xs ${flatCls(value.pnlPct)}" style="display:block">${flatPct(value.pnlPct)}</span></span></div></a>`).join("");
  const body = `${header("Baskets", "Copy a set of tokens with one tap", "/feed", `<a class="ic" href="/baskets/new" aria-label="New basket">${icon("plus", 18, "currentColor", 2)}</a>`)}
<main class="main" style="gap:12px">${requests.join("")}
${holding ? `<section class="col" style="gap:8px"><h2 style="font-size:16px">You copy</h2>${holding}</section>` : ""}
${mine.length ? `<section class="col" style="gap:8px"><h2 style="font-size:16px">You built</h2>${mine.map(basketRow).join("")}</section>` : `<section class="flat col" style="gap:8px"><b class="md">Build your own basket</b><span class="sm mut">Pick up to ${MAX_TOKENS} tokens, set their weights and a stop. Anyone can copy it, and you earn a share of the fee.</span><a class="btn p" href="/baskets/new">New basket</a></section>`}
<section class="col" style="gap:8px"><h2 style="font-size:16px">Top baskets</h2>${board.map(basketRow).join("") || `<div class="sm mut">No baskets yet. Be first.</div>`}</section>
<a class="sm" href="/signals">Trader signals ›</a></main>`;
  return page({ title: "Baskets", nav: "baskets", body });
}

/** The portfolio's basket section. */
export async function basketHoldingsHtml(uid: number): Promise<string> {
  const copies = await copiesOf(uid);
  if (!copies.length) return `<div class="sm mut" style="padding:8px 0">No baskets yet. <a href="/baskets">Find one to copy</a>.</div>`;
  return copies.map(({ copy, basket, value, request }) => `<a class="line" href="/b/${basket.id}#yours" style="color:#F5F5F5"><span class="grow" style="min-width:0"><b class="sm">${esc(basket.name)}</b><span class="xs mut" style="display:block">${money(copy.usd)} in${request ? " · <span class='warn'>rebalance waiting</span>" : ""}${copy.status === "partial" ? " · <span class='warn'>partly filled</span>" : ""}</span></span><span style="text-align:right"><b class="sm">${money(value.value)}</b><span class="xs ${flatCls(value.pnlPct)}" style="display:block">${flatPct(value.pnlPct)}</span></span></a>`).join("");
}

/** Build a basket, or change an existing one's weights (name, stop and target stay what copiers signed up to). */
export async function basketBuilderPage(uid: number, id?: number): Promise<string> {
  const b = id !== undefined ? basketById(id) : undefined;
  if (id !== undefined && (!b || b.owner !== uid)) return notFound("Basket not found");
  const start: Weight[] = b ? versionOf(b.id).weights : [];
  const chip = (name: string, vals: [number, string][], cur: number) => `<div class="chips" role="radiogroup" aria-label="${name}">${vals.map(([v, l]) => `<button type="button" class="chip${v === cur ? " on" : ""}" data-pick data-name="${name}" data-val="${v}" role="radio" aria-checked="${v === cur}">${l}</button>`).join("")}</div><input type="hidden" name="${name}" value="${cur}">`;
  const fields = b
    ? `<section class="col tkf"><b class="md">What changed, and why</b><textarea id="bk-note" rows="2" maxlength="200" class="tkta" placeholder="Copiers see this on their rebalance request"></textarea></section>`
    : `<section class="col tkf"><b class="md">Name</b><input class="f" id="bk-name" maxlength="40" placeholder="Base Blue Chips" autocomplete="off" aria-label="Basket name"></section>
<section class="col tkf"><div class="row sp"><b class="md">Why</b><span class="xs mut">Optional</span></div><textarea id="bk-thesis" rows="2" maxlength="200" class="tkta" placeholder="One line on the idea: copiers see it on the card"></textarea></section>
<section class="col tkf"><div class="row sp"><b class="md">Stop per token</b><span class="xs mut">Sells a token if it falls this far</span></div>${chip("stop", [[0, "None"], [5, "−5%"], [10, "−10%"], [15, "−15%"], [25, "−25%"]], 10)}</section>
<section class="col tkf"><div class="row sp"><b class="md">Target per token</b><span class="xs mut">Takes profit at this gain</span></div>${chip("tp", [[0, "None"], [20, "+20%"], [50, "+50%"], [100, "+100%"]], 0)}</section>`;
  const body = `${header(b ? `Change ${b.name}` : "New basket", b ? "Copiers approve before anything moves" : "Pick tokens, set weights, publish", b ? `/b/${b.id}` : "/baskets")}
<main class="main tkmain" data-scope id="bk"><section class="card col" style="gap:14px">
<section class="col tkf"><div class="row sp"><b class="md">Tokens</b><button type="button" class="chip" id="bk-even">Split evenly</button></div>
<div id="bk-rows" class="col" style="gap:6px"></div>
<button type="button" class="tkpick" id="bk-add" aria-expanded="false" aria-controls="bk-list">${icon("plus", 15, "currentColor", 2)}<span class="grow">Add a token</span><span class="xs mut">Up to ${MAX_TOKENS}</span></button>
<div class="tklist" id="bk-list" hidden><input class="f" id="bk-q" placeholder="Search tokens on Base" autocomplete="off" aria-label="Search tokens"><div id="bk-res" class="col" style="gap:4px" role="listbox" aria-label="Tokens"></div></div>
<div class="alloc" id="bk-bar" aria-hidden="true"></div>
<div class="row sp sm"><span class="mut">Total</span><b id="bk-total" aria-live="polite">0%</b></div></section>
${fields}
<button class="btn p" id="bk-go" disabled>${icon("bolt", 15, "currentColor", 2.2)}${b ? "Publish new weights" : "Publish basket"}</button>
<p class="xs mut" style="margin:0">${b ? "Your basket's record carries on from today's value." : "A published version can't be edited. New weights make a new version, and copiers approve the change."}</p></section></main>
<script>${BUILDER_JS(start, b?.id)}</script>`;
  return page({ title: b ? `Change ${b.name}` : "New basket", body });
}

const BUILDER_JS = (start: Weight[], id?: number) => `(function(){var rows=${JSON.stringify(start.map((w) => ({ token: w.token, symbol: w.symbol, weight: w.weight }))).replace(/</g, "\\u003c")},editing=${id ?? "null"},MAX=${MAX_TOKENS},COL=${JSON.stringify(SLICE)};
var box=document.getElementById('bk-rows'),bar=document.getElementById('bk-bar'),tot=document.getElementById('bk-total'),go=document.getElementById('bk-go'),add=document.getElementById('bk-add'),list=document.getElementById('bk-list'),q=document.getElementById('bk-q'),res=document.getElementById('bk-res'),tm;
function e(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function total(){return Math.round(rows.reduce(function(a,r){return a+(Number(r.weight)||0)},0)*100)/100}
function sum(){var t=total(),ok=rows.length>=2&&Math.abs(t-100)<=0.01&&rows.every(function(r){return Number(r.weight)>=1});tot.textContent=t+'%';tot.className=ok?'up':(t>100?'down':'');go.disabled=!ok;
 bar.innerHTML=rows.map(function(r,i){return '<i style="width:'+Math.min(100,Number(r.weight)||0)+'%;background:'+COL[i%COL.length]+'"></i>'}).join('')}
function draw(){box.innerHTML='';rows.forEach(function(r,i){var d=document.createElement('div');d.className='row';d.style.gap='8px';
 d.innerHTML='<i aria-hidden="true" style="width:10px;height:10px;border-radius:3px;flex:none;background:'+COL[i%COL.length]+'"></i><b class="grow sm">'+e(r.symbol)+'</b><label class="chip cust" style="width:92px;height:36px"><input type="number" inputmode="decimal" min="1" max="100" step="any" aria-label="'+e(r.symbol)+' weight in percent" value="'+e(r.weight)+'" style="width:100%"><span>%</span></label><button type="button" class="ic s" aria-label="Remove '+e(r.symbol)+'">\\u00d7</button>';
 d.querySelector('input').oninput=function(){r.weight=this.value;sum()};d.querySelector('button').onclick=function(){rows.splice(i,1);draw()};box.appendChild(d)});add.hidden=rows.length>=MAX;if(rows.length>=MAX)list.hidden=true;sum()}
function even(){var n=rows.length;if(!n)return;var w=Math.floor(10000/n)/100;rows.forEach(function(r){r.weight=w});rows[n-1].weight=Math.round((100-w*(n-1))*100)/100;draw()}
document.getElementById('bk-even').onclick=even;
function row(t){var b=document.createElement('button');b.type='button';b.className='tkrow'+(t.ok?'':' off');b.setAttribute('role','option');b.disabled=!t.ok;var taken=rows.some(function(r){return r.token===t.address.toLowerCase()});if(taken)b.disabled=true;
 b.innerHTML='<span class="tkimg">'+(t.image?'<img src="'+e(t.image)+'" alt="">':e(t.symbol.slice(0,1)))+'</span><span class="grow"><b>'+e(t.symbol)+'</b><span class="xs mut" style="display:block">'+e(taken?'Already in the basket':t.ok?t.name:t.why)+'</span></span>';
 if(t.ok&&!taken)b.onclick=function(){rows.push({token:t.address.toLowerCase(),symbol:t.symbol,weight:0});list.hidden=true;add.setAttribute('aria-expanded','false');even()};return b}
function load(term){res.innerHTML='<div class="sm mut" style="padding:8px">Loading\\u2026</div>';fetch('/api/tokens?q='+encodeURIComponent(term)).then(function(r){return r.json()}).then(function(j){res.innerHTML='';if(j.error){res.innerHTML='<div class="sm warn" style="padding:8px">'+e(j.error)+'</div>';return}if(!j.tokens.length){res.innerHTML='<div class="sm mut" style="padding:8px">No tokens found on Base.</div>';return}j.tokens.forEach(function(t){res.appendChild(row(t))})}).catch(function(){res.innerHTML='<div class="sm warn" style="padding:8px">Network error</div>'})}
add.onclick=function(){var open=list.hidden;list.hidden=!open;add.setAttribute('aria-expanded',open?'true':'false');if(open){q.value='';load('');q.focus()}};
q.oninput=function(){clearTimeout(tm);tm=setTimeout(function(){load(q.value.trim())},300)};
function val(i){var el=document.getElementById(i);return el?el.value:''}
function pick(n){var i=document.querySelector('#bk input[name="'+n+'"]');return i?Number(i.value):0}
go.onclick=function(){go.disabled=true;var w=rows.map(function(r){return {token:r.token,weight:Number(r.weight)}});
 var url=editing?'/api/baskets/'+editing+'/weights':'/api/baskets',body=editing?{weights:w,note:val('bk-note')}:{name:val('bk-name'),thesis:val('bk-thesis'),stopPct:pick('stop'),tpPct:pick('tp'),weights:w};
 fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(j){if(j.error){tribe.toast(j.error);sum();return}if(j.toast)tribe.toast(j.toast);location.href=j.redirect}).catch(function(){tribe.toast('Network error');sum()})};
draw()})()`;
