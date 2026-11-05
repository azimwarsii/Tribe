import { reactionCounts } from "../db.js";
import { signalReactionCounts } from "../signals.js";

/**
 * Trade reactions, LinkedIn style: one per person per trade, picked from a bar that pops up on hover (long-press on
 * touch). Custom badges, each with its own little animation. A plain tap toggles Fire.
 */
export const REACTIONS: { key: string; label: string; path: string }[] = [
  { key: "fire", label: "Fire", path: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.6 2.4 3C11 9 11 6 12 3z" },
  { key: "rocket", label: "To the moon", path: "M14 4c3-1 5-1 6 0 1 1 1 3 0 6l-6 6-4-4zM10 12l-3 1-2 3 4-1M12 14l-1 3-3 2 1-4M15 9h.01" },
  { key: "diamond", label: "Diamond hands", path: "M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l-1 5 4 11 4-11-1-5" },
  { key: "bull", label: "Bullish", path: "M4 17l5-5 4 3 7-8M15 7h5v5" },
  { key: "bear", label: "Bearish", path: "M4 7l5 5 4-3 7 8M15 17h5v-5" },
  { key: "bulb", label: "Smart call", path: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3z" },
];
const BY = new Map(REACTIONS.map((r) => [r.key, r]));
export const isReaction = (k: string) => BY.has(k);

/** One badge: a coloured circle with the glyph; the class carries its colour and animation. */
export const badge = (key: string, size = 20) => {
  const r = BY.get(key);
  return r ? `<span class="rx rx-${key}" style="--s:${size}px" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${r.path}"/></svg></span>` : "";
};

/** The reaction control on a trade (or a signal): top three badges and the count, with the picker. Re-rendered by POST /api/react. */
export function reactBar(tradeId: number, viewer: number | undefined, kind: "trade" | "signal" = "trade"): string {
  const rows = (kind === "signal" ? signalReactionCounts(tradeId, viewer) : reactionCounts(tradeId, viewer)).filter((r) => BY.has(r.emoji)).sort((a, b) => b.n - a.n);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const mine = rows.find((r) => r.mine)?.emoji;
  const top = rows.slice(0, 3).map((r) => r.emoji);
  const summary = total
    ? `<span class="rxstack">${top.map((k) => badge(k, 18)).join("")}</span><span>${total}</span>`
    : `<span class="rxstack">${badge("fire", 18)}</span><span>React</span>`;
  const label = `${total} reaction${total === 1 ? "" : "s"}${mine ? `, yours: ${BY.get(mine)!.label}` : ""}. Hover or long-press for more`;
  return `<div class="react" data-react="${tradeId}"${kind === "signal" ? ' data-kind="signal"' : ""} data-mine="${mine ?? ""}"><button type="button" class="chip rxbtn${mine ? " mine" : ""}" aria-label="${label}" aria-haspopup="true">${summary}</button>
<div class="rxpick" role="menu" aria-label="Reactions">${REACTIONS.map((r) => `<button type="button" role="menuitemradio" aria-checked="${r.key === mine}" data-rx="${r.key}" aria-label="${r.label}">${badge(r.key, 38)}<b>${r.label}</b></button>`).join("")}</div></div>`;
}

/** Who reacted how, for the thread page: each reaction with its count. */
export function reactBreakdown(tradeId: number): string {
  const rows = reactionCounts(tradeId).filter((r) => BY.has(r.emoji)).sort((a, b) => b.n - a.n);
  return rows.length ? `<div class="row" style="gap:12px;flex-wrap:wrap">${rows.map((r) => `<span class="row sm" style="gap:6px">${badge(r.emoji, 20)}<span class="mut">${BY.get(r.emoji)!.label}</span><b>${r.n}</b></span>`).join("")}</div>` : "";
}

export const REACT_JS = `(function(){
function close(x){document.querySelectorAll('.react.open').forEach(function(r){if(r!==x)r.classList.remove('open')})}
function send(bar,key){var mine=bar.dataset.mine;bar.classList.remove('open');
fetch('/api/react',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify((function(o){o[bar.dataset.kind==='signal'?'signal':'trade']=Number(bar.dataset.react);return o})({emoji:key===mine?'':key}))}).then(function(r){return r.json()}).then(function(j){
if(j.error){tribe.toast(j.error);if(j.redirect)location.href=j.redirect;return}var t=document.createElement('div');t.innerHTML=j.html;var nb=t.firstElementChild;bar.replaceWith(nb);
if(key!==mine){var b=nb.querySelector('.rxbtn .rx-'+key)||nb.querySelector('.rxbtn .rx');if(b)b.classList.add('pop')}})}
var hover=matchMedia('(hover: hover) and (pointer: fine)').matches,ti,to,pressed=false,lp;
document.addEventListener('pointerover',function(e){if(!hover)return;var bar=e.target.closest&&e.target.closest('.react');if(!bar)return;clearTimeout(to);if(!bar.classList.contains('open')){clearTimeout(ti);ti=setTimeout(function(){close(bar);bar.classList.add('open')},350)}});
document.addEventListener('pointerout',function(e){if(!hover)return;var bar=e.target.closest&&e.target.closest('.react');if(!bar||bar.contains(e.relatedTarget))return;clearTimeout(ti);to=setTimeout(function(){bar.classList.remove('open')},300)});
document.addEventListener('pointerdown',function(e){var b=e.target.closest&&e.target.closest('.rxbtn');if(!b||e.pointerType==='mouse')return;pressed=false;clearTimeout(lp);lp=setTimeout(function(){pressed=true;close();b.parentElement.classList.add('open');if(navigator.vibrate)navigator.vibrate(10)},450)});
['pointerup','pointercancel'].forEach(function(n){document.addEventListener(n,function(){clearTimeout(lp)})});
document.addEventListener('contextmenu',function(e){if(e.target.closest&&e.target.closest('.rxbtn'))e.preventDefault()});
document.addEventListener('click',function(e){var pick=e.target.closest('[data-rx]');if(pick){e.preventDefault();send(pick.closest('.react'),pick.dataset.rx);return}
var b=e.target.closest('.rxbtn');if(b){e.preventDefault();if(pressed){pressed=false;return}var bar=b.parentElement;send(bar,bar.dataset.mine||'fire');return}
if(!e.target.closest('.react'))close()});
document.addEventListener('keydown',function(e){var bar=e.target.closest&&e.target.closest('.react');if(e.key==='Escape')close();else if(bar&&(e.key==='ArrowUp'||(e.key==='Enter'&&e.altKey))){e.preventDefault();bar.classList.add('open');var f=bar.querySelector('[data-rx]');if(f)f.focus()}});
})()`;
