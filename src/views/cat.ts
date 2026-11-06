import { learnedMemory, ruleLimit } from "../cat.js";
import { getMeta, rulesOf } from "../db.js";
import { esc, glyphBadge, header, icon, page, sheet, split, sw } from "../ui.js";
import { pct } from "../data.js";
import { catCalls, latestEntry, researchTrade } from "../research.js";

const orb = (size: number, glow = true) =>
  `<span class="orb" aria-hidden="true" style="width:${size}px;height:${size}px;box-shadow:${glow ? `0 0 ${Math.round(size * 0.5)}px rgba(52,211,153,.35),` : ""}inset 0 -${Math.round(size / 12)}px ${Math.round(size / 5)}px rgba(0,0,0,.45)"><i></i></span>`;

const PERSONAS: [string, string, string][] = [
  ["Sharp", "sharp", "Numbers first. “Bracket ready: −$2.50 max loss, +$6 target.”"],
  ["Chill", "chill", "Explains as it goes. “Here's what this order does, step by step…”"],
  ["Degen", "degen", "Memes allowed, stops still required. “Sending it. Responsibly.”"],
];



const TONE: Record<string, string> = { "Looks solid": "#34D399", Mixed: "#FCD34D", Risky: "#F87171", "Avoid for now": "#F87171" };

/** Chief's track record: every call it made in chat, scored by what the trader did next. Hidden until there is one. */
function callsCard(): string {
  const calls = catCalls();
  if (!calls.length) return "";
  return `<section class="tile" aria-label="Chief's track record" style="border-radius:18px;padding:14px"><div class="row sp" style="align-items:baseline"><b class="md">Chief’s calls</b><span class="xs mut">30 days · scored by what the trader did next</span></div><div class="col" style="gap:6px;margin-top:10px">${calls.map((c) => `<div class="row sp sm"><span style="color:${TONE[c.label]};font-weight:600">${esc(c.label)}</span><span class="mut">${c.calls} call${c.calls === 1 ? "" : "s"} · ${c.closed ? `${c.green} of ${c.closed} closed green` : "none closed yet"}</span></div>`).join("")}</div></section>`;
}

/** How Chief talks: tone only, limits and Guard never change. Opened from the chat header. */
const personaSheet = (persona: string) => sheet("persona", `<h2>How should Chief talk?</h2><p class="mut md" style="margin:6px 0 12px">Tone only. Your limits and Guard rules never change.</p><div class="col" role="radiogroup" style="gap:8px">${PERSONAS.map(([n, e, s]) => `<button class="opt${persona === n ? " on" : ""}" role="radio" aria-checked="${persona === n}" data-act="/api/cat/persona" data-body='{"persona":"${n}"}' style="justify-content:flex-start;gap:12px;padding:12px 16px">${glyphBadge(e, 40)}<span><b style="display:block">${n}</b><span class="sm mut" style="line-height:1.4">${s}</span></span></button>`).join("")}</div>`);

/** Chief's read on a trader's latest entry, one tap from the full research chat. Shown before you copy. */
export async function catReadCard(viewer: number, leader: number, style = "", trade?: number): Promise<string> {
  const id = trade ?? latestEntry(leader);
  if (id === undefined || leader === viewer) return "";
  const v = (await researchTrade(viewer, id, "Is this a good trade?"))?.verdict;
  if (!v) return "";
  const col = { ok: "#34D399", warn: "#FCD34D", bad: "#F87171" }[v.tone];
  const judged = v.checks.filter((c) => c.ok !== null);
  const note = v.checks.find((c) => c.ok === false) ?? v.checks.find((c) => c.ok && /CRE CopyGuard/.test(c.t));
  return `<div class="card catread" style="border-color:${col}44;${style}">${orb(34, false)}<span class="grow" style="min-width:0"><span class="xs mut" style="display:block">Safety read on ${trade ? "this trade" : "their latest trade"}</span><b style="color:${col}">${esc(v.label)}</b><span class="sm mut"> · ${judged.filter((c) => c.ok).length} of ${judged.length} checks pass</span>${note ? `<span class="xs row" style="gap:5px;color:#A3A3A3;margin-top:3px"><i class="ck${note.ok ? "" : " bad"}" aria-hidden="true">${note.ok ? icon("check", 9, "currentColor", 3.4) : "!"}</i>${esc(note.t)}</span>` : ""}</span></div>`;
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
  const body = `<header class="hd"><a class="ic" href="/settings" aria-label="Back">${icon("back", 18, "currentColor", 2)}</a><div class="grow"><h1>Chief's memory</h1><div class="sub">Same memory in the app and Telegram · only you can see it</div></div></header>
${split(`<main class="main" style="gap:20px;padding-bottom:40px">${callsCard()}<div class="only-m"><div class="col" style="gap:20px"><section class="card row" style="gap:14px;padding:18px">${orb(48)}<div><b>Chief remembers so you don't repeat yourself</b><div class="sm mut" style="line-height:1.45;margin-top:2px">Only you can see this. Forget anything, any time.</div></div></section>
<div class="row" style="padding:0 4px"><span class="grow md">Use memory in replies</span>${memSwitch}</div></div></div>
<div class="d2" style="gap:20px"><section style="opacity:${meta.catMemory ? 1 : 0.4};transition:opacity 200ms" aria-label="About you"><h2 style="margin:0 0 8px 4px;font-size:12px;letter-spacing:.08em;color:#8A8A8A">LEARNED FROM YOUR ACTIVITY</h2>${list(learned.map((m) => ({ t: m.t, src: m.src, attrs: `data-act="/api/cat/memory" data-body='{"op":"forget","key":"${m.key}"}'` })))}</section>
<section style="opacity:${meta.catMemory ? 1 : 0.4};transition:opacity 200ms" aria-label="Your rules for Chief"><h2 style="margin:0 0 8px 4px;font-size:12px;letter-spacing:.08em;color:#8A8A8A">YOUR RULES FOR CHIEF</h2>${list(rules.map((r) => ({ t: r.text, src: ruleLimit(r.text) !== undefined ? `You said this in ${r.source} · enforced as a $${ruleLimit(r.text)} limit` : `You said this in ${r.source}`, attrs: `data-act="/api/cat/memory" data-body='{"op":"delrule","id":${r.id}}'` })))}
<form data-form action="/api/cat/memory" class="row" style="gap:8px;margin-top:10px"><input type="hidden" name="op" value="rule"><label class="grow row" style="height:46px;padding:0 14px;border-radius:23px;background:#141414;border:1px solid rgba(255,255,255,.1)"><input name="text" maxlength="140" placeholder="Tell Chief something to remember" aria-label="New rule for Chief" style="flex:1;min-width:0;border:0;background:transparent;color:#F5F5F5;font-size:14px" required></label><button class="btn w" style="width:auto;height:46px">Add</button></form>
<p class="note">Rules that name a dollar limit, like “Ask me before anything over $50”, add a warning when an order goes over it. Chief always waits for your confirm before signing.</p></section></div>
<div class="only-m"><div class="col" style="gap:20px"><a class="tile row" href="#persona" data-open="persona" style="border-radius:18px;padding:14px;gap:12px;color:#F5F5F5">${glyphBadge(meta.catPersona.toLowerCase(), 34)}<span class="grow"><b style="display:block;font-size:14px">Personality: ${esc(meta.catPersona)}</b><span class="sm mut">Change how Chief talks</span></span>${icon("chev", 14, "#737373", 2)}</a>
${wipe}</div></div></main>`, aside, "Memory settings")}`;
  return page({ title: "Chief's memory", body, split: true, sheets: personaSheet(meta.catPersona) });
}
