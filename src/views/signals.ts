import { followCount, getUser, isWatching, watchersCount } from "../db.js";
import { ago, face, money, pct } from "../data.js";
import { getPrice } from "../prices.js";
import { TOKENS } from "../parse.js";
import { callerRecord, HORIZONS, signalComments, signals, topCallers, type Signal } from "../signals.js";
import { greenDays, traderStats } from "../stats.js";
import { creatorEarnings } from "./me.js";
import { esc, icon, page, sheet, signCls, split } from "../ui.js";
import { reactBar } from "./reactions.js";

/**
 * Signals (where the leaderboard used to be): traders post calls and show off their record, people follow the callers
 * who hit, copy them with Flash, and the callers earn a share of the fees on every copy.
 */

export type SignalTab = "live" | "mine";
export const signalTab = (t: unknown): SignalTab => (t === "mine" ? t : "live");

const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const BASE_URL = () => process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;
export const signalUrl = (id: number) => `${BASE_URL()}/signal/${id}`;

/** The post that goes out with a shared call: what was called and, once scored, how it went. */
function shareText(sig: Signal): string {
  const up = (sig.target / sig.entry - 1) * 100, rr = (sig.target - sig.entry) / (sig.entry - sig.stop);
  if (sig.status === "hit") return `@${sig.handle} called it: ${sig.symbol} long from ${usd0(sig.entry)} hit the ${usd0(sig.target)} target (+${up.toFixed(1)}%). Every call on Tribe is scored live.`;
  if (sig.status === "stopped") return `@${sig.handle}'s ${sig.symbol} call from ${usd0(sig.entry)} got stopped at ${usd0(sig.stop)}. Every call on Tribe is scored live, wins and losses.`;
  if (sig.status === "expired") return `@${sig.handle}'s ${sig.symbol} call from ${usd0(sig.entry)} ran out of time (${pct(sig.resultPct)}). Every call on Tribe is scored live.`;
  return `@${sig.handle} on Tribe: long ${sig.symbol} from ${usd0(sig.entry)}, target ${usd0(sig.target)}, stop ${usd0(sig.stop)} (risks 1 to make ${rr.toFixed(1)}). Scored live. Follow for their calls:`;
}

/** Where a call can be shared, with the link and text filled in. */
const PLATFORMS: [string, string, string, (url: string, text: string) => string][] = [
  ["X", "#F5F5F5", "𝕏", (u, t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}`],
  ["Telegram", "#229ED9", "tg", (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`],
  ["WhatsApp", "#25D366", "W", (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`],
  ["LinkedIn", "#0A66C2", "in", (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`],
  ["Farcaster", "#855DCD", "F", (u, t) => `https://warpcast.com/~/compose?text=${encodeURIComponent(t)}&embeds[]=${encodeURIComponent(u)}`],
  ["Reddit", "#FF4500", "r", (u, t) => `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`],
];
const platGlyph = (color: string, mark: string) => `<span class="shic" style="background:${color};color:${color === "#F5F5F5" ? "#0A0A0A" : "#fff"}">${mark === "tg" ? icon("tg", 14, "currentColor", 2) : mark}</span>`;
/** Share buttons for one call (the public page renders them directly; the app fills the share sheet from the card). */
export const shareRow = (sig: Signal) =>
  `<div class="sharegrid">${PLATFORMS.map(([name, color, mark, href]) => `<a class="shbtn" href="${esc(href(signalUrl(sig.id), shareText(sig)))}" target="_blank" rel="noopener">${platGlyph(color, mark)}${name}</a>`).join("")}<button type="button" class="shbtn" data-copylink="${esc(signalUrl(sig.id))}">${platGlyph("#262626", "⧉")}Copy link</button></div>`;
const STATUS: Record<Signal["status"], [string, string]> = { live: ["Live", "ok"], hit: ["Target hit", "ok"], stopped: ["Stopped out", "bad"], expired: ["Expired", ""] };

/** A caller's showcase: their call record, followers and copiers, streak, and badges. */
async function showcase(author: number) {
  const s = await traderStats(author);
  const rec = callerRecord(author);
  return { s, rec, followers: watchersCount(author), copiers: followCount(author), streak: greenDays(author) };
}

/** One call. On the public share page (pub) there is no share sheet, and signed-out visitors get "join and follow" instead of the buttons. */
async function signalCard(sig: Signal, viewer?: number, pub = false): Promise<string> {
  const { s, rec, followers, copiers, streak } = await showcase(sig.author);
  const own = sig.author === viewer;
  const watching = viewer !== undefined && isWatching(viewer, sig.author);
  const comments = signalComments(sig.id);
  const [label, tone] = STATUS[sig.status];
  const up = (sig.target / sig.entry - 1) * 100, down = (1 - sig.stop / sig.entry) * 100;
  const rr = Math.round((up / down) * 10) / 10;
  const flat = Math.abs(sig.resultPct) < 0.05;
  const at = (p: number) => Math.max(0, Math.min(100, ((p - sig.stop) / (sig.target - sig.stop)) * 100));
  const ach = [
    rec.closed ? `<span class="ach">${icon("target", 11, "currentColor", 2.2)}${rec.hits}/${rec.closed} calls hit</span>` : `<span class="ach">${icon("target", 11, "currentColor", 2.2)}First calls</span>`,
    streak >= 2 ? `<span class="ach hot">${icon("flame", 11, "currentColor", 2.2)}${streak}-day streak</span>` : "",
    ...s.badges.slice(0, 2).map((b) => `<span class="ach">${icon(b.icon, 11, "currentColor", 2.2)}${esc(b.label)}</span>`),
  ].filter(Boolean).join("");
  const ask = `/cat/chat?new=1&q=${encodeURIComponent(`Is @${sig.handle} a good trader to copy? They called ${sig.symbol} long from $${Math.round(sig.entry)} to $${Math.round(sig.target)}, stop $${Math.round(sig.stop)}.`)}`;
  return `<article class="card sig${sig.status === "live" ? "" : " done"}">
<div class="row"><a href="/u/${esc(sig.handle)}" class="lvl"><span class="av w">${face(sig.handle)}</span><b>${s.level}</b></a><div class="grow" style="min-width:0"><a href="/u/${esc(sig.handle)}" style="color:#F5F5F5;font-weight:600">@${esc(sig.handle)}</a><div class="xs mut">${followers} follower${followers === 1 ? "" : "s"} · ${copiers} copier${copiers === 1 ? "" : "s"} · ${ago(sig.at)} ago</div></div><span class="pill ${tone}">${sig.status === "live" ? '<span class="live" aria-hidden="true"></span>' : ""}${label}</span>${viewer !== undefined && !pub ? `<button type="button" class="ic s" data-open="share-signal" data-share-id="${sig.id}" data-share-url="${esc(signalUrl(sig.id))}" data-share-text="${esc(shareText(sig))}" aria-label="Share @${esc(sig.handle)}'s call">${icon("share", 15, "currentColor", 2)}</button>` : ""}</div>
<div class="achs">${ach}</div>
<div class="row sp" style="align-items:flex-end"><div><div class="mut sm">Long · ${esc(HORIZONS[sig.horizon].label)}</div><div style="font-size:28px;font-weight:700;letter-spacing:-.02em">${esc(sig.symbol)}</div></div><div style="text-align:right"><div class="${flat ? "mut" : signCls(sig.resultPct)}" style="font-size:22px;font-weight:600">${flat ? "flat" : pct(sig.resultPct)}</div><div class="xs mut">${sig.status === "live" ? "since the call" : "result"}</div></div></div>
<div class="sigbar" role="img" aria-label="Stop ${usd0(sig.stop)}, entry ${usd0(sig.entry)}, target ${usd0(sig.target)}, price ${usd0(sig.price)}"><div class="track"><i style="width:${sig.progress.toFixed(1)}%"></i><b class="entry" style="left:${at(sig.entry).toFixed(1)}%"></b><b class="now ${sig.price >= sig.entry ? "" : "down"}" style="left:${sig.progress.toFixed(1)}%"></b></div>
<div class="row sp xs" style="margin-top:6px"><span class="down">Stop ${usd0(sig.stop)} (−${down.toFixed(1)}%)</span><span class="mut">Entry ${usd0(sig.entry)}</span><span class="up">Target ${usd0(sig.target)} (+${up.toFixed(1)}%)</span></div></div>
${viewer !== undefined && !pub ? `<template class="sharetpl">${shareRow(sig)}</template>` : ""}
<p class="md" style="margin:0;line-height:1.45;color:#D4D4D4">“${esc(sig.note)}”</p>
<div class="xs mut">Risks 1 to make ${rr.toFixed(1)}${sig.status === "live" ? ` · now ${usd0(sig.price)}` : ` · closed ${usd0(sig.price)}`}</div>
<div class="row sigsoc">${reactBar(sig.id, viewer, "signal")}<button type="button" class="chip" data-cmtoggle="${sig.id}" aria-expanded="false" aria-controls="cm-${sig.id}">${icon("chat", 14, "currentColor", 2)}<span data-cmcount>${comments.length || ""}</span><span class="cml">${comments.length === 0 ? "Comment" : comments.length === 1 ? "comment" : "comments"}</span></button></div>
<section class="sigcm" id="cm-${sig.id}" hidden aria-label="Comments on @${esc(sig.handle)}'s call"><div class="cmlist">${comments.map(signalCommentHtml).join("") || `<p class="xs mut cmempty" style="margin:0">No comments yet. Start the conversation.</p>`}</div>
${viewer !== undefined ? `<form class="cmform" data-signal="${sig.id}"><input name="text" maxlength="280" placeholder="Add a comment…" autocomplete="off" aria-label="Your comment"><button class="btn sm p" type="submit">Post</button></form>` : `<a class="sm" href="/signin">Sign in to comment</a>`}</section>
${viewer === undefined ? `<div class="grid2"><a class="btn p" href="/onboarding?follow=${esc(sig.handle)}">${icon("bolt", 14)}Join and follow @${esc(sig.handle)}</a><a class="btn" href="/signin">I have an account</a></div>`
    : own ? `<div class="sm mut row" style="gap:6px">${icon("star", 13, "currentColor", 2)}Your call. Share it: hits win you followers, and their copies earn you fees.</div>`
    : `<div class="sigact"><button class="btn sm${watching ? "" : " p"}" data-act="/api/watch" data-body='{"leader":"${esc(sig.handle)}"}' aria-pressed="${watching}">${watching ? "Following" : `+ Follow @${esc(sig.handle)}`}</button><a class="btn sm" href="${ask}" aria-label="Ask Cat about @${esc(sig.handle)}"><span class="orb" aria-hidden="true" style="width:16px;height:16px"><i></i></span>Ask Cat</a></div>`}
</article>`;
}

/** One comment on a call. */
export const signalCommentHtml = (c: { text: string; at: number; handle: string }) =>
  `<div class="cmrow"><a href="/u/${esc(c.handle)}" class="av xs">${face(c.handle)}</a><div class="grow" style="min-width:0"><div class="row" style="gap:6px"><a href="/u/${esc(c.handle)}" class="sm" style="color:#F5F5F5;font-weight:600">@${esc(c.handle)}</a><span class="xs mut">${ago(c.at)}</span></div><div class="sm" style="color:#D4D4D4;line-height:1.4;overflow-wrap:anywhere">${esc(c.text)}</div></div></div>`;

/** Copy link anywhere, and the in-app share sheet: filled from the card's share buttons, plus the phone's own share menu. */
const SHARE_JS = `(function(){
document.addEventListener('click',function(e){var c=e.target.closest('[data-copylink]');if(!c)return;e.preventDefault();var u=c.dataset.copylink;
 (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(function(){tribe.toast('Link copied')},function(){window.prompt('Copy this link',u)})});
document.addEventListener('click',function(e){var b=e.target.closest('[data-share-id]');if(!b)return;var card=b.closest('.sig'),row=document.getElementById('shs-row'),t=document.getElementById('shs-t'),more=document.getElementById('shs-more');
 row.innerHTML=card.querySelector('.sharetpl').innerHTML;t.textContent=b.dataset.shareText;
 more.hidden=!navigator.share;more.onclick=function(){navigator.share({title:'Signal on Tribe',text:b.dataset.shareText,url:b.dataset.shareUrl}).catch(function(){})}});
// Comments: open and close a call's thread, and post into it without leaving the page.
document.addEventListener('click',function(e){var b=e.target.closest('[data-cmtoggle]');if(!b)return;var s=document.getElementById('cm-'+b.dataset.cmtoggle),open=s.hidden;s.hidden=!open;b.setAttribute('aria-expanded',open?'true':'false');b.classList.toggle('open',open);if(open){var i=s.querySelector('input');if(i)i.focus()}});
document.addEventListener('submit',function(e){var f=e.target.closest('.cmform');if(!f)return;e.preventDefault();var i=f.elements.text,t=i.value.trim();if(!t)return;var btn=f.querySelector('button');btn.disabled=true;
 fetch('/api/signal-comment',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({signal:Number(f.dataset.signal),text:t})}).then(function(r){return r.json()}).then(function(j){btn.disabled=false;if(j.error){tribe.toast(j.error);if(j.redirect)location.href=j.redirect;return}
  var list=f.parentElement.querySelector('.cmlist'),em=list.querySelector('.cmempty');if(em)em.remove();list.insertAdjacentHTML('beforeend',j.html);i.value='';
  var tg=document.querySelector('[data-cmtoggle="'+f.dataset.signal+'"]');if(tg){tg.querySelector('[data-cmcount]').textContent=j.count;tg.querySelector('.cml').textContent=j.count===1?'comment':'comments'}}).catch(function(){btn.disabled=false;tribe.toast('Network error')})});
})()`;
const shareSheet = sheet("share-signal", `<div class="row sp"><h2>Share this call</h2><button class="ic s" data-close="share-signal" aria-label="Close">${icon("close", 14, "currentColor", 2.4)}</button></div>
<p class="sm" id="shs-t" style="margin:6px 0 14px;padding:12px;border-radius:12px;background:#141414;color:#D4D4D4;line-height:1.45"></p>
<div id="shs-row"></div><button type="button" class="btn" id="shs-more" style="width:100%;margin-top:10px" hidden>${icon("share", 14, "currentColor", 2)}More apps…</button>
<script>${SHARE_JS}</script>`);

/** Your desk: what your calls have done for you, and the button to post one. */
async function desk(viewer: number) {
  const me = getUser(viewer);
  const rec = callerRecord(viewer);
  const earn = creatorEarnings(viewer);
  const followers = watchersCount(viewer), copiers = followCount(viewer);
  const stat = (v: string, k: string) => `<div><b>${v}</b><span>${k}</span></div>`;
  return `<section class="card col sigdesk" style="gap:12px"><div class="row sp"><div class="row" style="gap:10px"><span class="av sm">${face(me.handle)}</span><div><b>Your signal desk</b><div class="xs mut">${rec.calls ? `${rec.calls} call${rec.calls === 1 ? "" : "s"} · ${rec.live} live` : "Post a call to start your record"}</div></div></div></div>
<div class="grid4 deskstats">${stat(rec.hitRate === null ? "—" : rec.hitRate + "%", "hit rate")}${stat(String(followers), "followers")}${stat(String(copiers), "copiers")}${stat(money(earn.accrued), "earned")}</div>
<button class="btn p" data-open="post-signal">${icon("plus", 15, "currentColor", 2.4)}Post a signal</button></section>`;
}

async function aside(viewer: number) {
  const earn = creatorEarnings(viewer);
  const top = topCallers(5);
  return `${await desk(viewer)}
<section class="flat col" style="gap:10px"><h2 style="font-size:15px">How callers earn</h2>
<ol class="steps"><li><b>Post a call</b><span>Entry, target, stop and why. Cat and everyone see how it plays out.</span></li><li><b>Hits win followers</b><span>Your record shows on every call: calls hit, streak, badges.</span></li><li><b>Followers copy you with Flash</b><span>You earn ${earn.shareBps}% of the Flash fees on every copy of your trades.</span></li></ol></section>
<section class="flat col" style="gap:8px"><div class="row sp"><h2 style="font-size:15px">Top callers</h2><a class="xs" href="/ranks">Leaderboard ›</a></div>
${top.length ? top.map((c, i) => `<a class="caller" href="/u/${esc(c.handle)}"><span class="rank">${i + 1}</span><span class="av sm">${face(c.handle)}</span><span class="grow"><b class="sm">@${esc(c.handle)}</b><span class="xs mut" style="display:block">${c.hits}/${c.closed} calls hit</span></span><b class="${(c.hitRate ?? 0) >= 50 ? "up" : "mut"}">${c.hitRate}%</b></a>`).join("") : `<span class="sm mut">No scored calls yet.</span>`}</section>`;
}

export async function signalsPage(viewer: number, tab: SignalTab = "live"): Promise<string> {
  const list = tab === "mine" ? await signals({ author: viewer }) : await signals({ status: "live" });
  const cards = (await Promise.all(list.map((s) => signalCard(s, viewer)))).join("");
  const empty = tab === "mine" ? `<div class="card col" style="align-items:center;text-align:center;gap:10px;padding:28px"><span class="orb" aria-hidden="true" style="width:48px;height:48px"><i></i></span><b>No calls yet</b><span class="sm mut" style="max-width:300px">Post your first signal. When it hits, people follow you, and when they copy you with Flash you earn.</span><button class="btn p" data-open="post-signal">Post a signal</button></div>`
    : `<div class="card sm mut" style="text-align:center;padding:24px">No live calls right now. Post one.</div>`;
  const tabs = `<nav class="dtabs" aria-label="Signals">${([["live", "Live calls"], ["mine", "Mine"]] as const).map(([k, l]) => `<a href="/signals${k === "live" ? "" : `?tab=${k}`}"${k === tab ? ' class="on" aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
  const body = split(`<main class="main"><header class="hd" style="padding:8px 0 0;justify-content:space-between"><div><h1 class="row" style="font-size:22px;gap:8px">${icon("rise", 20, "currentColor", 2.2)}Signals</h1><div class="sub">Calls from traders, scored by what the price did next</div></div>
<div class="row" style="gap:8px"><a class="ic" href="/ranks" aria-label="Leaderboard">${icon("bars", 18)}</a><button class="btn p sm only-d" data-open="post-signal">${icon("plus", 14, "currentColor", 2.4)}Post a signal</button></div></header>
<div class="only-m">${await desk(viewer)}</div>
${tabs}
<div class="col" style="gap:14px">${cards || empty}</div></main>`, await aside(viewer), "Your signal desk and top callers");
  const mark = await getPrice(TOKENS.ETH).catch(() => 2500);
  const horizons = (Object.keys(HORIZONS) as (keyof typeof HORIZONS)[]).map((k) => `<label class="chip${k === "days" ? " on" : ""}"><input type="radio" name="horizon" value="${k}"${k === "days" ? " checked" : ""} hidden>${HORIZONS[k].label}</label>`).join("");
  const composer = sheet("post-signal", `<div class="row sp"><h2>Post a signal</h2><button class="ic s" data-close="post-signal" aria-label="Close">${icon("close", 14, "currentColor", 2.4)}</button></div>
<p class="sm mut" style="margin:4px 0 12px">A long on ETH (now ${usd0(mark)}). It's scored automatically: target first is a hit, stop first is a miss.</p>
<form id="sigform" class="col" style="gap:12px"><div class="grid3"><label class="fld"><span>Entry</span><input name="entry" type="number" step="1" inputmode="decimal" value="${Math.round(mark)}" required></label><label class="fld"><span>Target</span><input name="target" type="number" step="1" inputmode="decimal" value="${Math.round(mark * 1.05)}" required></label><label class="fld"><span>Stop</span><input name="stop" type="number" step="1" inputmode="decimal" value="${Math.round(mark * 0.97)}" required></label></div>
<div class="xs mut" id="sigrr"></div>
<div><div class="xs mut" style="margin-bottom:6px">Time frame</div><div class="chips" id="sighz">${horizons}</div></div>
<label class="fld"><span>Why (what you see)</span><textarea name="note" rows="3" maxlength="280" placeholder="Range low held three times. Stop under it, target the last high." required></textarea></label>
<button class="btn p" type="submit">${icon("rise", 15, "currentColor", 2.2)}Post signal</button></form>
<script>(function(){var f=document.getElementById('sigform'),rr=document.getElementById('sigrr');
function n(k){return parseFloat(f.elements[k].value)}
function upd(){var e=n('entry'),t=n('target'),s=n('stop');if(!(t>e&&e>s)){rr.textContent='Target above entry, stop below it.';rr.className='xs warn';return}rr.className='xs mut';rr.textContent='+'+((t/e-1)*100).toFixed(1)+'% to target \\u00b7 \\u2212'+((1-s/e)*100).toFixed(1)+'% to stop \\u00b7 risks 1 to make '+((t-e)/(e-s)).toFixed(1)}
f.addEventListener('input',upd);upd();
document.getElementById('sighz').addEventListener('change',function(e){[].forEach.call(this.querySelectorAll('.chip'),function(c){c.classList.toggle('on',c.contains(e.target))})});
f.addEventListener('submit',function(e){e.preventDefault();var b=f.querySelector('[type=submit]');b.disabled=true;
 fetch('/api/signal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entry:n('entry'),target:n('target'),stop:n('stop'),horizon:(f.querySelector('[name=horizon]:checked')||{}).value,note:f.elements.note.value})}).then(function(r){return r.json()}).then(function(j){b.disabled=false;if(j.error){tribe.toast(j.error);return}tribe.toast(j.toast);setTimeout(function(){location.href=j.redirect},500)}).catch(function(){b.disabled=false;tribe.toast('Network error')})})})()</script>`);
  return page({ title: "Signals", nav: "signals", body, sheets: composer + shareSheet, split: true });
}

/**
 * A shared call, open to anyone (the link that goes out to X, Telegram, WhatsApp...): the call scored up to now, the
 * caller's record, and a way in. The preview card on those platforms comes from the Open Graph tags.
 */
export async function publicSignalPage(sig: Signal, viewer?: number): Promise<string> {
  const title = `@${sig.handle}: ${sig.symbol} long ${usd0(sig.entry)} → ${usd0(sig.target)}`;
  const desc = shareText(sig);
  const img = `${BASE_URL()}/og/u/${encodeURIComponent(sig.handle)}.png`;
  const head = `<meta name="description" content="${esc(desc)}"><meta property="og:type" content="article"><meta property="og:url" content="${esc(signalUrl(sig.id))}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(img)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">`;
  const body = `<style>.app.pub{max-width:640px;margin:0 auto}</style><header class="hd" style="justify-content:space-between"><a href="/" style="font-size:22px;font-weight:700;letter-spacing:-.04em;color:#F5F5F5">tribe<span style="color:#34D399">.</span></a>${viewer !== undefined ? `<a class="btn sm" href="/signals">Open Signals</a>` : `<a class="btn sm" href="/signin">Sign in</a>`}</header>
<main class="main" style="gap:16px"><div><h1 style="margin:0;font-size:22px">A call on Tribe</h1><div class="sub">Scored live: target first is a hit, stop first is a miss.</div></div>
${await signalCard(sig, viewer, true)}
<section class="col" style="gap:10px"><h2 style="font-size:15px">Share this call</h2>${shareRow(sig)}</section>
<p class="note">Calls are ideas, not advice. Copying on Tribe places real Flash orders from your own wallet, inside your limits.</p></main>
<script>${SHARE_JS}</script>`;
  return page({ title, body, head, focus: true, extraClass: "pub" });
}
