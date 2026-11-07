import { basketsBy } from "../baskets.js";
import { basketRow } from "./baskets.js";
import { botById, botRecord, botsOf, copierOutcomes, copyLedger, earningsOf, openSignals, publishChecks, STAKE_USD, stakeOf, TEMPLATES, TRIAL_DAYS, type Bot, type TemplateKey } from "../creator.js";
import { db, getMeta, getUser, guardEvents, strategiesOf, userById } from "../db.js";
import { ago, freeBalance as freeBalanceOf, money, pct, tradeCard } from "../data.js";
import { TOKENS } from "../parse.js";
import { getPrice } from "../prices.js";
import { isDry } from "../tracker.js";
import { isExternal } from "../wallet.js";
import { esc, header, icon, money2, page } from "../ui.js";
import { MIN_LIQUIDITY, tradableToken } from "../tokens.js";

const fmtPx = (p: number) => `$${p > 0 && p < 1 ? p.toFixed(Math.min(14, Math.ceil(-Math.log10(p)) + 3)) : p.toFixed(2)}`;
import { tradeCardHtml } from "./feed.js";

/**
 * Creator Studio, start to end: post a trade by hand (the trade ticket), build a bot from a template, run it on a
 * private trial, publish it, and see what copiers did and what you earned.
 */

const chips = (name: string, opts: { v: number | string; l: string }[], cur: number | string, custom?: { ph: string; unit?: string }) =>
  `<div class="chips" role="radiogroup" aria-label="${esc(name)}">${opts.map((o) => `<button type="button" class="chip${String(o.v) === String(cur) ? " on" : ""}" data-pick data-name="${name}" data-val="${o.v}" role="radio" aria-checked="${String(o.v) === String(cur)}">${esc(o.l)}</button>`).join("")}${custom ? `<label class="chip cust"><input type="number" inputmode="decimal" step="any" min="0" data-custom="${name}" placeholder="${esc(custom.ph)}" aria-label="Custom ${esc(name)}"${opts.some((o) => String(o.v) === String(cur)) ? "" : ` value="${esc(String(cur))}"`}>${custom.unit ?? ""}</label>` : ""}</div><input type="hidden" name="${name}" value="${esc(String(cur))}">`;

/** Custom-amount inputs next to chips: typing sets the value and clears the chips. */
const CUSTOM_JS = `document.addEventListener('input',function(e){var i=e.target.closest('[data-custom]');if(!i)return;var sc=i.closest('[data-scope]')||document,n=i.dataset.custom;sc.querySelectorAll('[data-pick][data-name="'+n+'"]').forEach(function(c){c.classList.remove('on');c.setAttribute('aria-checked','false')});var h=sc.querySelector('input[type=hidden][name="'+n+'"]');if(h)h.value=i.value;sc.dispatchEvent(new Event('change'))});
document.addEventListener('click',function(e){var c=e.target.closest('[data-pick]');if(!c)return;var sc=c.closest('[data-scope]')||document,i=sc.querySelector('[data-custom="'+c.dataset.name+'"]');if(i)i.value='';setTimeout(function(){sc.dispatchEvent(new Event('change'))},0)});`;

const field = (label: string, inner: string, hint = "") => `<section class="col tkf"><div class="row sp"><b class="md">${label}</b>${hint ? `<span class="xs mut">${hint}</span>` : ""}</div>${inner}</section>`;

function walletLine(uid: number): string {
  if (isExternal(uid)) return isDry()
    ? "Demo mode: trades are simulated, so this places right away. With real money, MetaMask asks you to sign."
    : "Your MetaMask wallet signs this order.";
  return getUser(uid).privy_wallet_id ? "Placed from your Tribe wallet, within its spending limits." : "Placed from your demo wallet (simulated money).";
}

// ---------- Trade ticket ----------

/** Post a trade by hand: amount, a required stop, an optional target and why. Ask Chief can pre-fill it (?usd=&stop=&tp=&note=). */
export async function tradeTicketPage(uid: number, q: Record<string, unknown>): Promise<string> {
  // Any Base token Flash can trade (?token=0x… pre-picks one); ETH to start.
  const picked = typeof q.token === "string" && /^0x[0-9a-fA-F]{40}$/.test(q.token) ? await tradableToken(q.token).catch(() => undefined) : undefined;
  const tok = picked ?? { address: "ETH", symbol: "ETH", name: "Ether", price: await getPrice(TOKENS.ETH).catch(() => 0), image: null as string | null, change24h: 0 };
  const price = tok.price;
  const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : def);
  const free = await freeBalanceOf(uid);
  // Never suggest more than the wallet holds (live: real USDC on Base).
  const usd = Math.min(num(q.usd, 25), Math.max(1, Math.floor(free))), stop = num(q.stop, 5), tp = q.tp === "0" ? 0 : num(q.tp, 10);
  // MetaMask (live) signs only the entry: exits that must be signed after the fill (breakout, trailing) aren't offered.
  const oneOrder = isExternal(uid) && !isDry();
  const types = [{ v: "market", l: "Market" }, { v: "limit", l: "Limit" }, ...(oneOrder ? [] : [{ v: "stop", l: "Breakout" }]), { v: "twap", l: "TWAP" }];
  const stopTypes = [{ v: "fixed", l: "Fixed" }, ...(oneOrder ? [] : [{ v: "trailing-stop", l: "Trailing" }, { v: "trailing-stop-limit", l: "Trailing limit" }])];
  const type = types.some((t) => t.v === q.type) ? String(q.type) : "market";
  const stopType = stopTypes.some((t) => t.v === q.stopType) ? String(q.stopType) : "fixed";
  const followers = (db.prepare("SELECT COUNT(*) AS n FROM follows WHERE leader = ?").get(uid) as { n: number }).n;
  const body = `${header("New trade", "Placed through Flash, always with a stop", "/portfolio?tab=creating")}
<main class="main tkmain" data-scope id="tk">
<section class="card col" style="gap:14px">
${field("Token", `<input type="hidden" name="token" value="${esc(tok.address)}">
<button type="button" class="tkpick" id="tk-pick" aria-expanded="false" aria-controls="tk-list"><span class="tkimg" id="tk-img">${tok.image ? `<img src="${esc(tok.image)}" alt="">` : esc(tok.symbol.slice(0, 1))}</span><span class="grow"><b id="tk-sym">${esc(tok.symbol)}</b><span class="xs mut" id="tk-name" style="display:block">${esc(tok.name)}</span></span><span class="sm mut">Now <b style="color:#F5F5F5" id="tk-px" data-px="${price}">${esc(fmtPx(price))}</b></span><span class="chip" style="height:30px">Change</span></button>
<div class="tklist" id="tk-list" hidden><input class="f" id="tk-q" placeholder="Search any token on Base (name, symbol or address)" autocomplete="off" aria-label="Search tokens"><div id="tk-res" class="col" style="gap:4px" role="listbox" aria-label="Tokens"></div><div class="xs mut">Prices and routes from Flash. Tokens Flash flags as risky, or with under $${(MIN_LIQUIDITY() / 1000).toFixed(0)}k of liquidity, can't be picked.</div></div>`, "Any token Flash trades on Base")}
${field("Amount", chips("usd", [1, 2, 5, 10, 25, 50, 100].filter((v) => v <= Math.max(1, free)).slice(-4).map((v) => ({ v, l: `$${v}` })), usd, { ph: "Custom", unit: "" }), `$${free.toFixed(2)} USDC available`)}
${field("Order type", chips("type", types, type), "How it buys")}
<div id="tk-atf" hidden>${field('<span id="tk-atl">Price</span>', `<label class="chip cust" style="width:100%;height:40px"><span>$</span><input class="tkat" name="price" type="number" inputmode="decimal" step="any" min="0" aria-label="Order price in dollars" style="width:100%"${Number(q.price) > 0 ? ` value="${esc(String(q.price))}"` : ""}></label>`, '<span id="tk-ath"></span>')}</div>
<div id="tk-twf" hidden>${field("Spread over", chips("minutes", [15, 30, 60, 240].map((v) => ({ v, l: v < 60 ? `${v} min` : `${v / 60} h` })), num(q.minutes, 30), { ph: "min" }), "Smaller slices, less price impact")}</div>
${field("Stop", chips("stopType", stopTypes, stopType) + chips("stop", [2, 3, 5, 8, 10].map((v) => ({ v, l: `−${v}%` })), stop, { ph: "%" }) + '<div class="xs mut" id="tk-stopnote"></div>', "Required: every trade on Tribe has one")}
<div id="tk-actf" hidden>${field("Start trailing at", `<label class="chip cust" style="width:100%;height:40px"><span>$</span><input name="activation" type="number" inputmode="decimal" step="any" min="0" placeholder="Right away" aria-label="Price that arms the trailing stop" style="width:100%"></label>`, "Optional: it trails once the price gets there")}</div>
<div id="tk-tpf">${field("Target", chips("tp", [{ v: 0, l: "None" }, ...[5, 10, 20].map((v) => ({ v, l: `+${v}%` }))], tp, { ph: "%" }))}</div>
${field("Why", `<textarea name="note" rows="2" maxlength="200" class="tkta" placeholder="One line on why: copiers see it on the trade card">${esc(String(q.note ?? ""))}</textarea>`, "Optional")}
</section>
<section class="card col tksum" aria-live="polite" style="gap:10px"><div class="row sp"><b>Your order</b><span class="pill flash">${icon("bolt", 11)}Flash</span></div><div class="md" id="tk-line"></div>
<div class="grid2"><div class="tile"><div class="k">If the stop hits</div><div class="v down" id="tk-loss"></div></div><div class="tile"><div class="k">If the target hits</div><div class="v up" id="tk-gain"></div></div></div>
<div class="xs mut">${followers ? `${followers} ${followers === 1 ? "person follows" : "people follow"} you: each copy goes by their own limits, and they approve it unless they chose auto-copy.` : "Nobody follows you yet: this builds your public record."} ${esc(walletLine(uid))}</div>
<button class="btn p" id="tk-go" data-act="/api/trade/new" data-collect="#tk">${icon("bolt", 15, "currentColor", 2.2)}Place trade</button></section>
</main>
<script>${CUSTOM_JS}
(function(){var sc=document.getElementById('tk'),px=Number(document.getElementById('tk-px').dataset.px);function v(n){var i=sc.querySelector('input[name="'+n+'"]');return Number(i&&i.value)||0}
function f(n){return '$'+(n>0&&n<1?n.toFixed(Math.min(14,Math.ceil(-Math.log10(n))+3)):n.toFixed(2))}
function e(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
// Token picker: popular tokens first, then Flash search as you type.
var pick=document.getElementById('tk-pick'),list=document.getElementById('tk-list'),q=document.getElementById('tk-q'),res=document.getElementById('tk-res'),tm;
function row(t){var b=document.createElement('button');b.type='button';b.className='tkrow'+(t.ok?'':' off');b.setAttribute('role','option');b.disabled=!t.ok;
 b.innerHTML='<span class="tkimg">'+(t.image?'<img src="'+e(t.image)+'" alt="">':e(t.symbol.slice(0,1)))+'</span><span class="grow"><b>'+e(t.symbol)+'</b><span class="xs mut" style="display:block">'+e((t.ok?t.name+' · $'+Math.round(t.liquidity/1000).toLocaleString()+'k liquidity':t.why)+(t.symbol==='ETH'?'':' · '+t.address.slice(0,6)+'…'+t.address.slice(-4)))+'</span></span><span class="sm" style="text-align:right">'+f(t.price)+'<span class="xs '+(t.change24h>=0?'up':'down')+'" style="display:block">'+(t.change24h>=0?'+':'')+t.change24h.toFixed(1)+'%</span></span>';
 if(t.ok)b.onclick=function(){sc.querySelector('input[name=token]').value=t.symbol==='ETH'?'ETH':t.address;document.getElementById('tk-sym').textContent=t.symbol;document.getElementById('tk-name').textContent=t.name;document.getElementById('tk-img').innerHTML=t.image?'<img src="'+e(t.image)+'" alt="">':e(t.symbol.slice(0,1));px=t.price;document.getElementById('tk-px').textContent=f(t.price);list.hidden=true;pick.setAttribute('aria-expanded','false');upd()};
 return b}
function load(term){res.innerHTML='<div class="sm mut" style="padding:8px">Loading…</div>';fetch('/api/tokens?q='+encodeURIComponent(term)).then(function(r){return r.json()}).then(function(j){res.innerHTML='';if(j.error){res.innerHTML='<div class="sm warn" style="padding:8px">'+e(j.error)+'</div>';return}if(!j.tokens.length){res.innerHTML='<div class="sm mut" style="padding:8px">No tokens found on Base.</div>';return}j.tokens.forEach(function(t){res.appendChild(row(t))})}).catch(function(){res.innerHTML='<div class="sm warn" style="padding:8px">Network error</div>'})}
pick.onclick=function(){var open=list.hidden;list.hidden=!open;pick.setAttribute('aria-expanded',open?'true':'false');if(open){q.value='';load('');q.focus()}};
q.oninput=function(){clearTimeout(tm);tm=setTimeout(function(){load(q.value.trim())},300)};
function sv(n){var i=sc.querySelector('input[name="'+n+'"]');return i?i.value:''}
var lastType='';
function upd(){var u=v('usd'),s=v('stop'),ty=sv('type'),st=sv('stopType'),trail=st!=='fixed',at=v('price'),m=v('minutes'),pi=sc.querySelector('input[name=price]');
 // Limit and breakout need a price: switching to one suggests 2% below (limit) or above (breakout) the price now.
 if(ty!==lastType&&(ty==='limit'||ty==='stop')&&pi&&(lastType||!pi.value)){pi.value=String(+(px*(ty==='limit'?0.98:1.02)).toPrecision(6));at=Number(pi.value)}
 lastType=ty;
 document.getElementById('tk-atf').hidden=!(ty==='limit'||ty==='stop');document.getElementById('tk-twf').hidden=ty!=='twap';
 document.getElementById('tk-atl').textContent=ty==='limit'?'Limit price':'Breakout price';
 document.getElementById('tk-ath').textContent=ty==='limit'?'Buys at this price or lower':'Buys once the price rises to it';
 document.getElementById('tk-actf').hidden=!trail;document.getElementById('tk-tpf').hidden=trail;
 document.getElementById('tk-stopnote').textContent=st==='trailing-stop'?'Follows the price up and sells at market once it falls '+(s||'…')+'% from its peak. It replaces a fixed target.':st==='trailing-stop-limit'?'Like a trailing stop, but sells with a limit at the trigger price: no slippage, though it may not fill in a fast drop.':'';
 var ref=(ty==='limit'||ty==='stop')&&at>0?at:px,t=trail?0:v('tp'),sl=ref*(1-s/100),tg=ref*(1+t/100),sym=e(document.getElementById('tk-sym').textContent);
 var how=ty==='limit'?'Limit buy <b>'+f(u)+'</b> of '+sym+' at <b>'+f(ref)+'</b> or lower':ty==='stop'?'Breakout buy <b>'+f(u)+'</b> of '+sym+' once it rises to <b>'+f(ref)+'</b>':ty==='twap'?'Buy <b>'+f(u)+'</b> of '+sym+' in slices over '+(m>=60?(m/60)+' h':m+' min')+' (about '+f(px)+' now)':'Buy <b>'+f(u)+'</b> of '+sym+' at about '+f(px);
 document.getElementById('tk-line').innerHTML=how+(s?(trail?' · trailing stop <b>'+s+'%</b> below the peak'+(v('activation')?' from '+f(v('activation')):''):' · stop <b>'+f(sl)+'</b>'):'')+(t?' · target <b>'+f(tg)+'</b>':'');
 document.getElementById('tk-loss').textContent=s?'−'+f(u*s/100)+(trail?' at most':''):'—';document.getElementById('tk-gain').textContent=trail?'Rides the trend':t?'+'+f(u*t/100):'No target';
 var ok=u>=1&&s>=0.5&&(!trail||s<=50)&&(ty==='market'||(ty==='twap'?m>=5&&m<=1440:at>0&&(ty!=='stop'||at>px)));
 var b=document.getElementById('tk-go');b.disabled=!ok}
sc.addEventListener('change',upd);sc.addEventListener('input',function(ev){var n=ev.target.name;if(n==='price'||n==='activation')upd()});upd()})()</script>`;
  return page({ title: "New trade", body, nav: "me" });
}

// ---------- Bot builder ----------

export async function botBuilderPage(uid: number): Promise<string> {
  const stake = await stakeOf(uid);
  const ext = isExternal(uid);
  const tpl = (Object.keys(TEMPLATES) as TemplateKey[]).map((k, i) => `<button type="button" class="opt${i === 0 ? " on" : ""}" data-pick data-name="template" data-val="${k}" role="radio" aria-checked="${i === 0}" style="min-height:72px;justify-content:flex-start;gap:12px;text-align:left"><span class="ic36">${icon(TEMPLATES[k].icon, 18)}</span><span class="grow"><b style="display:block">${TEMPLATES[k].name}</b><span class="sm mut" style="line-height:1.4">${TEMPLATES[k].blurb}</span></span></button>`).join("");
  const params = (Object.keys(TEMPLATES) as TemplateKey[]).map((k, i) => { const t = TEMPLATES[k].param; return `<div class="bparam" data-for="${k}"${i ? " hidden" : ""}>${field(t.label, `<div class="chips" role="radiogroup">${t.options.map((o) => `<button type="button" class="chip${o === t.def ? " on" : ""}" data-pick data-name="p_${k}" data-val="${o}" role="radio" aria-checked="${o === t.def}">${o}${t.unit}</button>`).join("")}</div><input type="hidden" name="p_${k}" value="${t.def}">`)}</div>`; }).join("");
  const wallet = ext
    ? isDry() ? "Demo mode: trades are simulated, so your bot places them itself. With real money and MetaMask, it asks you to approve each trade." : "Your wallet is MetaMask, which only you can sign for: your bot asks you to approve each trade."
    : "It trades from your wallet within these limits only. It can't send money anywhere.";
  const body = `${header("New bot", "Pick a strategy, set its limits, run a private trial", "/portfolio?tab=creating")}
<main class="main" data-scope id="bb" style="gap:14px">
<section class="card col" style="gap:14px">
${field("Name", `<input class="f" name="name" maxlength="40" placeholder="e.g. Night dip buyer" style="height:44px">`)}
${field("Strategy", `<div class="col" style="gap:8px" role="radiogroup">${tpl}</div><input type="hidden" name="template" value="dip">`)}
${params}
</section>
<section class="card col" style="gap:14px">
${field("Size per trade", chips("usd", [10, 25, 50, 100].map((v) => ({ v, l: `$${v}` })), 25, { ph: "Custom" }), "$5 to $500")}
${field("Most trades a day", chips("perDay", [1, 2, 3, 5].map((v) => ({ v, l: String(v) })), 2))}
${field("Stop on every trade", chips("stopPct", [2, 3, 5, 8].map((v) => ({ v, l: `−${v}%` })), 5), "Required")}
${field("Target", chips("tpPct", [{ v: 0, l: "None" }, ...[5, 10, 20].map((v) => ({ v, l: `+${v}%` }))], 10))}
${field("Auto-stop the bot if it's down", chips("maxDdPct", [10, 15, 25].map((v) => ({ v, l: `${v}%` })), 15))}
</section>
<section class="card col" style="gap:10px"><b>How it will trade</b><p class="md" id="bb-say" style="margin:0;line-height:1.5;color:#D4D4D4"></p>
<div class="sm mut" style="line-height:1.5">${esc(wallet)}</div>
<div class="row sp sm" style="padding-top:8px;border-top:1px solid rgba(255,255,255,.07)"><span class="mut">Your stake: $${STAKE_USD}+ of your own money in the wallet</span><b class="${stake.ok ? "up" : "warn"}">$${stake.free.toFixed(2)} free</b></div>
<div class="sm mut" style="line-height:1.5">It starts with a <b style="color:#F5F5F5">${TRIAL_DAYS}-day private trial</b>: its trades are real and build its record, but nobody sees or copies them until you publish it.</div>
${stake.ok ? `<button class="btn p" data-act="/api/bots" data-collect="#bb">${icon("play", 15, "currentColor", 2.2)}Start private trial</button>` : `<a class="btn p" href="/funds">Add funds to start</a>`}</section>
</main>
<script>${CUSTOM_JS}
(function(){var sc=document.getElementById('bb'),T=${JSON.stringify(Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => [k, { unit: t.param.unit }])))};
function v(n){var i=sc.querySelector('input[name="'+n+'"]');return i?i.value:''}
function upd(){var k=v('template');sc.querySelectorAll('.bparam').forEach(function(p){p.hidden=p.dataset.for!==k});var p=v('p_'+k),u=v('usd'),d=v('perDay'),s=v('stopPct'),t=Number(v('tpPct')),dd=v('maxDdPct');
 var rule=k==='dip'?'when ETH is '+p+'% below its high of the last 24 hours':k==='trend'?'when ETH is '+p+'% above its average of the last 6 hours':'every '+p+' hours';
 document.getElementById('bb-say').textContent='Checks ETH every minute and buys $'+u+' '+rule+', with a '+s+'% stop'+(t?' and a '+t+'% target':'')+'. At most '+d+' trade'+(d==='1'?'':'s')+' a day. If it loses '+dd+'% of what it put in, it pauses itself.'}
sc.addEventListener('change',upd);upd()})()</script>`;
  return page({ title: "New bot", body, nav: "me" });
}

// ---------- One bot ----------

const statusPill = (b: Bot) => {
  const r = botRecord(b);
  return b.status === "trial" ? `<span class="pill warn">Private trial · day ${Math.min(r.days, TRIAL_DAYS)}/${TRIAL_DAYS}</span>`
    : b.status === "live" ? `<span class="pill ok"><span class="live" style="width:6px;height:6px"></span>Live · copyable</span>`
    : b.status === "paused" ? `<span class="pill bad">Paused</span>` : `<span class="pill">Stopped</span>`;
};

const rules = (b: Bot) => {
  const t = TEMPLATES[b.template], p = b.params;
  const rule = b.template === "dip" ? `when ETH is ${p.p}% below its 24h high` : b.template === "trend" ? `when ETH is ${p.p}% above its 6h average` : `every ${p.p} hours`;
  return `Buys $${p.usd} of ETH ${rule}, with a ${p.stopPct}% stop${p.tpPct ? ` and a ${p.tpPct}% target` : ""}. At most ${p.perDay} a day; pauses itself at −${p.maxDdPct}%. (${t.name})`;
};

function recordTiles(b: Bot) {
  const r = botRecord(b);
  return `<div class="grid4 deskstats">${[
    [String(r.entries), "trades"], [r.closed ? `${r.wins}/${r.closed}` : "—", "closed green"],
    [r.closed ? `${r.realized >= 0 ? "+" : "−"}${money(Math.abs(r.realized))}` : "—", "realised"], [String(r.copiers), "copiers"],
  ].map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join("")}</div>`;
}

/** The bot's limits, changed in place: each chip saves straight away. The strategy itself is fixed once made. */
function settingsCard(b: Bot): string {
  const row = (label: string, key: string, opts: number[], fmt: (v: number) => string) =>
    `<div class="row sp" style="gap:10px;flex-wrap:wrap"><span class="sm mut">${label}</span><div class="chips">${opts.map((v) => `<button type="button" class="chip${(b.params as unknown as Record<string, number>)[key] === v ? " on" : ""}" data-act="/api/bots/${b.id}/update" data-body='{"${key}":${v}}'>${fmt(v)}</button>`).join("")}</div></div>`;
  return `<section class="card col" style="gap:12px"><b>Limits</b>
${row("Size per trade", "usd", [10, 25, 50, 100], (v) => `$${v}`)}
${row("Trades a day", "perDay", [1, 2, 3, 5], String)}
${row("Stop", "stopPct", [2, 3, 5, 8], (v) => `−${v}%`)}
${row("Target", "tpPct", [0, 5, 10, 20], (v) => (v ? `+${v}%` : "None"))}
${row("Auto-stop at", "maxDdPct", [10, 15, 25], (v) => `−${v}%`)}</section>`;
}

export async function botDetailPage(viewer: number, id: number): Promise<string | undefined> {
  const b = botById(id);
  if (!b || (b.owner !== viewer && b.status === "trial")) return undefined;
  const owner = userById(b.owner)!;
  const mine = b.owner === viewer;
  const trades = (db.prepare("SELECT id FROM trades WHERE bot_id = ? ORDER BY id DESC LIMIT 6").all(b.id) as { id: number }[]);
  const cards = (await Promise.all(trades.map((t) => tradeCard(t.id, viewer)))).filter(Boolean).map((c) => tradeCardHtml(c!, viewer)).join("");
  if (!mine) {
    const body = `${header(b.name, `A bot by @${owner.handle}`, `/u/${encodeURIComponent(owner.handle)}`)}<main class="main" style="gap:14px">
<section class="card col" style="gap:12px"><div class="row sp"><span class="row" style="gap:10px"><span class="ic36">${icon(TEMPLATES[b.template].icon, 18)}</span><b>${esc(TEMPLATES[b.template].name)}</b></span>${statusPill(b)}</div>
<p class="md" style="margin:0;color:#D4D4D4;line-height:1.5">${esc(rules(b))}</p>${recordTiles(b)}
<div class="xs mut">Its record is from real trades, including a ${TRIAL_DAYS}-day private trial before it went public. Copies go by your own limits, and CopyGuard pauses it for everyone if @${esc(owner.handle)} is flagged.</div>
<div class="grid2"><a class="btn p" href="/copy/${encodeURIComponent(owner.handle)}">${icon("bolt", 14)}Copy @${esc(owner.handle)}</a><a class="btn" href="/u/${encodeURIComponent(owner.handle)}">Profile</a></div></section>
${cards ? `<h2>Recent trades</h2>${cards}` : ""}</main>`;
    return page({ title: b.name, body });
  }
  const checks = b.status === "trial" ? await publishChecks(b) : [];
  const ready = checks.length > 0 && checks.every((c) => c.ok);
  const r = botRecord(b);
  const signals = openSignals(viewer).filter((s) => s.bot === b.id);
  const act = (a: string, label: string, cls = "btn sm", confirm = "") => `<button class="${cls}" data-act="/api/bots/${b.id}/${a}"${confirm ? ` data-confirm="${esc(confirm)}"` : ""}>${label}</button>`;
  const controls = b.status === "stopped" ? "" : `<div class="row" style="gap:8px;flex-wrap:wrap">${b.status === "paused" ? act("resume", `${icon("play", 13)}Resume`, "btn sm p") : act("pause", `${icon("pause", 13)}Pause`)}${b.status !== "paused" ? act("check", `${icon("refresh", 13)}Check now`) + act("run", `${icon("bolt", 13)}Test buy now`, "btn sm", `Place one $${b.params.usd} buy now, outside its rule?`) : ""}${act("stop", "Stop for good", "btn sm danger", "Stop this bot for good? Its record stays.")}</div>`;
  const trial = b.status === "trial" ? `<section class="card col" style="gap:10px"><div class="row sp"><b>Publish</b><span class="xs mut">${Math.min(r.days, TRIAL_DAYS)}/${TRIAL_DAYS} days</span></div><div class="bar"><i style="width:${Math.min(100, (r.days / TRIAL_DAYS) * 100).toFixed(0)}%"></i></div>
<div class="col" style="gap:6px">${checks.map((c) => `<div class="row sp sm"><span class="row" style="gap:8px"><i class="ck${c.ok ? "" : " bad"}" aria-hidden="true">${c.ok ? icon("check", 9, "currentColor", 3.4) : "·"}</i>${esc(c.label)}</span><span class="mut">${esc(c.detail)}</span></div>`).join("")}</div>
<button class="btn ${ready ? "p" : ""}" data-act="/api/bots/${b.id}/publish"${ready ? "" : " disabled"}>${icon("rise", 14)}${ready ? "Publish: let people copy it" : "Publish when every check passes"}</button>
${process.env.DEMO === "true" && r.days < TRIAL_DAYS ? `<button class="btn sm" data-act="/api/bots/${b.id}/fastforward" style="align-self:flex-start">Demo: skip the ${TRIAL_DAYS}-day wait</button>` : ""}</section>` : "";
  const body = `${header(b.name, TEMPLATES[b.template].name, "/portfolio?tab=creating")}<main class="main" style="gap:14px">
<section class="card col" style="gap:12px"><div class="row sp">${statusPill(b)}<span class="xs mut">${b.last_check ? `checked ${ago(b.last_check)} ago` : "first check within a minute"}</span></div>
<div class="tile" style="padding:12px"><div class="k">Right now</div><div class="md" style="margin-top:4px">${esc(b.status === "paused" || b.status === "stopped" ? b.reason ?? "Not running" : b.last_why ?? "Starting up")}</div></div>
<p class="sm mut" style="margin:0;line-height:1.5">${esc(rules(b))}</p>${controls}</section>
${signals.map((s) => `<section class="card col" style="gap:10px;border-color:rgba(252,211,77,.4)"><b>Your bot wants to trade</b><div class="sm">${esc(s.why)}</div><div class="grid2"><button class="btn p" data-act="/api/bot-signals/${s.id}" data-body='{"approve":true}'>${icon("bolt", 14)}Approve</button><button class="btn" data-act="/api/bot-signals/${s.id}" data-body='{"approve":false}'>Decline</button></div></section>`).join("")}
${trial}
${b.status !== "stopped" ? settingsCard(b) : ""}
<section class="card col" style="gap:12px"><b>Record</b>${recordTiles(b)}${r.returnPct !== null ? `<div class="sm mut">Return on money it put in: <b class="${r.returnPct >= 0 ? "up" : "down"}">${pct(r.returnPct)}</b></div>` : ""}</section>
${cards ? `<h2>${b.status === "trial" ? "Trial trades (only you see these)" : "Recent trades"}</h2>${cards}` : `<p class="sm mut">No trades yet. ${b.template === "dca" ? "Its first scheduled buy comes within a minute or two." : "It needs about 10 minutes of prices before its rule can fire. Use “Test buy now” to see a trade straight away."}</p>`}
</main>`;
  return page({ title: b.name, body, nav: "me" });
}

/** A creator's published bots, for their profile. */
export function botsStrip(owner: number): string {
  const bots = db.prepare("SELECT id FROM bots WHERE owner = ? AND status = 'live' ORDER BY id").all(owner) as { id: number }[];
  if (!bots.length) return "";
  return `<h2>Bots</h2><div class="col" style="gap:8px">${bots.map(({ id }) => { const b = botById(id)!; const r = botRecord(b); return `<a class="tile row" href="/bots/${b.id}" style="gap:12px;color:#F5F5F5;padding:12px"><span class="ic36">${icon(TEMPLATES[b.template].icon, 16)}</span><span class="grow" style="min-width:0"><b class="md">${esc(b.name)}</b><span class="xs mut" style="display:block">${TEMPLATES[b.template].name} · ${r.entries} trades${r.closed ? ` · ${r.wins}/${r.closed} green` : ""} · ${b.params.stopPct}% stop on every trade</span></span>${r.returnPct !== null ? `<b class="${r.returnPct >= 0 ? "up" : "down"}">${pct(r.returnPct)}</b>` : `<span class="pill ok">Live</span>`}</a>`; }).join("")}</div>`;
}

// ---------- Creator studio ----------

/** The Creating tab of Portfolio: build baskets, see what they earn, how copiers are doing. */
export async function creatingTabHtml(uid: number): Promise<string> {
  const e = earningsOf(uid);
  const o = e.outcomes;
  const meta = getMeta(uid);
  const bots = botsOf(uid);
  const signals = openSignals(uid);
  const myBaskets = await basketsBy(uid);
  const ledger = copyLedger(uid, 10);
  const guard = guardEvents(uid, 4);
  const manual = strategiesOf(uid).find((s) => s.kind === "trades");
  const days = Math.max(0, Math.ceil((e.seasonEnds - Date.now()) / 86400e3));
  const tile = (k: string, v: string, sub = "", cls = "") => `<div class="tile"><div class="k">${k}</div><div class="v ${cls}">${v}</div>${sub ? `<div class="xs mut" style="margin-top:2px">${sub}</div>` : ""}</div>`;
  const botRow = (b: Bot) => { const r = botRecord(b); const n = signals.filter((s) => s.bot === b.id).length; return `<a class="line" href="/bots/${b.id}" style="color:#F5F5F5;align-items:flex-start;padding:12px 0"><span class="ico">${icon(TEMPLATES[b.template].icon, 16)}</span><span class="grow" style="min-width:0"><span class="t row" style="gap:8px;flex-wrap:wrap">${esc(b.name)} ${statusPill(b)}${n ? `<span class="pill warn">${n} to approve</span>` : ""}</span><span class="s">${r.entries} trade${r.entries === 1 ? "" : "s"}${r.closed ? ` · ${r.wins}/${r.closed} green · ${r.realized >= 0 ? "+" : "−"}${money(Math.abs(r.realized))}` : ""}${r.copiers ? ` · ${r.copiers} copier${r.copiers === 1 ? "" : "s"}` : ""}</span><span class="s" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.status === "paused" || b.status === "stopped" ? b.reason ?? "" : b.last_why ?? "Starting up")}</span></span>${icon("chev", 14, "#8A8A8A", 2)}</a>`; };
  const ledgerRow = (l: (typeof ledger)[number]) => `<tr><td class="mut">${new Date(l.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td><td><a href="/t/${l.id}" style="color:#F5F5F5">${esc(l.label)}</a><span class="xs mut" style="display:block">${l.botName ? esc(l.botName) : ""}${l.botName && l.private ? " · " : ""}${l.private ? "private trial" : ""}</span></td><td class="up">${l.copied}</td><td>${l.pending}</td><td class="mut">${l.declined}</td><td><span class="${l.skipped ? "warn" : "mut"}">${l.skipped}</span>${l.reasons.length ? `<span class="xs mut" style="display:block;max-width:220px">${esc(l.reasons.join("; "))}</span>` : ""}</td></tr>`;
  return `<main class="main" style="gap:14px">
<a class="card cnew" href="/trades/new"><span class="cfi" style="--fc:#FBBF24">${icon("cards", 18, "#FBBF24", 2.2)}</span><span><b>New trade</b><span class="sm mut">One token or several. Anyone can copy it, and you earn a share of the fee.</span></span></a>
${myBaskets.length ? `<section class="col" style="gap:8px"><h2 style="font-size:16px">Your trades</h2>${myBaskets.map(basketRow).join("")}</section>` : ""}
${signals.length ? `<a class="card row" href="/bots/${signals[0].bot}" style="gap:12px;border-color:rgba(252,211,77,.4);color:#F5F5F5">${icon("bell", 18, "#FCD34D")}<span class="grow"><b>${signals.length} bot trade${signals.length > 1 ? "s" : ""} waiting for you</b><span class="sm mut" style="display:block">${esc(signals[0].name)}: ${esc(signals[0].why)}</span></span>${icon("chev", 14, "#8A8A8A", 2)}</a>` : ""}
<section class="card col" style="gap:12px" aria-label="Earnings"><div class="row sp"><span class="sm mut">Earned · all time</span><span class="pill ok">${esc(e.tier.label)} · ${e.shareBps}% of the fee</span></div>
<div class="big">${money2(e.accrued)}</div><div class="up" style="font-size:13px">↑ ${money(e.weekly)} this week</div>
<div class="grid3">${tile("Ready to claim", money(e.claimable))}${tile(`Held · Season ${e.season}`, money(e.held), `released in ${days}d by copier results`)}${tile("Claimed", money(e.claimed))}</div>
${e.tier.next ? `<div class="xs mut">Next: ${esc(e.tier.next)}</div>` : ""}
<div class="row sp" style="padding-top:12px;border-top:1px solid rgba(255,255,255,.07)">${meta.kyc ? `<span class="sm mut">Verified for payouts</span>` : `<a class="sm" href="/creator/verify">Verify to get paid ›</a>`}<button class="btn p sm" data-act="/api/claim" ${e.claimable < 0.01 ? "disabled" : ""}>${e.claimable < 0.01 ? "Nothing to claim" : "Claim"}</button></div>
<p class="note" style="margin:0">You get ${e.shareBps}% of Tribe's fee on every copy of your trades. Half of each season's share is held until the season ends, then released by how your copiers did: all of it if they're net positive, less the more they lost. Copies made while CopyGuard had you paused earn nothing${e.excludedPaused ? ` (${e.excludedPaused} left out)` : ""}. ${isDry() ? "Demo: claiming credits your simulated balance." : "Estimated from copied volume."}</p></section>
${bots.length ? `<section class="card col" style="gap:10px" aria-label="Your bots"><h2 style="font-size:16px">Your bots</h2>${bots.map(botRow).join("")}</section>` : ""}
<section class="card col" style="gap:12px" aria-label="Your copiers"><h2 style="font-size:16px">How your copiers are doing</h2>
<div class="grid4 deskstats">${[[String(o.following), "following"], [String(o.copiers), "copied you"], [o.copiers ? `${o.inProfitPct}%` : "—", "in profit"], [o.retained30 === null ? "—" : `${o.retained30}%`, "still here after 30d"]].map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join("")}</div>
<div class="sm mut">Copiers' net result from your trades: <b class="${o.netUsd >= 0 ? "up" : "down"}">${o.netUsd >= 0 ? "+" : "−"}${money(Math.abs(o.netUsd))}${o.netPct !== null ? ` (${pct(o.netPct)})` : ""}</b>. This decides your tier and your held-back pay, not how much they traded.</div></section>
<section class="card col" style="gap:8px;padding:6px 8px" aria-label="Copy ledger"><div class="row sp" style="padding:10px 12px 0"><h2 style="font-size:16px">What happened to each trade</h2><span class="xs mut">copied · waiting · declined · skipped</span></div>
${ledger.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>When</th><th>Trade</th><th>Copied</th><th>Waiting</th><th>Declined</th><th>Skipped</th></tr></thead><tbody>${ledger.map(ledgerRow).join("")}</tbody></table></div>` : `<p class="sm mut" style="padding:0 12px 12px;margin:0">Your trades show up here with what every copier's copy did.</p>`}</section>
<section class="card col" style="gap:10px"><div class="row sp"><h2 style="font-size:16px">Your manual trades</h2>${manual ? `<span class="pill ${manual.public ? "ok" : ""}">${manual.public ? "Published" : "Private"}</span>` : ""}</div>
<p class="sm mut" style="margin:0">Anyone can follow you. Publishing lists you on the Leaderboard and Feed as a creator, once you pass the checks (14+ days, 10+ trades, stops on half, no Guard pauses).</p>${manual ? "" : `<a class="btn sm" href="/strategy/new" style="align-self:flex-start">Check if you can publish</a>`}</section>
<section class="card col" style="gap:8px"><h2 style="font-size:16px">Guard</h2>${guard.length ? guard.map((g) => `<div class="row sp sm"><span class="${g.kind === "halt" ? "down" : "up"}">${g.kind === "halt" ? "Paused" : "Cleared"}</span><span class="mut" style="flex:1;margin:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.reason ?? "")}</span><span class="xs mut">${ago(g.at)} ago</span></div>`).join("") : `<span class="sm mut">Never paused. A pause stops copying of you and your bots for everyone.</span>`}</section>
<p class="note" style="text-align:center;margin:4px 0 90px">Copiers see the fee and your share before every copy. Nothing here is investment advice.</p>
</main>`;
}

// ---------- Verify for payouts ----------

export const BLOCKED_COUNTRIES = () => (process.env.CREATOR_BLOCKED_COUNTRIES ?? "US,GB").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const COUNTRIES: [string, string][] = [["IN", "India"], ["AE", "United Arab Emirates"], ["SG", "Singapore"], ["NG", "Nigeria"], ["BR", "Brazil"], ["ID", "Indonesia"], ["PH", "Philippines"], ["TR", "Türkiye"], ["DE", "Germany"], ["FR", "France"], ["GB", "United Kingdom"], ["US", "United States"], ["OTHER", "Somewhere else"]];

export function verifyPage(uid: number): string {
  const k = getMeta(uid).kyc;
  const body = `${header("Verify to get paid", "Once, before your first payout", "/portfolio?tab=creating")}<main class="main" style="gap:14px">
${k ? `<section class="card good col" style="gap:6px"><b class="up">You're verified</b><span class="sm mut">Since ${new Date(k.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${esc(COUNTRIES.find((c) => c[0] === k.country)?.[1] ?? k.country)}</span></section>` : `<form class="card col" id="kyc" style="gap:14px">
<label class="fld"><span>Where you live</span><select name="country" class="f" style="height:44px" required><option value="">Choose…</option>${COUNTRIES.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("")}</select></label>
<label class="row" style="gap:10px;align-items:flex-start"><input type="checkbox" name="adult" style="margin-top:3px"><span class="sm">I'm 18 or older, and payouts go to my own wallet.</span></label>
<label class="row" style="gap:10px;align-items:flex-start"><input type="checkbox" name="honest" style="margin-top:3px"><span class="sm">I won't promise returns or pay anyone to promote my trades.</span></label>
<button type="button" class="btn p" data-act="/api/creator/verify" data-collect="#kyc">Verify</button>
<p class="note" style="margin:0">Demo verification. Before real payouts this step is an ID check with a verification provider. Creator payouts aren't offered in ${BLOCKED_COUNTRIES().join(", ")} yet.</p></form>`}
</main>`;
  return page({ title: "Verify", body, nav: "me" });
}

export { copierOutcomes };
