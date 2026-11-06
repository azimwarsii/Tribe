import { commentsOf, db, isWatching } from "../db.js";
import { ago, face, money, pct, profile, tradeCard, windowPnl } from "../data.js";
import { txUrl } from "../flash.js";
import { esc, header, icon, notFound, page, sheet, signCls, split, stat } from "../ui.js";
import { tradeCardHtml } from "./feed.js";
import { commentHtml } from "./trader.js";

const BASE_URL = () => process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;
export const tradeUrl = (id: number) => `${BASE_URL()}/t/${id}`;

/**
 * One trade's own page at /t/<id>, open to anyone with the link: the trade card, every detail of the order, sharing
 * it, reactions and comments, and the trader's record. Signed out, it reads the same and invites sign-in.
 */
export async function tradePage(id: number, viewer: number | undefined): Promise<string> {
  const c = await tradeCard(id, viewer);
  if (!c) return notFound("Trade not found");
  const signedIn = viewer !== undefined;
  const own = viewer === c.leader;
  const comments = commentsOf(id);
  const copiers = new Set((db.prepare("SELECT follower FROM copies WHERE trade_id = ? AND status IN ('executed','dry-run')").all(id) as unknown as { follower: number }[]).map((r) => r.follower));
  const p = await profile(c.leader);
  const month = windowPnl(c.leader, Date.now() - 30 * 86400e3);
  const side = c.trade.side === "buy" ? "long" : "sell";
  const url = tradeUrl(id);
  const shareText = `@${c.handle}'s ${c.symbol} ${side} on Tribe${c.sincePct !== null ? ` (${pct(c.sincePct)} since entry)` : ""}. Guarded onchain.`;
  const img = `${BASE_URL()}/og/t/${id}.png`;

  // Details as small tiles, three to a row. The card's price ladder already shows entry, stop and target on open
  // longs, so those tiles appear only when it doesn't.
  const ladderShown = c.mark !== null && c.trade.side === "buy";
  const tile = (k: string, v: string, cls = "") => `<div class="tile" style="padding:8px 10px"><div class="k">${k}</div><div class="v ${cls}" style="font-size:14px">${v}</div></div>`;
  const tiles = [
    tile("Size", c.trade.side === "buy" ? money(Number(c.trade.qty)) : `${esc(c.trade.qty)} ${esc(c.symbol)}`),
    !ladderShown && c.entry !== null ? tile("Entry", `$${c.entry.toFixed(2)}`) : "",
    c.mark !== null ? tile("Price now", `$${c.mark.toFixed(2)}`) : "",
    c.sincePct !== null ? tile("Since entry", pct(c.sincePct), signCls(c.sincePct)) : "",
    c.realisedPct !== null ? tile("Realised", pct(c.realisedPct), signCls(c.realisedPct)) : "",
    !ladderShown ? tile("Stop", c.stopPrice !== null ? `$${c.stopPrice.toFixed(2)}` : "None", c.stopPrice !== null ? "down" : "") : "",
    !ladderShown && c.targetPrice !== null ? tile("Target", `$${c.targetPrice.toFixed(2)}`, "up") : "",
    tile("Guard", c.guard === "paused" ? `Paused · ${c.risk}` : `Passed · ${c.risk}`, c.guard === "paused" ? "down" : "up"),
    tile("Copies", `${c.copiers}`),
    tile("Placed", new Date(c.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })),
  ].filter(Boolean).join("");
  const settled = c.tx ? `<a class="xs" href="${txUrl(c.tx)}" target="_blank" rel="noopener">Settlement onchain ↗</a>` : `<span class="xs dim">Simulated fill (practice mode)</span>`;
  const details = `<section aria-label="Trade details" class="col tdetails" style="gap:6px"><div class="grid3" style="gap:6px">${tiles}</div><div class="row">${settled}</div></section>`;

  // A trade is part of the trader's record: what people copy is their baskets. Following them stays free.
  const watching = signedIn && !own && isWatching(viewer!, c.leader);
  const followBtn = `<button class="btn" data-act="/api/watch" data-body='{"leader":"${esc(c.handle)}"}'>${watching ? `${icon("check", 14, "currentColor", 2)}Following` : "Follow"}</button>`;
  const baskets = `<a class="btn p sm" style="width:auto" href="/u/${esc(c.handle)}#baskets">${icon("cards", 14, "currentColor", 2)}Their trades</a>`;
  const copyPanel = !signedIn
    ? `<section class="card row" style="gap:10px;padding:12px" id="copy"><span class="grow sm" style="line-height:1.4">Part of @${esc(c.handle)}'s record. On Tribe you copy trades.</span><a class="btn p sm" style="width:auto" href="/signin">${icon("wallet", 14)}Sign in</a></section>`
    : own
      ? `<section class="card row" style="gap:10px;padding:12px" id="copy"><b class="grow sm">Your trade</b><button type="button" class="btn sm" style="width:auto" onclick="document.getElementById('share-btn').click()">${icon("share", 14, "currentColor", 2)}Share</button></section>`
      : `<section class="card row" style="gap:10px;padding:12px" id="copy"><span class="grow sm" style="line-height:1.4">${c.guard === "paused" ? "Guard paused this trader: copies are blocked." : "Part of their record. On Tribe you copy trades."}</span>${baskets}<div style="width:96px">${followBtn}</div></section>`;

  // Sharing is one small button in the header: on phones and tablets, the device's own share menu (Instagram, WhatsApp,
  // Messages…); on computers, a small panel with the link and the main apps. Links ending in #share open the panel.
  const shareApp = (label: string, href: string) => `<a class="btn sm" target="_blank" rel="noopener" href="${href}">${label}</a>`;
  const shareSheet = sheet("sharesheet", `<div class="row sp" style="margin-bottom:10px"><h2 style="font-size:17px">Share this trade</h2><button class="ic s" data-close="sharesheet" aria-label="Close">${icon("close", 16, "currentColor", 2)}</button></div>
<section class="col" style="gap:8px" aria-label="Share this trade"><div class="row" style="gap:6px;padding:8px 10px;border-radius:12px;background:#0F0F0F;border:1px solid rgba(255,255,255,.06)"><span class="grow sm" style="font-family:ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(url)}</span><button class="btn sm p" style="width:auto" data-copy="${esc(url)}">${icon("copy", 14, "currentColor", 2)}Copy link</button></div>
<div class="grid2" style="gap:6px">${shareApp("X", `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`)}${shareApp("Telegram", `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`)}${shareApp("WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`)}<a class="btn sm" href="${esc(img)}?f=story" download="tribe-trade-${id}.png">Story image</a></div></section>`);
  const shareButton = `<button type="button" class="ic" id="share-btn" aria-label="Share this trade">${icon("share", 18, "currentColor", 2)}</button><button type="button" data-open="sharesheet" id="share-open" hidden></button>
<script>(function(){var b=document.getElementById('share-btn'),o=document.getElementById('share-open');
b.onclick=function(){if(navigator.share&&matchMedia('(pointer:coarse)').matches)navigator.share({title:${JSON.stringify(`@${c.handle} on Tribe`)},text:${JSON.stringify(shareText)},url:${JSON.stringify(url)}}).catch(function(e){if(e&&e.name!=='AbortError')o.click()});else o.click()};
if(location.hash==='#share')setTimeout(function(){o.click()},50)})()</script>`;

  // Comments open in their own panel that scrolls by itself, so the page stays one screen. A bar shows the count,
  // the reactions and the latest comment; links ending in #comments open the panel straight away.
  // The bar's preview cycles through the latest comments (newest first); a comment posted from the panel joins in.
  const recent = comments.slice(-8).reverse().map((m) => `@${m.handle}: ${m.text}`);
  const commentsBar = `<button type="button" class="card cbar" data-open="comments">${icon("chat", 16, "currentColor", 2)}<span class="grow" style="min-width:0"><b class="sm" id="cbar-n" style="display:block">${comments.length ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Comments"}</b><span class="xs mut cbar-line" id="cbar-line">${esc(recent[0] ?? (signedIn ? "No comments yet. Be first." : "No comments yet."))}</span></span>${icon("chev", 14, "#8A8A8A", 2)}</button>
<script>(function(){var list=${JSON.stringify(recent).replace(/</g, "\\u003c")},i=0,el=document.getElementById('cbar-line');
function show(t){el.classList.add('out');setTimeout(function(){el.textContent=t;el.classList.remove('out')},250)}
setInterval(function(){if(list.length<2||document.hidden)return;i=(i+1)%list.length;show(list[i])},3500);
// A comment posted in the panel: newest first in the rotation, and the count goes up. The panel is rendered after
// this script, so it's watched once the page has loaded.
addEventListener('DOMContentLoaded',function(){var cm=document.getElementById('cm');if(cm)new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;var h=n.querySelector('b'),t=n.querySelector('div.md');if(!h||!t)return;list.unshift(h.textContent+': '+t.textContent.trim());i=0;show(list[0]);document.getElementById('cbar-n').textContent=list.length+' comment'+(list.length===1?'':'s')})})}).observe(cm,{childList:true})})})()</script>`;
  const commentsSheet = sheet("comments", `<div class="row sp" style="margin-bottom:8px"><h2 style="font-size:17px">${comments.length} comment${comments.length === 1 ? "" : "s"}</h2><button class="ic s" data-close="comments" aria-label="Close comments">${icon("close", 16, "currentColor", 2)}</button></div>
<div class="clist"><div id="cm" class="col" style="gap:0">${comments.map(commentHtml(copiers)).join("") || '<div class="sm mut" style="padding:8px 0">No comments yet. Be first.</div>'}</div></div>
${signedIn
    ? `<form data-form action="/api/comment" class="row" style="gap:8px"><input type="hidden" name="trade" value="${id}"><input class="f" name="text" maxlength="280" placeholder="Add a comment" aria-label="Add a comment" autocomplete="off" required><button class="btn p" style="width:auto">Post</button></form>`
    : `<a class="btn sm" href="/signin" style="margin-top:10px">Sign in to react and comment</a>`}
<script>(function(){if(location.hash==='#comments'){var b=document.querySelector('[data-open=comments]');if(b)setTimeout(function(){b.click()},50)}})()</script>`).replace('class="sheet"', 'class="sheet csheet"');

  // The card is this page, so it doesn't link to itself; its copy and share buttons are the panels right below it.
  const card = tradeCardHtml(c, viewer, false, true).replace(` data-href="/t/${id}"`, "");
  const main = `<main class="main" style="gap:10px">${card}
${copyPanel}
${details}
${commentsBar}</main>`;

  const aside = `<section class="card col" style="gap:14px"><div class="row" style="gap:12px"><span class="av w lg">${face(c.handle)}</span><div class="grow"><b style="display:block;font-size:16px">@${esc(c.handle)}</b><span class="sm mut">${esc(p.user.persona ?? "Trader")} · Lv ${p.level} · ${p.followers} copier${p.followers === 1 ? "" : "s"}</span></div></div>
<div class="grid3">${stat("30d", pct(month.pct), signCls(month.pct))}${stat("Win rate", p.winRate === null ? "—" : p.winRate + "%")}${stat("Guard", `${p.guardPauses} pause${p.guardPauses === 1 ? "" : "s"}`)}</div>
<a class="btn" href="/u/${esc(c.handle)}">View profile</a></section>
<section class="flat col" style="gap:6px"><h2 style="font-size:16px">${c.copiers} copied this trade</h2><div class="sm mut" style="line-height:1.5">Each copy carries the same stop and target, sized by each follower's own rules. Posted ${ago(c.at)}.</div></section>`;

  const head = `<meta property="og:title" content="${esc(`@${c.handle}: ${c.symbol} ${side} on Tribe`)}"><meta property="og:description" content="${esc(shareText)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">`;
  const back = signedIn ? "/feed" : "/";
  const body = `${header(`${c.symbol} ${side}`, `@${c.handle} · ${ago(c.at)}`, back, shareButton)}${split(main, aside, "About this trader")}`;
  return page({ title: `@${c.handle} · ${c.symbol} ${side}`, body, head, split: true, sheets: commentsSheet + shareSheet, ...(signedIn ? {} : { extraClass: "pub" }) });
}
