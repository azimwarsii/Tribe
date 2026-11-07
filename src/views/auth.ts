import { CARD_TIERS } from "../card-tiers.js";
import { esc, icon, page } from "../ui.js";

const wordmark = (size: number) => `<span style="font-size:${size}px;font-weight:700;letter-spacing:-.05em">tribe<span style="color:#34D399">.</span></span>`;

export function splashPage(next = "/feed"): string {
  return page({
    title: "Tribe",
    focus: true,
    extraClass: "splash lock",
    head: `<style>
.splash{background:#050505;align-items:center;justify-content:center;text-align:center;cursor:pointer}
.splash .glow{position:absolute;left:50%;top:38%;width:520px;height:520px;margin:-260px 0 0 -260px;border-radius:50%;background:radial-gradient(circle,rgba(52,211,153,.16) 0%,rgba(52,211,153,0) 62%);animation:sp-glow 3.2s ease-in-out infinite}
.splash .w{position:relative;font-size:64px;font-weight:700;letter-spacing:-.05em;animation:sp-word 900ms cubic-bezier(.2,.8,.2,1) both;display:flex;align-items:baseline}
.splash .w i{display:inline-block;width:14px;height:14px;border-radius:7px;background:#34D399;margin-left:4px;animation:sp-dot 500ms cubic-bezier(.2,.8,.2,1) 700ms both}
.splash p{position:relative;margin:14px 0 0;font-size:15px;color:#A3A3A3;animation:tr-step 500ms cubic-bezier(.2,.8,.2,1) 900ms both}
.splash .ld{position:absolute;left:50%;bottom:120px;width:120px;margin-left:-60px;height:3px;border-radius:2px;background:#1F1F1F;overflow:hidden}
.splash .ld div{height:3px;background:#F5F5F5;transform-origin:left;animation:sp-bar 1600ms cubic-bezier(.4,0,.2,1) 400ms both}
.splash .ft{position:absolute;bottom:52px;left:0;right:0;font-size:12px;color:#737373;display:flex;gap:8px;justify-content:center;animation:tr-fade 400ms ease-out 1800ms both}
@keyframes sp-word{0%{opacity:0;letter-spacing:.2em;filter:blur(6px)}100%{opacity:1;letter-spacing:-.05em;filter:none}}
@keyframes sp-dot{0%{transform:scale(0)}70%{transform:scale(1.4)}100%{transform:scale(1)}}
@keyframes sp-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes sp-glow{0%,100%{opacity:.55}50%{opacity:.9}}</style>`,
    body: `<a href="/intro?next=${encodeURIComponent(next)}" data-auto="/intro?next=${encodeURIComponent(next)}" data-delay="2600" aria-label="Tribe. Tap to continue" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:inherit">
<div class="glow" aria-hidden="true"></div><div class="w">tribe<i aria-hidden="true"></i></div><p>Custom ETF-style trades. Cards that level up.</p>
<div class="ld" aria-hidden="true"><div></div></div><div class="ft"><span>Flash orders</span><span aria-hidden="true">·</span><span>Chainlink CRE</span><span aria-hidden="true">·</span><span>Privy</span></div></a>`,
  });
}

const CARD = "padding:14px;border-radius:18px;background:linear-gradient(180deg,#262626,#171717);border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 40px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:10px";

const { glitter: GLITTER, holo: HOLO } = CARD_TIERS.copy;

const sampleCard = (tier: string, style: string) => `<img src="/card/sample/${tier}.svg" alt="" style="position:absolute;height:auto;border-radius:14px;box-shadow:0 16px 32px rgba(0,0,0,.55);${style}">`;

/** The intro: how Tribe works, one feature per slide, in the order a new user meets them. */
const SLIDES: { h: string; p: string; art: string }[] = [
  {
    h: "Custom ETF-style trades",
    p: "Creators turn a thesis into a custom index of up to 10 tokens, each with its own weight and an optional stop and target. You copy the whole trade with one swipe.",
    art: `<div style="width:270px;${CARD}"><div class="row sp"><b class="md">Base Blue Chips</b><span class="sm mut">@nightowl</span></div>
<div class="row" style="gap:2px;height:6px"><i style="width:50%;height:6px;border-radius:3px;background:#34D399"></i><i style="width:30%;height:6px;border-radius:3px;background:#A7F3D0"></i><i style="width:20%;height:6px;border-radius:3px;background:#737373"></i></div>
${[["ETH", "50%"], ["cbBTC", "30%"], ["AERO", "20%"]].map(([t, w]) => `<div class="row sp sm"><span>${t}</span><b>${w}</b></div>`).join("")}
<div class="btn p" style="height:36px;font-size:13px">${icon("bolt", 12)} Copy trade</div></div>`,
  },
  {
    h: "Copy it, mint your card",
    p: "Every copy mints a numbered trading card for that trade. It stays in your collection, even after you close the trade.",
    art: sampleCard("base", "width:186px;left:50%;top:18px;margin-left:-93px"),
  },
  {
    h: "Your card upgrades with your profit",
    p: `It starts at Base. Reach +${GLITTER.returnPct}% on your copy and it turns Glitter; reach +${HOLO.returnPct}% and it goes Holo. A card never drops a tier, even if the trade falls back.`,
    art: `${sampleCard("base", "width:140px;left:50%;top:58px;margin-left:-158px;transform:rotate(-9deg)")}${sampleCard("glitter", "width:140px;left:50%;top:58px;margin-left:18px;transform:rotate(9deg)")}${sampleCard("holo", "width:164px;left:50%;top:36px;margin-left:-82px;z-index:1")}`,
  },
  {
    h: "Your wallet, your approval",
    p: "The tokens sit in your own wallet and nothing is pooled. If a creator changes a trade, you see the exact sells and buys, and nothing moves until you approve.",
    art: `<div style="width:270px;${CARD}"><b class="md">Rebalance request</b><div class="row sp sm"><span class="mut">Sell</span><span>AERO 10%</span></div><div class="row sp sm"><span class="mut">Buy</span><span>ETH 10%</span></div>
<div class="grid2" style="gap:6px"><div class="btn" style="height:36px;font-size:13px">Skip</div><div class="btn p" style="height:36px;font-size:13px">Approve</div></div></div>`,
  },
  {
    h: "Guard: a safety net, onchain",
    p: "Chainlink CRE checks creators and pauses risky ones before you copy them. The pause is written onchain, so anyone can verify why.",
    art: `<div style="width:270px;${CARD.replace("rgba(255,255,255,.08)", "rgba(248,113,113,.4)")}">
<div class="row sp"><span class="md" style="font-weight:600">@traderx</span><span class="pill bad">Paused by Guard</span></div>
<div style="position:relative;height:6px;border-radius:3px;background:#262626"><div style="width:91%;height:6px;border-radius:3px;background:#F87171"></div><span style="position:absolute;left:65%;top:-4px;width:2px;height:14px;background:#F5F5F5"></span></div>
<div class="row sp sm mut"><span>Risk 91</span><span>Pause line 65</span></div><div class="up sm">Proof onchain ↗</div></div>`,
  },
  {
    h: "Launch your own index",
    p: "Publish a custom trade and you mint its Original card, which upgrades as its return and copiers grow. Every copy earns you a share of the Flash fee.",
    art: `<div style="width:270px;${CARD}"><div class="row sp"><b class="md">Base Blue Chips</b><span class="pill ok">Original</span></div>
<div class="grid2" style="gap:6px"><div class="tile sm"><div class="mut">Return</div><b class="up">+12.5%</b></div><div class="tile sm"><div class="mut">Copiers</div><b>12</b></div></div>
<div class="sm mut">Next: Holo</div><div style="height:6px;border-radius:3px;background:#262626"><div style="width:50%;height:6px;border-radius:3px;background:#34D399"></div></div></div>`,
  },
];

/** The intro slides; Skip and Get started go to `done` (the app after sign-up, or sign-in when signed out). */
export function introPage(done = "/signin"): string {
  const slides = SLIDES.map(
    (s, i) => `<div class="step ${i ? "hide" : ""}" data-step-id="${i + 1}" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:clamp(12px,3vh,28px)">
<div aria-hidden="true" class="ihero" style="flex:1 1 300px;min-height:0;max-height:300px;border-radius:28px;background:radial-gradient(ellipse 80% 60% at 50% 30%,rgba(255,255,255,.07),rgba(255,255,255,0) 70%),#0E0E0E;border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">${s.art}</div>
<div style="flex:none"><h1 class="h1" style="font-size:clamp(23px,4.2vh,30px)">${esc(s.h)}</h1><p style="margin:8px 0 0;font-size:clamp(14px,2.3vh,16px);color:#A3A3A3;line-height:1.45">${esc(s.p)}</p></div></div>`,
  ).join("");
  const dots = SLIDES.map((_, i) => `<button role="tab" aria-label="Page ${i + 1}" data-goto="${i + 1}" data-dot="${i + 1}" style="width:${i ? 8 : 24}px;height:8px;border-radius:4px;border:0;padding:0;background:${i ? "#3A3A3A" : "#F5F5F5"}"></button>`).join("");
  return page({
    title: "Welcome",
    focus: true,
    extraClass: "lock",
    body: `<div data-scope id="intro" style="flex:1;min-height:0;display:flex;flex-direction:column">
<header class="hd" style="flex:none;justify-content:space-between;padding:calc(12px + env(safe-area-inset-top,0px)) 20px 4px">${wordmark(22)}<a href="${esc(done)}" class="mut md" style="min-height:40px;display:flex;align-items:center">Skip</a></header>
<main class="main" style="padding-top:8px;min-height:0">${slides}</main>
<div style="flex:none;padding:12px 20px max(16px,calc(var(--sab) + 8px));display:flex;flex-direction:column;gap:12px"><div class="row" style="justify-content:center;gap:6px" role="tablist">${dots}</div>
<button class="btn w big" id="next">Next</button><a class="btn p big hide" id="start" href="${esc(done)}">Get started</a></div></div>
<script>(function(){var i=1,n=${SLIDES.length},sc=document.getElementById('intro');function show(k){i=k;sc.querySelectorAll('[data-step-id]').forEach(function(s){s.classList.toggle('hide',Number(s.dataset.stepId)!==k)});sc.querySelectorAll('[data-dot]').forEach(function(d){var on=Number(d.dataset.dot)===k;d.style.width=on?'24px':'8px';d.style.background=on?'#F5F5F5':'#3A3A3A'});document.getElementById('next').classList.toggle('hide',k===n);document.getElementById('start').classList.toggle('hide',k!==n)}
document.getElementById('next').onclick=function(){show(i+1)};sc.querySelectorAll('[data-dot]').forEach(function(d){d.onclick=function(e){e.stopPropagation();show(Number(d.dataset.dot))}})})()</script>`,
  });
}

const AV_ICONS = ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M13 2L4 14h7l-1 8 9-12h-7z", "M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9z", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8", "M5 5l2.5 3.5h9L19 5v9a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6z", "M3 17l6-6 4 4 8-8", "M12 2l3 6 6 .9-4.5 4.4 1 6.2L12 16.6 6.5 19.5l1-6.2L3 8.9 9 8z", "M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0"];
const AV_NAMES = ["Cube", "Bolt", "Shield", "Target", "Chief", "Chart", "Star", "Arc"];

/**
 * Sign-up after a new wallet signs in: pick a username and an avatar. The wallet is already proven by its signature.
 * No risk quiz: accounts start with balanced limits, changed any time in Settings or per trader.
 */
export function onboardingPage(wallet?: string, follow = ""): string {
  const avatars = AV_ICONS.map(
    (d, i) => `<button type="button" role="radio" aria-checked="${i === 0}" aria-label="${AV_NAMES[i]}" data-pick data-name="avatar" data-val="${i}" class="${i === 0 ? "on" : ""} avb" style="aspect-ratio:1;border-radius:50%;border:0;padding:0;background:${i % 2 ? "#F5F5F5" : "#262626"};display:flex;align-items:center;justify-content:center;color:${i % 2 ? "#0A0A0A" : "#F5F5F5"}"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></button>`,
  ).join("");
  const steps: [string, string][] = [["Wallet connected", "Proved with a free signature"], ["Pick a username", "How others see you"]];
  return page({
    title: "Get started",
    focus: true,
    extraClass: "obw",
    head: `<style>.avb{box-shadow:0 0 0 3px #0A0A0A,0 0 0 5px transparent}.avb.on{box-shadow:0 0 0 3px #0A0A0A,0 0 0 5px #34D399}
.obnav [data-nav]{display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:16px;color:#A3A3A3}.obnav [data-nav] i{width:30px;height:30px;border-radius:15px;border:2px solid #3A3A3A;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;font-weight:600;flex-shrink:0}
.obnav [data-nav].on{background:#1A1A1A;color:#F5F5F5}.obnav [data-nav].on i{border-color:#34D399;color:#34D399}.obnav [data-nav].done{color:#F5F5F5}.obnav [data-nav].done i{border-color:#34D399;background:#34D399;color:#052E1C}
@media (min-width:900px){.app.focus.obw{max-width:1120px}#ob{display:grid!important;grid-template-columns:360px minmax(0,1fr);gap:56px;align-items:start;padding:0 28px 40px}.obcol{border-radius:24px;background:#121212;border:1px solid rgba(255,255,255,.07);padding:4px 8px 20px;min-height:520px;display:flex;flex-direction:column}.obbars{visibility:hidden}#ob [aria-label=Avatar]{grid-template-columns:repeat(8,minmax(0,1fr))!important}}</style>`,
    body: `<header class="hd only-d" style="justify-content:space-between">${wordmark(26)}<span class="sm mut">Your wallet, your keys</span></header>
<div data-scope id="ob" style="flex:1;display:flex;flex-direction:column">
<nav class="only-d obnav" aria-label="Steps"><div class="xs up" style="font-weight:600;letter-spacing:.1em;margin-top:24px">GET STARTED</div><h1 class="h1" style="font-size:32px;margin:12px 0 24px">One last step and you're in.</h1>
${steps.map(([t, sub], i) => `<div class="${i === 0 ? "done" : "on"}" data-nav="${i}" aria-current="${i === 1 ? "step" : "false"}"><i>${i + 1}</i><span><b style="display:block;font-size:15px">${t}</b><span class="sm mut">${sub}</span></span></div>`).join("")}</nav>
<div class="obcol" style="flex:1;display:flex;flex-direction:column">
<main class="main" style="padding-top:28px;gap:20px">
<section class="step col" data-step-id="2"><div><h1 class="h1">Pick a username</h1><p class="mut" style="margin:8px 0 0;font-size:15px">This is how others see you on the feed and leaderboard.</p></div>
${wallet ? `<div class="tile sm" style="padding:10px 14px">${icon("check", 14)} Wallet connected · <span style="font-family:ui-monospace,monospace">${esc(wallet.slice(0, 6))}…${esc(wallet.slice(-4))}</span></div>` : ""}
<div><label class="l" for="handle">Username</label><div class="row" style="height:52px;padding:0 16px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:#151515"><span class="dim">@</span><input id="handle" name="handle" autocomplete="off" autocapitalize="none" maxlength="20" placeholder="yourname" style="flex:1;min-width:0;border:0;background:transparent;color:#F5F5F5;font-size:16px;padding:0 0 0 2px"><span id="hstate" class="sm"></span></div></div>
<div><div class="md" style="font-weight:600;margin-bottom:10px">Avatar</div><div role="radiogroup" aria-label="Avatar" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">${avatars}</div><input type="hidden" name="avatar" value="0"></div>
<button type="button" class="btn p big" id="finish" style="margin-top:auto" disabled>Create account</button></section></main><div style="height:22px"></div></div></div>
<script>(function(){
var FOLLOW=${JSON.stringify(follow)},sc=document.getElementById('ob');
var h=document.getElementById('handle'),hs=document.getElementById('hstate'),fin=document.getElementById('finish'),t;
h.addEventListener('input',function(){var v=h.value.trim();clearTimeout(t);fin.disabled=true;if(!/^[a-z0-9_]{3,20}$/i.test(v)){hs.textContent=v?'3-20 letters, numbers, _':'';hs.className='sm mut';return}
t=setTimeout(function(){fetch('/api/handle?h='+encodeURIComponent(v)).then(function(r){return r.json()}).then(function(j){hs.textContent=j.free?'Available':(j.why||'Taken');hs.className='sm '+(j.free?'up':'down');fin.disabled=!j.free})},250)});
fin.onclick=function(){fin.disabled=true;fetch('/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({handle:h.value.trim(),avatar:Number(sc.querySelector('input[name=avatar]').value),follow:FOLLOW})}).then(function(r){return r.json()}).then(function(j){if(j.redirect)location.href=j.redirect;else{fin.disabled=false;tribe.toast(j.error||'Could not create your account')}})};
})()</script>`,
  });
}
