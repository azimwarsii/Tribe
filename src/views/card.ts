import { CARD_FONTS } from "../card-fonts.js";
import type { CardView } from "../cards.js";
import { progressOf, type CardKind, type Tier } from "../card-tiers.js";
import { pct } from "../data.js";
import { esc } from "../ui.js";

export const CARD_W = 360;
export const CARD_H = 504;

// The design's typefaces travel inside the file (card-fonts.ts). These stand in for anything outside basic Latin.
const SANS = `Inter,'Helvetica Neue',Helvetica,Arial,sans-serif`;
const DISPLAY = `'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif`;
const MONO = `'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace`;

// The grid inside the 10px frame: a 340 x 484 panel, with 17px of padding to the content.
const LEFT = 27, RIGHT = 333, WIDTH = RIGHT - LEFT;
const CHART_Y = 63, CHART_H = 150;
const SLOTS = 4;

interface Theme {
  label: string; frame: string[]; badge: string[]; badgeInk: string; panelStroke: string; chartBg: string; chartStroke: string; grid: string;
  text: string; sub: string; mono: string; rule: string; track: string; slices: string[]; gain: string;
  line: string[]; lineW: number; dot: string; dotR: number; area: [string, number, string]; bar: string[];
  plot: [number, number]; // where the chart line sits: its top, and how much height it gets. Each tier stands taller.
}

/** The three finishes, from the Basket Card Tiers design. */
const THEME: Record<Tier, Theme> = {
  base: {
    label: "BASE", frame: ["#2b2e34"], badge: [], badgeInk: "#c4c8ce", panelStroke: "#353941", chartBg: "#1d2025", chartStroke: "#2a2e35", grid: "#2a2e35",
    text: "#e8eaed", sub: "#9aa0a6", mono: "#c4c8ce", rule: "#2a2e35", track: "#2a2e35", slices: ["#e8eaed", "#b7bcc3", "#80868e", "#555a62"], gain: "#e8eaed",
    line: ["#b7bcc3"], lineW: 2, dot: "#e8eaed", dotR: 4, area: ["#9aa0a6", 0.08, "#9aa0a6"], bar: ["#b7bcc3"], plot: [76, 42],
  },
  glitter: {
    label: "GLITTER", frame: ["#d9dbe4", "#8e92a4", "#efe4c2", "#9a9fb2", "#dcdfe8"], badge: ["#f3f0ff", "#b9bdcc", "#f1e3b8"], badgeInk: "#1b1838", panelStroke: "rgba(255,255,255,.18)", chartBg: "rgba(12,10,28,.65)", chartStroke: "rgba(201,184,255,.28)", grid: "rgba(201,184,255,.12)",
    text: "#ffffff", sub: "#c9c2e8", mono: "#ddd6f7", rule: "rgba(201,184,255,.2)", track: "rgba(201,184,255,.18)", slices: ["#f1e3b8", "#dcd3ff", "#a594f0", "#6c5fc0"], gain: "#f1e3b8",
    line: ["#b9bdcc", "#c7b8ff", "#f1e3b8"], lineW: 2.5, dot: "#f1e3b8", dotR: 5, area: ["#c7b8ff", 0.35, "#c7b8ff"], bar: ["#c7b8ff", "#f1e3b8"], plot: [46, 78],
  },
  holo: {
    label: "HOLO", frame: ["#ff5f9e", "#ffb86b", "#f6f57a", "#6bffbf", "#66c6ff", "#a98bff", "#ff5f9e"], badge: ["#ff9ec4", "#ffe08a", "#9dffd3", "#9ed8ff", "#cdb6ff"], badgeInk: "#0d1020", panelStroke: "rgba(255,255,255,.25)", chartBg: "rgba(8,10,22,.7)", chartStroke: "rgba(255,255,255,.18)", grid: "rgba(255,255,255,.08)",
    text: "#ffffff", sub: "#d6dcf5", mono: "#e6eaff", rule: "rgba(255,255,255,.16)", track: "rgba(255,255,255,.14)", slices: ["#ff8fbb", "#ffd27a", "#7dffc9", "#7ccfff"], gain: "#8dffcf",
    line: ["#ff5f9e", "#ffb86b", "#6bffbf", "#66c6ff", "#a98bff"], lineW: 3, dot: "#ffffff", dotR: 6, area: ["#66c6ff", 0.3, "#a98bff"], bar: ["#ff5f9e", "#ffb86b", "#6bffbf", "#66c6ff"], plot: [22, 110],
  },
};

const LOSS = "#F87171";
const STAR = "M0,-6 L1.4,-1.4 L6,0 L1.4,1.4 L0,6 L-1.4,1.4 L-6,0 L-1.4,-1.4 Z";
/** The design's sparkles, in panel coordinates: x, y, size, and which twinkle delay. */
const STARS: [number, number, number, string][] = [[28, 52, 0.9, ""], [304, 38, 1.2, "d2"], [250, 250, 0.7, "d4"], [312, 300, 0.8, "d1"], [20, 330, 0.6, "d3"], [180, 470, 0.9, "d5"], [318, 455, 0.6, "d2"], [150, 20, 0.5, "d4"]];
const DOTS: [number, number, number, string][] = [[60, 120, 1.2, "d1"], [120, 80, 1, "d3"], [230, 110, 1.4, "d5"], [280, 170, 1, "d2"], [90, 190, 1.3, ""], [200, 60, 1, "d4"], [40, 250, 1.1, "d3"], [300, 380, 1.2, "d1"], [60, 420, 1, "d5"], [250, 430, 1.3, "d2"], [140, 300, 0.9, ""], [330, 230, 1, "d4"]];

const MOTION = `@keyframes tw{0%,100%{opacity:.15}50%{opacity:1}}.tw{animation:tw 2.8s ease-in-out infinite}.d1{animation-delay:.35s}.d2{animation-delay:.8s}.d3{animation-delay:1.3s}.d4{animation-delay:1.9s}.d5{animation-delay:2.4s}
@keyframes hue{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}.hue{animation:hue 9s linear infinite}
@keyframes sweep{to{transform:translate(72.5px,33.8px)}}.sweep{animation:sweep 7s linear infinite}
@keyframes glare{from{transform:translateX(-380px)}to{transform:translateX(380px)}}.glare{animation:glare 4.5s ease-in-out infinite}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}`;

/** Text width in ems, roughly: there's no font to measure with here, so this errs wide. */
function emWidth(s: string): number {
  let w = 0;
  for (const c of s) w += /[WM@%]/.test(c) ? 1 : /[A-Z0-9]/.test(c) ? 0.74 : /[iljtf.,' ]/.test(c) ? 0.36 : c.codePointAt(0)! > 0x2e7f ? 1.15 : 0.6;
  return w;
}
const fit = (width: number, max: number, ems: number) => Math.min(max, Math.floor((width / Math.max(ems, 0.1)) * 10) / 10);
const fitSans = (s: string, width: number, max: number) => fit(width, max, emWidth(s));
const fitMono = (s: string, width: number, max: number) => fit(width, max, [...s].length * 0.62);
const clip = (s: string, n: number) => ([...s].length > n ? `${[...s].slice(0, n - 1).join("")}…` : s);
const weightText = (n: number) => `${Number(n.toFixed(1))}%`;

const gradient = (id: string, colours: string[], x2 = 1, y2 = 0) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${colours.map((c, i) => `<stop offset="${(i / Math.max(1, colours.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join("")}</linearGradient>`;
/** A flat colour, or a reference to the gradient made from several. */
const paint = (id: string, colours: string[]) => (colours.length > 1 ? `url(#${id})` : colours[0]);

/** The chart's line: about a dozen points, for the design's angular look, in the tier's part of a 306 x 150 box. */
function chartLine(chart: number[], tier: Tier): { line: string; lastY: number } {
  const [top, h] = THEME[tier].plot;
  const n = Math.min(chart.length, 11);
  const vals = Array.from({ length: n }, (_, i) => chart[n > 1 ? Math.round((i * (chart.length - 1)) / (n - 1)) : 0]);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  // A new card has one value or several the same: a level line.
  if (!(mx > mn)) return { line: `M0.0 ${(top + h / 2).toFixed(1)} L${WIDTH}.0 ${(top + h / 2).toFixed(1)}`, lastY: top + h / 2 };
  const ys = vals.map((v) => top + (1 - (v - mn) / (mx - mn)) * h);
  return { line: ys.map((y, i) => `${i ? "L" : "M"}${((i * WIDTH) / (n - 1)).toFixed(1)} ${y.toFixed(1)}`).join(" "), lastY: ys[n - 1] };
}

function chartSvg(v: CardView, t: Theme, p: string): string {
  const { line, lastY } = chartLine(v.chart, v.tier);
  const rows = [50, 90, 130].map((y) => `<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="${t.grid}"/>`).join("");
  return `<clipPath id="${p}chart"><rect width="${WIDTH}" height="${CHART_H}" rx="10"/></clipPath>
<g transform="translate(${LEFT} ${CHART_Y})"><rect width="${WIDTH}" height="${CHART_H}" rx="10" fill="${t.chartBg}"/><g clip-path="url(#${p}chart)">${rows}
<path d="${line} L${WIDTH} ${CHART_H} L0 ${CHART_H} Z" fill="url(#${p}area)"/><path d="${line}" fill="none" stroke="${paint(`${p}line`, t.line)}" stroke-width="${t.lineW}"/><circle cx="${WIDTH}" cy="${lastY.toFixed(1)}" r="${t.dotR}" fill="${t.dot}"/></g><rect x=".5" y=".5" width="${WIDTH - 1}" height="${CHART_H - 1}" rx="9.5" fill="none" stroke="${t.chartStroke}"/></g>`;
}

/** The feed card's chart: the same line, stretching to whatever height the card has spare. Its colours come from the card's CSS. */
export function feedChartHtml(id: number, chart: number[], tier: Tier): string {
  const { line, lastY } = chartLine(chart, tier);
  const g = `fl${id}`, a = `fa${id}`;
  const stops = [1, 2, 3, 4, 5].map((n) => `<stop offset="${(n - 1) / 4}" style="stop-color:var(--l${n})"/>`).join("");
  const rows = [50, 90, 130].map((y) => `<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" vector-effect="non-scaling-stroke" style="stroke:var(--f-grid)"/>`).join("");
  return `<div class="fchart" aria-hidden="true"><svg viewBox="0 0 ${WIDTH} ${CHART_H}" preserveAspectRatio="none"><defs><linearGradient id="${g}">${stops}</linearGradient><linearGradient id="${a}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--a1);stop-opacity:var(--ao)"/><stop offset="1" style="stop-color:var(--a2);stop-opacity:var(--ao2)"/></linearGradient></defs>${rows}<path d="${line} L${WIDTH} ${CHART_H} L0 ${CHART_H} Z" fill="url(#${a})"/><path d="${line}" fill="none" stroke="url(#${g})" vector-effect="non-scaling-stroke" style="stroke-width:var(--f-lw)"/></svg><i style="top:${((lastY / CHART_H) * 100).toFixed(1)}%"></i></div>`;
}

/** "ORIGINAL · #0003" on a creator's card; just "#0007" on the card someone mints by copying. */
export const editionText = (kind: CardKind, n: number) => `${kind === "original" ? "ORIGINAL · " : ""}#${String(n).padStart(4, "0")}`;
export const whenText = (days: number) => (days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`);

/** The split as labels, four to a row: the biggest tokens, and how many more when they don't all fit. */
export function splitLabels(weights: { symbol: string; weight: number }[]): string[] {
  const order = [...weights].sort((a, b) => b.weight - a.weight);
  const crowded = order.length > SLOTS;
  const labels = (crowded ? order.slice(0, SLOTS - 1) : order).map((w) => `${clip(w.symbol, 8)} ${weightText(w.weight)}`);
  return crowded ? [...labels, `+${order.length - SLOTS + 1} more`] : labels;
}

function splitSvg(v: CardView, t: Theme, p: string, y: number): string {
  const order = [...v.weights].sort((a, b) => b.weight - a.weight);
  const total = order.reduce((a, w) => a + w.weight, 0) || 1;
  let x = LEFT;
  const bar = order.map((w, i) => {
    const width = (w.weight / total) * WIDTH;
    const r = `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(1, i === order.length - 1 ? width : width - 2).toFixed(1)}" height="6" fill="${t.slices[i % t.slices.length]}"/>`;
    x += width;
    return r;
  }).join("");
  const labels = splitLabels(v.weights);
  // Spread edge to edge, as the design does, unless the labels need the room.
  const size = Math.min(...labels.map((s) => fitMono(s, WIDTH / SLOTS - 4, 11)));
  const widths = labels.map((s) => [...s].length * size * 0.6);
  const gap = labels.length > 1 ? (WIDTH - widths.reduce((a, b) => a + b, 0)) / (labels.length - 1) : 0;
  let lx = LEFT;
  const row = labels.map((s, i) => {
    const r = `<text x="${lx.toFixed(1)}" y="${y + 25}" fill="${t.mono}" font-family="${MONO}" font-size="${size}">${esc(s)}</text>`;
    lx += widths[i] + gap;
    return r;
  }).join("");
  return `<clipPath id="${p}split"><rect x="${LEFT}" y="${y}" width="${WIDTH}" height="6" rx="3"/></clipPath><g clip-path="url(#${p}split)">${bar}</g>${row}`;
}

function statSvg(label: string, value: string, x: number, y: number, t: Theme, colour: string): string {
  return `<text x="${x.toFixed(1)}" y="${y}" fill="${t.sub}" font-size="10" letter-spacing="1.2">${label}</text><text x="${x.toFixed(1)}" y="${y + 23}" fill="${colour}" font-family="${MONO}" font-size="${fitMono(value, 94, 18)}" font-weight="600">${esc(value)}</text>`;
}

function progressSvg(v: CardView, t: Theme, p: string): string {
  const { pct: done, detail, count } = v.progress;
  const fill = (done / 100) * WIDTH;
  return `<text x="${LEFT}" y="464" fill="${t.sub}" font-size="11">${esc(detail)}</text><text x="${RIGHT}" y="464" fill="${t.sub}" font-family="${MONO}" font-size="11" text-anchor="end">${esc(count)}</text>
<rect x="${LEFT}" y="472" width="${WIDTH}" height="4" rx="2" fill="${t.track}"/>${fill ? `<rect x="${LEFT}" y="472" width="${fill.toFixed(1)}" height="4" rx="2" fill="${paint(`${p}bar`, t.bar)}"/>` : ""}`;
}

/** The foil stops for the design's 135-degree sweep, which runs corner to corner of a square, not of the card. */
const FOIL_STOPS = [0, 0.28, 0.52, 0.76, 1];

const mix = (a: string, b: string, k: number) => `#${[1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("")}`;

/** SVG has no conic gradient, so the Holo frame is drawn as thin wedges turning from 210 degrees, as the design's does. */
function conicFrame(colours: string[], p: string): string {
  const n = 72, cx = CARD_W / 2, cy = CARD_H / 2, r = 340, turn = (d: number) => ((d - 90) * Math.PI) / 180;
  const at = (d: number) => `${(cx + r * Math.cos(turn(d))).toFixed(1)} ${(cy + r * Math.sin(turn(d))).toFixed(1)}`;
  const wedges = Array.from({ length: n }, (_, i) => {
    const f = ((i + 0.5) / n) * (colours.length - 1), k = Math.floor(f);
    const from = 210 + (i * 360) / n, to = from + 360 / n + 0.6; // a little overlap, so no seams show
    return `<path d="M${cx} ${cy}L${at(from)}L${at(to)}Z" fill="${mix(colours[k], colours[k + 1], f - k)}"/>`;
  }).join("");
  return `<clipPath id="${p}card"><rect width="${CARD_W}" height="${CARD_H}" rx="22"/></clipPath><g clip-path="url(#${p}card)"><g class="hue">${wedges}</g></g>`;
}

/** What sits on the panel under the content: sparkles for Glitter, moving foil stripes and a glare for Holo. */
function foilSvg(tier: Tier, p: string): string {
  if (tier === "glitter") {
    const stars = STARS.map(([x, y, k, d]) => `<g transform="translate(${x + 11} ${y + 11}) scale(${k})"><path class="tw ${d}" d="${STAR}" fill="#ffffff"/></g>`).join("");
    const dots = DOTS.map(([x, y, r, d]) => `<circle class="tw ${d}" cx="${x + 11}" cy="${y + 11}" r="${r}" fill="#e9dcff"/>`).join("");
    return `<g clip-path="url(#${p}panel)">${stars}${dots}</g>`;
  }
  if (tier === "holo") {
    return `<g clip-path="url(#${p}panel)"><rect class="sweep" x="-160" y="-160" width="700" height="840" fill="url(#${p}stripes)"/><rect class="glare" x="10" y="10" width="340" height="484" fill="url(#${p}glare)"/></g>`;
  }
  return "";
}

function defsSvg(tier: Tier, t: Theme, p: string): string {
  const stripes = ["#ff4d94", "#ffc44d", "#4dffaa", "#4db6ff", "#aa6eff"].map((c, i) => `<rect x="${i * 16}" width="16" height="80" fill="${c}" fill-opacity=".13"/>`).join("");
  const panel = tier === "glitter"
    ? `<radialGradient id="${p}fill" cx=".2" cy="0" r="1" gradientTransform="translate(.2 0) scale(1.2 .8) translate(-.2 0)"><stop offset="0" stop-color="#2a2350"/><stop offset=".55" stop-color="#15132b"/><stop offset="1" stop-color="#0f0e20"/></radialGradient>`
    : "";
  const holo = tier === "holo"
    ? `<pattern id="${p}stripes" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(25)">${stripes}</pattern><linearGradient id="${p}glare" x1="0" y1=".2" x2="1" y2=".8"><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".16"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient>`
    : "";
  const [from, opacity, to] = t.area;
  return `<defs>${tier === "holo" ? "" : `<linearGradient id="${p}foil" gradientUnits="userSpaceOnUse" x1="-36" y1="36" x2="396" y2="468">${t.frame.map((c, i) => `<stop offset="${FOIL_STOPS[i] ?? 0}" stop-color="${c}"/>`).join("")}</linearGradient>`}${t.badge.length ? gradient(`${p}badge`, t.badge, 1, tier === "glitter" ? 1 : 0) : ""}${t.line.length > 1 ? gradient(`${p}line`, t.line) : ""}${t.bar.length > 1 ? gradient(`${p}bar`, t.bar) : ""}
<linearGradient id="${p}area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${to}" stop-opacity="${tier === "base" ? opacity : 0}"/></linearGradient>${panel}${holo}
<clipPath id="${p}panel"><rect x="10" y="10" width="340" height="484" rx="14"/></clipPath></defs>`;
}

/** The card, 360 x 504, in its tier's finish. Everything a person typed goes through esc: the file is also served on its own. */
export function cardSvg(v: CardView): string {
  const t = THEME[v.tier], p = `c${v.id}`;
  const flat = Math.abs(v.returnPct) < 0.05;
  const ret = pct(flat ? 0 : v.returnPct);
  const retColour = flat ? t.text : v.returnPct > 0 ? t.gain : LOSS;
  const col = (WIDTH - 16) / 3 + 8;
  const badgeW = Math.round(t.label.length * 9.1 + 20);
  const badge = t.badge.length
    ? `<rect class="${v.tier === "holo" ? "hue" : ""}" x="${LEFT}" y="27" width="${badgeW}" height="24" rx="12" fill="url(#${p}badge)"/>`
    : `<rect x="${LEFT + 0.5}" y="27.5" width="${badgeW - 1}" height="23" rx="11.5" fill="none" stroke="#4a4f57"/>`;
  const panelFill = v.tier === "glitter" ? `url(#${p}fill)` : v.tier === "holo" ? "#0d1020" : "#16181c";
  const by = `by @${v.handle} · minted ${whenText(v.days)}`;
  const alt = `${v.name}, ${v.editionLabel}, ${t.label} tier, ${ret}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-label="${esc(alt)}" font-family="${SANS}"><title>${esc(alt)}</title><style>${CARD_FONTS}${v.tier === "base" ? "" : MOTION}</style>
${defsSvg(v.tier, t, p)}
${v.tier === "holo" ? conicFrame(t.frame, p) : `<rect width="${CARD_W}" height="${CARD_H}" rx="22" fill="${paint(`${p}foil`, t.frame)}"/>`}
<rect x="10.5" y="10.5" width="339" height="483" rx="13.5" fill="${panelFill}" stroke="${t.panelStroke}"/>
${foilSvg(v.tier, p)}
${badge}<text x="${LEFT + badgeW / 2}" y="43" fill="${t.badgeInk}" font-size="11" font-weight="700" letter-spacing="1.5" text-anchor="middle">${t.label}</text>
<text x="${RIGHT}" y="43" fill="${t.sub}" font-family="${MONO}" font-size="11" text-anchor="end">${esc(editionText(v.kind, v.kind === "original" ? v.basket : v.edition))}</text>
${chartSvg(v, t, p)}
<text x="${LEFT}" y="249" fill="${t.text}" font-family="${DISPLAY}" font-size="${fitSans(v.name, WIDTH, 22)}" font-weight="700">${esc(v.name)}</text>
<text x="${LEFT}" y="270" fill="${t.sub}" font-size="${fitSans(by, WIDTH, 12)}">${esc(by)}</text>
${splitSvg(v, t, p, 285)}
<line x1="${LEFT}" y1="326" x2="${RIGHT}" y2="326" stroke="${t.rule}"/>
${statSvg("RETURN", ret, LEFT, 347, t, retColour)}${statSvg("COPIERS", String(v.copiers), LEFT + col, 347, t, t.text)}${statSvg("LIVE", `${v.days}d`, LEFT + col * 2, 347, t, t.text)}
<line x1="${LEFT}" y1="386" x2="${RIGHT}" y2="386" stroke="${t.rule}"/>
<text x="${CARD_W / 2}" y="428" fill="${t.sub}" fill-opacity=".7" font-size="10" text-anchor="middle">${v.practice ? "Practice · simulated fills" : "Real orders on Base"}</text>
${progressSvg(v, t, p)}</svg>`;
}

const SAMPLE_RETURNS: Record<Tier, number> = { base: 3.2, glitter: 12.5, holo: 31.2 };

/** An example card for the landing page and intro, marked practice so it never reads as a real result. */
export function sampleCardSvg(tier: Tier): string {
  const returnPct = SAMPLE_RETURNS[tier];
  return cardSvg({
    id: 7, kind: "copy", edition: 7, editionLabel: "Card #7", tier, basket: 1, name: "Base Blue Chips", handle: "nightowl", returnPct, copiers: 12, days: 21, practice: true,
    weights: [{ symbol: "ETH", weight: 50 }, { symbol: "cbBTC", weight: 30 }, { symbol: "AERO", weight: 20 }],
    chart: [100, 99, 101, 100, 103, 102, 100 + returnPct * 0.7, 100 + returnPct * 0.6, 100 + returnPct],
    progress: progressOf("copy", tier, { returnPct, copiers: 0 }),
  });
}
