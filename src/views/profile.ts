import { getMeta, getUser } from "../db.js";
import { face, feed, pct, sourceSplit } from "../data.js";
import { botTradesToday } from "../bots.js";
import { esc, header, icon, page, sw } from "../ui.js";
import { tradeCardHtml } from "./feed.js";

/** Edit profile: photo (cropped and resized in the browser), a unique username, and a short bio. */
export function profileEditPage(uid: number): string {
  const u = getUser(uid);
  const body = `${header("Edit profile", "How others see you on Tribe", `/u/${esc(u.handle)}`)}
<main class="main" style="gap:18px">
<section class="col" style="align-items:center;gap:12px" aria-label="Photo"><span class="av w pav" style="width:112px;height:112px;border-radius:56px;font-size:34px" id="pv">${face(u.handle)}</span>
<div class="row" style="gap:8px"><label class="btn sm p" style="cursor:pointer">${icon("camera", 14, "currentColor", 2)}${u.photo_at ? "Change photo" : "Add a photo"}<input type="file" id="photo" accept="image/*" style="position:absolute;width:1px;height:1px;opacity:0"></label>${u.photo_at ? `<button class="btn sm" data-act="/api/photo" data-body='{"remove":true}'>Remove</button>` : ""}</div>
<span class="xs mut">Cropped to a square and shrunk to 256px before it leaves your phone.</span></section>
<form class="col" id="pf" style="gap:14px" autocomplete="off">
<label class="col" style="gap:6px"><span class="sm mut">Username</span><span class="row" style="height:48px;padding:0 14px;border-radius:14px;background:#1A1A1A;border:1px solid rgba(255,255,255,.08)"><span class="mut">@</span><input name="handle" id="h" value="${esc(u.handle)}" maxlength="20" spellcheck="false" style="flex:1;min-width:0;border:0;background:transparent;color:#F5F5F5;font-size:16px"></span><span class="sm" id="hs" aria-live="polite" style="min-height:18px"></span></label>
<label class="col" style="gap:6px"><span class="row sp"><span class="sm mut">Bio</span><span class="xs mut" id="bc">${(u.bio ?? "").length}/160</span></span><textarea name="bio" id="bio" maxlength="160" rows="3" placeholder="What you trade and how" style="padding:12px 14px;border-radius:14px;background:#1A1A1A;border:1px solid rgba(255,255,255,.08);color:#F5F5F5;font:inherit;font-size:15px;resize:none">${esc(u.bio ?? "")}</textarea></label>
<button class="btn p big" id="save">Save</button></form>
<p class="note">Usernames are unique, 3-20 letters, numbers or _. Your trades, and your bot's, show under this name.</p></main>
<script>(function(){
var h=document.getElementById('h'),hs=document.getElementById('hs'),save=document.getElementById('save'),mine=${JSON.stringify(u.handle)},t;
h.oninput=function(){var v=h.value.trim().toLowerCase();clearTimeout(t);if(v===mine){hs.textContent='';save.disabled=false;return}
t=setTimeout(function(){fetch('/api/handle?h='+encodeURIComponent(v)).then(function(r){return r.json()}).then(function(j){hs.textContent=j.free?'@'+v+' is available':j.why;hs.className='sm '+(j.free?'up':'down');save.disabled=!j.free})},250)};
var bio=document.getElementById('bio');bio.oninput=function(){document.getElementById('bc').textContent=bio.value.length+'/160'};
document.getElementById('pf').onsubmit=function(e){e.preventDefault();save.disabled=true;
fetch('/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({handle:h.value.trim(),bio:bio.value})}).then(function(r){return r.json()}).then(function(j){save.disabled=false;if(j.error){tribe.toast(j.error);return}location.href='/u/'+encodeURIComponent(h.value.trim().toLowerCase())})};
document.getElementById('photo').onchange=function(){var f=this.files&&this.files[0];if(!f)return;var img=new Image();img.onload=function(){
var s=Math.min(img.naturalWidth,img.naturalHeight),c=document.createElement('canvas');c.width=c.height=256;
c.getContext('2d').drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,256,256);URL.revokeObjectURL(img.src);
var url=c.toDataURL('image/jpeg',0.85);document.getElementById('pv').innerHTML='<img src="'+url+'" alt="">';
fetch('/api/photo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({photo:url})}).then(function(r){return r.json()}).then(function(j){tribe.toast(j.error||j.toast||'Saved')})};
img.onerror=function(){tribe.toast('That file is not an image')};img.src=URL.createObjectURL(f)};
})()</script>`;
  return page({ title: "Edit profile", body });
}

/** Your bot: the CRE strategy trading from your wallet, under your username. */
export async function botPage(uid: number): Promise<string> {
  const u = getUser(uid);
  const bot = getMeta(uid).bot;
  const rec = sourceSplit(uid).bot;
  const recent = (await feed(uid, { time: "30d" }, 80)).filter((c) => c.leader === uid && c.source !== "user").slice(0, 3);
  const pick = (name: string, vals: number[], cur: number, fmt: (n: number) => string) =>
    `<div class="chips" role="radiogroup" aria-label="${name}">${vals.map((v) => `<button class="chip${v === cur ? " on" : ""}" role="radio" aria-checked="${v === cur}" data-act="/api/bot" data-body='{"${name}":${v}}'>${fmt(v)}</button>`).join("")}</div>`;
  const body = `${header("Your bot", bot.on ? "On · trading under your name" : "Off", "/me")}
<main class="main" style="gap:16px">
<section class="card col" style="gap:12px;${bot.on ? "border-color:rgba(52,211,153,.35);background:linear-gradient(135deg,rgba(52,211,153,.08),#141414 60%)" : ""}"><div class="row" style="gap:12px"><span class="ic36" style="color:#34D399;background:rgba(52,211,153,.12)">${icon("bot", 18, "currentColor", 2)}</span><span class="grow"><b class="md" style="display:block">@${esc(u.handle)}'s bot</b><span class="sm mut">${bot.on ? `$${bot.usd} a trade · up to ${bot.perDay} a day` : "Turn it on to start"}</span></span>${sw(bot.on, "Bot on", `data-act="/api/bot" data-body='{"on":${!bot.on}}'`)}</div>
<p class="sm" style="margin:0;color:#C4C4C4;line-height:1.5">It runs the Tribe strategy on <b>Chainlink CRE</b>. Every few minutes the workflow reads the Chainlink ETH/USD feed and the DEX price, and buys a pullback only when the two agree, always with a take-profit and a stop attached. Each trade is placed from your wallet, posted under <b>@${esc(u.handle)}</b>, with the bot's one-line reason. People who copy you copy it by their own rules.</p></section>
<section class="col" style="gap:8px"><b class="md">Size per trade</b>${pick("usd", [10, 25, 50, 100], bot.usd, (v) => `$${v}`)}</section>
<section class="col" style="gap:8px"><b class="md">Most bot trades a day</b>${pick("perDay", [1, 2, 3, 5], bot.perDay, (v) => String(v))}<span class="xs mut">${botTradesToday(uid)} today</span></section>
<div class="grid3"><div class="tile"><div class="k">Bot entries</div><div class="v">${rec.trades}</div></div><div class="tile"><div class="k">Closed green</div><div class="v">${rec.closed ? `${rec.wins}/${rec.closed}` : "—"}</div></div><div class="tile"><div class="k">Return</div><div class="v ${rec.pnlPct === null ? "" : rec.pnlPct >= 0 ? "up" : "down"}">${rec.pnlPct === null ? "—" : pct(rec.pnlPct)}</div></div></div>
${recent.length ? `<h2>Recent bot trades</h2>${recent.map((c) => tradeCardHtml(c, uid)).join("")}` : ""}
<a class="card row" href="/bots/new" style="gap:12px;color:#F5F5F5">${icon("plus", 18, "#34D399", 2.2)}<span class="grow"><b>Build your own bot</b><span class="sm mut" style="display:block">Pick a strategy and limits in Creator Studio. It runs a private trial, then others can copy it.</span></span>${icon("chev", 14, "#8A8A8A", 2)}</a>
<p class="note">Guard watches your bot too: if CopyGuard pauses you, your bot stops and nobody copies you until it clears.</p></main>`;
  return page({ title: "Your bot", body });
}
