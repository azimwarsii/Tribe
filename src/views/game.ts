import { allSquads, db, getMeta, getUser, setMeta, squadMembers, squadOf, userById } from "../db.js";
import { face, initials, pct, seasonOf, seasonRange, seasonRanked, tradeCard } from "../data.js";
import { badgeProgress, dayStart, levelOf, levelRange, questsOf, streakOf, traderStats, xpEvents, xpSinceLastLevel, type BadgeProgress, type Quest } from "../stats.js";
import { esc, header, icon, page, progress, seg, sheet, signCls, split } from "../ui.js";

const BASE_URL = () => process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;
const kxp = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString("en-US"));
const day = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const seasonNow = () => {
  const cur = seasonOf(Date.now());
  return { cur, days: Math.max(0, Math.ceil((seasonRange(cur).end - Date.now()) / 86400e3)) };
};

/** Level, progress to the next one and its threshold, for an XP total. */
export function levelView(xp: number) {
  const level = levelOf(xp);
  const { lo, hi } = levelRange(level);
  return { level, hi, pct: ((xp - lo) / (hi - lo)) * 100, toNext: hi - xp };
}

/** Squads ranked by total member XP. */
export async function squadBoard() {
  const xpOf = new Map<number, number>();
  const rows = await Promise.all(
    allSquads().map(async (sq) => {
      const members = squadMembers(sq.id);
      let xp = 0;
      for (const m of members) {
        const v = (await traderStats(m)).xp;
        xpOf.set(m, v);
        xp += v;
      }
      return { ...sq, members, xp };
    }),
  );
  rows.sort((a, b) => b.xp - a.xp);
  return { rows, xpOf };
}

/** Last season's finish for the viewer, for the Progress and Badges cards. */
function lastSeasonCard(uid: number): string {
  const prev = seasonOf(Date.now()) - 1;
  if (prev < 1) return "";
  const ranked = seasonRanked(prev);
  const i = ranked.findIndex((r) => r.id === uid);
  const title = i >= 0 ? `Season ${prev} · Top ${Math.max(1, Math.ceil(((i + 1) / ranked.length) * 100))}%` : `Season ${prev} results`;
  const sub = i >= 0 ? `Finished #${i + 1} of ${ranked.length.toLocaleString("en-US")}` : "You weren't ranked last season";
  return `<section class="flat row" aria-label="Season finishes" style="gap:12px"><span aria-hidden="true" class="av w" style="width:40px;height:40px;border-radius:20px;font-size:13px;font-weight:700">S${prev}</span><span class="grow"><b class="md" style="display:block">${title}</b><span class="sm mut" style="display:block">${sub}</span></span><a href="/season" class="md" style="font-weight:600">Results</a></section>`;
}

// ---------- Progress: level, streak, quests ----------

const questRow = (q: Quest) => {
  const complete = q.done >= q.of;
  const right = q.claimed
    ? `<span class="md mut" style="font-weight:600;flex-shrink:0">Claimed</span>`
    : complete
      ? `<button class="btn sm p" style="flex-shrink:0" data-act="/api/quest-claim" data-body='{"id":"${q.id}"}'>Claim +${q.xp} XP</button>`
      : `<span class="pill" style="height:28px;padding:0 10px;border-radius:14px;color:#C4C4C4;font-size:12px;font-weight:600;flex-shrink:0">+${q.xp} XP</span>`;
  return `<div class="flat row qcard" style="gap:12px;padding:12px 14px;border-radius:16px"><span aria-hidden="true" class="ic36">${icon(q.icon, 18)}</span>
<span class="grow col" style="gap:6px"><span class="md" style="font-weight:600;line-height:1.3">${esc(q.title)}</span><span class="row" style="gap:8px"><span class="grow">${progress((q.done / q.of) * 100, q.title, "s")}</span><span class="sm mut">${q.done}/${q.of}</span></span></span>${right}</div>`;
};

const badgeStatus = (b: BadgeProgress) =>
  b.done >= b.of ? (b.when ? `Earned ${day(b.when)}` : "Earned") : b.unit ? `${b.done}${b.unit} of ${b.of}${b.unit}` : `${b.done} of ${b.of}`;

export async function progressPage(uid: number, tab: string): Promise<string> {
  const u = getUser(uid);
  const s = await traderStats(uid);
  const lv = levelView(s.xp);
  const st = streakOf(uid);
  const period = tab === "Weekly" ? "Weekly" : "Daily";
  const quests = questsOf(uid).filter((q) => q.period === period);
  const { cur, days } = seasonNow();
  const badges = await badgeProgress(uid);
  const earned = badges.filter((b) => b.done >= b.of).length;
  const left = dayStart() + 86400e3 - Date.now();
  const reset = period === "Daily" ? `New daily quests in ${Math.floor(left / 3600e3)}h ${Math.floor((left % 3600e3) / 60e3)}m` : "Weekly quests reset Monday";
  const sq = squadOf(uid);
  const sqRank = sq ? (await squadBoard()).rows.findIndex((r) => r.id === sq.id) + 1 : 0;

  const level = `<section class="card col" aria-label="Level" style="gap:12px"><div class="row sp"><span class="mut" style="font-size:13px">Your level</span>${u.persona ? `<span class="pill ok">${esc(u.persona)}</span>` : ""}</div>
<div class="row" style="align-items:baseline;gap:10px"><span style="font-size:38px;font-weight:600;letter-spacing:-.02em">Level ${lv.level}</span><span class="mut" style="font-size:15px">${s.xp.toLocaleString("en-US")} XP</span></div>
${progress(lv.pct, "Progress to next level")}<div class="row sp" style="font-size:13px"><span style="color:#C4C4C4">${lv.toNext.toLocaleString("en-US")} XP to Level ${lv.level + 1}</span><span class="mut">Level ${lv.level + 1} at ${lv.hi.toLocaleString("en-US")}</span></div></section>`;
  const streak = `<section class="flat col" aria-label="Streak" style="gap:12px"><div class="row sp" style="align-items:baseline"><b style="font-size:15px">${st.current ? `${st.current} green day${st.current === 1 ? "" : "s"} in a row` : "No green streak yet"}</b><span class="sm mut">Best ${st.best}</span></div>
<ul aria-label="Last 7 days" style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">${st.week.map((d) => `<li style="display:flex;flex-direction:column;align-items:center;gap:6px"><span class="daydot${d.green ? " on" : ""}" role="img" aria-label="${d.green ? "Green day" : "No green close"}">${icon(d.green ? "check" : "clock", 14, "currentColor", d.green ? 3 : 2)}</span><span class="xs mut" aria-hidden="true">${d.label}</span></li>`).join("")}</ul>
<div class="sm mut" style="line-height:1.4">A green day closes with positive realised PnL. Streaks rank on the <a href="/ranks?tab=Streaks">Streaks leaderboard</a>.</div></section>`;
  const questSec = `<section class="col" aria-label="Quests" style="gap:10px"><div class="row sp"><h2 style="font-size:16px">Quests</h2>${seg((["Daily", "Weekly"] as const).map((p) => ({ label: p, href: `/progress?tab=${p}`, on: p === period })), true, "Quest period")}</div>
<div class="sm mut">${reset}</div><div class="d3">${quests.map(questRow).join("")}</div></section>`;
  const earn = [["Each trade", "+10"], ["New follower", "+20"], ["Each copy you make", "+5"], ["Someone copies you", "+3"], ["Bracket order", "+5"], ["Saved by Guard", "+15"]];
  const how = `<section class="flat col" aria-label="How you earn XP" style="gap:10px"><b style="font-size:15px">How you earn XP</b><div class="grid2" style="gap:8px 16px">${earn.map(([k, v]) => `<span class="row sp" style="font-size:13px"><span style="color:#C4C4C4">${k}</span><b>${v}</b></span>`).join("")}</div>
<div class="sm mut" style="line-height:1.4">Plus 100 XP while your PnL is positive, and the XP on quests you claim. XP comes from your real activity, so it can't be gamed.</div></section>`;

  const aside = `<section class="flat col" aria-label="Badges" style="gap:6px"><div class="row sp"><h2 style="font-size:16px">Badges</h2><a class="sm" href="/badges">${earned} of ${badges.length} earned</a></div>
${badges.map((b) => { const on = b.done >= b.of; return `<details class="bd"><summary class="row" style="gap:10px;min-height:52px"><span class="medal${on ? " on" : ""}" style="width:36px;height:36px" aria-hidden="true">${icon(b.icon, 16)}</span><span class="grow md" style="font-weight:600">${b.label}</span><span class="sm ${on ? "up" : "mut"}">${badgeStatus(b)}</span></summary><div class="sm mut" style="padding:0 0 10px 46px;line-height:1.45">${esc(b.how)}</div></details>`; }).join("")}</section>
${lastSeasonCard(uid)}
<a class="flat row" href="${sq ? "/squad" : "/squads"}" style="gap:12px;color:#F5F5F5"><span aria-hidden="true" class="av" style="border-radius:12px">${esc(sq ? initials(sq.name) : "+")}</span><span class="grow"><b class="md" style="display:block">${sq ? `${esc(sq.name)} · #${sqRank} squad` : "Join a squad"}</b><span class="sm mut" style="display:block">${sq ? "Your XP counts for the squad" : "Your XP counts for one squad at a time"}</span></span><span class="md up" style="font-weight:600">Open</span></a>`;

  const body = `${header("Progress", `Season ${cur} · ${days} days left`, "/me", `<a class="btn sm" href="/badges">Badges</a>`)}
${split(`<main class="main" style="gap:14px"><div class="d2">${level}${streak}</div>${questSec}${how}<div style="height:90px" class="only-m"></div></main>`, aside, "Badges and season")}`;
  return page({ title: "Progress", nav: "me", body, split: true });
}

// ---------- Badges ----------

export async function badgesPage(uid: number): Promise<string> {
  const badges = await badgeProgress(uid);
  const handle = getUser(uid).handle;
  const earned = badges.filter((b) => b.done >= b.of).length;
  const card = (b: BadgeProgress, i: number) => {
    const on = b.done >= b.of;
    const count = b.unit ? `${b.done}${b.unit} / ${b.of}${b.unit}` : `${b.done} / ${b.of}`;
    return `<button class="tile col step" data-open="b-${b.id}" aria-label="${b.label}, ${on ? "earned" : "locked"}" style="text-align:left;padding:14px;border-radius:18px;gap:10px;min-height:152px;color:#F5F5F5;animation-delay:${i * 50}ms;${on ? "border-color:rgba(52,211,153,.3)" : "background:#111"}">
<span class="medal${on ? " on" : ""}" aria-hidden="true">${icon(b.icon, 22)}</span><span style="font-size:15px;font-weight:600">${b.label}</span><span class="sm mut" style="line-height:1.4">${b.rule}</span>
${on ? `<span class="sm up" style="font-weight:600">${badgeStatus(b)}</span>` : `<span class="row" style="gap:8px;width:100%"><span class="grow">${progress((b.done / b.of) * 100, `${b.label} progress`, "s mute")}</span><span class="sm" style="color:#C4C4C4">${count}</span></span>`}</button>`;
  };
  const sheets = badges
    .map((b) => {
      const on = b.done >= b.of;
      const [cta, href] = on ? ["Show on profile", `/u/${encodeURIComponent(handle)}?tab=Badges`] : b.cta;
      return sheet(
        `b-${b.id}`,
        `<div class="col" style="align-items:center;text-align:center;gap:12px"><span class="medal${on ? " on" : ""}" aria-hidden="true" style="width:80px;height:80px;border-radius:40px;margin-top:8px">${icon(b.icon, 34)}</span><h2 style="font-size:20px">${b.label}</h2>
<p style="margin:0;font-size:14px;color:#C4C4C4;line-height:1.5;max-width:300px">${esc(b.how)}</p><span class="${on ? "up" : ""}" style="font-size:13px;font-weight:600;${on ? "" : "color:#C4C4C4"}">${on ? (b.when ? `Earned on ${day(b.when)}` : "Earned") : `${badgeStatus(b)} so far`}</span></div>
<div class="grid2" style="margin-top:18px;gap:10px"><button class="btn" data-close="b-${b.id}">Close</button><a class="btn w" href="${href}">${cta}</a></div>`,
      );
    })
    .join("");
  const body = `${header("Badges", `${earned} of ${badges.length} earned · shown on your profile`, "/progress")}<main class="main" style="gap:14px">
${progress((earned / badges.length) * 100, "Badges earned", "s")}
<div class="grid2" style="gap:10px">${badges.map(card).join("")}</div>${lastSeasonCard(uid)}<div style="height:90px"></div></main>`;
  return page({ title: "Badges", nav: "me", body, sheets });
}

// ---------- Squads ----------

export async function squadPage(uid: number, view: "mine" | "find", q: string): Promise<string> {
  const mine = squadOf(uid);
  if (view === "mine" && !mine) view = "find";
  const { rows, xpOf } = await squadBoard();
  const { cur, days } = seasonNow();
  const query = q.trim().toLowerCase();

  // Find and create, used on phones at /squads and in the desktop aside.
  const found = rows.filter((r) => !query || r.name.toLowerCase().includes(query));
  const findRows = found
    .map((r) => {
      const yours = mine?.id === r.id;
      const n = r.members.length;
      const btn = yours
        ? `<span class="btn sm" style="min-width:72px;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.5);color:#34D399">Yours</span>`
        : `<button class="btn sm w" style="min-width:72px" aria-label="Join ${esc(r.name)}" data-act="/api/squad-join" data-body='{"id":${r.id}}'${mine ? ` data-confirm="Leave ${esc(mine.name)} and join ${esc(r.name)}? Your XP moves with you."` : ""}>Join</button>`;
      return `<div class="row" style="gap:12px;min-height:60px;border-bottom:1px solid #1C1C1C"><span style="width:20px;text-align:center;font-size:13px;font-weight:600;color:#A3A3A3">${rows.indexOf(r) + 1}</span><span aria-hidden="true" class="av" style="border-radius:12px">${esc(initials(r.name))}</span><span class="grow"><b style="display:block;font-size:15px">${esc(r.name)}</b><span class="sm mut" style="display:block">${n} member${n === 1 ? "" : "s"} · ${kxp(r.xp)} XP</span></span>${btn}</div>`;
    })
    .join("");
  const find = `<section class="col" aria-label="Find a squad" style="gap:10px"><h2 class="only-d" style="font-size:16px">Find a squad</h2>
<form method="get" action="/squads" role="search"><label class="row" style="height:48px;padding:0 16px;border-radius:24px;background:#161616;border:1px solid rgba(255,255,255,.1);gap:10px">${icon("search", 18, "#A3A3A3", 2)}<input type="search" name="q" value="${esc(q)}" placeholder="Search squads" aria-label="Search squads" style="flex:1;min-width:0;height:100%;border:0;background:transparent;color:#F5F5F5;font-size:15px"></label></form>
<div>${findRows || `<div class="md mut" style="padding:18px 0">${query ? `No squad called “${esc(q)}”. Create it below.` : "No squads yet. Start the first one."}</div>`}</div></section>
<section class="flat col" aria-label="Create a squad" style="gap:10px"><b style="font-size:15px">Start your own squad</b>
<form data-form action="/api/squad" class="col" style="gap:10px"><label class="col" style="gap:6px"><span class="sm mut">Squad name · 3 to 24 letters, numbers or spaces</span><input class="f" name="name" maxlength="24" pattern="[A-Za-z0-9 ]{3,24}" value="${query && !found.length ? esc(q) : ""}" placeholder="e.g. Stop Loss Society" required style="height:44px;border-radius:12px;font-size:15px;background:#0F0F0F"></label>
<button class="btn p">Create squad</button></form></section>`;

  let mineHtml = "";
  let leaveSheet = "";
  if (mine) {
    const row = rows.find((r) => r.id === mine.id)!;
    const rank = rows.indexOf(row);
    const other = rank === 0 ? rows[1] : rows[rank - 1];
    const max = Math.max(row.xp, other?.xp ?? 0) || 1;
    const bar = (r: typeof row, me: boolean) =>
      `<div class="row" style="gap:10px;font-size:13px"><span style="width:92px;${me ? "font-weight:600" : "color:#C4C4C4"};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</span><span class="grow">${progress((r.xp / max) * 100, `${r.name} squad XP`, me ? "s" : "s mute")}</span><span style="width:44px;text-align:right;${me ? "" : "color:#C4C4C4"}">${kxp(r.xp)}</span></div>`;
    const myXp = xpOf.get(uid) ?? 0;
    const gap = other ? Math.abs(row.xp - other.xp) : 0;
    const lead = !other ? "The only squad so far." : rank === 0 ? `You lead by ${kxp(gap)} XP with ${days} days left.` : `${kxp(gap)} XP behind ${esc(other.name)}.`;
    const standing = `<section class="card col" aria-label="Squad standing" style="gap:14px"><div class="row sp" style="align-items:baseline"><span class="mut" style="font-size:13px">Season ${cur} · ${days} days left</span><span class="up" style="font-size:13px">#${rank + 1} on the Squads board</span></div>
<div class="row" style="align-items:baseline;gap:10px"><span style="font-size:38px;font-weight:600;letter-spacing:-.02em">${kxp(row.xp)}</span><span class="mut" style="font-size:15px">squad XP</span></div>
<div class="col" style="gap:8px">${[row, other].filter(Boolean).sort((a, b) => b!.xp - a!.xp).map((r) => bar(r!, r!.id === row.id)).join("")}</div>
<div style="font-size:13px;color:#C4C4C4">${lead} Your share: ${myXp.toLocaleString("en-US")} XP (${row.xp ? Math.round((myXp / row.xp) * 100) : 0}%).</div></section>`;

    // XP from the same snapshot as the squad total, so the rows add up to it.
    const people = await Promise.all(row.members.map(async (m) => {
      const st = await traderStats(m);
      const xp = xpOf.get(m) ?? st.xp;
      return { id: m, u: userById(m)!, s: { ...st, xp, level: levelOf(xp) } };
    }));
    people.sort((a, b) => b.s.xp - a.s.xp);
    const top = people.slice(0, 5);
    const restXp = people.slice(5).reduce((a, p) => a + p.s.xp, 0);
    const memberList = `<div class="only-m">${top.map((p, i) => `<a class="row" href="${p.id === uid ? "/progress" : `/u/${esc(p.u.handle)}`}" style="gap:12px;min-height:56px;border-bottom:1px solid #1C1C1C;color:#F5F5F5"><span style="width:20px;text-align:center;font-size:13px;font-weight:600;color:#A3A3A3">${i + 1}</span><span aria-hidden="true" class="av ${p.id === uid ? "" : ""}" style="${p.id === uid ? "background:#34D399;color:#052E1C;border:0" : ""}">${face(p.u.handle)}</span><span class="grow"><b style="display:block;font-size:15px">@${esc(p.u.handle)}${p.id === uid ? " · you" : ""}</b><span class="sm mut" style="display:block">Lv ${p.s.level} · ${esc(p.u.persona ?? `${p.s.trades} trades`)}</span></span><b class="md">${p.s.xp.toLocaleString("en-US")}</b></a>`).join("")}
${people.length > 5 ? `<div class="md mut" style="min-height:44px;display:flex;align-items:center;font-size:13px">${people.length - 5} more member${people.length - 5 === 1 ? "" : "s"} · ${restXp.toLocaleString("en-US")} XP</div>` : ""}</div>
<div class="card only-d" style="padding:6px 8px"><table class="tbl"><thead><tr><th>#</th><th>Member</th><th>Level</th><th>Persona</th><th class="r">XP</th></tr></thead><tbody>${people.slice(0, 25).map((p, i) => `<tr style="${p.id === uid ? "background:rgba(52,211,153,.05)" : ""}"><td class="mut">${i + 1}</td><td><a href="${p.id === uid ? "/progress" : `/u/${esc(p.u.handle)}`}" style="color:#F5F5F5"><b>@${esc(p.u.handle)}</b>${p.id === uid ? ' <span class="pill">You</span>' : ""}</a></td><td>Lv ${p.s.level}</td><td class="mut">${esc(p.u.persona ?? "—")}</td><td class="r"><b>${p.s.xp.toLocaleString("en-US")}</b></td></tr>`).join("")}${people.length > 25 ? `<tr><td></td><td colspan="4" class="mut">${people.length - 25} more members</td></tr>` : ""}</tbody></table></div>`;

    const ids = row.members.join(",") || "0";
    const recent = (db.prepare(`SELECT id FROM trades WHERE leader IN (${ids}) ORDER BY id DESC LIMIT 3`).all() as unknown as { id: number }[]).map((r) => r.id);
    const cards = (await Promise.all(recent.map((id) => tradeCard(id, uid)))).filter((c) => c !== undefined);
    const trades = `<section class="flat col" aria-label="Squad trades" style="gap:10px"><div class="row sp" style="align-items:baseline"><b style="font-size:15px">Latest squad trades</b><a href="/feed?tab=Squad" class="md" style="font-weight:600">Squad feed</a></div>
${cards.map((c) => `<a class="row sp" href="/thread/${c.id}" style="font-size:13px;color:#C4C4C4"><span>@${esc(c.handle)} · ${esc(c.symbol)} ${c.trade.side === "buy" ? "long" : "sold"} · ${esc(c.orderLabel.toLowerCase())}</span>${c.sincePct !== null ? `<b class="${signCls(c.sincePct)}">${pct(c.sincePct)}</b>` : ""}</a>`).join("") || '<div class="sm mut">No squad trades yet.</div>'}</section>`;

    const invite = `${BASE_URL()}/squads?q=${encodeURIComponent(mine.name)}`;
    mineHtml = `<section class="row only-d" aria-label="Your squad" style="gap:12px"><span aria-hidden="true" class="av w" style="width:48px;height:48px;border-radius:14px;font-size:15px">${esc(initials(mine.name))}</span><span class="grow"><span class="sm mut" style="display:block">Your squad</span><b style="display:block;font-size:20px">${esc(mine.name)}</b></span><button class="btn sm w" data-copy="${esc(invite)}">Invite</button><button class="btn sm" data-open="leave">Leave</button></section>
${standing}<section class="col" aria-label="Members" style="gap:4px"><div class="row sp" style="align-items:baseline"><h2 style="font-size:16px">Members</h2><span class="sm mut">by XP</span></div>${memberList}</section>${trades}
<button class="btn only-m" data-open="leave" style="height:44px;border-radius:22px;background:transparent;color:#C4C4C4">Leave squad</button>`;
    leaveSheet = sheet(
      "leave",
      `<h2 style="font-size:20px">Leave ${esc(mine.name)}?</h2><p style="font-size:14px;color:#C4C4C4;line-height:1.5">Your ${myXp.toLocaleString("en-US")} XP stops counting for the squad. You keep your own XP, level and badges, and you can join another squad right away.</p>
<div class="grid2" style="gap:10px"><button class="btn" data-close="leave">Stay</button><button class="btn" style="background:#F87171;color:#1A0505;border:0" data-act="/api/squad-leave">Leave</button></div>`,
    );
  }
  const none = `<div class="empty"><div class="md" style="font-weight:600">No squad yet</div><div class="sm mut">Join a squad or start one. Your XP counts for one squad at a time.</div></div>`;
  const desktopMain = mineHtml || none;
  const head = view === "mine" && mine
    ? header(mine.name, `Your squad · ${rows.find((r) => r.id === mine.id)!.members.length} members`, "/ranks?tab=Squads", `<button class="btn sm w" data-copy="${esc(`${BASE_URL()}/squads?q=${encodeURIComponent(mine.name)}`)}">Invite</button>`)
    : header("Squads", "Team up · your XP counts for one squad", "/ranks?tab=Squads");
  const main = view === "mine" ? mineHtml : `<div class="only-m"><div class="col" style="gap:14px">${find}</div></div><div class="only-d"><div class="col" style="gap:14px">${desktopMain}</div></div>`;
  const body = `<div class="only-m">${head}</div><div class="only-d">${header("Squads", `Team up · your XP counts for one squad · Season ${cur}`, "/ranks?tab=Squads")}</div>
${split(`<main class="main" style="gap:14px">${main}<div style="height:90px" class="only-m"></div></main>`, find, "Find a squad")}`;
  return page({ title: mine && view === "mine" ? mine.name : "Squads", nav: "ranks", body, sheets: leaveSheet, split: true });
}

// ---------- Level up ----------

async function levelUpInner(uid: number): Promise<string> {
  const s = await traderStats(uid);
  const lv = levelView(s.xp);
  const sq = squadOf(uid);
  const since = xpSinceLastLevel(xpEvents(uid, s.pnlPct > 0), lv.level);
  return `<div class="col" style="align-items:center;text-align:center;gap:18px">
<div aria-hidden="true" class="lvring"><span style="font-size:12px;font-weight:600;letter-spacing:.14em;color:#34D399">LEVEL</span><span style="font-size:64px;font-weight:600;line-height:1;letter-spacing:-.03em">${lv.level}</span></div>
<div class="step" style="animation-delay:260ms"><h1 class="h1">You reached Level ${lv.level}</h1><p style="margin:6px 0 0;font-size:15px;color:#C4C4C4">${s.xp.toLocaleString("en-US")} XP${sq ? ` · it also counts for ${esc(sq.name)}` : ""}</p></div>
<section aria-label="Where the XP came from" class="card" style="align-self:stretch;text-align:left;padding:14px 16px;background:linear-gradient(180deg,#1F1F1F,#151515)"><div class="mut" style="font-size:13px;margin-bottom:4px">Since your last level</div>
${since.rows.map(([label, xp], i) => `<div class="row sp step" style="min-height:36px;border-bottom:1px solid #222;font-size:14px;animation-delay:${420 + i * 80}ms"><span style="color:#D4D4D4">${esc(label)}</span><b class="up">+${xp} XP</b></div>`).join("")}
<div class="row sp" style="min-height:40px;font-size:15px;font-weight:600"><span>Total</span><span>+${since.total} XP</span></div></section>
<div class="col" style="align-self:stretch;gap:8px">${progress(Math.max(1, lv.pct), `Progress to Level ${lv.level + 1}`, "s")}<div class="row sp" style="font-size:13px"><span style="color:#C4C4C4">${lv.toNext.toLocaleString("en-US")} XP to Level ${lv.level + 1}</span><span class="mut">Level ${lv.level + 1} at ${lv.hi.toLocaleString("en-US")}</span></div></div>
<div class="grid2" style="align-self:stretch;gap:10px"><a class="btn big" href="/share/me">Share</a><a class="btn p big" href="/progress">See progress</a></div></div>`;
}

export async function levelUpPage(uid: number): Promise<string> {
  const body = `<div style="min-height:100vh;display:flex;flex-direction:column;background-image:radial-gradient(ellipse 80% 45% at 50% 22%,rgba(52,211,153,.16),rgba(52,211,153,0) 100%)"><header class="hd" style="justify-content:flex-end"><a class="ic" href="/feed" aria-label="Close">${icon("close", 18, "currentColor", 2)}</a></header>
<main class="main" style="padding-bottom:28px">${await levelUpInner(uid)}</main></div>`;
  return page({ title: "Level up", body, focus: true });
}

/** The level-up dialog for the feed, once per new level. The first visit only records the current level. */
export async function levelUpPrompt(uid: number): Promise<string> {
  const level = levelOf((await traderStats(uid)).xp);
  const seen = getMeta(uid).seenLevel;
  if (seen >= level) return "";
  setMeta(uid, { seenLevel: level });
  if (!seen) return "";
  return `${sheet("levelup", `<div style="display:flex;justify-content:flex-end"><button class="ic" data-close="levelup" aria-label="Close">${icon("close", 18, "currentColor", 2)}</button></div>${await levelUpInner(uid)}`)}<span data-autoopen="levelup" hidden></span>`;
}
