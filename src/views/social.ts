import { matchesFilter, type AssetFilter } from "../assets.js";
import { basketBoard } from "../baskets.js";
import { basketRow } from "./baskets.js";
import { allHalts, allSquads, creRuns, db, followingOf, getMeta, guardEvents, haltOf, seasonBoard, squadMembers, squadOf, userById, type CreRun, type CreVerdict } from "../db.js";
import { face, ago, initials, money, pct, profile, rankMin, seasonOf, seasonRange, windowPnl } from "../data.js";
import { guardHeartbeat, lastGuardCheck, lastOracleCheck, riskOf } from "../guard.js";
import { riskWord } from "../risk.js";
import { RISK_LINE } from "../rules.js";
import { greenDays, traderStats } from "../stats.js";
import { squadBoard } from "./game.js";
import { esc, icon, page, polyline, seg, sheet, signCls } from "../ui.js";
import { botById, botRecord, TEMPLATES } from "../creator.js";

const chainTx = (tx: string) => `https://${process.env.GUARD_CHAIN === "base" ? "" : "sepolia."}basescan.org/tx/${tx}`;

// ---------- Guard center ----------

/** The Guard log: what each CRE run checked and decided, trader by trader (rules or AI), with onchain proof. */
function guardLog(): string {
  const runs = creRuns(5);
  if (!runs.length) return "";
  const pill = (s: CreVerdict["severity"]) => `<span class="pill ${s === "halt" ? "bad" : s === "warn" ? "warn" : "ok"}">${s === "halt" ? "Pause" : s === "warn" ? "Watch" : "OK"}</span>`;
  const run = (r: CreRun, i: number) => {
    const flagged = r.verdicts.filter((v) => v.severity !== "ok").length;
    const ai = r.verdicts.filter((v) => v.ai).length;
    return `<details class="tile bd"${i === 0 ? " open" : ""} style="padding:0 14px"><summary class="row sp" style="min-height:48px;gap:10px"><span class="md" style="font-weight:600">${ago(r.at)} ago</span><span class="grow sm mut">${r.verdicts.length} traders checked${flagged ? ` · ${flagged} flagged` : ""}${ai ? ` · ${ai} judged by AI` : ""}</span>${r.oracle !== null && r.dex !== null ? `<span class="sm mut">Chainlink $${r.oracle.toFixed(2)} vs DEX $${r.dex.toFixed(2)}</span>` : ""}</summary>
<div class="col" style="gap:0;padding-bottom:10px">${r.verdicts.map((v) => `<div class="row" style="gap:10px;min-height:44px;border-top:1px solid #222"><span style="width:56px;flex-shrink:0">${pill(v.severity)}</span><b class="md" style="min-width:96px">@${esc(v.handle ?? String(v.leader))}</b><span class="grow sm mut">${v.ai ? '<span class="pill" style="margin-right:6px">AI</span>' : ""}${esc(v.reason)}${typeof v.risk === "number" ? ` · risk ${v.risk}` : ""}</span>${v.tx ? `<a class="sm" href="${chainTx(v.tx)}" target="_blank" rel="noopener">Onchain ↗</a>` : ""}</div>`).join("")}</div></details>`;
  };
  return `<section class="col" aria-label="Guard log"><div class="row sp"><h2>Guard log</h2><span class="sm mut">Each Chainlink CRE run, trader by trader</span></div>${runs.map(run).join("")}</section>`;
}

export async function guardPage(viewer: number): Promise<string> {
  const meta = getMeta(viewer);
  const follows = followingOf(viewer);
  const line = RISK_LINE[meta.strict];
  const rows = await Promise.all(
    follows.map(async (f) => {
      const u = userById(f.leader)!;
      const risk = await riskOf(f.leader);
      const h = haltOf(f.leader);
      return { leader: f.leader, handle: u.handle, risk, halted: !!h && !f.rules.guardOverride, over: f.rules.guardOverride, reason: h?.reason ?? (risk >= line ? `risk ${risk} is above your pause line` : "Behaving normally"), tx: h?.tx ?? null };
    }),
  );
  rows.sort((a, b) => b.risk - a.risk);
  const paused = rows.filter((r) => r.halted || (r.risk >= line && !r.over));
  const events = guardEvents(undefined, 40).filter((e) => follows.some((f) => f.leader === e.leader));
  const incident = paused[0];
  const blocked = incident ? (db.prepare("SELECT COUNT(*) AS n FROM copies WHERE follower = ? AND leader = ? AND status = 'skipped' AND note LIKE '%CopyGuard%'").get(viewer, incident.leader) as { n: number }).n : 0;
  const openFrom = incident ? (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE trader = ? AND leader = ? AND role = 'copy' AND status = 'open'").get(viewer, incident.leader) as { n: number }).n : 0;
  const pauses30 = (db.prepare("SELECT COUNT(*) AS n FROM guard_events WHERE kind = 'halt' AND at >= ?").get(Date.now() - 30 * 86400e3) as { n: number }).n;
  const at = lastGuardCheck();
  const checked = at ? `Checked ${ago(at)} ago` : "Waiting for the first CRE check";
  const blockedTotal = (db.prepare("SELECT COUNT(*) AS n FROM copies WHERE follower = ? AND status = 'skipped' AND note LIKE '%CopyGuard%'").get(viewer) as { n: number }).n;

  const hero = paused.length
    ? `<div class="card bad"><div class="row" style="gap:10px">${icon("shield", 22, "#F87171")}<div><b style="font-size:17px">Guard paused ${paused.length} trader${paused.length > 1 ? "s" : ""} you copy</b><div class="sm mut">${checked}</div></div></div></div>`
    : `<div class="card good"><div class="row" style="gap:10px">${icon("shield", 22, "#34D399")}<div><b style="font-size:17px">All clear</b><div class="sm mut">${checked} · every 5 minutes</div></div></div></div>`;

  const traderRow = (r: (typeof rows)[number]) => {
    const bad = r.halted || (r.risk >= line && !r.over);
    return `<article class="card post${bad ? " bad" : ""}" style="gap:10px"><div class="row"><span class="av ${bad ? "" : "w"}" style="${bad ? "color:#F87171" : ""}">${face(r.handle)}</span><span class="grow"><a href="/u/${esc(r.handle)}" style="color:#F5F5F5;font-weight:600">@${esc(r.handle)}</a><span class="sm mut" style="display:block">${esc(r.reason)}</span></span><span class="pill ${bad ? "bad" : r.over ? "warn" : "ok"}">${bad ? "Paused" : r.over ? "Override" : "Copying"}</span></div>
<div><div style="position:relative;height:6px;border-radius:3px;background:#262626"><div style="width:${r.risk}%;height:6px;border-radius:3px;background:${bad ? "#F87171" : "#34D399"}"></div><span style="position:absolute;left:${line}%;top:-4px;width:2px;height:14px;background:#F5F5F5"></span></div>
<div class="row sp xs mut" style="margin-top:6px"><span>Risk ${r.risk} · ${riskWord(r.risk)}</span><span>${bad ? `${r.risk - line >= 0 ? r.risk - line : 0} over the line` : `${line - r.risk} under the line`} (${line})</span></div></div>
${bad ? `<div class="grid3" style="gap:6px"><button class="btn sm" style="width:100%" data-close="x">Keep paused</button><button class="btn sm" style="width:100%" data-act="/api/unfollow" data-body='{"leader":${r.leader}}' data-confirm="Stop copying @${esc(r.handle)}?">Stop copying</button><button class="btn sm danger" style="width:100%" data-open="resume-${r.leader}">Resume anyway</button></div>` : ""}</article>`;
  };
  const resumeSheet = (r: (typeof rows)[number]) => {
    const bad = r.halted || (r.risk >= line && !r.over);
    return `${bad ? sheet(`resume-${r.leader}`, `<h2>Resume against Guard's advice?</h2><p class="mut" style="font-size:14px;line-height:1.5">You'll copy @${esc(r.handle)}'s next trades even though Guard rates them high risk. Your limits and stop-loss filter still apply.</p><div class="grid2"><button class="btn" data-close="resume-${r.leader}">Cancel</button><button class="btn danger" data-act="/api/guard-override" data-body='{"leader":${r.leader},"value":true}'>Resume</button></div>`) : ""}`;
  };

  const guardTable = rows.length
    ? `<div class="card only-d" style="padding:6px 8px"><table class="tbl"><thead><tr><th>Trader</th><th style="width:30%">Risk vs your line (${line})</th><th>Status</th><th>Why</th><th></th></tr></thead><tbody>${rows
        .map((r) => {
          const bad = r.halted || (r.risk >= line && !r.over);
          return `<tr><td><a href="/u/${esc(r.handle)}" style="color:#F5F5F5"><b>@${esc(r.handle)}</b></a></td><td><div style="position:relative;height:6px;border-radius:3px;background:#262626"><div style="width:${r.risk}%;height:6px;border-radius:3px;background:${bad ? "#F87171" : "#34D399"}"></div><span style="position:absolute;left:${line}%;top:-4px;width:2px;height:14px;background:#F5F5F5"></span></div><div class="xs mut" style="margin-top:4px">Risk ${r.risk} · ${riskWord(r.risk)}</div></td><td><span class="pill ${bad ? "bad" : r.over ? "warn" : "ok"}">${bad ? "Paused" : r.over ? "Override" : "Copying"}</span></td><td class="mut sm">${esc(r.reason)}</td><td class="r" style="white-space:nowrap">${bad ? `<button class="btn sm" data-act="/api/unfollow" data-body='{"leader":${r.leader}}' data-confirm="Stop copying @${esc(r.handle)}?">Stop</button> <button class="btn sm danger" data-open="resume-${r.leader}">Resume anyway</button>` : ""}</td></tr>`;
        })
        .join("")}</tbody></table></div>`
    : "";
  const resumeSheets = rows.map(resumeSheet).join("");

  // The live value, or the last one CRE reported (survives restarts).
  const lastRun = creRuns(10).find((r) => r.oracle && r.dex);
  const oc = lastOracleCheck ?? (lastRun ? { oracle: lastRun.oracle!, dex: lastRun.dex!, deviationPct: Math.abs(lastRun.deviation ?? 0), at: lastRun.at } : null);
  const hb = guardHeartbeat();
  const heartbeat = `<section class="flat row" aria-label="CopyGuard heartbeat" style="gap:12px"><span class="ic36" aria-hidden="true" style="color:${hb.held ? "#FCD34D" : "#34D399"}">${icon(hb.held ? "shield" : "shieldok", 16)}</span><span class="grow"><b class="md" style="display:block">CopyGuard heartbeat ${hb.held ? '<span class="pill warn">Holding auto-copy</span>' : hb.last ? '<span class="pill ok">Live</span>' : ""}</b><span class="sm mut" style="display:block">${hb.last ? `Last CRE report ${ago(hb.last)} ago` : "No CRE report yet"}${hb.held ? ` · silent over ${hb.silence} min, so auto-copies wait for your OK` : ""}${hb.onchain ? " · every copy reads the contract first" : ""}</span></span></section>`;
  const priceCheck = oc
    ? `<section class="flat row" aria-label="Price check" style="gap:12px"><span class="ic36" aria-hidden="true">${icon("bars", 16)}</span><span class="grow"><b class="md" style="display:block">ETH price check ${oc.deviationPct < 3 ? '<span class="pill ok">Agrees</span>' : '<span class="pill bad">Disagrees</span>'}</b><span class="sm mut" style="display:block">Chainlink Data Feed $${oc.oracle.toFixed(2)} · Flash DEX $${oc.dex.toFixed(2)} · ${oc.deviationPct.toFixed(2)}% apart · ${ago(oc.at)} ago</span></span></section>`
    : "";
  const body = `<header class="hd"><div class="grow"><h1 style="font-size:22px">Guard</h1><div class="sub">Chainlink CRE checks every trader, every 5 min</div></div><button class="ic" data-open="how" aria-label="How Guard works">${icon("help", 18, "currentColor", 2)}</button></header>
<main class="main" style="gap:14px">${hero}${priceCheck}${heartbeat}
<div class="grid3"><div class="tile"><div class="k">Traders</div><div class="v">${rows.length}</div></div><div class="tile"><div class="k">Pauses · 30d</div><div class="v">${pauses30}</div></div><div class="tile"><div class="k">Copies blocked</div><div class="v">${blockedTotal}</div></div></div>
<section class="card col" style="gap:10px"><div class="row sp"><b>Strictness</b><span class="sm mut">Pauses at risk ${line}</span></div>${seg((["Strict", "Balanced", "Relaxed"] as const).map((l) => ({ label: l, on: meta.strict === l, attrs: `data-act="/api/meta" data-body='{"strict":"${l}"}'` })), false, "Strictness")}<div class="note">${meta.strict === "Strict" ? "Pauses early. Fewer surprises, more missed trades." : meta.strict === "Relaxed" ? "Pauses late. More trades copied, more risk." : "A balance of safety and activity."}</div></section>
${incident ? `<section class="card bad"><div class="xs down" style="font-weight:700;letter-spacing:.06em">YOUR MONEY</div><div class="md" style="margin-top:6px;line-height:1.5">${blocked ? `${blocked} copy${blocked > 1 ? " copies" : ""} from @${esc(incident.handle)} were blocked before they filled.` : `No copies from @${esc(incident.handle)} have been placed since the pause.`} ${openFrom ? `Your ${openFrom} open position${openFrom > 1 ? "s" : ""} from them stay open with their stop-losses in place.` : ""}</div>${incident.tx ? `<a class="sm" href="${chainTx(incident.tx)}" target="_blank" rel="noopener">Proof onchain ↗</a>` : ""}</section>` : ""}
<section class="col"><div class="row sp"><h2>Traders you copy</h2><span class="sm mut">Highest risk first</span></div><div class="col only-m">${rows.map(traderRow).join("")}</div>${guardTable}${rows.length ? "" : '<div class="empty"><div class="md" style="font-weight:600">You are not copying anyone yet</div><a class="btn sm" href="/feed?tab=top">Find traders</a></div>'}</section>
${guardLog()}
<section class="col"><h2>History</h2>${events.map((e) => `<div class="tile"><div class="row sp"><b class="md">${e.kind === "halt" ? "Paused" : "Cleared"} · @${esc(userById(e.leader)?.handle ?? "")}</b><span class="sm mut">${ago(e.at)} ago</span></div><div class="sm mut" style="margin-top:4px">${esc(e.reason ?? "Checks passed, copying resumed")}</div>${e.tx ? `<a class="sm" href="${chainTx(e.tx)}" target="_blank" rel="noopener">Proof ↗</a>` : ""}</div>`).join("") || '<div class="empty"><div class="md" style="font-weight:600">No incidents in 30 days</div><div class="sm mut">Guard keeps checking every 5 minutes.</div></div>'}</section><div style="height:20px"></div></main>`;
  const how = sheet(
    "how",
    `<h2>How Guard works</h2><p class="mut md" style="line-height:1.5">Every 5 minutes a Chainlink CRE workflow checks each trader. If their behaviour looks risky or manipulated, it writes a pause to the CopyGuard contract, and copying stops for everyone.</p>
<div class="col">${[["1", "Read", "CRE nodes pull each trader's drawdown, trade bursts, concentration and token flags, and check the DEX price against the Chainlink ETH/USD Data Feed."], ["2", "Judge", "Hard rules catch obvious blow-ups and bad prices; an AI model decides the grey zone, and the nodes must agree."], ["3", "Write", "A signed report goes through the Chainlink Forwarder to the CopyGuard contract."], ["4", "Enforce", "Right before any copy, Tribe reads the CopyGuard contract itself, so a paused trader is never copied even if an event was missed. If CRE goes quiet, auto-copies wait for your OK. Your own strictness adds a personal pause line."]].map(([n, t, b]) => `<div class="row" style="align-items:flex-start;gap:12px"><span class="av sm">${n}</span><span><b>${t}</b><span class="sm mut" style="display:block;line-height:1.45">${b}</span></span></div>`).join("")}</div>
<p class="note" style="margin-top:12px">If a check can't run, new copies wait until it's back. Guard never closes your open positions; your stops do that.</p><button class="btn" data-close="how" style="margin-top:12px">Got it</button>`,
  );
  return page({ title: "Guard", nav: "guard", body, sheets: how + resumeSheets });
}

// ---------- Leaderboard ----------

/** The Top tab of the feed. Its own tabs are ?board=, since ?tab= is the feed's. */
export async function ranksHtml(viewer: number, q: Record<string, unknown>, asset: AssetFilter = "all"): Promise<string> {
  const tab = (["Baskets", "Profit", "Copied", "Streaks", "Safest", "New", "Bots", "Squads"].includes(String(q.board)) ? String(q.board) : q.q ? "Profit" : "Baskets") as "Baskets" | "Profit" | "Copied" | "Streaks" | "Safest" | "New" | "Bots" | "Squads";
  // Explore: find anyone by name, whether or not they're ranked yet.
  const find = String(q.q ?? "").trim().replace(/^@/, "").toLowerCase().slice(0, 40);
  const period = (["Week", "Month", "All"].includes(String(q.period)) ? String(q.period) : "Week") as "Week" | "Month" | "All";
  const noPause = q.guard === "1";
  const min = rankMin();
  const ids = (db.prepare("SELECT DISTINCT leader AS id FROM trades").all() as unknown as { id: number }[]).map((r) => r.id);
  const since = period === "Week" ? Date.now() - 7 * 86400e3 : period === "Month" ? Date.now() - 30 * 86400e3 : 0;
  const all = await Promise.all(ids.map(async (id) => ({ id, p: await profile(id), s: await traderStats(id), w: windowPnl(id, since), streak: greenDays(id) })));
  const eligible = all.filter((r) => r.p.days >= min.days && r.p.trades >= min.trades && (!noPause || r.p.guardPauses === 0));
  const value = (r: (typeof all)[number]): [number, string, string] =>
    tab === "Profit" ? (period === "All" ? [r.p.pnlPct, pct(r.p.pnlPct), `${r.p.trades} trades`] : [r.w.pct, pct(r.w.pct), `${r.w.n} fills`])
    : tab === "Copied" ? [r.s.copiedByOthers, String(r.s.copiedByOthers), "copies"]
    : tab === "Streaks" ? [r.streak, `${r.streak}d`, "green days"]
    : tab === "New" ? [-r.p.days, r.p.days <= 1 ? "Today" : `${r.p.days}d`, "on Tribe"]
    : [-r.p.maxDd, r.p.maxDd ? `−${r.p.maxDd.toFixed(1)}pp` : "0", "max drawdown"];
  const board = [...eligible].sort((a, b) => value(b)[0] - value(a)[0]);
  // New: traders who started in the last 30 days, newest first, before they qualify for the ranked boards.
  // A search looks through everyone who has traded.
  const ranked = find ? all.filter((r) => r.s.handle.toLowerCase().includes(find)).sort((a, b) => value(b)[0] - value(a)[0])
    : tab === "New" ? all.filter((r) => r.p.days <= 30 && (!noPause || r.p.guardPauses === 0)).sort((a, b) => value(b)[0] - value(a)[0])
    : board;
  const myIdx = board.findIndex((r) => r.id === viewer);
  const cur = seasonOf(Date.now());
  const left = seasonRange(cur).end - Date.now();
  const href = (e: Record<string, string>) => "/feed?" + new URLSearchParams({ tab: "top", board: tab, period, ...(noPause ? { guard: "1" } : {}), ...e }).toString();
  const rows = ranked.slice(0, 25).map((r, i) => {
    const [, big, sub] = value(r);
    const spark = polyline(r.p.curve.slice(-24), 56, 22);
    const mine = r.id === viewer;
    return `<div class="row" style="min-height:64px;border-bottom:1px solid #1C1C1C;gap:12px"><span style="width:22px;text-align:center;font-weight:600;color:${i < 3 ? "#34D399" : "#8A8A8A"}">${i + 1}</span><span class="av ${i === 0 ? "w" : ""}">${face(r.s.handle)}</span>
<span class="grow"><a href="/u/${esc(r.s.handle)}" style="color:#F5F5F5;font-weight:600">@${esc(r.s.handle)}</a>${mine ? ' <span class="pill">You</span>' : ""}<span class="sm mut" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.p.user.persona ?? "Trader")} · ${r.p.guardPauses ? `${r.p.guardPauses} pauses` : "No pauses"}</span></span>
<svg width="56" height="22" viewBox="0 0 56 22" aria-hidden="true"><path d="${spark}" fill="none" stroke="#34D399" stroke-width="1.6"/></svg>
<span style="text-align:right;min-width:62px"><b class="${tab === "Profit" ? signCls(value(r)[0]) : ""}">${big}</b><span class="xs mut" style="display:block">${sub}</span></span>${mine ? "" : `<a class="btn sm" href="/u/${esc(r.s.handle)}#baskets" style="height:32px">Copy</a>`}</div>`;
  });
  const mySquad = squadOf(viewer);
  let squadRows = "";
  if (tab === "Squads") {
    squadRows = (await squadBoard()).rows
      .map((sq, i) => {
        const mine = mySquad?.id === sq.id;
        const n = sq.members.length;
        return `<div class="row" style="min-height:64px;border-bottom:1px solid #1C1C1C;gap:12px"><span style="width:22px;text-align:center;font-weight:600;color:${i < 3 ? "#34D399" : "#8A8A8A"}">${i + 1}</span><span class="av ${i === 0 ? "w" : ""}">${esc(initials(sq.name))}</span><span class="grow">${mine ? `<a href="/squad" style="color:#F5F5F5;font-weight:600">${esc(sq.name)}</a> <span class="pill">Yours</span>` : `<b>${esc(sq.name)}</b>`}<span class="sm mut" style="display:block">${n} member${n === 1 ? "" : "s"}</span></span><span style="text-align:right;min-width:62px"><b>${sq.xp.toLocaleString()}</b><span class="xs mut" style="display:block">XP</span></span>${mine ? `<a class="btn sm" style="height:32px" href="/squad">Open</a>` : `<button class="btn sm" style="height:32px" data-act="/api/squad-join" data-body='{"id":${sq.id}}'>${mySquad ? "Switch" : "Join"}</button>`}</div>`;
      })
      .join("");
  }
  const metricName = { Baskets: "Return", Profit: period === "All" ? "Return" : "Realised", Copied: "Copies", Streaks: "Green days", Safest: "Max drawdown", New: "On Tribe", Bots: "Return", Squads: "" }[tab];
  // Bots: creators' published bots, by realised return on what they put in (a bot needs 3+ closed trades to rank).
  const botBoard = tab === "Bots" ? (() => {
    const bots = (db.prepare("SELECT id FROM bots WHERE status = 'live'").all() as { id: number }[]).map(({ id }) => { const b = botById(id)!; return { b, r: botRecord(b), owner: userById(b.owner)! }; })
      .sort((x, y) => (y.r.closed >= 3 ? 1 : 0) - (x.r.closed >= 3 ? 1 : 0) || (y.r.returnPct ?? -1e9) - (x.r.returnPct ?? -1e9));
    return bots.length ? bots.map(({ b, r, owner }, i) => `<a class="row" href="/bots/${b.id}" style="min-height:64px;border-bottom:1px solid #1C1C1C;gap:12px;color:#F5F5F5"><span style="width:22px;text-align:center;font-weight:600;color:${i < 3 ? "#34D399" : "#8A8A8A"}">${i + 1}</span><span class="ic36">${icon(TEMPLATES[b.template].icon, 16)}</span><span class="grow" style="min-width:0"><b>${esc(b.name)}</b><span class="sm mut" style="display:block">by @${esc(owner.handle)} · ${TEMPLATES[b.template].name} · ${r.entries} trades</span></span><span style="text-align:right;min-width:62px"><b class="${(r.returnPct ?? 0) >= 0 ? "up" : "down"}">${r.returnPct === null ? "New" : pct(r.returnPct)}</b><span class="xs mut" style="display:block">${r.closed ? `${r.wins}/${r.closed} green` : "no closes yet"}</span></span></a>`).join("")
      : `<div class="empty"><div class="md" style="font-weight:600">No published bots yet</div><div class="sm mut">Creators build one under Portfolio, in Creating; it runs a private trial for 14 days before it shows here.</div><a class="btn sm" href="/bots/new">Build a bot</a></div>`;
  })() : "";
  const nobody = find ? `Nobody called “${esc(find)}” has traded yet.` : tab === "New" ? "No new traders this month." : "Nobody ranked yet.";
  const rankTable = `<div class="card only-d" style="padding:6px 8px"><table class="tbl"><thead><tr><th>#</th><th>Trader</th><th>${metricName}</th><th>Max drawdown</th><th>Copiers</th><th>Guard</th><th></th></tr></thead><tbody>${ranked
    .slice(0, 25)
    .map((r, i) => {
      const [, big, sub] = value(r);
      const mine = r.id === viewer;
      return `<tr><td style="color:${i < 3 ? "#34D399" : "#8A8A8A"};font-weight:600">${i + 1}</td><td><a class="row" href="/u/${esc(r.s.handle)}" style="gap:10px;color:#F5F5F5"><span class="av sm ${i === 0 ? "w" : ""}">${face(r.s.handle)}</span><span><b>@${esc(r.s.handle)}</b>${mine ? ' <span class="pill">You</span>' : ""}<span class="xs mut" style="display:block">${esc(r.p.user.persona ?? "Trader")} · ${r.p.days} days</span></span></a></td><td><b class="${tab === "Profit" ? signCls(value(r)[0]) : ""}">${big}</b> <span class="xs mut">${sub}</span></td><td class="mut">${r.p.maxDd ? "−" + r.p.maxDd.toFixed(1) + "pp" : "—"}</td><td>${r.s.followers}</td><td>${r.p.guardPauses ? `<span class="pill warn">${r.p.guardPauses} pauses</span>` : '<span class="pill ok">No pauses</span>'}</td><td class="r">${mine ? "" : `<a class="btn sm" href="/u/${esc(r.s.handle)}#baskets">Copy</a>`}</td></tr>`;
    })
    .join("") || `<tr><td colspan="7" class="mut">${nobody}</td></tr>`}</tbody></table></div>`;
  const search = `<form class="lbsearch" action="/feed" method="get" role="search"><span aria-hidden="true">${icon("search", 16, "currentColor", 2)}</span><input type="hidden" name="tab" value="top"><input name="q" value="${esc(find)}" placeholder="Find a trader by name" aria-label="Find a trader by name" autocomplete="off">${tab !== "Squads" ? `<input type="hidden" name="board" value="${tab}">` : ""}${find ? `<a class="xs" href="${href({})}">Clear</a>` : ""}</form>`;
  return `<main class="main" style="gap:12px"><section class="card"><div class="row sp"><span class="sm mut">Season ${cur} • Your rank</span>${(() => { const b = seasonBoard(cur); return b?.tx && b.ranking.length ? `<a class="pill ok" href="https://sepolia.basescan.org/tx/${b.tx}" target="_blank" rel="noopener">${icon("shieldok", 11, "currentColor", 2)}CRE-verified ↗</a>` : `<span class="pill" title="The CRE season-board workflow attests the ranking onchain once traders have Flash fills">From filled orders</span>`; })()}</div>
<div class="big" style="font-size:30px;margin-top:6px">${myIdx >= 0 ? `#${myIdx + 1} / ${board.length}` : "Unranked"}</div>
<div class="sm mut" style="margin-top:2px">${Math.floor(left / 86400e3)}d ${Math.floor((left % 86400e3) / 3600e3)}h left in the season</div></section>
${search}
${find ? `<div class="sm mut">Traders matching “${esc(find)}”, sorted by ${metricName.toLowerCase() || "rank"}</div>` : ""}
${seg((["Baskets", "Profit", "Copied", "Streaks", "Safest", "New", "Bots", "Squads"] as const).map((t) => ({ label: t, href: href({ board: t }), on: t === tab })), false, "Leaderboard")}
<div class="row sp">${tab === "Squads" ? "<span></span>" : tab === "Profit" ? seg((["Week", "Month", "All"] as const).map((p) => ({ label: p, href: href({ period: p }), on: p === period })), true, "Period") : "<span></span>"}${tab === "Squads" || tab === "Bots" ? "" : `<a class="chip${noPause ? " on" : ""}" href="${href({ guard: noPause ? "0" : "1" })}">${icon("shield", 13, "currentColor", 2)}No pauses</a>`}</div>
${tab === "Baskets" ? `<div class="col" style="gap:8px">${(await basketBoard(50)).filter((v) => matchesFilter(v, asset)).slice(0, 25).map(basketRow).join("") || '<div class="sm mut">No baskets match this filter.</div>'}</div><p class="note">Ranked on return since launch, from each basket's weights and token prices.</p>` : tab === "Bots" ? `<div>${botBoard}</div><p class="note">Humans vs Bots: published bots trade from their creators' own wallets, with a stop on every trade. Ranked on realised return; a bot needs 3 closed trades before its rank counts.</p>` : tab === "Squads" ? `<div>${squadRows || '<div class="empty"><div class="md" style="font-weight:600">No squads yet</div></div>'}</div><div class="grid2"><a class="btn" href="/squads">${icon("search", 16, "currentColor", 2)}Find a squad</a><a class="btn" href="/squads">${icon("plus", 16, "currentColor", 2)}Create a squad</a></div><p class="note">A squad score is the total XP of its members.</p>` : `<div class="only-m">${rows.join("") || `<div class="empty"><div class="md" style="font-weight:600">${nobody}</div><div class="sm mut">${find ? "Try another name." : "Trade with Ask Chief to get on the board."}</div></div>`}</div>${rankTable}
<p class="note">Ranked traders have ${min.days}+ days and ${min.trades}+ trades on Tribe. Rankings come from filled Flash orders.</p>`}</main>`;
}
