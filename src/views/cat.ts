import { awayLine, learnedMemory, ruleLimit } from "../cat.js";
import { allHalts, chatById, chatsOf, getMeta, msgsOf, rulesOf, userById } from "../db.js";
import { esc, glyphBadge, header, icon, page, sheet, split, sw } from "../ui.js";
import { face, pct, topTraders, tradeCard } from "../data.js";
import { catCalls, contextOf, latestEntry, researchTrade, type TradeCtx } from "../research.js";

const orb = (size: number, glow = true) =>
  `<span class="orb" aria-hidden="true" style="width:${size}px;height:${size}px;box-shadow:${glow ? `0 0 ${Math.round(size * 0.5)}px rgba(52,211,153,.35),` : ""}inset 0 -${Math.round(size / 12)}px ${Math.round(size / 5)}px rgba(0,0,0,.45)"><i></i></span>`;

const PERSONAS: [string, string, string][] = [
  ["Sharp", "sharp", "Numbers first. “Bracket ready: −$2.50 max loss, +$6 target.”"],
  ["Chill", "chill", "Explains as it goes. “Here's what this order does, step by step…”"],
  ["Degen", "degen", "Memes allowed, stops still required. “Sending it. Responsibly.”"],
];

const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };


const TONE: Record<string, string> = { "Looks solid": "#34D399", Mixed: "#FCD34D", Risky: "#F87171", "Avoid for now": "#F87171" };

/** Chief's track record: every call it made in chat, scored by what the trader did next. Hidden until there is one. */
function callsCard(): string {
  const calls = catCalls();
  if (!calls.length) return "";
  return `<section class="tile" aria-label="Chief's track record" style="border-radius:18px;padding:14px"><div class="row sp" style="align-items:baseline"><b class="md">Chief’s calls</b><span class="xs mut">30 days · scored by what the trader did next</span></div><div class="col" style="gap:6px;margin-top:10px">${calls.map((c) => `<div class="row sp sm"><span style="color:${TONE[c.label]};font-weight:600">${esc(c.label)}</span><span class="mut">${c.calls} call${c.calls === 1 ? "" : "s"} · ${c.closed ? `${c.green} of ${c.closed} closed green` : "none closed yet"}</span></div>`).join("")}</div></section>`;
}

/** How Chief talks: tone only, limits and Guard never change. Opened from the chat header. */
const personaSheet = (persona: string) => sheet("persona", `<h2>How should Chief talk?</h2><p class="mut md" style="margin:6px 0 12px">Tone only. Your limits and Guard rules never change.</p><div class="col" role="radiogroup" style="gap:8px">${PERSONAS.map(([n, e, s]) => `<button class="opt${persona === n ? " on" : ""}" role="radio" aria-checked="${persona === n}" data-act="/api/cat/persona" data-body='{"persona":"${n}"}' style="justify-content:flex-start;gap:12px;padding:12px 16px">${glyphBadge(e, 40)}<span><b style="display:block">${n}</b><span class="sm mut" style="line-height:1.4">${s}</span></span></button>`).join("")}</div>`);

/**
 * A new chat: a greeting, what happened while away, and everything Chief can do as buttons. The four big ones are what
 * makes Chief special (it trades through Flash, quotes live through Flash MCP, explains Chainlink CRE Guard pauses and
 * researches traders); the chips below are the rest. Tapping one asks it; links open their page.
 */
async function welcome(uid: number): Promise<string> {
  const tops = topTraders(7, 6).filter((t) => t.id !== uid);
  const top = tops[0];
  const paused = allHalts().map((h) => userById(h.leader)?.handle).find(Boolean);
  const big: [string, string, string, string, string][] = [
    ["Trade with Flash", "#34D399", "bolt", "Flash", "Buy $50 ETH with a 5% stop and 12% target"],
    ["Live quote", "#7DD3FC", "swap", "Flash MCP", "What would $50 of ETH get me right now?"],
    ["Guard check", "#F87171", "shield", "Chainlink CRE", paused ? `Why was @${paused} paused?` : "Is any trader paused by Guard right now?"],
    ["Rate a trader", "#FCD34D", "bars", "Research", top ? `Is @${top.handle} worth copying?` : "Who's the safest trader this week?"],
  ];
  const ask: [string, string, string][] = [
    ["wallet", "What's in my wallet?", "Flash MCP"],
    ["list", "Show my recent Flash orders", "Flash MCP"],
    ["crown", "Who are the top traders right now?", ""],
    ...(tops[1] ? [["eye", `Show @${tops[1].handle}'s track record`, ""] as [string, string, string]] : []),
    ["trend", "Sell $20 of ETH", "Flash"],
  ];
  const go: [string, string, string][] = [["mic", "Voice mode", "/cat/voice"], ["mem", "Teach Chief your rules", "/cat/memory"], ["rise", "Run a trading bot", "/bot"]];
  return `<div id="welcome" class="col catwelcome"><div class="col cwhead">${orb(48)}<div><h1 class="h1" style="font-size:24px">${greeting()}</h1><p class="mut cwsub">Trade, research or check anything. Pick one or just ask.</p></div>
<a class="pill ok" href="/guard" style="padding:6px 12px;font-size:12px"><span class="live" style="width:6px;height:6px"></span>Since you were away: ${esc(await awayLine(uid))}</a></div>
<div class="catfeat">${big.map(([t, c, ic, tag, q]) => `<button type="button" class="tile cfeat" data-ask="${esc(q)}" style="--fc:${c}"><span class="cfi">${icon(ic, 17, c, 2.2)}</span><span class="cft"><span class="cfh"><b>${t}</b><span class="cftag">${tag}</span></span><span class="sm mut">${esc(q)}</span></span></button>`).join("")}</div>
<div class="trendrow" id="cat-trend" hidden><span class="trendlbl">${icon("rise", 13, "#34D399", 2.2)}Trending on Base</span><div class="tchips" id="cat-trend-list"></div></div>
<div class="chips catmore">${ask.map(([ic, q, tag]) => `<button type="button" class="chip" data-ask="${esc(q)}">${icon(ic, 13, "currentColor", 2)}${esc(q)}${tag ? `<span class="cftag s">${tag}</span>` : ""}</button>`).join("")}${go.map(([ic, l, href]) => `<a class="chip" href="${href}">${icon(ic, 13, "currentColor", 2)}${l} ›</a>`).join("")}</div></div>`;
}

/** Past chats, newest first, grouped by when they were last used. */
function historyList(uid: number, active?: number): string {
  const chats = chatsOf(uid);
  if (!chats.length) return `<p class="xs mut" style="padding:4px 10px">Your chats show up here.</p>`;
  const day = new Date().setHours(0, 0, 0, 0);
  const group = (t: number) => (t >= day ? "Today" : t >= day - 86400e3 ? "Yesterday" : t >= day - 7 * 86400e3 ? "Previous 7 days" : "Older");
  let last = "";
  return chats.map((c) => {
    const g = group(c.updated);
    const head = g !== last ? `<div class="hgrp">${g}</div>` : "";
    last = g;
    return `${head}<div class="hitem${c.id === active ? " on" : ""}"><a href="/cat/chat?id=${c.id}" title="${esc(c.title)}">${c.source === "Telegram" ? icon("tg", 12) : ""}<span>${esc(c.title)}</span></a><button type="button" class="hdel" data-delchat="${c.id}" aria-label="Delete chat “${esc(c.title)}”">${icon("close", 12, "currentColor", 2.2)}</button></div>`;
  }).join("");
}

/** The post a research chat is about, pinned above the composer: jump back to it or copy the trader without losing the chat. */
function contextBar(c: TradeCtx): string {
  const av = `<span class="av sm">${face(c.handle)}</span>`;
  const act = c.own ? `<a class="btn sm" href="/u/${esc(c.handle)}">Your trade</a>`
    : c.paused ? ""
    : c.copying ? `<a class="btn sm" href="/traders">Copying</a>`
    : `<a class="btn sm p" href="/u/${esc(c.handle)}#baskets">${icon("list", 13, "currentColor", 2)}Their baskets</a>`;
  return `<div class="ctxbar" role="region" aria-label="Asking about this post">${av}<a class="grow" href="/t/${c.id}" style="min-width:0;color:#F5F5F5"><span class="xs mut" style="display:block">Asking about · back to post ↗</span><b style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">@${esc(c.handle)} · ${c.bot ? "Bot · " : ""}${esc(c.verb)} ${esc(c.symbol)}${c.sincePct === null ? "" : Math.abs(c.sincePct) < 0.05 ? ' <span class="mut">flat</span>' : ` <span class="${c.sincePct >= 0 ? "up" : "down"}">${pct(c.sincePct)}</span>`}</b></a>${act}<button type="button" class="ic s" id="unpin" aria-label="Stop asking about this post" title="Back to general questions">${icon("close", 14, "currentColor", 2)}</button></div>`;
}

/** Chief's read on a trader's latest entry, one tap from the full research chat. Shown before you copy. */
export async function catReadCard(viewer: number, leader: number, style = "", trade?: number): Promise<string> {
  const id = trade ?? latestEntry(leader);
  if (id === undefined || leader === viewer) return "";
  const v = (await researchTrade(viewer, id, "Is this a good trade?"))?.verdict;
  if (!v) return "";
  const col = { ok: "#34D399", warn: "#FCD34D", bad: "#F87171" }[v.tone];
  const judged = v.checks.filter((c) => c.ok !== null);
  const note = v.checks.find((c) => c.ok === false) ?? v.checks.find((c) => c.ok && /CRE CopyGuard/.test(c.t));
  return `<a class="card catread" href="/cat/chat?new=1&trade=${id}&q=${encodeURIComponent("Is this a good trade?")}" style="border-color:${col}44;${style}">${orb(34, false)}<span class="grow" style="min-width:0"><span class="xs mut" style="display:block">Chief’s read on ${trade ? "this trade" : "their latest trade"}</span><b style="color:${col}">${esc(v.label)}</b><span class="sm mut"> · ${judged.filter((c) => c.ok).length} of ${judged.length} checks pass</span>${note ? `<span class="xs row" style="gap:5px;color:#A3A3A3;margin-top:3px"><i class="ck${note.ok ? "" : " bad"}" aria-hidden="true">${note.ok ? icon("check", 9, "currentColor", 3.4) : "!"}</i>${esc(note.t)}</span>` : ""}</span><span class="mut" aria-hidden="true" style="font-size:20px">›</span></a>`;
}

/** The bar alone, for when a chat switches to another post. */
export async function ctxBarHtml(uid: number, trade: number): Promise<string> {
  const c = await tradeCard(trade, uid);
  return c ? contextBar(contextOf(c, uid)) : "";
}

/**
 * Ask Chief, like a chat app: past chats on the left (a sheet on phones), a new chat starts blank with everything Chief
 * can do. A chat is saved on its first message. "Ask Chief" on a trade pins it above the box (?trade=), ?q= asks
 * straight away, ?id= reopens a past chat. The tone, Chief's track record and memory live in the header.
 */
export async function catChatPage(uid: number, q: string, trade?: number, chatId?: number): Promise<string> {
  const chat = chatId !== undefined ? chatById(chatId, uid) : undefined;
  const meta = getMeta(uid);
  const msgs = chat ? msgsOf(chat.id) : [];
  const about = trade ?? (JSON.parse(chat?.state || "{}") as { trade?: number }).trade;
  const card = about ? await tradeCard(about, uid) : undefined;
  const ctx = card ? contextOf(card, uid) : undefined;
  const boot = JSON.stringify({ id: chat?.id ?? null, persona: meta.catPersona, msgs, q: q || "", trade: ctx?.id ?? null }).replace(/</g, "\\u003c");
  const calls = callsCard();
  const body = `<div class="catshell"><aside class="chat-hist" aria-label="Your chats"><a class="btn p sm hnew" href="/cat">${icon("plus", 15, "currentColor", 2.4)}New chat</a><div class="hlist">${historyList(uid, chat?.id)}</div></aside><section class="catmain"><header class="hd"><a class="ic" id="cback" href="${ctx ? `/t/${ctx.id}` : "/feed"}" aria-label="${ctx ? "Back to the post" : "Back"}">${icon("back", 18, "currentColor", 2)}</a><button type="button" class="grow" data-open="persona" aria-haspopup="dialog" style="text-align:left;background:none;border:0;color:inherit;font:inherit;padding:0;min-width:0"><h1>Chief</h1><div class="sub"><span class="row" style="gap:5px;display:inline-flex">${glyphBadge(meta.catPersona.toLowerCase(), 14)}${esc(meta.catPersona)}<span class="only-d">&nbsp;· change tone</span></span></div></button>${calls ? `<button class="ic only-d" data-open="calls" aria-label="Chief's track record">${icon("target", 18)}</button>` : ""}<a class="ic only-d" href="/cat/memory" aria-label="Chief's memory">${icon("mem", 18)}</a><button class="btn sm only-m chatsbtn" type="button" data-open="hist" aria-label="Your chats">${icon("chat", 15, "currentColor", 2)}Chats</button><a class="ic only-m" href="/cat" aria-label="New chat" title="New chat">${icon("plus", 18, "currentColor", 2.2)}</a><a class="ic" href="/cat/voice" aria-label="Voice mode">${icon("mic", 18)}</a></header>
<main class="main chatpanes" style="padding-bottom:${ctx ? 220 : 150}px;--cpad:${ctx ? 230 : 160}px"><div class="col msgcol" style="gap:14px;min-width:0">${msgs.length || q ? "" : await welcome(uid)}<div id="msgs" class="col" style="gap:14px"></div><div id="chips" class="chips"></div></div></main></section></div>
<form class="composer shift" style="bottom:16px" id="cf"><div id="ctxwrap">${ctx ? contextBar(ctx) : ""}</div><div class="box"><input id="cat-in" placeholder="Ask Chief anything" autocomplete="off" aria-label="Message Chief"><div class="row" style="gap:8px;margin-top:4px"><button type="button" class="tg" id="t-think" aria-pressed="true">${icon("think", 14, "currentColor", 2)}Think</button><button type="button" class="tg" id="t-live" aria-pressed="true">${icon("live", 14, "currentColor", 2)}Live</button><span class="grow"></span><button type="button" class="ic s" id="dictate" aria-label="Speak your message" aria-pressed="false" style="width:38px;height:38px;border-radius:19px">${icon("mic", 17, "currentColor", 2)}</button><button class="ic s" style="width:38px;height:38px;border-radius:19px;background:#34D399;color:#052E1C;border:0" aria-label="Send">${icon("up", 18, "currentColor", 2.4)}</button></div></div></form>
<script>(function(){
var CH=${boot};var msgs=document.getElementById('msgs'),chips=document.getElementById('chips'),inp=document.getElementById('cat-in'),sending=false;
function pref(k){try{return localStorage.getItem('cat_'+k)!=='0'}catch(e){return true}}
['think','live'].forEach(function(k){var b=document.getElementById('t-'+k);b.setAttribute('aria-pressed',pref(k)?'true':'false');b.onclick=function(){var on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',on?'true':'false');try{localStorage.setItem('cat_'+k,on?'1':'0')}catch(e){}}});
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var IC={close:'M18 6L6 18M6 6l12 12',bolt:'M13 2L4 14h7l-1 8 9-12h-7z',up:'M12 19V5M6 11l6-6 6 6',copy:'M9 9h11v11H9zM5 15V5h10',refresh:'M20 11a8 8 0 1 0-2 6M20 4v7h-7',thumb:'M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H7',share:'M4 12v7h16v-7M16 7l-4-4-4 4M12 3v12',think:'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3z',chev:'M6 9l6 6 6-6',check:'M5 12l4.5 4.5L19 7'};
function svg(n,s,st){return '<svg width="'+(s||15)+'" height="'+(s||15)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(st||2)+'" stroke-linecap="round" stroke-linejoin="round"'+(n==='down'?' style="transform:scaleY(-1)"':'')+'><path d="'+(IC[n==='down'?'thumb':n])+'"/></svg>'}
function userMsg(t){var d=document.createElement('div');d.className='bubble u';d.textContent=t;msgs.appendChild(d)}
function ladder(c){if(!c.stopPct&&!c.tpPct)return '';var sl=c.stopPct||0,tp=c.tpPct||0,pos=!tp?'80%':!sl?'20%':(sl/(sl+tp)*100).toFixed(0)+'%';return '<div role="img" aria-label="'+(sl?'Stop at -'+sl+'%':'No stop')+', '+(tp?'target at +'+tp+'%':'no target')+' from entry" style="position:relative;margin:4px 0 22px"><div style="height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(248,113,113,.55),rgba(52,211,153,.55))"></div><span style="position:absolute;left:'+pos+';top:-4px;width:2px;height:14px;background:#F5F5F5"></span>'+(sl?'<span class="xs down" style="position:absolute;left:0;top:12px">Stop −'+sl+'%</span>':'')+'<span class="xs mut" style="position:absolute;left:'+pos+';top:12px;transform:translateX(-50%)">Entry</span>'+(tp?'<span class="xs up" style="position:absolute;right:0;top:12px">Target +'+tp+'%</span>':'')+'</div>'}
function card(m){var d=m.data||{},c=d.card;if(!c)return '';var h='<section class="card" style="padding:14px;gap:10px;display:flex;flex-direction:column"><div class="row sp"><span class="row" style="gap:10px"><span class="av">Ξ</span><span><b style="display:block">'+esc(c.title)+'</b><span class="sm mut">Flash · '+esc(c.kind)+'</span></span></span><b>$'+Number(c.usd).toFixed(2)+'</b></div>'+ladder(c)+'<div class="grid3"><div class="tile"><div class="k">Max gain</div><div class="v up">'+(c.maxGain!=null?'+$'+c.maxGain.toFixed(2):'open')+'</div></div><div class="tile"><div class="k">Max loss</div><div class="v down">'+(c.maxLoss!=null?'−$'+c.maxLoss.toFixed(2):'no stop')+'</div></div><div class="tile"><div class="k">Fee</div><div class="v">$'+c.fee.toFixed(2)+'</div></div></div>';
if(d.signed)h+='<div role="status" class="up md" style="font-weight:600;display:flex;gap:6px;align-items:center">'+svg('check',16,3)+'Landed · '+esc(d.receipt||'placed')+'</div>';else if(d.proposalId)h+='<div class="grid2">'+(c.usd&&c.stopPct?'<a class="btn" href="/trade/new?usd='+c.usd+'&stop='+c.stopPct+'&tp='+(c.tpPct||0)+'">Edit in trade form</a>':'<button class="btn" data-x="edit">Edit</button>')+'<button class="btn p" data-x="sign" data-p="'+d.proposalId+'" data-m="'+m.id+'">Confirm &amp; sign</button></div>';return h+'</section>'}
function verdict(v){if(!v)return '';var col={ok:'#34D399',warn:'#FCD34D',bad:'#F87171'}[v.tone];return '<section class="card" style="padding:14px;gap:10px;display:flex;flex-direction:column;border-color:'+col+'55"><div class="row sp"><span class="xs mut" style="letter-spacing:.08em;font-weight:700">CAT’S READ</span><span class="pill" style="color:'+col+';border-color:'+col+'66;background:'+col+'14">'+esc(v.label)+'</span></div><ul class="vchecks">'+v.checks.map(function(c){var k=c.ok===true?'ok':c.ok===false?'bad':'na';return '<li class="'+k+'"><i aria-hidden="true">'+(k==='ok'?svg('check',11,3.2):k==='bad'?'!':'–')+'</i>'+esc(c.t)+'</li>'}).join('')+'</ul></section>'}
function catMsg(m,stream,last){var d=m.data||{},box=document.createElement('div');box.className='row';box.style.alignItems='flex-start';var think=pref('think')&&d.steps;
var html='<span style="margin-top:2px">'+'<span class="orb" style="width:26px;height:26px"><i></i></span></span><div class="grow col" style="gap:10px">';
if(think)html+='<div><button class="tg" data-x="steps" style="height:30px">'+svg('think',13)+' Thought for 2s · '+d.steps.length+' checks '+svg('chev',12)+'</button><ol class="steps hide">'+d.steps.map(function(s){return '<li><b>'+esc(s.t)+'</b> · '+esc(s.d)+'</li>'}).join('')+'</ol></div>';
html+='<p data-text style="margin:0;font-size:15px;line-height:1.55;white-space:pre-wrap"></p><div data-after class="col" style="gap:10px;'+(stream?'visibility:hidden':'')+'">'+verdict(d.verdict)+card(m);
if(d.sources&&d.sources.length)html+='<div class="row" style="flex-wrap:wrap;gap:6px"><span class="xs dim">Sources</span>'+d.sources.map(function(s){return '<span class="pill">'+esc(s)+'</span>'}).join('')+'</div>';
html+='<div class="row" role="toolbar" style="gap:4px;color:#A3A3A3"><button class="ic s" data-x="copy" aria-label="Copy" style="background:transparent;border:0">'+svg('copy')+'</button><button class="ic s" data-x="regen" aria-label="Regenerate" style="background:transparent;border:0">'+svg('refresh')+'</button><button class="ic s" data-x="up" aria-label="Good answer" style="background:transparent;border:0;'+(m.vote===1?'color:#34D399':'')+'">'+svg('thumb')+'</button><button class="ic s" data-x="down" aria-label="Bad answer" style="background:transparent;border:0;'+(m.vote===-1?'color:#F87171':'')+'">'+svg('down')+'</button><a class="ic s" href="/share/me" aria-label="Share" style="background:transparent;border:0">'+svg('share')+'</a></div></div></div>';
box.innerHTML=html;msgs.appendChild(box);var p=box.querySelector('[data-text]'),after=box.querySelector('[data-after]');
function finish(){p.textContent=m.text;after.style.visibility='visible';if(last)showChips(d.follow||[]);bottom()}
if(!stream){finish()}else{var w=m.text.split(' '),i=0;p.innerHTML='<span class="caret"></span>';var iv=setInterval(function(){i++;p.textContent=w.slice(0,i).join(' ');if(i>=w.length){clearInterval(iv);finish()}},45)}
box.addEventListener('click',function(e){var b=e.target.closest('[data-x]');if(!b)return;var x=b.dataset.x;
if(x==='steps'){box.querySelector('.steps').classList.toggle('hide')}
else if(x==='copy'){navigator.clipboard&&navigator.clipboard.writeText(m.text);tribe.toast('Copied')}
else if(x==='regen'){var q=lastUser();if(q)send(q)}
else if(x==='up'||x==='down'){var v=x==='up'?1:-1;if(m.vote===v)v=0;m.vote=v;fetch('/api/cat/vote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({msg:m.id,vote:v})});box.querySelector('[data-x=up]').style.color=v===1?'#34D399':'';box.querySelector('[data-x=down]').style.color=v===-1?'#F87171':''}
else if(x==='edit'){inp.value='make it $';inp.focus()}
else if(x==='sign'){b.disabled=true;fetch('/api/cat/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:b.dataset.p})}).then(function(r){return r.json()}).then(function(r){if(r.ok){b.closest('.grid2').outerHTML='<div role="status" class="up md" style="font-weight:600;display:flex;gap:6px;align-items:center">'+svg('check',16,3)+'Landed onchain</div>';var a=document.createElement('a');a.href='/strategy/new';a.className='chip';a.textContent='Run this as a bot others can copy';chips.appendChild(a)}else b.disabled=false;var n=document.createElement('div');n.className='bubble b';n.textContent=r.reply;msgs.appendChild(n);n.scrollIntoView({block:'end'})})}})}
function pin(id){CH.trade=id;document.getElementById('cback').href='/t/'+id;fetch('/cat/ctxbar/'+id).then(function(x){return x.text()}).then(function(h){document.getElementById('ctxwrap').innerHTML=h;var mm=document.querySelector('main');mm.style.paddingBottom='220px';mm.style.setProperty('--cpad','230px')})}
// Desktop: the conversation is its own scroll pane; phones scroll the page.
function bottom(){var c=document.querySelector('.msgcol');if(c)c.scrollTop=c.scrollHeight;window.scrollTo(0,document.body.scrollHeight)}
// A new chat joins the top of the history the moment Chief answers its first message.
function addHist(id,t){document.querySelectorAll('.hlist').forEach(function(l){var p=l.querySelector('p');if(p)p.remove();l.querySelectorAll('.hitem.on').forEach(function(x){x.classList.remove('on')});var g=l.querySelector('.hgrp');if(!g||g.textContent!=='Today'){g=document.createElement('div');g.className='hgrp';g.textContent='Today';l.prepend(g)}var d=document.createElement('div');d.className='hitem on';d.innerHTML='<a href="/cat/chat?id='+id+'"><span>'+esc(t.slice(0,60))+'</span></a><button type="button" class="hdel" data-delchat="'+id+'" aria-label="Delete chat">'+svg('close',12,2.2)+'</button>';g.after(d)})}
document.addEventListener('click',function(e){var b=e.target.closest('[data-delchat]');if(!b)return;e.preventDefault();if(!confirm('Delete this chat?'))return;var id=Number(b.dataset.delchat);
 fetch('/api/cat/chat/delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:id})}).then(function(r){return r.json()}).then(function(j){if(j.error){tribe.toast(j.error);return}if(id===CH.id){location.href='/cat';return}document.querySelectorAll('[data-delchat="'+id+'"]').forEach(function(x){x.closest('.hitem').remove()})})});
function lastUser(){for(var i=CH.msgs.length-1;i>=0;i--)if(CH.msgs[i].role==='user')return CH.msgs[i].text}
function showChips(f){chips.innerHTML='';f.forEach(function(c){var b=document.createElement(c.href?'a':'button');var ic=c.icon,l=c.label;if(/^⚡/.test(l)){ic='bolt';l=l.replace(/^⚡ ?/,'')}b.className='chip'+(ic?' flashchip':'');b.innerHTML=(ic?svg(ic,13,2.2):'')+esc(l);if(c.href)b.href=c.href;else b.onclick=function(){send(c.text)};chips.appendChild(b)})}
function send(t){if(sending||!t.trim())return;sending=true;var wl=document.getElementById('welcome');if(wl)wl.remove();chips.innerHTML='';userMsg(t);CH.msgs.push({role:'user',text:t});var th=document.createElement('div');th.className='row';th.innerHTML='<span class="orb" style="width:26px;height:26px"><i></i></span><span class="sm mut">Thinking…</span>';msgs.appendChild(th);th.scrollIntoView({block:'end'});
fetch('/api/cat/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:t,chat:CH.id,live:pref('live'),trade:CH.trade})}).then(function(r){return r.json()}).then(function(r){th.remove();sending=false;if(r.error){tribe.toast(r.error);return}if(r.chatId&&r.chatId!==CH.id){CH.id=r.chatId;try{history.replaceState(null,'','/cat/chat?id='+r.chatId)}catch(e){}addHist(r.chatId,t)}

var m={id:r.msgId,role:'cat',text:r.reply,vote:0,data:{card:r.card,proposalId:r.proposalId,steps:r.steps,sources:r.sources,follow:r.follow,verdict:r.verdict}};CH.msgs.push(m);catMsg(m,true,true);if(r.ctx&&r.ctx.id!==CH.trade)pin(r.ctx.id)}).catch(function(){th.remove();sending=false;tribe.toast('Network error')})}
CH.msgs.forEach(function(m,i){if(m.role==='user')userMsg(m.text);else catMsg(m,false,i===CH.msgs.length-1)});
document.getElementById('cf').onsubmit=function(e){e.preventDefault();var t=inp.value.trim();inp.value='';send(t)};
if(CH.q){try{history.replaceState(null,'',CH.id?'/cat/chat?id='+CH.id:'/cat'+(CH.trade?'?trade='+CH.trade:''))}catch(e){}send(CH.q)}
document.querySelectorAll('[data-ask]').forEach(function(b){b.onclick=function(){send(b.dataset.ask)}});
// Trending on Base (blank chat only): live from GeckoTerminal; tap one to ask Chief about it.
(function(){var row=document.getElementById('cat-trend');if(!row)return;fetch('/api/trending').then(function(r){return r.json()}).then(function(j){if(!j.tokens||!j.tokens.length)return;var l=document.getElementById('cat-trend-list');
 j.tokens.slice(0,8).forEach(function(t){var b=document.createElement('button');b.type='button';b.className='tchip';var ch=t.change24hPct;
  b.innerHTML=(t.image?'<img src="'+esc(t.image)+'" alt="">':'')+'<b>'+esc(t.symbol)+'</b><span class="'+(ch>=0?'up':'down')+'">'+(ch>=0?'+':'')+ch.toFixed(1)+'%</span>';
  b.title=t.name+' · $'+Math.round(t.liquidityUsd/1000)+'k liquidity';b.onclick=function(){send("What's going on with "+t.symbol+" on Base ("+t.address+")? Is it safe to trade here?")};l.appendChild(b)});row.hidden=false}).catch(function(){})})();
document.addEventListener('click',function(e){if(!e.target.closest('#unpin'))return;fetch('/api/cat/unpin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat:CH.id})});CH.trade=null;document.getElementById('ctxwrap').innerHTML='';document.getElementById('cback').href='/feed';var mm=document.querySelector('main');mm.style.paddingBottom='150px';mm.style.setProperty('--cpad','160px');try{history.replaceState(null,'',CH.id?'/cat/chat?id='+CH.id:'/cat')}catch(e){}});
// The mic: record (up to a minute), turn it into a small 16 kHz WAV, transcribe on the server, send it as the message.
// Server-side so it works in every browser, including Brave, which has no built-in speech recognition.
var dic=document.getElementById('dictate'),mr=null,chunks=[],stream=null,starting=false;
function dset(on,busy){dic.setAttribute('aria-pressed',on?'true':'false');dic.style.background=on?'#F87171':'';dic.style.color=on?'#2A0A0A':'';dic.disabled=!!busy;inp.placeholder=on?'Listening… tap the mic to send':busy?'Transcribing…':'Ask Chief anything'}
function toWav(au){var rate=16000,src=au.getChannelData(0),ratio=au.sampleRate/rate,n=Math.floor(src.length/ratio),buf=new ArrayBuffer(44+n*2),v=new DataView(buf);
 function str(o,t){for(var i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))}
 str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);
 for(var i=0;i<n;i++){var x=Math.max(-1,Math.min(1,src[Math.floor(i*ratio)]));v.setInt16(44+i*2,x<0?x*0x8000:x*0x7FFF,true)}
 var b=new Uint8Array(buf),bin='';for(var k=0;k<b.length;k+=0x8000)bin+=String.fromCharCode.apply(null,b.subarray(k,k+0x8000));return btoa(bin)}
dic.onclick=async function(){
 if(mr&&mr.state==='recording'){mr.stop();return}
 if(starting)return; // still waiting for the microphone: a second tap mustn't start another recording
 if(!navigator.mediaDevices||!window.MediaRecorder){tribe.toast("This browser can't record audio. Type instead.");return}
 starting=true;try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){tribe.toast('Allow the microphone for this site to talk to Chief.');return}finally{starting=false}
 chunks=[];mr=new MediaRecorder(stream);mr.ondataavailable=function(e){if(e.data.size)chunks.push(e.data)};
 mr.onstop=async function(){stream.getTracks().forEach(function(t){t.stop()});dset(false,true);
  try{var ab=await new Blob(chunks).arrayBuffer();var ac=new (window.AudioContext||window.webkitAudioContext)();var au=await ac.decodeAudioData(ab);ac.close();
   if(au.duration<0.4){tribe.toast('That was too short. Hold on a little longer.');return}
   var r=await fetch('/api/cat/transcribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({audio:toWav(au)})});var j=await r.json();
   if(j.error)throw new Error(j.error);if(!j.text){tribe.toast("Didn't catch that. Try again.");return}send(j.text)}
  catch(e){tribe.toast((e&&e.message)||'Voice failed. Try again.')}finally{dset(false,false)}};
 mr.start();dset(true,false);setTimeout(function(){if(mr&&mr.state==='recording')mr.stop()},60000)};
// Desktop: the box sits exactly under the conversation, whatever the window or sidebar width.
var cf=document.getElementById('cf'),mc=document.querySelector('.msgcol');function fit(){if(innerWidth<900){cf.style.left='';cf.style.maxWidth='';return}var r=mc.getBoundingClientRect();cf.style.left=(r.left+r.width/2)+'px';cf.style.maxWidth=(r.width+32)+'px';mc.style.paddingBottom=Math.max(0,Math.round(r.bottom-cf.getBoundingClientRect().top)+16)+'px'}
fit();addEventListener('resize',fit);if(window.ResizeObserver)new ResizeObserver(fit).observe(mc);
if(CH.msgs.length)bottom()})()</script>`;
  const sheets = personaSheet(meta.catPersona) + (calls ? sheet("calls", calls) : "")
    + sheet("hist", `<div class="row sp"><h2>Your chats</h2><a class="btn p sm" href="/cat">${icon("plus", 14, "currentColor", 2.4)}New chat</a></div><div class="row" style="gap:8px;margin-top:12px"><a class="chip" href="/cat/memory">${icon("mem", 13, "currentColor", 2)}Chief's memory</a>${calls ? `<button type="button" class="chip" data-close="hist" data-open="calls">${icon("target", 13, "currentColor", 2)}Chief's calls</button>` : ""}</div><div class="hlist" style="margin-top:8px;max-height:56vh;overflow-y:auto">${historyList(uid, chat?.id)}</div>`);
  return page({ title: "Ask Chief", body, sheets, extraClass: "wide chatapp", slim: true });
}

export function catVoicePage(uid: number): string {
  const persona = getMeta(uid).catPersona;
  const bars = [14, 26, 38, 22, 44, 30, 40, 18, 34, 24, 12].map((h, i) => `<span style="height:${h}px;animation-delay:${i * 70}ms;animation-duration:${700 + ((i * 97) % 300)}ms"></span>`).join("");
  const aside = `<section class="flat col" aria-label="Transcript" style="gap:8px"><h2 style="font-size:16px">Transcript</h2><div id="log" class="col" style="gap:8px" aria-live="polite"><div class="sm mut" id="log0">What you say and what Chief replies shows up here.</div></div></section>
<section class="card col hide" id="ocard" aria-label="Order" style="gap:10px"><div class="row sp"><b id="otitle"></b><span class="sm" id="otag" style="font-weight:600;color:#FCD34D">Waiting for “confirm”</span></div><div class="grid3" id="olegs"></div><div class="row sm mut" id="ometa" style="gap:12px;flex-wrap:wrap"></div></section>
<p class="note">Voice uses your browser's speech recognition. Nothing is signed until you say “confirm” or tap it.</p>`;
  const body = `<style>.vwrap{min-height:100vh;display:flex;flex-direction:column;background:#000}.vwrap>.split{flex:1;display:flex;flex-direction:column}.vbub{max-width:88%;padding:9px 12px;border-radius:16px;font-size:14px;line-height:1.45}
@media (min-width:900px){.vwrap{min-height:0;background:transparent}.vwrap>.split{display:grid}.vstage{min-height:640px;border-radius:24px;background:#000;border:1px solid rgba(255,255,255,.06);padding:32px 24px!important}}</style>
<div id="v" class="vwrap"><header class="hd only-m" style="justify-content:space-between;padding:18px 16px 0"><a class="ic" href="/cat/chat" aria-label="Close voice mode" style="background:#141414">${icon("close", 16, "currentColor", 2.4)}</a><span class="mut md">Chief · Voice</span><span style="width:44px"></span></header>
<div class="only-d">${header("Ask Chief · Voice", `Chief · ${persona} · talk to trade, say “confirm” to sign`, "/cat/chat")}</div>
${split(`<main class="main vstage" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;padding:0 24px">
<button id="orb" aria-label="Start listening" style="position:relative;width:240px;height:240px;border:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center"><span aria-hidden="true" class="ring" style="position:absolute;inset:20px;border-radius:50%;border:1px solid rgba(52,211,153,.4);animation:ring 2.4s ease-out infinite"></span><span id="orbs" style="transition:transform 400ms cubic-bezier(.2,.8,.2,1)">${orb(170)}</span></button>
<div id="wave" class="wave off" aria-hidden="true">${bars}</div>
<div role="status" aria-live="polite" style="text-align:center;display:flex;flex-direction:column;gap:10px;min-height:120px;max-width:560px"><div id="phase" style="font-size:13px;font-weight:600;letter-spacing:.12em;color:#A3A3A3">TAP TO TALK</div><div id="line" style="font-size:20px;line-height:1.4">Say “buy fifty dollars of ETH with a five percent stop”.</div><div id="hint" class="dim" style="font-size:14px"></div></div>
<div class="row" style="justify-content:center;gap:22px;padding:0 0 44px"><button id="mute" class="ic" aria-pressed="false" aria-label="Mute microphone" style="width:60px;height:60px;border-radius:30px;background:#1A1A1A">${icon("mic", 22, "currentColor", 2)}</button>
<a href="/cat/chat" aria-label="End voice mode" class="ic" style="width:72px;height:72px;border-radius:36px;background:#F87171;color:#2A0A0A;border:0">${icon("close", 26, "currentColor", 2.6)}</a><a href="/cat/chat" aria-label="Switch to typing" class="ic" style="width:60px;height:60px;border-radius:30px;background:#1A1A1A">${icon("kbd", 22, "currentColor", 2)}</a></div></main>`, aside, "Transcript")}</div>
<script>(function(){
var SR=window.SpeechRecognition||window.webkitSpeechRecognition,syn=window.speechSynthesis,$=function(i){return document.getElementById(i)};
var phase=$('phase'),line=$('line'),hint=$('hint'),wave=$('wave'),orbs=$('orbs'),st='idle',muted=false,rec,chat=null,pending=null;
function setPhase(p,label,color,scale,on){st=p;phase.textContent=label;phase.style.color=color;orbs.style.transform='scale('+scale+')';wave.classList.toggle('off',!on)}
if(!SR){line.textContent='Voice needs a browser with speech recognition (Chrome, Edge or Safari).';hint.textContent='You can still type with Chief.';$('orb').disabled=true}
function listen(){if(!SR||muted)return;try{rec=new SR();rec.lang=navigator.language||'en-US';rec.interimResults=true;rec.continuous=false;var final='';
rec.onresult=function(e){var t='';for(var i=e.resultIndex;i<e.results.length;i++){t+=e.results[i][0].transcript;if(e.results[i].isFinal)final=t}line.textContent='“'+t+'”'};
rec.onend=function(){if(final)handle(final);else if(st==='listening')setPhase('idle','TAP TO TALK','#A3A3A3',1,false)};
rec.onerror=function(e){hint.textContent=e.error==='not-allowed'?'Allow microphone access to talk to Chief.':'Did not catch that. Tap the orb to try again.';setPhase('idle','TAP TO TALK','#A3A3A3',1,false)};
rec.start();setPhase('listening','LISTENING','#34D399',1,true);hint.textContent='Tap the orb when you are done'}catch(e){}}
function say(who,t){var l=$('log'),z=$('log0');if(z)z.remove();var d=document.createElement('div');d.className='vbub';d.textContent=t;d.style.alignSelf=who==='you'?'flex-end':'flex-start';d.style.background=who==='you'?'#2A2A2A':'#0F1A15';d.style.color=who==='you'?'#F5F5F5':'#D1FAE5';l.appendChild(d)}
function card(c){var o=$('ocard');if(!c){o.classList.add('hide');return}o.classList.remove('hide');o.style.borderColor='';$('otitle').textContent=c.title;$('otag').textContent='Waiting for “confirm”';$('otag').style.color='#FCD34D';
var leg=function(k,v,col){return '<div><div class="xs mut">'+k+'</div><div class="md" style="font-weight:600;color:'+col+'">'+v+'</div></div>'};
$('olegs').innerHTML=leg('Stop',c.stopPct!=null?'−'+c.stopPct+'%':'—','#F87171')+leg('Entry','Market','#F5F5F5')+leg('Target',c.tpPct!=null?'+'+c.tpPct+'%':'—','#34D399');
$('ometa').textContent=[c.maxLoss!=null?'Max loss $'+Number(c.maxLoss).toFixed(2):'',c.maxGain!=null?'Max gain $'+Number(c.maxGain).toFixed(2):'','Flash '+c.kind].filter(Boolean).join(' · ')}
function speak(t,then){if(!syn){then&&then();return}syn.cancel();var u=new SpeechSynthesisUtterance(t);u.onend=function(){then&&then()};u.onerror=u.onend;syn.speak(u)}
async function handle(text){setPhase('thinking','THINKING','#FCD34D',.88,false);hint.textContent='';say('you',text);
if(pending&&/\\b(confirm|yes|sign it|do it)\\b/i.test(text)){var c=await (await fetch('/api/cat/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:pending})})).json();pending=null;setPhase('signed','SIGNED','#34D399',1,false);line.textContent=c.ok?'Done. It landed onchain. I will ping you if it hits the stop or the target.':c.reply;say('cat',c.ok?'Signed. Landed onchain.':c.reply);if(c.ok){$('otag').textContent='Landed onchain';$('otag').style.color='#34D399';$('ocard').style.borderColor='rgba(52,211,153,.45)'}speak(c.ok?'Done. It landed onchain.':c.reply);hint.textContent='Tap to start again';return}
var r=await (await fetch('/api/cat/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text,chat:chat,source:'App'})})).json();
if(r.error){line.textContent=r.error;setPhase('idle','TAP TO TALK','#A3A3A3',1,false);return}chat=r.chatId;pending=r.proposalId||null;say('cat',r.reply);card(pending?r.card:null);
setPhase('speaking','CAT','#F5F5F5',1.06,true);line.textContent=r.reply;hint.textContent=pending?'Say “confirm”, or tap to interrupt':'Tap to talk again';speak(r.reply,function(){if(pending&&!muted)listen();else setPhase('idle','TAP TO TALK','#A3A3A3',1,false)})}
$('orb').onclick=function(){if(syn)syn.cancel();if(rec)try{rec.abort()}catch(e){}listen()};
$('mute').onclick=function(){muted=!muted;this.setAttribute('aria-pressed',muted);this.style.background=muted?'#F5F5F5':'#1A1A1A';this.style.color=muted?'#0A0A0A':'#F5F5F5';this.setAttribute('aria-label',muted?'Unmute microphone':'Mute microphone');if(muted){if(rec)try{rec.abort()}catch(e){}setPhase('idle','MUTED','#A3A3A3',1,false)}};
})()</script>`;
  return page({ title: "Voice", body, split: true });
}

export async function catMemoryPage(uid: number): Promise<string> {
  const meta = getMeta(uid);
  const learned = await learnedMemory(uid);
  const rules = rulesOf(uid);
  const list = (items: { t: string; src: string; attrs: string }[]) => `<div class="tile" style="border-radius:18px;padding:4px 6px 4px 14px">${items.map((m, i) => `<div class="row" style="min-height:52px;gap:10px;${i < items.length - 1 ? "border-bottom:1px solid #222" : ""}"><span class="grow"><span style="display:block;font-size:14px">${esc(m.t)}</span><span class="xs dim" style="display:block">${esc(m.src)}</span></span><button class="ic s" aria-label="Forget: ${esc(m.t)}" style="background:transparent;border:0;color:#8A8A8A" ${m.attrs}>${icon("close", 14, "currentColor", 2.4)}</button></div>`).join("") || '<div class="sm mut" style="padding:14px 0">Nothing here.</div>'}</div>`;
  const memSwitch = sw(meta.catMemory, "Use memory in replies", `data-act="/api/cat/memory" data-body='{"op":"toggle"}'`);
  const wipe = `<button class="btn danger" data-act="/api/cat/memory" data-body='{"op":"wipe"}' data-confirm="Forget everything? This deletes your rules and chat history.">Forget everything</button>`;
  const aside = `<section class="flat row" style="gap:12px"><span class="grow"><b class="md" style="display:block">Use memory in replies</b><span class="sm mut">Chief remembers so you don't repeat yourself</span></span>${memSwitch}</section>
<section class="flat col" style="gap:10px"><h2 style="font-size:16px">Personality</h2><div class="chips" role="radiogroup" aria-label="Personality">${PERSONAS.map(([n]) => `<button class="chip${meta.catPersona === n ? " on" : ""}" role="radio" aria-checked="${meta.catPersona === n}" data-act="/api/cat/persona" data-body='{"persona":"${n}"}'>${glyphBadge(n.toLowerCase(), 18)}${n}</button>`).join("")}</div><p class="note" style="margin:0">Changes tone only. Numbers, limits and Guard are the same for every personality.</p></section>${wipe}`;
  const body = `<header class="hd"><a class="ic" href="/cat" aria-label="Back">${icon("back", 18, "currentColor", 2)}</a><div class="grow"><h1>Chief's memory</h1><div class="sub">Same memory in the app and Telegram · only you can see it</div></div></header>
${split(`<main class="main" style="gap:20px;padding-bottom:40px"><div class="only-m"><div class="col" style="gap:20px"><section class="card row" style="gap:14px;padding:18px">${orb(48)}<div><b>Chief remembers so you don't repeat yourself</b><div class="sm mut" style="line-height:1.45;margin-top:2px">Only you can see this. Forget anything, any time.</div></div></section>
<div class="row" style="padding:0 4px"><span class="grow md">Use memory in replies</span>${memSwitch}</div></div></div>
<div class="d2" style="gap:20px"><section style="opacity:${meta.catMemory ? 1 : 0.4};transition:opacity 200ms" aria-label="About you"><h2 style="margin:0 0 8px 4px;font-size:12px;letter-spacing:.08em;color:#8A8A8A">LEARNED FROM YOUR ACTIVITY</h2>${list(learned.map((m) => ({ t: m.t, src: m.src, attrs: `data-act="/api/cat/memory" data-body='{"op":"forget","key":"${m.key}"}'` })))}</section>
<section style="opacity:${meta.catMemory ? 1 : 0.4};transition:opacity 200ms" aria-label="Your rules for Chief"><h2 style="margin:0 0 8px 4px;font-size:12px;letter-spacing:.08em;color:#8A8A8A">YOUR RULES FOR CAT</h2>${list(rules.map((r) => ({ t: r.text, src: ruleLimit(r.text) !== undefined ? `You said this in ${r.source} · enforced as a $${ruleLimit(r.text)} limit` : `You said this in ${r.source}`, attrs: `data-act="/api/cat/memory" data-body='{"op":"delrule","id":${r.id}}'` })))}
<form data-form action="/api/cat/memory" class="row" style="gap:8px;margin-top:10px"><input type="hidden" name="op" value="rule"><label class="grow row" style="height:46px;padding:0 14px;border-radius:23px;background:#141414;border:1px solid rgba(255,255,255,.1)"><input name="text" maxlength="140" placeholder="Tell Chief something to remember" aria-label="New rule for Chief" style="flex:1;min-width:0;border:0;background:transparent;color:#F5F5F5;font-size:14px" required></label><button class="btn w" style="width:auto;height:46px">Add</button></form>
<p class="note">Rules that name a dollar limit, like “Ask me before anything over $50”, add a warning when an order goes over it. Chief always waits for your confirm before signing.</p></section></div>
<div class="only-m"><div class="col" style="gap:20px"><a class="tile row" href="/cat#persona" style="border-radius:18px;padding:14px;gap:12px;color:#F5F5F5">${glyphBadge(meta.catPersona.toLowerCase(), 34)}<span class="grow"><b style="display:block;font-size:14px">Personality: ${esc(meta.catPersona)}</b><span class="sm mut">Change how Chief talks</span></span>${icon("chev", 14, "#737373", 2)}</a>
${wipe}</div></div></main>`, aside, "Memory settings")}`;
  return page({ title: "Chief's memory", body, split: true });
}
