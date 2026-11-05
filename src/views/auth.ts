import { esc, icon, page } from "../ui.js";

const wordmark = (size: number) => `<span style="font-size:${size}px;font-weight:700;letter-spacing:-.05em">tribe<span style="color:#34D399">.</span></span>`;

export function splashPage(): string {
  return page({
    title: "Tribe",
    focus: true,
    extraClass: "splash",
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
    body: `<a href="/intro" data-auto="/intro" data-delay="2600" aria-label="Tribe. Tap to continue" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:inherit">
<div class="glow" aria-hidden="true"></div><div class="w">tribe<i aria-hidden="true"></i></div><p>Copy great traders. Guarded onchain.</p>
<div class="ld" aria-hidden="true"><div></div></div><div class="ft"><span>Flash orders</span><span aria-hidden="true">·</span><span>Chainlink CRE</span><span aria-hidden="true">·</span><span>Privy</span></div></a>`,
  });
}

const SLIDES: { h: string; p: string; art: string }[] = [
  {
    h: "Copy the best traders",
    p: "Every trade copies with its stop and target, at the size you choose.",
    art: `<div style="width:260px;padding:14px;border-radius:18px;background:linear-gradient(180deg,#262626,#171717);border:1px solid rgba(255,255,255,.08);box-shadow:0 20px 40px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:10px">
<div class="row"><span class="av w sm">NO</span><span class="grow md" style="font-weight:600">@nightowl</span><span class="up lg">+8.4%</span></div><div style="font-size:18px;font-weight:600">ETH long</div>
<div class="row" style="gap:4px"><span class="pill flash">FLASH BRACKET</span><span class="pill bad">SL −5%</span><span class="pill ok">TP +12%</span></div>
<div class="btn p" style="height:38px">${icon("bolt", 12)} Copy with Flash</div></div>`,
  },
  {
    h: "A safety net, onchain",
    p: "Chainlink CRE checks every trader every 5 minutes and pauses risky ones before you copy them.",
    art: `<div style="width:270px;padding:14px;border-radius:18px;background:linear-gradient(180deg,#262626,#171717);border:1px solid rgba(248,113,113,.4);display:flex;flex-direction:column;gap:10px">
<div class="row sp"><span class="md" style="font-weight:600">@traderx</span><span class="pill bad">Paused by Guard</span></div>
<div style="position:relative;height:6px;border-radius:3px;background:#262626"><div style="width:91%;height:6px;border-radius:3px;background:#F87171"></div><span style="position:absolute;left:65%;top:-4px;width:2px;height:14px;background:#F5F5F5"></span></div>
<div class="row sp sm mut"><span>Risk 91</span><span>Pause line 65</span></div><div class="up sm">Proof onchain ↗</div></div>`,
  },
  {
    h: "Just ask Cat",
    p: "Trade in plain words, get answers, and see why Guard acted. Here or in Telegram.",
    art: `<div style="width:280px;display:flex;flex-direction:column;gap:10px"><div class="bubble u" style="font-size:13px">buy $50 ETH with 5% stop</div>
<div style="padding:12px;border-radius:18px;background:linear-gradient(180deg,#262626,#171717);border:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:8px"><div class="row sp sm"><b>ETH · Long</b><span class="mut">$50.00</span></div>
<div class="grid2 xs"><span class="tile up">Max gain +$6</span><span class="tile down">Max loss −$2.50</span></div><div class="btn p" style="height:32px;font-size:13px">Confirm &amp; sign</div></div></div>`,
  },
  {
    h: "Earn when people copy you",
    p: "Publish your trades or a bot. Every copy pays you a share of the Flash fee.",
    art: `<div style="width:270px;padding:16px;border-radius:18px;background:linear-gradient(180deg,#262626,#171717);border:1px solid rgba(255,255,255,.08)"><div class="sm mut">Creator earnings · this month</div>
<div style="font-size:30px;font-weight:600;margin-top:4px">$186<span class="dim">.40</span></div><svg width="100%" height="50" viewBox="0 0 238 50" preserveAspectRatio="none"><path d="M0 44 L34 40 L68 41 L102 32 L136 28 L170 20 L204 14 L238 6" fill="none" stroke="#34D399" stroke-width="2"/></svg>
<div class="row sp sm mut"><span>128 copiers</span><span class="up">Fee-share</span></div></div>`,
  },
];

export function introPage(): string {
  const slides = SLIDES.map(
    (s, i) => `<div class="step ${i ? "hide" : ""}" data-step-id="${i + 1}" style="flex:1;display:flex;flex-direction:column;gap:28px">
<div aria-hidden="true" style="height:360px;border-radius:28px;background:radial-gradient(ellipse 80% 60% at 50% 30%,rgba(255,255,255,.07),rgba(255,255,255,0) 70%),#0E0E0E;border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">${s.art}</div>
<div><h1 class="h1" style="font-size:30px">${esc(s.h)}</h1><p style="margin:10px 0 0;font-size:16px;color:#A3A3A3;line-height:1.5">${esc(s.p)}</p></div></div>`,
  ).join("");
  const dots = SLIDES.map((_, i) => `<button role="tab" aria-label="Page ${i + 1}" data-goto="${i + 1}" data-dot="${i + 1}" style="width:${i ? 8 : 24}px;height:8px;border-radius:4px;border:0;padding:0;background:${i ? "#3A3A3A" : "#F5F5F5"}"></button>`).join("");
  return page({
    title: "Welcome",
    focus: true,
    body: `<div data-scope id="intro" style="flex:1;display:flex;flex-direction:column">
<header class="hd" style="justify-content:space-between;padding:20px 20px 8px">${wordmark(22)}<a href="/onboarding" class="mut md" style="min-height:40px;display:flex;align-items:center">Skip</a></header>
<main class="main" style="padding-top:12px">${slides}</main>
<div style="padding:16px 20px 28px;display:flex;flex-direction:column;gap:16px"><div class="row" style="justify-content:center;gap:6px" role="tablist">${dots}</div>
<button class="btn w big" id="next">Next</button><a class="btn p big hide" id="start" href="/onboarding">Get started</a></div></div>
<script>(function(){var i=1,n=${SLIDES.length},sc=document.getElementById('intro');function show(k){i=k;sc.querySelectorAll('[data-step-id]').forEach(function(s){s.classList.toggle('hide',Number(s.dataset.stepId)!==k)});sc.querySelectorAll('[data-dot]').forEach(function(d){var on=Number(d.dataset.dot)===k;d.style.width=on?'24px':'8px';d.style.background=on?'#F5F5F5':'#3A3A3A'});document.getElementById('next').classList.toggle('hide',k===n);document.getElementById('start').classList.toggle('hide',k!==n)}
document.getElementById('next').onclick=function(){show(i+1)};sc.querySelectorAll('[data-dot]').forEach(function(d){d.onclick=function(e){e.stopPropagation();show(Number(d.dataset.dot))}})})()</script>`,
  });
}

const AV_ICONS = ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M13 2L4 14h7l-1 8 9-12h-7z", "M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9z", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8", "M5 5l2.5 3.5h9L19 5v9a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6z", "M3 17l6-6 4 4 8-8", "M12 2l3 6 6 .9-4.5 4.4 1 6.2L12 16.6 6.5 19.5l1-6.2L3 8.9 9 8z", "M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0"];
const AV_NAMES = ["Cube", "Bolt", "Shield", "Target", "Cat", "Chart", "Star", "Arc"];

export function onboardingPage(demo: boolean, retake = false, follow = ""): string {
  const avatars = AV_ICONS.map(
    (d, i) => `<button type="button" role="radio" aria-checked="${i === 0}" aria-label="${AV_NAMES[i]}" data-pick data-name="avatar" data-val="${i}" class="${i === 0 ? "on" : ""} avb" style="aspect-ratio:1;border-radius:50%;border:0;padding:0;background:${i % 2 ? "#F5F5F5" : "#262626"};display:flex;align-items:center;justify-content:center;color:${i % 2 ? "#0A0A0A" : "#F5F5F5"}"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg></button>`,
  ).join("");
  const authBtn = (label: string, primary = false) => `<button type="button" class="btn big ${primary ? "w" : ""}" data-goto="2">${label}</button>`;
  return page({
    title: "Get started",
    focus: true,
    extraClass: "obw",
    head: `<style>.avb{box-shadow:0 0 0 3px #0A0A0A,0 0 0 5px transparent}.avb.on{box-shadow:0 0 0 3px #0A0A0A,0 0 0 5px #34D399}
.obnav [data-nav]{display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:16px;color:#A3A3A3}.obnav [data-nav] i{width:30px;height:30px;border-radius:15px;border:2px solid #3A3A3A;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;font-weight:600;flex-shrink:0}
.obnav [data-nav].on{background:#1A1A1A;color:#F5F5F5}.obnav [data-nav].on i{border-color:#34D399;color:#34D399}.obnav [data-nav].done{color:#F5F5F5}.obnav [data-nav].done i{border-color:#34D399;background:#34D399;color:#052E1C}
@media (min-width:900px){.app.focus.obw{max-width:1120px}#ob{display:grid!important;grid-template-columns:360px minmax(0,1fr);gap:56px;align-items:start;padding:0 28px 40px}.obcol{border-radius:24px;background:#121212;border:1px solid rgba(255,255,255,.07);padding:4px 8px 20px;min-height:560px;display:flex;flex-direction:column}.obbars{visibility:hidden}#ob [aria-label=Avatar]{grid-template-columns:repeat(8,minmax(0,1fr))!important}}</style>`,
    body: `<header class="hd only-d" style="justify-content:space-between">${wordmark(26)}<span class="sm mut">Wallets by Privy · non-custodial</span></header>
<div data-scope id="ob" style="flex:1;display:flex;flex-direction:column">
<nav class="only-d obnav" aria-label="Steps"><div class="xs up" style="font-weight:600;letter-spacing:.1em;margin-top:24px">GET STARTED</div><h1 class="h1" style="font-size:32px;margin:12px 0 24px">Copy great traders, with a safety net onchain.</h1>
${[["Sign in", "Email, Google or wallet"], ["Name and face", "How others see you"], ["Risk quiz", "3 quick questions"], ["Your persona", "Safe default rules"]].map(([t, s], i) => `<div data-nav="${i + 1}" class="${i === 0 ? "on" : ""}" aria-current="${i === 0 ? "step" : "false"}"><i>${i + 1}</i><span><b style="display:block;font-size:15px">${t}</b><span class="sm mut">${s}</span></span></div>`).join("")}</nav>
<div class="obcol" style="flex:1;display:flex;flex-direction:column">
<div class="row" style="padding:22px 20px 0;min-height:44px"><button class="ic hide" id="ob-back" aria-label="Back">${icon("back", 18, "currentColor", 2)}</button>
<div class="obbars" style="flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px" aria-hidden="true"><span data-bar="1" style="height:4px;border-radius:2px;background:#34D399"></span><span data-bar="2" style="height:4px;border-radius:2px;background:#262626"></span><span data-bar="3" style="height:4px;border-radius:2px;background:#262626"></span></div></div>
<main class="main" style="padding-top:28px;gap:20px">
<section class="step col" data-step-id="1" style="flex:1"><div class="only-m"><div style="padding-top:40px">${wordmark(44)}<h1 class="h1" style="margin-top:18px">Copy great traders.<br><span class="dim">With a safety net onchain.</span></h1>
<p class="mut" style="margin:8px 0 0;font-size:15px;line-height:1.5">Your wallet is created for you and stays yours. No seed phrase to start.</p></div></div>
<div class="only-d"><h1 class="h1">Create your account</h1><p class="mut" style="margin:8px 0 0;font-size:15px;line-height:1.5">Your wallet is created for you and stays yours. No seed phrase to start.</p></div>
<div class="col" style="margin-top:auto;gap:10px;padding-bottom:8px">${authBtn("Continue with email", true)}${authBtn("Continue with Google")}${authBtn("Connect a wallet")}
<div class="note" style="text-align:center">${demo ? "Demo build: this creates a local account. Privy sign-in comes next." : "Wallets by Privy · non-custodial"}</div></div></section>
<section class="step col hide" data-step-id="2"><div><h1 class="h1">Pick a name and a face</h1><p class="mut" style="margin:8px 0 0;font-size:15px">This is how others see you on the feed and leaderboard.</p></div>
<div><label class="l" for="handle">Handle</label><div class="row" style="height:52px;padding:0 16px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:#151515"><span class="dim">@</span><input id="handle" name="handle" autocomplete="off" autocapitalize="none" maxlength="20" placeholder="yourhandle" style="flex:1;min-width:0;border:0;background:transparent;color:#F5F5F5;font-size:16px;padding:0 0 0 2px"><span id="hstate" class="sm"></span></div></div>
<div><div class="md" style="font-weight:600;margin-bottom:10px">Avatar</div><div role="radiogroup" aria-label="Avatar" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">${avatars}</div><input type="hidden" name="avatar" value="0"></div>
<button type="button" class="btn p big" id="to3" style="margin-top:auto" disabled>Continue</button></section>
<section class="step col hide" data-step-id="3"><div><div class="sm mut">Risk quiz · question <span id="qn">1</span> of 3</div><h1 class="h1" id="qt" style="margin-top:6px"></h1></div>
<div class="col" style="gap:10px" id="qa"></div><button type="button" class="link" id="skipq" style="margin-top:auto">Skip, use balanced defaults</button></section>
<section class="step col hide" data-step-id="4" style="flex:1"><div class="card" style="text-align:center;margin-top:10px"><div class="sm mut">You're a</div><div id="persona" style="font-size:40px;font-weight:700;letter-spacing:-.03em"></div><p id="pline" style="margin:8px 0 0;font-size:14px;color:#C4C4C4;line-height:1.5"></p></div>
<div><div class="md" style="font-weight:600;margin-bottom:8px">Your starting copy rules</div><div class="tile" style="padding:4px 14px;border-radius:14px" id="rules"></div><div class="note" style="margin-top:8px">Change these any time, or per trader when you copy.</div></div>
<button type="button" class="btn p big" id="finish" style="margin-top:auto">Find traders to copy</button></section></main><div style="height:22px"></div></div></div>
<input type="hidden" name="persona" value="Sniper" form="none">
<script>(function(){
var RETAKE=${retake ? 'true' : 'false'},FOLLOW=${JSON.stringify(follow)};var sc=document.getElementById('ob'),step=1,q=0,score=0,persona='Sniper';
var Q=[['A trade you copied drops 10% in an hour. You…',['Close it right away','Let the stop-loss handle it','Hold, it will come back','Buy more on the dip']],['How much would you put into one trade?',['$10 or less','About $25','About $50','$100 or more']],['What matters most to you?',['Not losing money','Steady growth','Catching big moves','Fast flips, high risk']]];
var D={Guardian:['Safety first. You copy slowly and only with stops.',10,40,'Yes','Strict'],Hodler:['Steady and patient. You copy calm traders for the long run.',20,80,'Yes','Balanced'],Sniper:['Picky and precise. You copy few trades with tight stops.',25,100,'Yes','Balanced'],Degen:['You like big swings. Guard stays on to catch the worst.',50,200,'No','Relaxed']};
function go(n){step=n;sc.querySelectorAll('[data-step-id]').forEach(function(s){s.classList.toggle('hide',Number(s.dataset.stepId)!==n)});sc.querySelectorAll('[data-bar]').forEach(function(b){b.style.background=Number(b.dataset.bar)<=Math.min(n,3)?'#34D399':'#262626'});document.getElementById('ob-back').classList.toggle('hide',!(n===2||n===3));sc.querySelectorAll('[data-nav]').forEach(function(x){var k=Number(x.dataset.nav);x.classList.toggle('on',k===n);x.classList.toggle('done',k<n);x.setAttribute('aria-current',k===n?'step':'false');x.querySelector('i').innerHTML=k<n?'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4.5 4.5L19 7"/></svg>':k});window.scrollTo(0,0)}
sc.querySelectorAll('[data-goto]').forEach(function(b){b.addEventListener('click',function(e){e.stopImmediatePropagation();go(Number(b.dataset.goto))},true)});
document.getElementById('ob-back').onclick=function(){if(step===3&&q>0){q--;score=0;showQ()}else go(step-1)};
var h=document.getElementById('handle'),hs=document.getElementById('hstate'),to3=document.getElementById('to3'),t;
h.addEventListener('input',function(){var v=h.value.trim();clearTimeout(t);to3.disabled=true;if(!/^[a-z0-9_]{3,20}$/i.test(v)){hs.textContent=v?'3-20 letters, numbers, _':'';hs.className='sm mut';return}
t=setTimeout(function(){fetch('/api/handle?h='+encodeURIComponent(v)).then(function(r){return r.json()}).then(function(j){hs.textContent=j.free?'Available':(j.why||'Taken');hs.className='sm '+(j.free?'up':'down');to3.disabled=!j.free})},250)});
to3.onclick=function(){q=0;score=0;showQ();go(3)};
function showQ(){var d=Q[Math.min(q,2)];document.getElementById('qn').textContent=Math.min(q,2)+1;document.getElementById('qt').textContent=d[0];var a=document.getElementById('qa');a.innerHTML='';d[1].forEach(function(l,i){var b=document.createElement('button');b.type='button';b.className='opt';b.innerHTML=l+'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';b.onclick=function(){score+=i;if(q<2){q++;showQ()}else finishQuiz()};a.appendChild(b)})}
function finishQuiz(){persona=score<=1?'Guardian':score<=4?'Hodler':score<=7?'Sniper':'Degen';showPersona()}
document.getElementById('skipq').onclick=function(){score=3;persona='Hodler';showPersona()};
function showPersona(){var d=D[persona];document.getElementById('persona').textContent=persona;document.getElementById('pline').textContent=d[0];
document.getElementById('rules').innerHTML=[['Max per trade','$'+d[1]],['Daily cap','$'+d[2]],['Stop-loss required',d[3]],['Guard strictness',d[4]]].map(function(r){return '<div class="row sp md" style="min-height:44px;border-bottom:1px solid #222"><span class="mut">'+r[0]+'</span><b>'+r[1]+'</b></div>'}).join('');go(4)}
document.getElementById('finish').onclick=function(){var b=this;b.disabled=true;fetch(RETAKE?'/api/persona':'/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({handle:h.value.trim(),avatar:Number(sc.querySelector('input[name=avatar]').value),persona:persona,follow:FOLLOW})}).then(function(r){return r.json()}).then(function(j){if(j.redirect)location.href=j.redirect;else{b.disabled=false;tribe.toast(j.error||'Could not sign up')}})};
if(RETAKE){document.getElementById('finish').textContent='Save my risk profile';q=0;score=0;showQ();go(3);document.getElementById('ob-back').classList.add('hide')}
})()</script>`,
  });
}
