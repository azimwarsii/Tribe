import { esc, icon, sheet } from "../ui.js";

/**
 * Ask Chief lives in the feed: a panel over the deck, opened by swiping a card up, the orb, the Ask Chief chip or Cmd+K.
 * Everywhere else, an "Ask Chief" link goes to /feed?ask=<question> (and &trade=<id> for a trade), which opens it here.
 * `tribeChief.open(question, trade)` opens it from code. Each visit starts a fresh chat; past chats stay in the database.
 */

const STARTERS = ["Show me steady trades", "Show me trades with US stocks", "Show me meme trades", "How are my trades doing?"];

export const chiefSheet = () => sheet("chief", `<div class="chiefbox"><div class="row sp" style="gap:10px"><span class="row" style="gap:10px;min-width:0"><span class="orb" aria-hidden="true" style="width:28px;height:28px"><i></i></span><h2 style="margin:0">Ask Chief</h2></span><span class="row" style="gap:6px"><button type="button" class="chip" id="chief-new" hidden>New chat</button><button class="ic s" data-close="chief" aria-label="Close">${icon("close", 14, "currentColor", 2.4)}</button></span></div>
<div id="chief-msgs" class="chiefmsgs" aria-live="polite"><p class="mut md" id="chief-hello" style="margin:0">Find a trade, check a creator or ask anything.</p></div>
<div id="chief-chips" class="chips chiefchips"></div>
<form id="chief-form" class="chiefform"><input id="chief-in" placeholder="Ask Chief anything" autocomplete="off" aria-label="Message Chief"><button class="ic" aria-label="Send" style="background:#34D399;color:#052E1C;border:0;flex:none">${icon("send", 16, "currentColor", 2.4)}</button></form></div>`);

export const CHIEF_JS = `(function(){
var STARTERS=${JSON.stringify(STARTERS)};
var msgs=document.getElementById('chief-msgs'),chips=document.getElementById('chief-chips'),inp=document.getElementById('chief-in'),fresh=document.getElementById('chief-new'),hello=document.getElementById('chief-hello');
var chat=null,trade=null,sending=false;
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function json(u,b){return fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json()})}
function down(){msgs.scrollTop=msgs.scrollHeight}
function showChips(list){chips.innerHTML='';list.forEach(function(c){var b=document.createElement(c.href?'a':'button');if(!c.href)b.type='button';b.className='chip';b.textContent=c.label;if(c.href)b.href=c.href;else b.onclick=function(){send(c.text)};chips.appendChild(b)})}
function starters(){showChips(STARTERS.map(function(t){return {label:t,text:t}}))}
function ladder(c){if(!c.stopPct&&!c.tpPct)return '';var sl=c.stopPct||0,tp=c.tpPct||0,pos=!tp?'80%':!sl?'20%':Math.max(38,Math.min(62,sl/(sl+tp)*100)).toFixed(0)+'%';return '<div role="img" aria-label="'+(sl?'Stop at -'+sl+'%':'No stop')+', '+(tp?'target at +'+tp+'%':'no target')+' from entry" style="position:relative;margin:4px 0 22px"><div style="height:6px;border-radius:3px;background:linear-gradient(90deg,rgba(248,113,113,.55),rgba(52,211,153,.55))"></div><span style="position:absolute;left:'+pos+';top:-4px;width:2px;height:14px;background:#F5F5F5"></span>'+(sl?'<span class="xs down" style="position:absolute;left:0;top:12px">Stop \\u2212'+sl+'%</span>':'')+'<span class="xs mut" style="position:absolute;left:'+pos+';top:12px;transform:translateX(-50%)">Entry</span>'+(tp?'<span class="xs up" style="position:absolute;right:0;top:12px">Target +'+tp+'%</span>':'')+'</div>'}
function card(r){var c=r.card;if(!c)return '';var edit=c.href?'<a class="btn" href="'+esc(c.href)+'">Open the trade</a>':c.usd&&c.stopPct?'<a class="btn" href="/trade/new?usd='+c.usd+'&stop='+c.stopPct+'&tp='+(c.tpPct||0)+'">Edit in trade form</a>':'<button type="button" class="btn" data-x="edit">Edit</button>';
 return '<section class="card" style="padding:14px;gap:10px;display:flex;flex-direction:column"><div class="row sp" style="gap:10px"><span style="min-width:0"><b style="display:block">'+esc(c.title)+'</b><span class="sm mut">Flash \\u00b7 '+esc(c.kind)+'</span></span><b>$'+Number(c.usd).toFixed(2)+'</b></div>'+ladder(c)+'<div class="grid3"><div class="tile"><div class="k">Max gain</div><div class="v up">'+(c.maxGain!=null?'+$'+c.maxGain.toFixed(2):'open')+'</div></div><div class="tile"><div class="k">Max loss</div><div class="v down">'+(c.maxLoss!=null?'\\u2212$'+c.maxLoss.toFixed(2):'no stop')+'</div></div><div class="tile"><div class="k">Fee</div><div class="v">$'+Number(c.fee||0).toFixed(2)+'</div></div></div><div class="grid2" data-acts>'+edit+'<button type="button" class="btn p" data-x="sign" data-p="'+esc(r.proposalId)+'">Confirm &amp; sign</button></div></section>'}
function verdict(v){if(!v)return '';var col={ok:'#34D399',warn:'#FCD34D',bad:'#F87171'}[v.tone];return '<section class="card" style="padding:14px;gap:10px;display:flex;flex-direction:column;border-color:'+col+'55"><div class="row sp"><span class="xs mut" style="letter-spacing:.08em;font-weight:700">CHIEF\\u2019S READ</span><span class="pill" style="color:'+col+';border-color:'+col+'66;background:'+col+'14">'+esc(v.label)+'</span></div><ul class="vchecks">'+v.checks.map(function(c){var k=c.ok===true?'ok':c.ok===false?'bad':'na';return '<li class="'+k+'"><i aria-hidden="true">'+(k==='ok'?'\\u2713':k==='bad'?'!':'\\u2013')+'</i>'+esc(c.t)+'</li>'}).join('')+'</ul></section>'}
function bubble(t){var d=document.createElement('div');d.className='bubble u';d.textContent=t;msgs.appendChild(d);down()}
function say(r){var box=document.createElement('div');box.className='col';box.style.gap='10px';box.innerHTML='<p style="margin:0;font-size:15px;line-height:1.5;white-space:pre-wrap"></p>'+verdict(r.verdict)+card(r);box.firstChild.textContent=r.reply;msgs.appendChild(box);showChips(r.follow||[]);down()}
function send(t){t=(t||'').trim();if(sending||!t)return;sending=true;if(hello)hello.hidden=true;fresh.hidden=false;chips.innerHTML='';bubble(t);
 var th=document.createElement('div');th.className='row';th.style.gap='8px';th.innerHTML='<span class="orb" style="width:22px;height:22px"><i></i></span><span class="sm mut">Thinking\\u2026</span>';msgs.appendChild(th);down();
 json('/api/cat/ask',{text:t,chat:chat,trade:trade}).then(function(r){th.remove();sending=false;if(r.error){tribe.toast(r.error);return}chat=r.chatId||chat;say(r)}).catch(function(){th.remove();sending=false;tribe.toast('Network error')})}
msgs.addEventListener('click',function(e){var b=e.target.closest('[data-x]');if(!b)return;
 if(b.dataset.x==='edit'){inp.value='make it $';inp.focus();return}
 b.disabled=true;json('/api/cat/confirm',{id:b.dataset.p}).then(function(r){if(r.ok){b.closest('[data-acts]').outerHTML='<div role="status" class="up md" style="font-weight:600">\\u2713 '+(r.sim?'Filled in practice mode':'Landed onchain')+'</div>'}else b.disabled=false;var n=document.createElement('p');n.style.cssText='margin:0;font-size:15px;line-height:1.5;white-space:pre-wrap';n.textContent=r.reply;msgs.appendChild(n);down()})});
document.getElementById('chief-form').onsubmit=function(e){e.preventDefault();var t=inp.value;inp.value='';send(t)};
fresh.onclick=function(){chat=null;trade=null;msgs.innerHTML='';msgs.appendChild(hello);hello.hidden=false;fresh.hidden=true;starters();inp.focus()};
window.tribeChief={open:function(q,t){tribe.sheet('chief',true);if(t)trade=t;if(q)send(q);else if(innerWidth>=900)inp.focus()}};
document.querySelectorAll('[data-chief]').forEach(function(b){b.onclick=function(){tribeChief.open()}});
starters();
// A link from another page: /feed?ask=<question>&trade=<id>, or /feed?chief=1 to just open it.
var u=new URL(location.href),q=u.searchParams.get('ask'),t=Number(u.searchParams.get('trade'))||null,go=q||u.searchParams.has('chief');
// The app's shared script may load after this one, so wait for it before opening.
function boot(){['ask','trade','chief'].forEach(function(k){u.searchParams.delete(k)});try{history.replaceState(null,'',u.pathname+u.search)}catch(e){}tribeChief.open(q,t)}
if(go){if(window.tribe)boot();else addEventListener('DOMContentLoaded',boot)}
})()`;
