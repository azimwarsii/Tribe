import { allHalts, db, followingOf, getMeta, getUser, pendingFor } from "../db.js";
import { face, initials, money, pct, portfolio, topTraders } from "../data.js";
import { lastGuardCheck } from "../guard.js";
import { ago } from "../data.js";
import { esc, icon, money2, signCls } from "../ui.js";

const ITEMS: [string, string, string, string][] = [
  ["feed", "/feed", "home", "Feed"],
  ["baskets", "/baskets", "list", "Baskets"],
  ["ranks", "/ranks", "bars", "Leaderboard"],
  ["cat", "/cat", "chat", "Ask Chief"],
  ["guard", "/guard", "shield", "Guard"],
  ["portfolio", "/portfolio", "trend", "Portfolio"],
  ["creator", "/creator", "star", "Creator"],
  ["settings", "/settings", "gear", "Settings"],
];

/** Which sidebar item a path highlights. */
export function activeFor(path: string): string {
  const p = path.split("?")[0];
  if (p.startsWith("/basket") || p.startsWith("/b/")) return "baskets";
  if (["/ranks", "/season", "/squad"].some((x) => p.startsWith(x))) return "ranks";
  if (["/progress", "/badges", "/levelup"].some((x) => p.startsWith(x))) return "me";
  if (p.startsWith("/cat")) return "cat";
  if (p.startsWith("/guard")) return "guard";
  if (["/portfolio", "/positions", "/traders", "/requests", "/funds", "/transfer", "/activity"].some((x) => p.startsWith(x))) return "portfolio";
  if (["/creator", "/strategy", "/trade/new", "/bots", "/bot"].some((x) => p.startsWith(x))) return "creator";
  if (p.startsWith("/settings") || p.startsWith("/me") || p.startsWith("/alerts")) return "settings";
  return "feed";
}

const topWeek = async (n: number) => topTraders(7, n);

/** Replaces the shell placeholders emitted by page(). Logged-out and focus pages get a plain centred column. */
export async function finalize(html: string, uid: number | undefined, path: string): Promise<string> {
  if (!html.includes("<!--SHELL_OPEN-->")) return html;
  if (uid === undefined) return html.replace("<!--SHELL_OPEN-->", '<div class="shell"><div class="mainc">').replace("<!--SHELL_CLOSE-->", "</div></div>");
  const me = getUser(uid);
  const meta = getMeta(uid);
  const pf = await portfolio(uid);
  const pend = pendingFor(uid);
  const follows = followingOf(uid);
  const halts = allHalts();
  const pausedFollowed = follows.filter((f) => halts.some((h) => h.leader === f.leader)).length;
  const active = activeFor(path);
  const top = await topWeek(3);

  const side = `<aside class="side" aria-label="Main"><a class="logo" href="/feed">tr<span class="side-label">ibe</span><span>.</span></a>
${ITEMS.map(([k, href, ic, label]) => `<a class="side-item${k === active ? " on" : ""}" href="${href}" title="${label}">${icon(ic, 20)}<span class="side-label">${label}</span>${k === "guard" && pausedFollowed ? '<i class="side-dot"></i>' : ""}</a>`).join("")}
<span style="flex:1"></span>
<div class="side-extra card" style="padding:14px;border-radius:18px;margin-bottom:8px"><div class="sm mut">Copy portfolio</div><div style="font-size:22px;font-weight:600;margin-top:2px">${meta.hideBalance ? "••••" : money2(pf.total)}</div><div class="sm ${signCls(pf.todayUsd)}">${pf.todayUsd >= 0 ? "↑" : "↓"} ${money(Math.abs(pf.todayUsd))} today</div></div>
<a class="side-item${active === "me" ? " on" : ""}" href="/me" title="Me"><span class="av sm w" style="width:26px;height:26px;font-size:10px">${face(me.handle)}</span><span class="side-label">@${esc(me.handle)}</span></a></aside>`;

  const topbar = `<div class="topbar"><form method="get" action="/search" role="search"><label class="row" style="height:42px;padding:0 14px;border-radius:21px;background:#1A1A1A;border:1px solid rgba(255,255,255,.06);color:#9A9A9A">${icon("search", 16, "currentColor", 2)}<input id="wsearch" name="q" placeholder="Search traders, tokens" aria-label="Search" style="flex:1;min-width:0;border:0;background:transparent;color:#F5F5F5;font-size:14px"><span class="kbd">/</span></label></form>
<a class="ic" href="/requests" aria-label="Copy requests, ${pend.length} pending">${icon("inbox", 18)}${pend.length ? `<span class="badge">${pend.length}</span>` : ""}</a><a class="btn sm w" href="/funds">Add funds</a></div>`;

  const at = lastGuardCheck();
  const checked = at ? `CRE Guard checked ${ago(at)} ago` : "Waiting for the first CRE check";
  const rail = `<aside class="rail" aria-label="Summary">
<section class="card${meta.pausedAll ? " bad" : ""}"><div class="row sp sm mut"><span>Copy portfolio</span><span style="color:#F5F5F5;display:inline-flex;gap:3px;align-items:center">${icon("bolt", 11)}Flash</span></div>
<div class="big" style="margin-top:6px">${meta.hideBalance ? "••••" : money2(pf.total)}</div><div class="${signCls(pf.todayUsd)}" style="font-size:13px">${pf.todayUsd >= 0 ? "↑" : "↓"} ${money(Math.abs(pf.todayUsd))} (${pct(pf.todayPct, 2)}) today</div>
<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px"><span class="pill">Copying ${follows.filter((f) => !f.rules.paused).length}</span><a class="pill" href="/requests">${pend.length} pending</a>${pausedFollowed ? `<a class="pill bad" href="/guard">${pausedFollowed} paused</a>` : ""}</div>
<div class="grid2" style="margin-top:12px"><a class="btn sm" style="width:100%" href="/funds">Add funds</a><a class="btn sm" style="width:100%" href="/traders">My traders</a></div>
<button class="btn sm ${meta.pausedAll ? "p" : "danger"}" style="width:100%;margin-top:8px" data-act="/api/pause-all" data-body='{"value":${!meta.pausedAll}}'>${meta.pausedAll ? "Resume copying" : "Pause all copying"}</button></section>
<a class="card row" href="/guard" style="padding:14px;gap:12px;color:#F5F5F5;border-color:${pausedFollowed ? "rgba(248,113,113,.4)" : "rgba(52,211,153,.35)"}">${icon("shield", 22, pausedFollowed ? "#F87171" : "#34D399")}<span class="grow"><b style="display:block;font-size:15px">${pausedFollowed ? `${pausedFollowed} trader${pausedFollowed > 1 ? "s" : ""} paused` : "You're protected"}</b><span class="sm mut">${checked}${halts.length ? ` · ${halts.length} paused` : ""}</span></span>${icon("chev", 14, "#8A8A8A", 2)}</a>
${active === "ranks" ? "" : `<section class="card"><div class="row sp"><h2>Top this week</h2><a class="sm" href="/ranks" style="color:#A3A3A3">Leaderboard ›</a></div>
${top.map((t, i) => `<a class="row" href="/u/${esc(t.handle)}" style="gap:10px;min-height:44px;color:#F5F5F5"><span style="width:16px;color:${i === 0 ? "#34D399" : "#8A8A8A"};font-weight:600">${i + 1}</span><span class="av sm">${face(t.handle)}</span><span class="grow md">@${esc(t.handle)}</span><b class="${signCls(t.pct)} md">${pct(t.pct)}</b></a>`).join("") || '<div class="sm mut" style="padding-top:8px">No trades this week.</div>'}</section>`}
<a class="card row" href="/cat/chat?new=1" style="padding:14px;gap:12px;color:#F5F5F5"><span class="orb" style="width:30px;height:30px"><i></i></span><span class="grow mut md">Ask Chief anything…</span><span class="kbd">⌘K</span></a></aside>`;

  // Split pages bring their own aside, so the global rail would duplicate it.
  const ownAside = /<body class="norail[ "]/.test(html);
  return html
    .replace("<!--SHELL_OPEN-->", `<div class="shell">${side}<div class="mainc">${topbar}`)
    .replace("<!--SHELL_CLOSE-->", `</div>${ownAside ? "" : rail}</div>`);
}
