import { awayLine, learnedMemory, ruleLimit } from "../cat.js";
import { chatById, chatsOf, getMeta, msgsOf, rulesOf } from "../db.js";
import { esc, glyphBadge, header, icon, notFound, page, sheet, split, sw } from "../ui.js";
import { face, initials, pct, topTraders, tradeCard } from "../data.js";
import { catCalls, contextOf, latestEntry, researchTrade, type TradeCtx } from "../research.js";

const orb = (size: number, glow = true) =>
  `<span class="orb" aria-hidden="true" style="width:${size}px;height:${size}px;box-shadow:${glow ? `0 0 ${Math.round(size * 0.5)}px rgba(52,211,153,.35),` : ""}inset 0 -${Math.round(size / 12)}px ${Math.round(size / 5)}px rgba(0,0,0,.45)"><i></i></span>`;

const PERSONAS: [string, string, string][] = [
  ["Sharp", "sharp", "Numbers first. “Bracket ready: −$2.50 max loss, +$6 target.”"],
  ["Chill", "chill", "Explains as it goes. “Here's what this order does, step by step…”"],
  ["Degen", "degen", "Memes allowed, stops still required. “Sending it. Responsibly.”"],
];

const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const day = (t: number) => { const d = new Date(t).setHours(0, 0, 0, 0), n = new Date().setHours(0, 0, 0, 0); return d === n ? "Today" : d === n - 86400e3 ? "Yesterday" : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

const composer = (bottom: number, action: string) => `<form class="composer shift" style="bottom:${bottom}px" method="get" action="${action}" id="cf"><div class="box"><label class="sr" for="cat-in" style="position:absolute;width:1px;height:1px;overflow:hidden">Message Cat</label>
<input id="cat-in" name="q" placeholder="Ask Cat anything" autocomplete="off"><input type="hidden" name="new" value="1">
<div class="row" style="gap:8px;margin-top:4px"><button type="button" class="tg" id="t-think" aria-pressed="true">${icon("think", 14, "currentColor", 2)}Think</button><button type="button" class="tg" id="t-live" aria-pressed="true">${icon("live", 14, "currentColor", 2)}Live</button><span class="grow"></span>
<a class="ic s" href="/cat/voice" aria-label="Voice mode" style="width:38px;height:38px;border-radius:19px">${icon("mic", 17, "currentColor", 2)}</a><button class="ic s" style="width:38px;height:38px;border-radius:19px;background:#34D399;color:#052E1C;border:0" aria-label="Send">${icon("up", 18, "currentColor", 2.4)}</button></div></div></form>
<script>(function(){['think','live'].forEach(function(k){var b=document.getElementById('t-'+k),v;try{v=localStorage.getItem('cat_'+k)}catch(e){}if(v==='0')b.setAttribute('aria-pressed','false');b.onclick=function(){var on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',on?'true':'false');try{localStorage.setItem('cat_'+k,on?'1':'0')}catch(e){}}})})()</script>`;

const TONE: Record<string, string> = { "Looks solid": "#34D399", Mixed: "#FCD34D", Risky: "#F87171", "Avoid for now": "#F87171" };

/** Cat's track record: every call it made in chat, scored by what the trader did next. Hidden until there is one. */
function callsCard(): string {
  const calls = catCalls();
  if (!calls.length) return "";
  return `<section class="tile" aria-label="Cat's track record" style="border-radius:18px;padding:14px"><div class="row sp" style="align-items:baseline"><b class="md">Cat’s calls</b><span class="xs mut">30 days · scored by what the trader did next</span></div><div class="col" style="gap:6px;margin-top:10px">${calls.map((c) => `<div class="row sp sm"><span style="color:${TONE[c.label]};font-weight:600">${esc(c.label)}</span><span class="mut">${c.calls} call${c.calls === 1 ? "" : "s"} · ${c.closed ? `${c.green} of ${c.closed} closed green` : "none closed yet"}</span></div>`).join("")}</div></section>`;
}

export async function catHomePage(uid: number): Promise<string> {
  const meta = getMeta(uid);
  const chats = chatsOf(uid);
  const groups = new Map<string, typeof chats>();
  for (const c of chats) groups.set(day(c.updated), [...(groups.get(day(c.updated)) ?? []), c]);
  const top = topTraders(7, 5).find((t) => t.id !== uid);
  const prompts: [string, string, string, string][] = [
    ["TRADE", "#34D399", "bolt", "Buy $50 ETH with a 5% stop and 12% target"],
    ["RESEARCH", "#F5F5F5", "bars", top ? `Is @${top.handle} worth copying?` : "Who's the safest trader this week?"],
    ["GUARD", "#F87171", "shield", "Why was @traderx paused?"],
    ["BUILD", "#FCD34D", "cat", "Turn my best trades into a bot"],
  ];
  const histCol = `<aside class="chat-hist only-d" aria-label="Chats"><a class="btn sm" href="/cat/chat?new=1" style="background:#34D399;color:#052E1C;border:0;width:100%">New chat</a>${chats.map((c) => `<a href="/cat/chat?id=${c.id}" style="display:flex;flex-direction:column;padding:10px 8px;border-bottom:1px solid #1C1C1C;color:#F5F5F5"><span style="font-size:14px">${esc(c.title)}</span><span class="xs dim">${esc(c.source)} · ${day(c.updated)}</span></a>`).join("") || '<div class="sm mut">No chats yet.</div>'}</aside>`;
  const body = `<header class="hd" style="justify-content:space-between"><button class="ic only-m" data-open="history" aria-label="Chat history">${icon("menu", 18)}</button><button class="ic only-d" type="button" data-sidetg aria-label="Show menu" aria-pressed="false" title="Show or hide the menu">${icon("menu", 18)}</button>
<button class="btn sm" data-open="persona" aria-haspopup="dialog" style="background:#1A1A1A;gap:6px">${glyphBadge(meta.catPersona.toLowerCase(), 18)}Cat <span class="mut">· ${esc(meta.catPersona)}</span>${icon("chev", 12, "#8A8A8A", 2)}</button><a class="ic" href="/cat/memory" aria-label="Cat's memory">${icon("mem", 18)}</a></header>
<main class="main catgrid" style="gap:22px;padding-bottom:230px">${histCol}<div class="col" style="gap:22px"><div class="col" style="align-items:center;text-align:center;gap:14px;padding-top:18px">${orb(96)}<div><h1 class="h1" style="font-size:30px">${greeting()}</h1><p class="mut" style="margin:6px 0 0;font-size:16px">Trade, ask, or build something.</p></div>
<a class="pill ok" href="/guard" style="padding:6px 12px;font-size:12px"><span class="live" style="width:6px;height:6px"></span>Since you were away: ${esc(await awayLine(uid))}</a></div>
${callsCard()}<div class="col" style="gap:10px">${prompts.map(([tag, c, ic, text]) => `<a href="/cat/chat?new=1&q=${encodeURIComponent(text)}" class="tile" style="border-radius:18px;padding:14px;color:#F5F5F5;display:block"><span class="row" style="gap:6px;font-size:11px;font-weight:700;letter-spacing:.08em;color:${c}">${icon(ic, 12, c, 2.2)}${tag}</span><span style="display:block;margin-top:6px;font-size:15px;line-height:1.4">${esc(text)}</span></a>`).join("")}</div></div></main>
${composer(96, "/cat/chat")}
<div class="backdrop" id="bd-history" data-close="history"></div>
<aside class="drawer" id="history" role="dialog" aria-label="Chats"><div class="row sp"><b style="font-size:17px">Chats</b><a class="btn sm" href="/cat/chat?new=1" style="background:#34D399;color:#052E1C;border:0">New chat</a></div>
<label class="row" style="height:42px;padding:0 14px;border-radius:21px;background:#1A1A1A;border:1px solid rgba(255,255,255,.06);color:#9A9A9A">${icon("search", 15, "currentColor", 2)}<input id="hsearch" placeholder="Search chats" aria-label="Search chats" style="flex:1;min-width:0;border:0;background:transparent;color:#F5F5F5;font-size:14px"></label>
<div id="hlist">${[...groups].map(([d, items]) => `<div data-day><div class="sm mut" style="margin:10px 0 4px">${d}</div>${items.map((c) => `<a href="/cat/chat?id=${c.id}" data-t="${esc(c.title.toLowerCase())}" style="display:flex;flex-direction:column;padding:10px 4px;border-bottom:1px solid #1C1C1C;color:#F5F5F5"><span style="font-size:14px">${esc(c.title)}</span><span class="xs dim">${esc(c.source)}</span></a>`).join("")}</div>`).join("") || '<div class="sm mut">No chats yet. Ask Cat something.</div>'}</div></aside>
<script>document.getElementById('hsearch').oninput=function(){var q=this.value.toLowerCase();document.querySelectorAll('#hlist a').forEach(function(a){a.style.display=a.dataset.t.indexOf(q)>-1?'flex':'none'})};if(location.hash==='#persona'){document.querySelector('[data-open=persona]').click()}</script>`;
  const sheets = sheet("persona", `<h2>How should Cat talk?</h2><p class="mut md" style="margin:6px 0 12px">Tone only. Your limits and Guard rules never change.</p><div class="col" role="radiogroup" style="gap:8px">${PERSONAS.map(([n, e, s]) => `<button class="opt${meta.catPersona === n ? " on" : ""}" role="radio" aria-checked="${meta.catPersona === n}" data-act="/api/cat/persona" data-body='{"persona":"${n}"}' style="justify-content:flex-start;gap:12px;padding:12px 16px">${glyphBadge(e, 40)}<span><b style="display:block">${n}</b><span class="sm mut" style="line-height:1.4">${s}</span></span></button>`).join("")}</div>`);
  return page({ title: "Ask Cat", nav: "cat", body, sheets, extraClass: "wide", slim: true });
}

/** The post a research chat is about, pinned above the composer: jump back to it or copy the trader without losing the chat. */
function contextBar(c: TradeCtx): string {
  const av = `<span class="av sm">${face(c.handle)}</span>`;
  const act = c.own ? `<a class="btn sm" href="/u/${esc(c.handle)}">Your trade</a>`
    : c.paused ? ""
    : c.copying ? `<a class="btn sm" href="/traders">Copying</a>`
    : `<a class="btn sm p" href="/copy/${esc(c.handle)}">${icon("bolt", 13)}Copy with Flash</a>`;
  return `<div class="ctxbar" role="region" aria-label="Asking about this post">${av}<a class="grow" href="/thread/${c.id}" style="min-width:0;color:#F5F5F5"><span class="xs mut" style="display:block">Asking about · back to post ↗</span><b style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">@${esc(c.handle)} · ${c.bot ? "Bot · " : ""}${esc(c.verb)} ${esc(c.symbol)}${c.sincePct === null ? "" : Math.abs(c.sincePct) < 0.05 ? ' <span class="mut">flat</span>' : ` <span class="${c.sincePct >= 0 ? "up" : "down"}">${pct(c.sincePct)}</span>`}</b></a>${act}</div>`;
}

/** Cat's read on a trader's latest entry, one tap from the full research chat. Shown before you copy. */
export async function catReadCard(viewer: number, leader: number, style = "", trade?: number): Promise<string> {
  const id = trade ?? latestEntry(leader);
  if (id === undefined || leader === viewer) return "";
  const v = (await researchTrade(viewer, id, "Is this a good trade?"))?.verdict;
  if (!v) return "";
  const col = { ok: "#34D399", warn: "#FCD34D", bad: "#F87171" }[v.tone];
  const judged = v.checks.filter((c) => c.ok !== null);
  const note = v.checks.find((c) => c.ok === false) ?? v.checks.find((c) => c.ok && /CRE CopyGuard/.test(c.t));
  return `<a class="card catread" href="/cat/chat?new=1&trade=${id}&q=${encodeURIComponent("Is this a good trade?")}" style="border-color:${col}44;${style}">${orb(34, false)}<span class="grow" style="min-width:0"><span class="xs mut" style="display:block">Cat’s read on ${trade ? "this trade" : "their latest trade"}</span><b style="color:${col}">${esc(v.label)}</b><span class="sm mut"> · ${judged.filter((c) => c.ok).length} of ${judged.length} checks pass</span>${note ? `<span class="xs row" style="gap:5px;color:#A3A3A3;margin-top:3px"><i class="ck${note.ok ? "" : " bad"}" aria-hidden="true">${note.ok ? icon("check", 9, "currentColor", 3.4) : "!"}</i>${esc(note.t)}</span>` : ""}</span><span class="mut" aria-hidden="true" style="font-size:20px">›</span></a>`;
}

/** The bar alone, for when a chat switches to another post. */
export async function ctxBarHtml(uid: number, trade: number): Promise<string> {
  const c = await tradeCard(trade, uid);
  return c ? contextBar(contextOf(c, uid)) : "";
}

export async function catChatPage(uid: number, chatId: number | undefined, q: string, trade?: number): Promise<string> {
  const chat = chatId ? chatById(chatId, uid) : undefined;
  if (chatId && !chat) return notFound("Chat not found");
  const meta = getMeta(uid);
  const msgs = chat ? msgsOf(chat.id) : [];
  const about = (JSON.parse(chat?.state || "{}") as { trade?: number }).trade ?? trade;
  const card = about ? await tradeCard(about, uid) : undefined;
  const ctx = card ? contextOf(card, uid) : undefined;
  const boot = JSON.stringify({ id: chat?.id ?? null, persona: meta.catPersona, msgs, q: q || "", auto: !!q && !chat, trade: ctx?.id ?? null }).replace(/</g, "\\u003c");
  const body = `<header class="hd"><a class="ic" id="cback" href="${ctx ? `/thread/${ctx.id}` : "/cat"}" aria-label="${ctx ? "Back to the post" : "Back"}">${icon("back", 18, "currentColor", 2)}</a><div class="grow"><h1 id="ct">${esc(chat?.title ?? "New chat")}</h1><div class="sub"><span class="row" style="gap:5px;display:inline-flex">${glyphBadge(meta.catPersona.toLowerCase(), 14)}Cat · ${esc(meta.catPersona)}</span></div></div><button class="ic only-d" type="button" data-sidetg aria-label="Show menu" aria-pressed="false" title="Show or hide the menu">${icon("menu", 18)}</button><a class="ic" href="/cat/voice" aria-label="Voice mode">${icon("mic", 18)}</a></header>
<main class="main catgrid chatpanes" style="padding-bottom:${ctx ? 220 : 150}px;--cpad:${ctx ? 230 : 160}px"><aside class="chat-hist only-d" aria-label="Chats"><a class="btn sm" href="/cat/chat?new=1" style="background:#34D399;color:#052E1C;border:0;width:100%">New chat</a>${chatsOf(uid).map((h) => `<a href="/cat/chat?id=${h.id}" style="display:flex;flex-direction:column;padding:10px 8px;border-bottom:1px solid #1C1C1C;color:#F5F5F5"><span style="font-size:14px">${esc(h.title)}</span><span class="xs dim">${esc(h.source)} · ${day(h.updated)}</span></a>`).join("")}</aside><div class="col msgcol" style="gap:14px;min-width:0"><div id="msgs" class="col" style="gap:14px"></div><div id="chips" class="chips"></div></div></main>
<form class="composer shift" style="bottom:16px" id="cf"><div id="ctxwrap">${ctx ? contextBar(ctx) : ""}</div><div class="box"><input id="cat-in" placeholder="Ask Cat anything" autocomplete="off" aria-label="Message Cat"><div class="row" style="gap:8px;margin-top:4px"><button type="button" class="tg" id="t-think" aria-pressed="true">${icon("think", 14, "currentColor", 2)}Think</button><button type="button" class="tg" id="t-live" aria-pressed="true">${icon("live", 14, "currentColor", 2)}Live</button><span class="grow"></span><a class="ic s" href="/cat/voice" aria-label="Voice mode" style="width:38px;height:38px;border-radius:19px">${icon("mic", 17, "currentColor", 2)}</a><button class="ic s" style="width:38px;height:38px;border-radius:19px;background:#34D399;color:#052E1C;border:0" aria-label="Send">${icon("up", 18, "currentColor", 2.4)}</button></div></div></form>
<script>(function(){
var CH=${boot};var msgs=document.getElementById('msgs'),chips=document.getElementById('chips'),inp=document.getElementById('cat-in'),sending=false;
function pref(k){try{return localStorage.getItem('cat_'+k)!=='0'}catch(e){return true}}
['think','live'].forEach(function(k){var b=document.getElementById('t-'+k);b.setAttribute('aria-pressed',pref(k)?'true':'false');b.onclick=function(){var on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',on?'true':'false');try{localStorage.setItem('cat_'+k,on?'1':'0')}catch(e){}}});
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var IC={bolt:'M13 2L4 14h7l-1 8 9-12h-7z',up:'M12 19V5M6 11l6-6 6 6',copy:'M9 9h11v11H9zM5 15V5h10',refresh:'M20 11a8 8 0 1 0-2 6M20 4v7h-7',thumb:'M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H7',share:'M4 12v7h16v-7M16 7l-4-4-4 4M12 3v12',think:'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3z',chev:'M6 9l6 6 6-6',check:'M5 12l4.5 4.5L19 7'};
function svg(n,s,st){return '<svg width="'+(s||15)+'" height="'+(s||15)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(st||2)+'" stroke-linecap="round" stroke-linejoin="round"'+(n==='down'?' style="transform:scaleY(-1)"':'')+'><path d="'+(IC[n==='down'?'thumb':n])+'"/></svg>'}
function userMsg(t){var d=document.createElement('div');d.className='bubble u';d.textContent=t;msgs.appendChild(d)}
function ladder(c){if(!c.stopPct&&!c.tpPct)return '';var sl=c.stopPct||0,tp=c.tpPct||0,pos=(sl/((sl+tp)||1)*100).toFixed(0)+'%';return '<div role="img" aria-label="Stop at -'+sl+'%, target at +'+tp+'% from entry" style="position:relative;margin:4px 0 22px"><div style="height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(248,113,113,.55),rgba(52,211,153,.55))"></div><span style="position:absolute;left:'+pos+';top:-4px;width:2px;height:14px;background:#F5F5F5"></span><span class="xs down" style="position:absolute;left:0;top:12px">Stop −'+sl+'%</span><span class="xs mut" style="position:absolute;left:'+pos+';top:12px;transform:translateX(-50%)">Entry</span><span class="xs up" style="position:absolute;right:0;top:12px">Target +'+tp+'%</span></div>'}
function card(m){var d=m.data||{},c=d.card;if(!c)return '';var h='<section class="card" style="padding:14px;gap:10px;display:flex;flex-direction:column"><div class="row sp"><span class="row" style="gap:10px"><span class="av">Ξ</span><span><b style="display:block">'+esc(c.title)+'</b><span class="sm mut">Flash · '+esc(c.kind)+'</span></span></span><b>$'+Number(c.usd).toFixed(2)+'</b></div>'+ladder(c)+'<div class="grid3"><div class="tile"><div class="k">Max gain</div><div class="v up">'+(c.maxGain!=null?'+$'+c.maxGain.toFixed(2):'open')+'</div></div><div class="tile"><div class="k">Max loss</div><div class="v down">'+(c.maxLoss!=null?'−$'+c.maxLoss.toFixed(2):'no stop')+'</div></div><div class="tile"><div class="k">Fee</div><div class="v">$'+c.fee.toFixed(2)+'</div></div></div>';
if(d.signed)h+='<div role="status" class="up md" style="font-weight:600;display:flex;gap:6px;align-items:center">'+svg('check',16,3)+'Landed · '+esc(d.receipt||'placed')+'</div>';else if(d.proposalId)h+='<div class="grid2"><button class="btn" data-x="edit">Edit</button><button class="btn p" data-x="sign" data-p="'+d.proposalId+'" data-m="'+m.id+'">Confirm &amp; sign</button></div>';return h+'</section>'}
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
function pin(id){CH.trade=id;document.getElementById('cback').href='/thread/'+id;fetch('/cat/ctxbar/'+id).then(function(x){return x.text()}).then(function(h){document.getElementById('ctxwrap').innerHTML=h;var mm=document.querySelector('main');mm.style.paddingBottom='220px';mm.style.setProperty('--cpad','230px')})}
// Desktop: the conversation is its own scroll pane; phones scroll the page.
function bottom(){var c=document.querySelector('.msgcol');if(c)c.scrollTop=c.scrollHeight;window.scrollTo(0,document.body.scrollHeight)}
function lastUser(){for(var i=CH.msgs.length-1;i>=0;i--)if(CH.msgs[i].role==='user')return CH.msgs[i].text}
function showChips(f){chips.innerHTML='';f.forEach(function(c){var b=document.createElement(c.href?'a':'button');var ic=c.icon,l=c.label;if(/^⚡/.test(l)){ic='bolt';l=l.replace(/^⚡ ?/,'')}b.className='chip'+(ic?' flashchip':'');b.innerHTML=(ic?svg(ic,13,2.2):'')+esc(l);if(c.href)b.href=c.href;else b.onclick=function(){send(c.text)};chips.appendChild(b)})}
function send(t){if(sending||!t.trim())return;sending=true;chips.innerHTML='';userMsg(t);CH.msgs.push({role:'user',text:t});var th=document.createElement('div');th.className='row';th.innerHTML='<span class="orb" style="width:26px;height:26px"><i></i></span><span class="sm mut">Thinking…</span>';msgs.appendChild(th);th.scrollIntoView({block:'end'});
fetch('/api/cat/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:t,chat:CH.id,live:pref('live'),trade:CH.trade})}).then(function(r){return r.json()}).then(function(r){th.remove();sending=false;if(r.error){tribe.toast(r.error);return}
if(!CH.id){CH.id=r.chatId;try{history.replaceState(null,'','/cat/chat?id='+r.chatId)}catch(e){};document.getElementById('ct').textContent=t.slice(0,60)}
var m={id:r.msgId,role:'cat',text:r.reply,vote:0,data:{card:r.card,proposalId:r.proposalId,steps:r.steps,sources:r.sources,follow:r.follow,verdict:r.verdict}};CH.msgs.push(m);catMsg(m,true,true);if(r.ctx&&r.ctx.id!==CH.trade)pin(r.ctx.id)}).catch(function(){th.remove();sending=false;tribe.toast('Network error')})}
CH.msgs.forEach(function(m,i){if(m.role==='user')userMsg(m.text);else catMsg(m,false,i===CH.msgs.length-1)});
document.getElementById('cf').onsubmit=function(e){e.preventDefault();var t=inp.value.trim();inp.value='';send(t)};
if(CH.auto&&CH.q)send(CH.q);else if(CH.q&&!CH.id){send(CH.q)}
bottom()})()</script>`;
  return page({ title: chat?.title ?? "New chat", body, extraClass: "wide chatapp", slim: true });
}

export function catVoicePage(uid: number): string {
  const persona = getMeta(uid).catPersona;
  const bars = [14, 26, 38, 22, 44, 30, 40, 18, 34, 24, 12].map((h, i) => `<span style="height:${h}px;animation-delay:${i * 70}ms;animation-duration:${700 + ((i * 97) % 300)}ms"></span>`).join("");
  const aside = `<section class="flat col" aria-label="Transcript" style="gap:8px"><h2 style="font-size:16px">Transcript</h2><div id="log" class="col" style="gap:8px" aria-live="polite"><div class="sm mut" id="log0">What you say and what Cat replies shows up here.</div></div></section>
<section class="card col hide" id="ocard" aria-label="Order" style="gap:10px"><div class="row sp"><b id="otitle"></b><span class="sm" id="otag" style="font-weight:600;color:#FCD34D">Waiting for “confirm”</span></div><div class="grid3" id="olegs"></div><div class="row sm mut" id="ometa" style="gap:12px;flex-wrap:wrap"></div></section>
<p class="note">Voice uses your browser's speech recognition. Nothing is signed until you say “confirm” or tap it.</p>`;
  const body = `<style>.vwrap{min-height:100vh;display:flex;flex-direction:column;background:#000}.vwrap>.split{flex:1;display:flex;flex-direction:column}.vbub{max-width:88%;padding:9px 12px;border-radius:16px;font-size:14px;line-height:1.45}
@media (min-width:900px){.vwrap{min-height:0;background:transparent}.vwrap>.split{display:grid}.vstage{min-height:640px;border-radius:24px;background:#000;border:1px solid rgba(255,255,255,.06);padding:32px 24px!important}}</style>
<div id="v" class="vwrap"><header class="hd only-m" style="justify-content:space-between;padding:18px 16px 0"><a class="ic" href="/cat/chat" aria-label="Close voice mode" style="background:#141414">${icon("close", 16, "currentColor", 2.4)}</a><span class="mut md">Cat · Voice</span><span style="width:44px"></span></header>
<div class="only-d">${header("Ask Cat · Voice", `Cat · ${persona} · talk to trade, say “confirm” to sign`, "/cat/chat")}</div>
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
if(!SR){line.textContent='Voice needs a browser with speech recognition (Chrome, Edge or Safari).';hint.textContent='You can still type with Cat.';$('orb').disabled=true}
function listen(){if(!SR||muted)return;try{rec=new SR();rec.lang=navigator.language||'en-US';rec.interimResults=true;rec.continuous=false;var final='';
rec.onresult=function(e){var t='';for(var i=e.resultIndex;i<e.results.length;i++){t+=e.results[i][0].transcript;if(e.results[i].isFinal)final=t}line.textContent='“'+t+'”'};
rec.onend=function(){if(final)handle(final);else if(st==='listening')setPhase('idle','TAP TO TALK','#A3A3A3',1,false)};
rec.onerror=function(e){hint.textContent=e.error==='not-allowed'?'Allow microphone access to talk to Cat.':'Did not catch that. Tap the orb to try again.';setPhase('idle','TAP TO TALK','#A3A3A3',1,false)};
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
  const aside = `<section class="flat row" style="gap:12px"><span class="grow"><b class="md" style="display:block">Use memory in replies</b><span class="sm mut">Cat remembers so you don't repeat yourself</span></span>${memSwitch}</section>
<section class="flat col" style="gap:10px"><h2 style="font-size:16px">Personality</h2><div class="chips" role="radiogroup" aria-label="Personality">${PERSONAS.map(([n]) => `<button class="chip${meta.catPersona === n ? " on" : ""}" role="radio" aria-checked="${meta.catPersona === n}" data-act="/api/cat/persona" data-body='{"persona":"${n}"}'>${glyphBadge(n.toLowerCase(), 18)}${n}</button>`).join("")}</div><p class="note" style="margin:0">Changes tone only. Numbers, limits and Guard are the same for every personality.</p></section>${wipe}`;
  const body = `<header class="hd"><a class="ic" href="/cat" aria-label="Back">${icon("back", 18, "currentColor", 2)}</a><div class="grow"><h1>Cat's memory</h1><div class="sub">Same memory in the app and Telegram · only you can see it</div></div></header>
${split(`<main class="main" style="gap:20px;padding-bottom:40px"><div class="only-m"><div class="col" style="gap:20px"><section class="card row" style="gap:14px;padding:18px">${orb(48)}<div><b>Cat remembers so you don't repeat yourself</b><div class="sm mut" style="line-height:1.45;margin-top:2px">Only you can see this. Forget anything, any time.</div></div></section>
<div class="row" style="padding:0 4px"><span class="grow md">Use memory in replies</span>${memSwitch}</div></div></div>
<div class="d2" style="gap:20px"><section style="opacity:${meta.catMemory ? 1 : 0.4};transition:opacity 200ms" aria-label="About you"><h2 style="margin:0 0 8px 4px;font-size:12px;letter-spacing:.08em;color:#8A8A8A">LEARNED FROM YOUR ACTIVITY</h2>${list(learned.map((m) => ({ t: m.t, src: m.src, attrs: `data-act="/api/cat/memory" data-body='{"op":"forget","key":"${m.key}"}'` })))}</section>
<section style="opacity:${meta.catMemory ? 1 : 0.4};transition:opacity 200ms" aria-label="Your rules for Cat"><h2 style="margin:0 0 8px 4px;font-size:12px;letter-spacing:.08em;color:#8A8A8A">YOUR RULES FOR CAT</h2>${list(rules.map((r) => ({ t: r.text, src: ruleLimit(r.text) !== undefined ? `You said this in ${r.source} · enforced as a $${ruleLimit(r.text)} limit` : `You said this in ${r.source}`, attrs: `data-act="/api/cat/memory" data-body='{"op":"delrule","id":${r.id}}'` })))}
<form data-form action="/api/cat/memory" class="row" style="gap:8px;margin-top:10px"><input type="hidden" name="op" value="rule"><label class="grow row" style="height:46px;padding:0 14px;border-radius:23px;background:#141414;border:1px solid rgba(255,255,255,.1)"><input name="text" maxlength="140" placeholder="Tell Cat something to remember" aria-label="New rule for Cat" style="flex:1;min-width:0;border:0;background:transparent;color:#F5F5F5;font-size:14px" required></label><button class="btn w" style="width:auto;height:46px">Add</button></form>
<p class="note">Rules that name a dollar limit, like “Ask me before anything over $50”, add a warning when an order goes over it. Cat always waits for your confirm before signing.</p></section></div>
<div class="only-m"><div class="col" style="gap:20px"><a class="tile row" href="/cat#persona" style="border-radius:18px;padding:14px;gap:12px;color:#F5F5F5">${glyphBadge(meta.catPersona.toLowerCase(), 34)}<span class="grow"><b style="display:block;font-size:14px">Personality: ${esc(meta.catPersona)}</b><span class="sm mut">Change how Cat talks</span></span>${icon("chev", 14, "#737373", 2)}</a>
${wipe}</div></div></main>`, aside, "Memory settings")}`;
  return page({ title: "Cat's memory", body, split: true });
}
