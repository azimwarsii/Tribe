import { cardsOf, type CardRow, type CardView } from "../cards.js";
import { cardChainOn } from "../card-chain.js";
import type { Tier } from "../card-tiers.js";
import { pct } from "../data.js";
import { esc, header, icon, page, split, stat } from "../ui.js";
import { cardPng, renderPng, whenText } from "./card.js";

/**
 * Sharing a Tribe Trading Card: its public page at /card/<id>, plus the two images that travel with it. A card link is open
 * to anyone. Nothing here shows a dollar amount, and a Copy card doesn't say who holds it, though every card names its trade's
 * creator. A practice card always says so, in the caption and on the images, because its return comes from simulated fills.
 */

const SITE = () => process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;
const TIER_NAME: Record<Tier, string> = { base: "Base", glitter: "Glitter", holo: "Holo" };
const ACCENT: Record<Tier, string> = { base: "#C4C8CE", glitter: "#F1E3B8", holo: "#8DFFCF" };
const GLOW: Record<Tier, string> = { base: "#2B2E34", glitter: "#3A3160", holo: "#14424A" };
const LOSS = "#F87171";
const DISPLAY = `'Space Grotesk'`, SANS = "Inter";

const returnLabel = (v: CardView) => (v.kind === "original" ? "since launch" : "on this copy");

/** What a post says. The holder speaks for themselves; anyone else re-sharing the link gets the neutral version. */
export function cardCaption(v: CardView, mine: boolean): string {
  return `${mine ? "My" : "A"} ${TIER_NAME[v.tier]} ${v.onchain ? "NFT " : ""}card for ${v.name} on Tribe: ${pct(v.returnPct, 1)} ${returnLabel(v)}${v.practice ? ", in practice mode" : ""}.`;
}

const cardImage = (v: CardView, x: number, y: number, w: number, h: number) =>
  `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${cardPng(v).toString("base64")}"/>`;
const backdrop = (v: CardView, w: number, h: number) =>
  `<defs><radialGradient id="g" cx="0.72" cy="0.4" r="0.8"><stop offset="0" stop-color="${GLOW[v.tier]}"/><stop offset="1" stop-color="#0A0A0A"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>`;
const logo = (x: number, y: number, size: number) =>
  `<text x="${x}" y="${y}" fill="#F5F5F5" font-size="${size}" font-family="${SANS}" font-weight="700">tribe<tspan fill="#34D399">.</tspan></text>`;
/** A name's font size, so a long one still fits: a rough width, erring wide. */
const nameSize = (name: string, width: number, max: number) => Math.min(max, Math.floor(width / (Math.max([...name].length, 1) * 0.6)));
const statusText = (v: CardView) => [v.onchain ? "Minted NFT" : "", v.practice ? "Practice mode" : ""].filter(Boolean).join(" · ");

/** The link preview: 1200x630, which X, Telegram and the rest show whole. A tall card alone would be cropped. */
export function cardPostPng(v: CardView): Buffer {
  const colour = v.returnPct >= 0 ? ACCENT[v.tier] : LOSS;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${backdrop(v, 1200, 630)}
${logo(60, 100, 46)}
<text x="60" y="210" fill="${ACCENT[v.tier]}" font-size="30" font-family="${SANS}" font-weight="600">${esc(`${TIER_NAME[v.tier]} · ${v.editionLabel}`)}</text>
<text x="60" y="285" fill="#F5F5F5" font-size="${nameSize(v.name, 660, 62)}" font-family="${DISPLAY}" font-weight="700">${esc(v.name)}</text>
<text x="60" y="415" fill="${colour}" font-size="112" font-family="${SANS}" font-weight="700">${esc(pct(v.returnPct, 1))}</text>
<text x="60" y="465" fill="#A3A3A3" font-size="30" font-family="${SANS}">${esc(returnLabel(v))}</text>
<text x="60" y="520" fill="#C4C4C4" font-size="26" font-family="${SANS}" font-weight="600">${esc(statusText(v))}</text>
<text x="60" y="580" fill="#8A8A8A" font-size="26" font-family="${SANS}">Copy it on Tribe · powered by Flash</text>
${cardImage(v, 760, 25, 414, 580)}</svg>`;
  return renderPng(svg, 1200);
}

/** The 9:16 image for Instagram and TikTok, which take a picture rather than a link. Stories cover the top and bottom edges. */
export function cardStoryPng(v: CardView): Buffer {
  const colour = v.returnPct >= 0 ? ACCENT[v.tier] : LOSS;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">${backdrop(v, 1080, 1920)}
${logo(90, 200, 64)}
<text x="990" y="196" text-anchor="end" fill="${ACCENT[v.tier]}" font-size="38" font-family="${SANS}" font-weight="600">${esc(TIER_NAME[v.tier])}</text>
${cardImage(v, 140, 260, 800, 1120)}
<text x="540" y="1520" text-anchor="middle" fill="${colour}" font-size="118" font-family="${SANS}" font-weight="700">${esc(pct(v.returnPct, 1))}</text>
<text x="540" y="1578" text-anchor="middle" fill="#A3A3A3" font-size="36" font-family="${SANS}">${esc([returnLabel(v), statusText(v)].filter(Boolean).join(" · "))}</text>
<rect x="240" y="1620" width="600" height="96" rx="48" fill="#34D399"/><text x="540" y="1684" text-anchor="middle" fill="#052E1C" font-size="38" font-family="${SANS}" font-weight="700">Copy it on Tribe</text></svg>`;
  return renderPng(svg, 1080);
}

const TIER_RANK: Record<Tier, number> = { base: 0, glitter: 1, holo: 2 };
/** The card someone would most want to show: highest tier first, then minted, then newest. */
export function bestCard(uid: number) {
  return [...cardsOf(uid)].sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || Number(!!b.chain_tx) - Number(!!a.chain_tx) || b.id - a.id)[0];
}

const mintStatus = (v: CardView) =>
  v.onchain
    ? `<a class="pill ok" href="${esc(v.onchain)}" target="_blank" rel="noopener">${icon("shieldok", 12, "currentColor", 2)}Minted on Base Sepolia ↗</a>`
    : `<span class="pill">${cardChainOn() ? "Minting…" : "Not minted yet"}</span>`;

/** The share screen: the card first, then one tap to each app. Anyone with the link sees it and can pass it on. */
export function cardPage(row: CardRow, v: CardView, viewer: number | undefined): string {
  const signedIn = viewer !== undefined;
  const mine = viewer === row.owner;
  const url = `${SITE()}/card/${v.id}`;
  const post = `${SITE()}/og/card/${v.id}.png`;
  const text = cardCaption(v, mine);
  const q = encodeURIComponent, x = `https://x.com/intent/post?text=${q(text)}&url=${q(url)}`;
  const app = (label: string, href: string) => `<a class="btn sm" target="_blank" rel="noopener" href="${esc(href)}">${label}</a>`;
  const title = `${v.name} · ${v.editionLabel}`;
  // These sit in the main column because phones don't show the side panel: a visitor's reason to be here is the copy button.
  const trade = `<a class="btn${mine ? "" : " p big"}" href="/b/${v.basket}">${mine ? "See the trade" : "Copy this trade"}</a>`;
  const others = mine ? cardsOf(row.owner).filter((c) => c.id !== row.id).slice(0, 6) : [];
  const more = others.length
    ? `<section class="card col" style="gap:10px"><b class="md">Share another card</b><div class="cpick">${others.map((c) => `<a href="/card/${c.id}" aria-label="Share card ${c.id}"><img src="/card/${c.id}.svg" alt="" width="360" height="504" loading="lazy"></a>`).join("")}</div></section>`
    : "";

  const main = `<main class="main" style="gap:14px"><div class="cstage"><img src="/card/${v.id}.svg" alt="${esc(`Tribe Trading Card for ${v.name}`)}" width="360" height="504"></div>
<div class="row" style="gap:8px;justify-content:center;flex-wrap:wrap"><span class="pill">${esc(TIER_NAME[v.tier])}</span>${mintStatus(v)}${v.practice ? `<span class="pill">Practice</span>` : ""}</div>
${mine ? "" : trade}<section class="col" style="gap:8px" aria-label="Share this card"><a class="btn${mine ? " p" : ""} big" id="card-share" target="_blank" rel="noopener" href="${esc(x)}">${icon("share", 16, "currentColor", 2)}<span id="card-share-t">Share on X</span></a>
<div class="grid2" style="gap:6px">${app("Telegram", `https://t.me/share/url?url=${q(url)}&text=${q(text)}`)}${app("WhatsApp", `https://wa.me/?text=${q(`${text} ${url}`)}`)}${app("Farcaster", `https://farcaster.xyz/~/compose?text=${q(text)}&embeds%5B%5D=${q(url)}`)}${app("LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${q(url)}`)}<a class="btn sm" id="card-story" href="/og/card/${v.id}.png?f=story" download="tribe-card-${v.id}-story.png">Instagram / TikTok</a><a class="btn sm" href="/og/card/${v.id}.png" download="tribe-card-${v.id}.png">Save image</a></div>
<button class="btn sm" data-copy="${esc(url)}">${icon("copy", 14, "currentColor", 2)}Copy link</button></section>
${mine ? `<p class="note" style="margin:0;text-align:center">${v.kind === "copy" ? "The link shows the card and its return, not your name or how much you put in." : "The link shows the card, its return and your username, not how much you put in."}</p>${trade}${more}` : ""}</main>
<script>(function(){var T=${JSON.stringify(`${text} ${url}`).replace(/</g, "\\u003c")};
if(!navigator.canShare||!matchMedia('(pointer:coarse)').matches)return;
// Fetched ahead of the tap: a phone only opens its share menu straight after one.
document.getElementById('card-share-t').textContent='Share card';
function wire(id,src,name){var a=document.getElementById(id),f;fetch(src).then(function(r){return r.blob()}).then(function(b){f=new File([b],name,{type:'image/png'});if(!navigator.canShare({files:[f]}))f=null}).catch(function(){});
a.addEventListener('click',function(e){if(!f)return;e.preventDefault();navigator.share({files:[f],text:T}).catch(function(){})})}
wire('card-share','/og/card/${v.id}.png','tribe-card.png');wire('card-story','/og/card/${v.id}.png?f=story','tribe-card-story.png')})()</script>`;

  const aside = `<section class="card col" style="gap:12px"><div class="grid2">${stat("Return", pct(v.returnPct, 1))}${stat("Copiers", String(v.copiers))}${stat("Edition", v.editionLabel)}${stat("Started", whenText(v.days))}</div>
${v.progress.next ? `<div class="sm mut">Next: ${esc(TIER_NAME[v.progress.next])}. ${esc(v.progress.detail)}</div>` : `<div class="sm mut">Top tier reached.</div>`}</section>`;

  const head = `<meta property="og:title" content="${esc(`${title} on Tribe`)}"><meta property="og:description" content="${esc(cardCaption(v, false))}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(post)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(post)}">`;
  return page({ title, body: `${header(mine ? "Share your card" : "Tribe Trading Card", title, signedIn ? "/trades" : "/")}${split(main, aside, "About this card")}`, head, split: true, ...(signedIn ? {} : { extraClass: "pub" }) });
}
