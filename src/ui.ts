import { statSync } from "node:fs";
/** Tribe design system: tokens, components and page shell, ported from the Tribe design canvas. */

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ICONS: Record<string, string> = {
  home: "M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z",
  bars: "M6 20V11M12 20V5M18 20v-6",
  cat: "M5 5l2.5 3.5h9L19 5v9a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6zM9.5 13h.01M14.5 13h.01",
  bot: "M12 3v3M7 6h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM9 12h.01M15 12h.01M9.5 16h5",
  hand: "M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3 14.5a1.5 1.5 0 0 1 2.4-1.8L8 15",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  shield: "M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9z",
  user: "M12 8m-3.6 0a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0M5 20a7 7 0 0 1 14 0",
  search: "M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-4-4",
  inbox: "M4 13h4l2 3h4l2-3h4M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  share: "M4 12v7h16v-7M16 7l-4-4-4 4M12 3v12",
  chev: "M9 6l6 6-6 6",
  chevl: "M15 6l-6 6 6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  up: "M12 19V5M6 11l6-6 6 6",
  flame: "M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  check: "M5 12l4.5 4.5L19 7",
  close: "M6 6l12 12M18 6L6 18",
  pause: "M6 5h4v14H6zM14 5h4v14h-4z",
  play: "M7 4l13 8-13 8z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
  clock: "M12 8v4l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  wallet: "M3 7h18v12H3zM16 13h.01M3 7l3-3h12l3 3",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  people: "M9 8a3 3 0 1 0 0-.01M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 6",
  star: "M12 2l3 6 6 .9-4.5 4.4 1 6.2L12 16.6 6.5 19.5l1-6.2L3 8.9 9 8z",
  out: "M12 19V5M6 11l6-6 6 6",
  card: "M3 6h18v12H3zM3 10h18",
  swap: "M4 12h16M14 6l6 6-6 6M10 6l-6 6",
  send: "M7 17L17 7M9 7h8v8",
  trend: "M4 19V9M10 19V5M16 19v-7M22 19H2",
  help: "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.01",
  filter: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M10 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M18 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  tg: "M21 4L3 11l6 2 2 6 3-4 5 4z",
  copy: "M9 9h11v11H9zM5 15V5h10",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  logout: "M14 4h-8v16h8M10 12h10M17 9l3 3-3 3",
  menu: "M4 7h16M4 12h10M4 17h16",
  mem: "M9.5 3a3 3 0 0 0-3 3 3 3 0 0 0-2.4 5 3 3 0 0 0 2.4 5A3.5 3.5 0 0 0 12 19.5V4.5A1.8 1.8 0 0 0 9.5 3zM14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 2.4 5 3 3 0 0 1-2.4 5A3.5 3.5 0 0 1 12 19.5",
  think: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3z",
  live: "M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0M12 12h.01",
  mic: "M9 3h6v11H9zM5 11a7 7 0 0 0 14 0M12 18v3",
  refresh: "M20 11a8 8 0 1 0-2 6M20 4v7h-7",
  thumb: "M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H7",
  down: "M12 5v14M6 13l6 6 6-6",
  kbd: "M4 6h16v12H4zM7 10h.01M11 10h.01M15 10h.01M8 14h8",
  rise: "M4 17l6-6 4 4 6-8M14 7h6v6",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  crown: "M3 18h18M4 8l4 4 4-7 4 7 4-4-2 10H6z",
  shieldok: "M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9zM9 12l2 2 4-4",
  userplus: "M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6",
  list: "M8 7h11M8 12h11M8 17h11M4 7h.01M4 12h.01M4 17h.01",
  cards: "M9 3h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM4 7v12a2 2 0 0 0 2 2h9M11 8h5M11 12h3",
  updown: "M12 3v18M6 8l6-5 6 5M6 16l6 5 6-5",
};
export const FILLED = new Set(["bolt", "pause", "play"]);

export function icon(name: string, size = 20, color = "currentColor", sw = 1.9): string {
  const d = ICONS[name] ?? ICONS.help;
  const fill = FILLED.has(name);
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill ? color : "none"}" stroke="${fill ? "none" : color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

export const CSS = `
:root{--sab:env(safe-area-inset-bottom,0px);--bg:#0A0A0A;--tx:#F5F5F5;--mut:#A3A3A3;--dim:#8A8A8A;--ac:#34D399;--ac-ink:#052E1C;--bad:#F87171;--warn:#FCD34D;--line:rgba(255,255,255,.07)}
*{box-sizing:border-box}html{background:#050505}
body{margin:0;background:#050505;color:var(--tx);font-family:'Geist',system-ui,sans-serif;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
a{color:var(--ac);text-decoration:none}a:hover{color:#6EE7B7}
button,input,textarea,select{font-family:inherit;cursor:pointer}input,textarea{cursor:text}
button{color:inherit}
.app{position:relative;max-width:430px;min-height:100vh;margin:0 auto;background-color:var(--bg);background-image:radial-gradient(ellipse 70% 22% at 50% 0%,rgba(255,255,255,.09),rgba(255,255,255,0) 100%);display:flex;flex-direction:column;animation:tr-fade 220ms ease-out both;overflow-x:hidden;overflow-x:clip}
.app.pad{padding-bottom:calc(110px + var(--sab))}
html:has(.app.lock),html:has(.app.lock) body{height:100%;overflow:hidden;overscroll-behavior:none}
.app.lock{position:fixed;top:0;bottom:0;left:0;right:0;min-height:0;padding-bottom:0!important;overflow:hidden}
.hd{display:flex;align-items:center;gap:12px;padding:18px 20px 12px}
.hd h1{margin:0;font-size:16px;font-weight:600}.hd .sub{font-size:13px;color:var(--mut)}.hd .grow{flex:1;min-width:0}
.main{padding:0 20px;display:flex;flex-direction:column;gap:16px;flex:1}
.ic{width:44px;height:44px;border-radius:22px;background:#1F1F1F;border:1px solid var(--line);color:var(--tx);display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative}
.ic.s{width:36px;height:36px;border-radius:18px}
.badge{position:absolute;top:4px;right:4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#EF4444;color:#fff;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center}
.card{border-radius:22px;background:linear-gradient(180deg,#262626,#171717);border:1px solid var(--line);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);padding:16px}
.card.post{background:linear-gradient(180deg,#232323,#151515);padding:14px;display:flex;flex-direction:column;gap:12px}
.card.bad{border-color:rgba(248,113,113,.35)}.card.good{border-color:rgba(52,211,153,.35)}
.alloc{display:flex;height:8px;border-radius:99px;overflow:hidden;background:#262626;gap:2px;flex:none}.alloc i{display:block;height:100%;min-width:2px}
.allockey{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;color:#D4D4D4}.allockey span{display:inline-flex;align-items:center;gap:5px}.allockey i{width:8px;height:8px;border-radius:2px;flex:none}.allockey b{font-weight:600}
.tile{background:linear-gradient(180deg,#1C1C1C,#141414);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:10px 12px}
.tile .k{font-size:11px;color:var(--mut)}.tile .v{font-size:14px;font-weight:600;margin-top:2px}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.row{display:flex;align-items:center;gap:10px}.sp{justify-content:space-between}.col{display:flex;flex-direction:column;gap:12px}.grow{flex:1;min-width:0}
.mut{color:var(--mut)}.dim{color:var(--dim)}.up{color:var(--ac)}.down{color:var(--bad)}.warn{color:var(--warn)}
.xs{font-size:11px}.sm{font-size:12px}.md{font-size:14px}.lg{font-size:17px;font-weight:600}.h1{font-size:26px;font-weight:600;letter-spacing:-.02em;line-height:1.15;margin:0}
.big{font-size:34px;font-weight:600;letter-spacing:-.02em}.big small{color:var(--dim);font-size:inherit;font-weight:inherit}
h2{margin:0;font-size:17px;font-weight:600}
.av{width:38px;height:38px;border-radius:19px;background:#1F1F1F;border:1px solid rgba(255,255,255,.08);color:#E5E5E5;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.av.w{background:#F5F5F5;color:#0A0A0A}.av.lg{width:56px;height:56px;border-radius:28px;font-size:17px}.av.sm{width:30px;height:30px;border-radius:15px;font-size:11px}
.pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;border-radius:8px;background:#262626;color:#E5E5E5;white-space:nowrap}
.pill.ok{color:var(--ac);border:1px solid rgba(52,211,153,.45);background:rgba(52,211,153,.08)}
.pill.bad{color:var(--bad);border:1px solid rgba(248,113,113,.45);background:rgba(248,113,113,.08)}
.pill.warn{color:var(--warn);border:1px solid rgba(252,211,77,.4);background:rgba(252,211,77,.08)}
.pill.flash{background:#F5F5F5;color:#0A0A0A;font-weight:600;border-radius:6px;padding:3px 7px}
.btn{height:46px;border-radius:23px;border:0;padding:0 18px;font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;background:#262626;color:var(--tx);border:1px solid var(--line);width:100%}
.btn.p{background:var(--ac);color:var(--ac-ink);border:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}.btn.p:hover{color:var(--ac-ink)}
.btn.w{background:#F5F5F5;color:#0A0A0A;border:0}.btn.w:hover{color:#0A0A0A}
.btn.big{height:54px;border-radius:27px;font-size:16px}.btn.sm{height:36px;border-radius:18px;font-size:13px;width:auto;padding:0 14px}
.btn.danger{background:transparent;color:var(--bad);border:1px solid rgba(248,113,113,.5)}
.btn[disabled]{background:#262626!important;color:#737373!important;cursor:not-allowed;box-shadow:none}
.link{background:none;border:0;color:var(--mut);font-size:14px;height:44px}
.seg{display:flex;gap:2px;padding:4px;border-radius:22px;background:#151515;border:1px solid rgba(255,255,255,.05)}
.seg a,.seg button{flex:1;height:34px;border-radius:17px;border:0;background:transparent;color:var(--mut);font-size:13px;display:flex;align-items:center;justify-content:center;white-space:nowrap}
.seg .on{background:#333;color:#fff}
.seg.s{padding:2px;border-radius:15px;background:rgba(0,0,0,.35)}.seg.s a,.seg.s button{height:26px;padding:0 10px;font-size:11px;border-radius:13px}
.chip{height:34px;padding:0 12px;border-radius:17px;border:1px solid rgba(255,255,255,.08);background:#1A1A1A;color:#D4D4D4;font-size:13px;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
.chip.on{background:#F5F5F5;border-color:#F5F5F5;color:#0A0A0A}
.chips{display:flex;flex-wrap:wrap;gap:6px}
@media(max-width:480px){.cpy-t{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}
.av img{border-radius:inherit}.pav{position:relative;overflow:visible}.pav>img{border-radius:inherit}.pav>i{position:absolute;right:-2px;bottom:-2px;width:24px;height:24px;border-radius:12px;background:#F5F5F5;color:#0A0A0A;display:grid;place-items:center;border:2px solid #0A0A0A;font-style:normal}
.pcount{display:flex;flex-direction:column;color:#F5F5F5;line-height:1.2}.pcount b{font-size:16px}.pcount span{font-size:12px;color:#8A8A8A}
.av{overflow:hidden}.av img,.story .ring>span img{width:100%;height:100%;object-fit:cover;display:block}
.story .ring{position:relative}.botbadge{position:absolute;right:-2px;bottom:-2px;width:20px;height:20px;border-radius:10px;background:#34D399;color:#052E1C;display:grid;place-items:center;border:2px solid #0A0A0A;font-style:normal}
.react{position:relative;display:inline-flex}
.rx{width:var(--s,20px);height:var(--s,20px);border-radius:50%;display:inline-grid;place-items:center;flex:none;color:#fff;box-shadow:0 0 0 2px #1A1A1A;transition:transform .18s cubic-bezier(.3,1.6,.5,1)}
.rx svg{width:58%;height:58%;transform-origin:50% 70%}
.rx-fire{background:linear-gradient(140deg,#FDBA74,#F97316 55%,#DC2626)}.rx-rocket{background:linear-gradient(140deg,#C4B5FD,#8B5CF6 55%,#6D28D9)}
.rx-diamond{background:linear-gradient(140deg,#BAE6FD,#38BDF8 55%,#0369A1)}.rx-bull{background:linear-gradient(140deg,#6EE7B7,#10B981 55%,#047857)}
.rx-bear{background:linear-gradient(140deg,#FCA5A5,#EF4444 55%,#B91C1C)}.rx-bulb{background:linear-gradient(140deg,#FEF08A,#F59E0B 55%,#B45309)}
.rx-sharp{background:linear-gradient(140deg,#C7D2FE,#6366F1 55%,#3730A3)}.rx-chill{background:linear-gradient(140deg,#A5F3FC,#22D3EE 55%,#0E7490)}.rx-degen{background:linear-gradient(140deg,#F9A8D4,#EC4899 55%,#9D174D)}
.opt:hover .rx-sharp svg,.chip:hover .rx-sharp svg,.btn:hover .rx-sharp svg{animation:rx-glint .9s ease-in-out infinite}.opt:hover .rx-chill svg,.chip:hover .rx-chill svg,.btn:hover .rx-chill svg{animation:rx-lift .9s ease-in-out infinite}.opt:hover .rx-degen svg,.chip:hover .rx-degen svg,.btn:hover .rx-degen svg{animation:rx-flicker .7s ease-in-out infinite}
.opt.on .rx{box-shadow:0 0 0 2px #34D399}.chip:not(.rxbtn) .rx{box-shadow:none}
.rxstack{display:inline-flex}.rxstack .rx+.rx{margin-left:-6px}
.rxbtn.mine{border-color:rgba(52,211,153,.5);background:rgba(52,211,153,.1);color:#F5F5F5}
.rxpick{position:absolute;left:-6px;bottom:calc(100% + 10px);display:flex;gap:6px;padding:7px 9px;border-radius:30px;background:#1C1C1C;border:1px solid rgba(255,255,255,.1);box-shadow:0 14px 34px rgba(0,0,0,.55);z-index:25;opacity:0;visibility:hidden;transform:translateY(8px) scale(.94);transform-origin:20% 100%;transition:opacity .16s,transform .2s cubic-bezier(.3,1.4,.5,1),visibility .2s}
.rxpick::after{content:"";position:absolute;left:0;right:0;top:100%;height:14px}
.react.open .rxpick{opacity:1;visibility:visible;transform:none}
.rxpick button{position:relative;border:0;padding:0;background:none;border-radius:50%;cursor:pointer}
.rxpick .rx{box-shadow:0 4px 12px rgba(0,0,0,.35)}
.rxpick button:hover .rx,.rxpick button:focus-visible .rx{transform:translateY(-9px) scale(1.42)}
.rxpick button[aria-checked=true] .rx{box-shadow:0 0 0 2px #34D399,0 4px 12px rgba(0,0,0,.35)}
.rxpick b{position:absolute;left:50%;bottom:calc(100% + 16px);transform:translateX(-50%);padding:3px 8px;border-radius:10px;background:#0A0A0A;border:1px solid rgba(255,255,255,.12);font-size:11px;font-weight:600;color:#F5F5F5;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s}
.rxpick button:hover b,.rxpick button:focus-visible b{opacity:1}
.react.open .rxpick button{animation:rx-in .34s cubic-bezier(.3,1.5,.5,1) both}
.react.open .rxpick button:nth-child(2){animation-delay:.03s}.react.open .rxpick button:nth-child(3){animation-delay:.06s}.react.open .rxpick button:nth-child(4){animation-delay:.09s}.react.open .rxpick button:nth-child(5){animation-delay:.12s}.react.open .rxpick button:nth-child(6){animation-delay:.15s}
.react.open .rx-fire svg{animation:rx-flicker 1.1s ease-in-out infinite}.react.open .rx-rocket svg{animation:rx-lift 1.2s ease-in-out infinite}
.react.open .rx-diamond svg{animation:rx-glint 1.6s ease-in-out infinite}.react.open .rx-bull svg{animation:rx-up 1s ease-in-out infinite}
.react.open .rx-bear svg{animation:rx-down 1.1s ease-in-out infinite}.react.open .rx-bulb svg{animation:rx-glow 1.4s ease-in-out infinite}
.rxpick button:hover svg{animation-duration:.55s!important}
.rx.pop{animation:rx-pop .55s cubic-bezier(.3,1.6,.5,1)}
@keyframes rx-in{0%{opacity:0;transform:translateY(12px) scale(.3)}100%{opacity:1;transform:none}}
@keyframes rx-pop{0%{transform:scale(.3)}55%{transform:scale(1.6) rotate(-8deg)}100%{transform:scale(1)}}
@keyframes rx-flicker{0%,100%{transform:scale(1) rotate(0)}25%{transform:scale(1.08,.92) rotate(-5deg)}50%{transform:scale(.94,1.1) rotate(4deg)}75%{transform:scale(1.04,.96) rotate(-2deg)}}
@keyframes rx-lift{0%,100%{transform:translate(0,0) rotate(0)}50%{transform:translate(2px,-3px) rotate(4deg)}}
@keyframes rx-glint{0%,100%{transform:rotate(0) scale(1)}40%{transform:rotate(-14deg) scale(1.12)}60%{transform:rotate(8deg) scale(1.05)}}
@keyframes rx-up{0%,100%{transform:translate(-1px,1px)}50%{transform:translate(1px,-3px)}}
@keyframes rx-down{0%,100%{transform:translate(-1px,-1px)}50%{transform:translate(1px,3px)}}
@keyframes rx-glow{0%,100%{filter:drop-shadow(0 0 0 rgba(255,255,255,0));transform:scale(1)}50%{filter:drop-shadow(0 0 5px rgba(255,250,200,.95));transform:scale(1.1)}}
@media(prefers-reduced-motion:reduce){.rx,.rx svg,.rxpick,.rxpick button{animation:none!important;transition:none!important}}
.ck{width:14px;height:14px;border-radius:7px;display:inline-grid;place-items:center;flex:none;background:rgba(52,211,153,.18);color:#34D399;font-style:normal;font-size:9px;font-weight:800}.ck.bad{background:rgba(248,113,113,.18);color:#F87171}
.chip.flashchip{background:#34D399;color:#052E1C;border-color:#34D399;font-weight:600}.chip.flashchip:hover{color:#052E1C}
.swmain{gap:14px;padding-bottom:calc(120px + var(--sab))}
.deck{position:relative;height:min(648px,calc(100vh - 270px));min-height:430px}
.swcard{position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:26px;background:linear-gradient(180deg,#262626,#151515);border:1px solid var(--line);box-shadow:0 18px 40px rgba(0,0,0,.45);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;will-change:transform;transition:transform .45s cubic-bezier(.2,.9,.25,1.05),filter .45s,opacity .35s}
.swcard:active{cursor:grabbing}
/* Coverflow: the trade in front (p0), the next one peeking on the right (p1), the rest waiting behind it (pn), and the one
   you just decided on peeking on the left (was) with its SKIP / COPY stamp. Deciding slides the right card into the middle. */
.swcard.p1,.swcard.pn,.swcard.was{pointer-events:none}
.swcard.p1{transform:translateX(var(--peek,20%)) scale(.84) rotate(4deg);filter:brightness(.45)}
.swcard.pn{transform:translateX(calc(var(--peek,20%) + 6%)) scale(.78) rotate(6deg);opacity:0}
.swcard.was{transform:translateX(calc(-1 * var(--peek,20%))) scale(.84) rotate(-4deg);filter:brightness(.4) saturate(.6);z-index:1!important}
.swcard.was[data-did=left] .stamp.skip,.swcard.was[data-did=right] .stamp.copy{opacity:1!important;left:18px;right:auto;transform:rotate(-12deg)}
.swcard.req{border-color:rgba(252,211,77,.45)}
.freshband{position:relative;margin:-16px -16px 0;padding:10px 16px;background:rgba(52,211,153,.08);color:#A7F3D0;font-size:13px;display:flex;gap:8px;align-items:center;overflow:hidden}
/* Why this trade is in your feed (X / LinkedIn style) and the feed tabs. */
.soc{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#A3A3A3;min-width:0;margin-bottom:-4px}.soc>span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.soc .socic{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:11px;background:#1F1F1F;color:#D4D4D4;flex:none}.soc.trending .socic{color:#FB923C;background:rgba(251,146,60,.12)}.soc.copying .socic,.soc.following .socic{color:#34D399;background:rgba(52,211,153,.12)}
.socfaces{display:flex;flex:none;padding-left:7px}.socfaces .av.stack{width:22px;height:22px;font-size:8px;border-color:#202020}.soc.network>span:last-child{color:#D4D4D4}
#chief-new[hidden]{display:none}.chiefbox{display:flex;flex-direction:column;gap:10px;height:min(74vh,640px)}.chiefmsgs{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:4px 2px}.chiefchips{flex:none;max-height:84px;overflow-y:auto}.chiefchips:empty{display:none}.chiefform{display:flex;gap:8px;align-items:center;flex:none}.chiefform input{flex:1;min-width:0;height:44px;padding:0 14px;border-radius:22px;border:1px solid rgba(255,255,255,.1);background:#141414;color:#F5F5F5;font-size:16px;outline:none}.chiefform input:focus{border-color:#34D399}
@media (min-width:900px){.paside{position:relative;z-index:50}.split:has(.deck){padding-top:14px}.deck{height:max(520px,calc(100vh - 160px))}}
.mixtags{display:flex;flex-wrap:wrap;gap:5px}.mixtag{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;background:#1A1A1A;border:1px solid rgba(255,255,255,.08);font-size:11.5px;color:#D4D4D4;white-space:nowrap}.mixtag i{width:7px;height:7px;border-radius:2px;flex:none}.mixtag b{font-weight:700;color:#F5F5F5}.mixtag.risk{background:none;font-weight:600}
.deskstats{gap:6px}.deskstats div{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border-radius:12px;background:#1A1A1A;text-align:center}.deskstats b{font-size:16px}.deskstats span{font-size:11px;color:#A3A3A3}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;counter-reset:st}.steps li{display:flex;flex-direction:column;gap:2px;padding-left:30px;position:relative;font-size:13px}.steps li::before{counter-increment:st;content:counter(st);position:absolute;left:0;top:0;width:20px;height:20px;border-radius:10px;background:rgba(52,211,153,.14);color:#34D399;font-size:11px;font-weight:700;display:grid;place-items:center}.steps span{color:#A3A3A3;font-size:12.5px;line-height:1.4}
.lbsearch{display:flex;align-items:center;gap:10px;padding:0 14px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:#141414;color:#A3A3A3}.lbsearch:focus-within{border-color:#34D399}.lbsearch input{flex:1;min-width:0;height:100%;border:0;background:none;color:#F5F5F5;font:inherit;font-size:15px;outline:none}
.fld{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#A3A3A3}.fld input,.fld textarea{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:#141414;color:#F5F5F5;font:inherit;font-size:15px;resize:vertical}.fld input:focus,.fld textarea:focus{outline:none;border-color:#34D399}
.chip:has(input:focus-visible){outline:2px solid #34D399;outline-offset:2px}
.swcard.arrive{animation:card-in .45s cubic-bezier(.3,1.3,.5,1) both}
@keyframes card-in{from{opacity:0;transform:translateY(40px) scale(.92)}to{opacity:1}}
[data-live].flash{animation:live-flash .9s ease-out}
@keyframes live-flash{0%{background:rgba(52,211,153,.25)}100%{background:transparent}}
/* The buttons sit over the card's bottom edge (above every card in the stack), with room left in the card so they cover nothing. */
.swcard{padding-bottom:52px}.swmain .swbar{position:relative;z-index:60;margin-top:-48px}
/* Phones are swipes only: following the trader lives on desktop (button or F). */
@media (max-width:899px){
  /* Phones: the card fills the screen between the header and the tab bar. */
  .swmain{padding:0 10px}.deck{height:calc(100vh - 190px - var(--sab));height:calc(100dvh - 190px - var(--sab));min-height:430px;margin:0 8px;--peek:16%}
  .swmain .swbar{margin-bottom:-16px}
  /* The deck is the whole screen on a phone: nothing scrolls, and the card gives way on short screens. */
  html:has(.deck),html:has(.deck) body{height:100%;overflow:hidden;overscroll-behavior:none}
  .app.pad:has(.deck){position:fixed;top:0;bottom:0;left:0;right:0;min-height:0;padding-bottom:0;overflow:hidden}
  .deck{min-height:0}.swmain{padding-top:env(safe-area-inset-top,0px)}}
/* Short phones: Chief's read and the worst case stay; the extras give way. */
@media (max-width:899px) and (max-height:740px){.swcard{gap:7px;padding:12px 14px 50px}.swcard .soc,.swcard .allockey,.swcard .swthesis,.swcard .freshband{display:none}.swcard .swread{padding:9px 11px}.swcard .swread li:nth-child(n+3){display:none}}
.bcard{padding:20px 20px 18px;gap:16px!important}.bcard #brief{gap:16px!important;flex:1 1 auto}
/* Deck side panel: runs to the bottom of the screen. Chief's brief takes all the room the portfolio and active trades leave,
   with its last trades and stats sitting at the bottom; on a short screen the brief scrolls inside itself. */
@media (min-width:900px){.paside:has(.bcard){height:calc(100vh - 140px);overflow:hidden}.split:has(.bcard){padding-bottom:16px}.app.pad:has(.deck),.app:has(.tdetails){padding-bottom:0!important}.split:has(.tdetails){padding-bottom:16px}.paside .bcard{flex:1 1 0;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#333 transparent}.paside>section:not(.bcard){flex:none}.bcard .blast{margin-top:auto}}
.bheld{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:14px;background:#1A1A1A;font-size:15px}
.bcurve{display:flex;flex-direction:column;gap:6px}.bcurve svg{width:100%;height:64px;display:block}.bcurve b{font-size:14px}
/* Phones: the trader's record on the deck card (the side panel's job on desktop). Shorter phones drop the chart, then the chips. */
.mrec{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)}
.swcard>*{flex-shrink:0}.swcard>.mrec{flex:0 1 auto;min-height:0;overflow:hidden}
.mrec .bstats{gap:6px}.mrec .bstats span{padding:7px 2px;border-radius:10px;font-size:11px}.mrec .bstats b{font-size:15px}.mrec .btrade{padding:3px 9px;font-size:13px}
@media (max-height:900px){.mrec{display:none!important}}
@media (max-height:820px){.bcurve{display:none}}.bcard h2{font-size:18px!important;gap:10px!important}.bcard h2 .orb{width:24px!important;height:24px!important}
.av.xs{width:22px;height:22px;border-radius:11px;font-size:9px;flex:none}
.bhead .av{width:42px;height:42px;border-radius:21px;font-size:13px}.bhead b{font-size:17px}.bhead .xs{font-size:12.5px}
.brief{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}.brief li{display:flex;gap:11px;align-items:flex-start;font-size:15.5px;line-height:1.4;color:#E5E5E5}.brief li i{flex:none;width:9px;height:9px;border-radius:50%;margin-top:7px}
.blast{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.blast>.xs{font-size:13.5px}
.btrade{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:#1A1A1A;border:1px solid rgba(255,255,255,.06);font-size:15px}
.bstats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;font-size:12.5px;color:#A3A3A3}.bstats span{display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 4px;border-radius:14px;background:#1A1A1A;text-align:center}.bstats b{color:#F5F5F5;font-size:19px}
#brief.loading{opacity:.45;transition:opacity .2s}
.acar{display:flex;flex-direction:column;gap:10px;border-radius:18px;background:#141414;border:1px solid rgba(255,255,255,.07);padding:12px 14px;overflow:hidden}
.aslides{display:grid;touch-action:pan-y;user-select:none}
.aslide{grid-area:1/1;display:flex;flex-direction:column;gap:8px;color:#F5F5F5;opacity:0;visibility:hidden;transform:translateX(14px);transition:opacity .3s,transform .3s,visibility 0s .3s}
.aslide.on{opacity:1;visibility:visible;transform:none;transition:opacity .3s,transform .3s}
.acbtn{display:inline-grid;place-items:center;width:24px;height:24px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:transparent;color:#D4D4D4;cursor:pointer}.acbtn:hover{background:#1F1F1F;color:#F5F5F5}
.pcurve{display:flex;flex-direction:column;gap:8px}.pc-plot{position:relative;height:170px;cursor:crosshair;touch-action:pan-y}.pc-plot svg{display:block;width:100%;height:100%;overflow:visible}.pc-dot{position:absolute;width:9px;height:9px;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 4px rgba(52,211,153,.15);pointer-events:none}.pc-zero{position:absolute;right:0;transform:translateY(-120%)}
.mbars{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:10px;height:150px;align-items:end;padding:4px 2px 0}.mbar{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%}.mbar i{display:block;width:70%;max-width:46px;border-radius:8px 8px 3px 3px;min-height:4px}.mbar i.pos{background:linear-gradient(180deg,#6EE7B7,#10B981)}.mbar i.neg{background:linear-gradient(180deg,#FCA5A5,#EF4444)}
.mrow{border-top:1px solid #1F1F1F}.mrow summary{list-style:none;cursor:pointer;min-height:56px;padding:6px 0}.mrow summary::-webkit-details-marker{display:none}.mrow[open] summary{border-bottom:0}
@media(min-width:900px){.swmain{padding-bottom:16px}.deck{width:100%;max-width:560px;margin:0 auto}.swmain .swbar{width:100%;max-width:560px;margin-left:auto;margin-right:auto}}
@media(prefers-reduced-motion:reduce){.swcard.arrive,[data-live].flash{animation:none}}
.reqband{margin:-16px -16px 0;padding:10px 16px;background:rgba(252,211,77,.12);color:#FCD34D;font-size:13px;display:flex;gap:6px;align-items:center}
.stamp{position:absolute;top:24px;padding:4px 12px;border:3px solid;border-radius:10px;font-weight:800;font-size:22px;letter-spacing:.06em;opacity:0;z-index:5;pointer-events:none;background:rgba(10,10,10,.55)}
.stamp.copy{left:18px;color:#34D399;border-color:#34D399;transform:rotate(-12deg)}.stamp.skip{right:18px;color:#F87171;border-color:#F87171;transform:rotate(12deg)}
.stamp.ask{left:50%;top:auto;bottom:28px;transform:translateX(-50%);color:#A7F3D0;border-color:#A7F3D0;white-space:nowrap}
.swread{border:1px solid;border-radius:16px;padding:12px;background:rgba(255,255,255,.02)}
/* A basket card fills the height it is given: spare room spreads between its sections rather than pooling in one gap. */
.swcard[data-basket]{justify-content:space-between}
@media (min-width:900px) and (max-height:760px){.swcard[data-basket] .soc{display:none}}
/* Tall desktop screens: the content grows with the card, so the card fills up rather than just spreading out. */
@media (min-width:900px) and (min-height:860px){.swcard[data-basket]>:not(.freshband):not(.stamp){zoom:1.14}}
@media (min-width:900px) and (min-height:1020px){.swcard[data-basket]>:not(.freshband):not(.stamp){zoom:1.32}}
/* A basket in the feed, laid out like its Basket Card, in the finish its return since launch has earned (finishOf). The finish is a pseudo-element behind the content, and the chart takes whatever height is left, so every card fills the deck. */
.swcard[data-basket]{--f-text:#e8eaed;--f-sub:#9aa0a6;--f-mono:#c4c8ce;--f-rule:#2a2e35;--f-gain:#e8eaed;--f-cbg:#1d2025;--f-cline:#2a2e35;--f-grid:#2a2e35;--f-track:#2a2e35;--f-dot:#e8eaed;--f-dotr:4px;--f-lw:2;--l1:#b7bcc3;--l2:#b7bcc3;--l3:#b7bcc3;--l4:#b7bcc3;--l5:#b7bcc3;--a1:#9aa0a6;--a2:#9aa0a6;--ao:.08;--ao2:.08;--s1:#e8eaed;--s2:#b7bcc3;--s3:#80868e;--s4:#555a62;--b1:#b7bcc3;--b2:#b7bcc3;--b3:#b7bcc3;--b4:#b7bcc3;
gap:10px;padding:16px 16px 54px;border:0;border-radius:22px;background:none;color:var(--f-text);font-family:Inter,'Geist',system-ui,sans-serif}
.swcard.fin-glitter{--f-text:#fff;--f-sub:#c9c2e8;--f-mono:#ddd6f7;--f-rule:rgba(201,184,255,.2);--f-gain:#f1e3b8;--f-cbg:rgba(12,10,28,.65);--f-cline:rgba(201,184,255,.28);--f-grid:rgba(201,184,255,.12);--f-track:rgba(201,184,255,.18);--f-dot:#f1e3b8;--f-dotr:5px;--f-lw:2.5;--l1:#b9bdcc;--l2:#c0bbe6;--l3:#c7b8ff;--l4:#dccedb;--l5:#f1e3b8;--a1:#c7b8ff;--a2:#c7b8ff;--ao:.35;--ao2:0;--s1:#f1e3b8;--s2:#dcd3ff;--s3:#a594f0;--s4:#6c5fc0;--b1:#c7b8ff;--b2:#d4c6e6;--b3:#e3d5cf;--b4:#f1e3b8}
.swcard.fin-holo{--f-text:#fff;--f-sub:#d6dcf5;--f-mono:#e6eaff;--f-rule:rgba(255,255,255,.16);--f-gain:#8dffcf;--f-cbg:rgba(8,10,22,.7);--f-cline:rgba(255,255,255,.18);--f-grid:rgba(255,255,255,.08);--f-track:rgba(255,255,255,.14);--f-dot:#fff;--f-dotr:6px;--f-lw:3;--l1:#ff5f9e;--l2:#ffb86b;--l3:#6bffbf;--l4:#66c6ff;--l5:#a98bff;--a1:#66c6ff;--a2:#a98bff;--ao:.3;--ao2:0;--s1:#ff8fbb;--s2:#ffd27a;--s3:#7dffc9;--s4:#7ccfff;--b1:#ff5f9e;--b2:#ffb86b;--b3:#6bffbf;--b4:#66c6ff}
.swcard[data-basket]::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background:#16181c}
.swcard.fin-glitter::after{background:url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27338%27%20height%3D%27482%27%3E%3Cstyle%3E%40keyframes%20t%7B0%25%2C100%25%7Bopacity%3A.15%7D50%25%7Bopacity%3A1%7D%7D.t%7Banimation%3At%202.8s%20ease-in-out%20infinite%7D.a%7Banimation-delay%3A.35s%7D.b%7Banimation-delay%3A.8s%7D.c%7Banimation-delay%3A1.3s%7D.d%7Banimation-delay%3A1.9s%7D.e%7Banimation-delay%3A2.4s%7D%40media%28prefers-reduced-motion%3Areduce%29%7B.t%7Banimation%3Anone%3Bopacity%3A.5%7D%7D%3C%2Fstyle%3E%3Cg%20fill%3D%27%23fff%27%3E%3Cpath%20class%3D%27t%20%27%20transform%3D%27translate%2828%2052%29%20scale%280.9%29%27%20d%3D%27M0-6%201.4-1.4%206%200%201.4%201.4%200%206-1.4%201.4-6%200-1.4-1.4Z%27%2F%3E%3Cpath%20class%3D%27t%20b%27%20transform%3D%27translate%28304%2038%29%20scale%281.2%29%27%20d%3D%27M0-6%201.4-1.4%206%200%201.4%201.4%200%206-1.4%201.4-6%200-1.4-1.4Z%27%2F%3E%3Cpath%20class%3D%27t%20d%27%20transform%3D%27translate%28250%20250%29%20scale%280.7%29%27%20d%3D%27M0-6%201.4-1.4%206%200%201.4%201.4%200%206-1.4%201.4-6%200-1.4-1.4Z%27%2F%3E%3Cpath%20class%3D%27t%20a%27%20transform%3D%27translate%28312%20300%29%20scale%280.8%29%27%20d%3D%27M0-6%201.4-1.4%206%200%201.4%201.4%200%206-1.4%201.4-6%200-1.4-1.4Z%27%2F%3E%3Cpath%20class%3D%27t%20c%27%20transform%3D%27translate%2820%20330%29%20scale%280.6%29%27%20d%3D%27M0-6%201.4-1.4%206%200%201.4%201.4%200%206-1.4%201.4-6%200-1.4-1.4Z%27%2F%3E%3Cpath%20class%3D%27t%20e%27%20transform%3D%27translate%28180%20470%29%20scale%280.9%29%27%20d%3D%27M0-6%201.4-1.4%206%200%201.4%201.4%200%206-1.4%201.4-6%200-1.4-1.4Z%27%2F%3E%3Cpath%20class%3D%27t%20b%27%20transform%3D%27translate%28318%20455%29%20scale%280.6%29%27%20d%3D%27M0-6%201.4-1.4%206%200%201.4%201.4%200%206-1.4%201.4-6%200-1.4-1.4Z%27%2F%3E%3Cpath%20class%3D%27t%20d%27%20transform%3D%27translate%28150%2020%29%20scale%280.5%29%27%20d%3D%27M0-6%201.4-1.4%206%200%201.4%201.4%200%206-1.4%201.4-6%200-1.4-1.4Z%27%2F%3E%3C%2Fg%3E%3Cg%20fill%3D%27%23e9dcff%27%3E%3Ccircle%20class%3D%27t%20a%27%20cx%3D%2760%27%20cy%3D%27120%27%20r%3D%271.2%27%2F%3E%3Ccircle%20class%3D%27t%20c%27%20cx%3D%27120%27%20cy%3D%2780%27%20r%3D%271%27%2F%3E%3Ccircle%20class%3D%27t%20e%27%20cx%3D%27230%27%20cy%3D%27110%27%20r%3D%271.4%27%2F%3E%3Ccircle%20class%3D%27t%20b%27%20cx%3D%27280%27%20cy%3D%27170%27%20r%3D%271%27%2F%3E%3Ccircle%20class%3D%27t%20%27%20cx%3D%2790%27%20cy%3D%27190%27%20r%3D%271.3%27%2F%3E%3Ccircle%20class%3D%27t%20d%27%20cx%3D%27200%27%20cy%3D%2760%27%20r%3D%271%27%2F%3E%3Ccircle%20class%3D%27t%20c%27%20cx%3D%2740%27%20cy%3D%27250%27%20r%3D%271.1%27%2F%3E%3Ccircle%20class%3D%27t%20a%27%20cx%3D%27300%27%20cy%3D%27380%27%20r%3D%271.2%27%2F%3E%3Ccircle%20class%3D%27t%20e%27%20cx%3D%2760%27%20cy%3D%27420%27%20r%3D%271%27%2F%3E%3Ccircle%20class%3D%27t%20b%27%20cx%3D%27250%27%20cy%3D%27430%27%20r%3D%271.3%27%2F%3E%3Ccircle%20class%3D%27t%20%27%20cx%3D%27140%27%20cy%3D%27300%27%20r%3D%270.9%27%2F%3E%3Ccircle%20class%3D%27t%20d%27%20cx%3D%27330%27%20cy%3D%27230%27%20r%3D%271%27%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E") 0 0/338px 482px,radial-gradient(120% 80% at 20% 0%,#2a2350 0%,#15132b 55%,#0f0e20 100%)}
.swcard.fin-holo::after{background-color:#0d1020;background-image:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.16) 50%,transparent 62%),repeating-linear-gradient(115deg,rgba(255,77,148,.13) 0 16px,rgba(255,196,77,.13) 16px 32px,rgba(77,255,170,.13) 32px 48px,rgba(77,182,255,.13) 48px 64px,rgba(170,110,255,.13) 64px 80px);background-size:250% 100%,200% 200%;animation:fin-sweep 7s linear infinite}
@keyframes fin-hue{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}
@keyframes fin-sweep{from{background-position:160% 0,0% 0%}to{background-position:-60% 0,200% 200%}}
.swcard.p1::after,.swcard.pn::after,.swcard.was::after{animation:none}
.cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}.ctile>a:first-child{display:block;transition:transform .15s}.ctile>a:first-child:hover{transform:translateY(-3px)}.cgrid img{display:block;width:100%;height:auto}
.tkadv{gap:8px;margin-top:8px;padding:10px;border-radius:12px;background:#141414;border:1px solid rgba(255,255,255,.08)}.tkadv label{display:flex;flex-direction:column;gap:4px}.tkadv label.row{flex-direction:row;align-items:center}.tkadv [hidden]{display:none}
.ctile{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}.ctile>a:first-child{width:100%}.cnft{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--mut)}.cnft:hover{color:#F5F5F5}
/* A trade unlocks its card: locked and dark, the lock opens, light breaks, the card shows. */
.unlock{position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px;background:rgba(5,5,5,.9);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:un-fade .25s both}
.uncard{position:relative;width:min(270px,64vw,calc((100vh - 220px)*.714));aspect-ratio:360/504;border-radius:18px;animation:un-rise .55s cubic-bezier(.2,1.25,.4,1) both}
.uncard img{position:relative;display:block;width:100%;height:100%;animation:un-reveal .65s 1.2s both}
.unglow{position:absolute;inset:-35%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.6),rgba(167,139,250,.28) 42%,transparent 68%);opacity:0;pointer-events:none;animation:un-burst 1s 1.15s ease-out both}
.unsheen{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}.unsheen::after{content:"";position:absolute;top:-20%;bottom:-20%;left:-60%;width:45%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);animation:un-sweep .8s 1.7s ease-out both}
.unlockicon{position:absolute;left:50%;top:50%;width:76px;height:76px;margin:-38px 0 0 -38px;color:#fff;filter:drop-shadow(0 4px 14px rgba(0,0,0,.6));animation:un-shake .65s .45s both,un-pop .35s 1.15s forwards}
.unshackle{animation:un-open .22s 1s both}
.untext{display:flex;flex-direction:column;gap:3px;text-align:center;animation:un-up .4s 1.6s both}.untext b{font-size:20px;color:#F5F5F5}.untext span{font-size:13px;color:var(--mut)}
.unbtns{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(290px,100%);animation:un-up .4s 1.75s both}
@keyframes un-fade{from{opacity:0}to{opacity:1}}
@keyframes un-rise{from{opacity:0;transform:translateY(46px) scale(.82)}to{opacity:1;transform:none}}
@keyframes un-reveal{from{filter:blur(13px) grayscale(1) brightness(.38)}to{filter:none}}
@keyframes un-shake{0%,100%{transform:none}20%{transform:rotate(-9deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-6deg)}80%{transform:rotate(4deg)}}
@keyframes un-open{to{transform:translateY(-3px) rotate(14deg);transform-origin:16px 11px}}
@keyframes un-pop{to{opacity:0;transform:scale(1.7)}}
@keyframes un-burst{0%{opacity:0;transform:scale(.4)}35%{opacity:1}100%{opacity:0;transform:scale(1.15)}}
@keyframes un-sweep{to{left:125%}}
@keyframes un-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.unlock,.unlock *,.unlock *::after{animation:none!important}.unlockicon,.unglow{display:none}}
.fhead{display:flex;justify-content:space-between;align-items:center;height:24px}
.fed,.fkeys,.fv,.fcount{font-family:'JetBrains Mono',ui-monospace,Menlo,monospace}.fed{font-size:11px;color:var(--f-sub)}
.finbadge{flex:none;font-size:11px;font-weight:700;letter-spacing:.14em;padding:4px 10px;border-radius:999px;color:#0d1020}
.fin-base .finbadge{font-weight:600;color:#c4c8ce;border:1px solid #4a4f57}.fin-base .finbadge::before{content:"BASE"}
.fin-glitter .finbadge{color:#1b1838;background:linear-gradient(135deg,#f3f0ff,#b9bdcc 45%,#f1e3b8)}.fin-glitter .finbadge::before{content:"GLITTER"}
.fin-holo .finbadge{background:linear-gradient(90deg,#ff9ec4,#ffe08a,#9dffd3,#9ed8ff,#cdb6ff);animation:fin-hue 9s linear infinite}.fin-holo .finbadge::before{content:"HOLO"}
.swcard[data-basket]>.fchart{position:relative;flex:1 1 150px;flex-shrink:1;min-height:60px;max-height:230px;border-radius:10px;background:var(--f-cbg);border:1px solid var(--f-cline);overflow:hidden}
.fchart svg{position:absolute;inset:0;width:100%;height:100%;display:block}.fchart i{position:absolute;right:0;width:calc(var(--f-dotr)*2);height:calc(var(--f-dotr)*2);border-radius:50%;background:var(--f-dot);transform:translate(50%,-50%)}
.ftitle{display:flex;flex-direction:column;gap:3px;min-width:0}
.fname{font-family:'Space Grotesk','Geist',system-ui,sans-serif;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-.01em;color:var(--f-text)}
.fby{font-size:12px;color:var(--f-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fby a{color:inherit}
.fsplitbox{display:flex;flex-direction:column;gap:8px}.fsplit{display:flex;height:6px;border-radius:3px;overflow:hidden;gap:2px}.fsplit i{display:block;min-width:2px}.fsplit i:nth-child(4n+1){background:var(--s1)}.fsplit i:nth-child(4n+2){background:var(--s2)}.fsplit i:nth-child(4n+3){background:var(--s3)}.fsplit i:nth-child(4n){background:var(--s4)}
.fkeys{display:flex;justify-content:space-between;gap:6px;font-size:11px;color:var(--f-mono);white-space:nowrap;overflow:hidden}
.fstats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px 0;border-top:1px solid var(--f-rule);border-bottom:1px solid var(--f-rule)}.fstats>div{display:flex;flex-direction:column;gap:4px;min-width:0}
.fk{font-size:10px;letter-spacing:.12em;color:var(--f-sub)}.fv{font-size:18px;font-weight:600;color:var(--f-text)}.fv .up{color:var(--f-gain)}
.fnote{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--f-sub)}.fnote b{color:var(--f-text);font-weight:600}.fnote b.up{color:var(--f-gain)}
.fthesis{margin:0;font-size:13px;line-height:1.45;color:var(--f-mono)}
.swcard[data-basket] .mixtag{background:var(--f-cbg);border-color:var(--f-cline)}
.fnext{display:flex;flex-direction:column;gap:6px}.fnr{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--f-sub)}.ftrack{height:4px;border-radius:2px;background:var(--f-track)}.ftrack i{display:block;height:4px;border-radius:2px;background:linear-gradient(90deg,var(--b1),var(--b2),var(--b3),var(--b4))}
@media (max-height:760px){.swcard[data-basket]{gap:7px;padding:10px 10px 54px}.swcard[data-basket] .soc,.swcard[data-basket] .fthesis{display:none}.fstats{padding:6px 0}}
@media(prefers-reduced-motion:reduce){.swcard[data-basket]::after,.finbadge{animation:none!important}}
.swbar{display:flex;justify-content:center;align-items:center;gap:22px}
.swbtn{width:64px;height:64px;border-radius:32px;border:1px solid var(--line);background:#1A1A1A;display:grid;place-items:center;box-shadow:0 10px 24px rgba(0,0,0,.4);transition:transform .15s}
.swbtn:hover{transform:scale(1.08)}.swbtn:active{transform:scale(.94)}
.swbtn.skip{color:#F87171;border-color:rgba(248,113,113,.4)}.swbtn.copy{color:#052E1C;background:#34D399;border:0}.swbtn.ask{width:54px;height:54px}
.swempty{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:20px}
.deck.done .swempty{display:flex}.deck.done~.swbar{opacity:.3;pointer-events:none}
@media(prefers-reduced-motion:reduce){.swcard{transition:none}}
.chip.askcat{color:#D1FAE5;border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.07)}.chip.askcat .orb{width:16px;height:16px}
.catread{display:flex;align-items:center;gap:12px;padding:12px 14px;color:#F5F5F5;background:linear-gradient(135deg,rgba(52,211,153,.06),rgba(26,26,26,.6))}
.ctxbar{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 10px;margin-bottom:8px;border-radius:20px;background:rgba(12,22,18,.94);border:1px solid rgba(52,211,153,.28);backdrop-filter:blur(12px)}
.vchecks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}.vchecks li{display:flex;gap:10px;font-size:14px;line-height:1.4;color:#D4D4D4}
.vchecks i{flex:none;width:20px;height:20px;border-radius:10px;display:grid;place-items:center;font-style:normal;font-size:11px;font-weight:700;background:#262626;color:#A3A3A3}
.vchecks .ok i{background:rgba(52,211,153,.15);color:#34D399}.vchecks .bad i{background:rgba(248,113,113,.15);color:#F87171}
.card.post{scroll-margin-top:90px}.card.post:target{box-shadow:0 0 0 2px rgba(52,211,153,.6),0 0 32px rgba(52,211,153,.15)}
#rebalance,#yours{scroll-margin-top:90px}#copy{scroll-margin-top:90px}#copy:target{box-shadow:0 0 0 2px rgba(52,211,153,.6),0 0 32px rgba(52,211,153,.15)}.card.post[data-href]{cursor:pointer}.card.post[data-href]:hover{border-color:rgba(255,255,255,.14)}
.chip:has(input:checked){background:#F5F5F5;border-color:#F5F5F5;color:#0A0A0A}
.sw{width:44px;height:26px;border-radius:13px;border:0;padding:3px;background:#3A3A3A;display:flex;justify-content:flex-start;flex-shrink:0}
.sw i{width:20px;height:20px;border-radius:10px;background:#fff;display:block}
.sw[aria-checked=true]{background:var(--ac);justify-content:flex-end}
.line{display:flex;align-items:center;gap:12px;min-height:52px;border-bottom:1px solid #1F1F1F;font-size:14px;color:var(--tx)}
.line .ico{width:34px;height:34px;border-radius:10px;background:#1F1F1F;border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.line .t{display:block}.line .s:not(.seg){display:block;font-size:12px;color:var(--mut)}
.setmain{gap:18px}.setme{gap:12px}.setsec{display:flex;flex-direction:column;gap:8px}.sethd{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 4px}.sethd h2{font-size:12px;color:#A3A3A3;font-weight:600;text-transform:uppercase;letter-spacing:.06em}.sethd span{font-size:12px;color:#6B6B6B}
.setcard{background:linear-gradient(180deg,#171717,#121212);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:2px 16px}.setcard>.line{padding:12px 0;min-height:62px;flex-wrap:wrap;row-gap:10px}.setcard>.line:last-of-type{border-bottom:0}.setcard>.line .grow{min-width:180px;flex:1 1 220px}.setcard>.line .s{line-height:1.4;margin-top:2px}.setcard>.line>.seg{flex:none;margin-left:auto}.setcard .seg.s button{height:30px;padding:0 13px;font-size:12px}.setcard>form{padding:4px 0 14px}
.setout{gap:10px}.setcard .s{overflow-wrap:anywhere}
@media (max-width:640px){.setcard>.line .grow{flex:1 1 0;min-width:0}.setcard>.line>.seg,.setcard>.line>form{flex:1 0 100%;margin-left:46px;max-width:calc(100% - 46px)}.setcard>.line>.seg button{flex:1}.setcard>.line>form .f{flex:1;width:auto!important}}
.bar{height:4px;border-radius:2px;background:#262626;overflow:hidden}.bar i{display:block;height:100%;background:var(--ac)}
.bar.r i{background:var(--bad)}
.nav{position:fixed;left:var(--cx,50%);bottom:max(24px,calc(var(--sab) + 8px));transform:translateX(-50%);display:flex;gap:4px;padding:5px;border-radius:30px;background:rgba(36,36,36,.78);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.07);box-shadow:0 12px 32px rgba(0,0,0,.55);z-index:30}
.nav a{width:44px;height:44px;border-radius:22px;color:#9A9A9A;display:flex;align-items:center;justify-content:center}
.nav a.on{background:#3A3A3A;color:#fff}
.backdrop.drawer-bd{z-index:50}
.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:50;display:none;animation:tr-backdrop 200ms both}
.sheet{position:fixed;left:var(--cx,50%);bottom:0;width:100%;max-width:430px;transform:translateX(-50%);max-height:88vh;overflow-y:auto;border-radius:28px 28px 0 0;background:linear-gradient(180deg,#1E1E1E,#121212 22%);border-top:1px solid rgba(255,255,255,.1);box-shadow:0 -24px 60px rgba(0,0,0,.6);z-index:51;display:none;padding:10px 20px calc(28px + var(--sab));animation:tr-sheet 340ms cubic-bezier(.2,.9,.25,1) both}
.sheet .grab{width:40px;height:4px;border-radius:2px;background:#404040;margin:0 auto 12px}
.sheet.csheet{flex-direction:column;overflow:hidden;height:min(640px,82vh)}.sheet.csheet.open{display:flex}.csheet .clist{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#333 transparent;margin:0 -4px;padding:0 4px}.csheet form{position:static!important;padding:10px 0 4px!important;background:none!important}
.cbar{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;text-align:left;color:inherit;font:inherit}.cbar-line{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .25s,transform .25s}.cbar-line.out{opacity:0;transform:translateY(4px)}@media (prefers-reduced-motion:reduce){.cbar-line{transition:none}}
.chip.camt{gap:2px;padding:0 4px 0 12px;cursor:text}.chip.camt input{width:72px;height:100%;border:0;background:transparent;color:inherit;font:inherit;outline:none}.chip.camt:focus-within{border-color:#34D399}
.ordstrip{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:12px;background:#0F0F0F;border:1px solid rgba(255,255,255,.05)}.ordstrip .pill{flex:none}.ordstrip .sm{color:#D4D4D4;line-height:1.4;padding-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media (max-height:800px){.tdetails .grid3>.tile:nth-child(n+4),.tdetails>.row{display:none}}@media (max-height:700px){.tdetails{display:none}}
.open{display:block}.open.flex{display:flex}
.toast{position:fixed;left:var(--cx,50%);top:14px;transform:translateX(-50%);width:calc(100% - 32px);max-width:398px;z-index:80;display:none;align-items:center;gap:10px;padding:10px 12px;border-radius:18px;background:rgba(245,245,245,.97);color:#0A0A0A;box-shadow:0 14px 34px rgba(0,0,0,.55);font-size:14px;font-weight:600}
.toast.show{display:flex;animation:tr-toast 260ms cubic-bezier(.2,.8,.2,1) both}
.toast .tick{width:28px;height:28px;border-radius:14px;background:#0A0A0A;color:var(--ac);display:flex;align-items:center;justify-content:center;flex-shrink:0}
input.f,textarea.f,select.f{width:100%;height:52px;padding:0 16px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:#151515;color:var(--tx);font-size:16px}
textarea.f{height:auto;padding:12px 16px;resize:none}
label.l{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.opt{min-height:60px;padding:0 18px;border-radius:18px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,#1E1E1E,#151515);color:var(--tx);font-size:15px;text-align:left;display:flex;align-items:center;justify-content:space-between;width:100%}
.opt.on{border-color:var(--ac);background:rgba(52,211,153,.06)}
.dot{width:20px;height:20px;border-radius:10px;border:2px solid #5A5A5A;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.on>.dot,.dot.on{border-color:var(--ac)}.on>.dot::after,.dot.on::after{content:"";width:10px;height:10px;border-radius:5px;background:var(--ac)}
.empty{padding:28px 16px;border-radius:22px;border:1px dashed rgba(255,255,255,.12);text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}
.note{font-size:12px;color:var(--dim);line-height:1.5}
.hide{display:none!important}
.step{animation:tr-step 280ms cubic-bezier(.2,.8,.2,1) both}
.live{width:8px;height:8px;border-radius:4px;background:var(--ac);animation:tr-pulse 2s ease-out infinite;display:inline-block}
.bubble{padding:9px 13px;border-radius:18px;max-width:88%;font-size:14px;line-height:1.45;white-space:pre-wrap}
.bubble.u{align-self:flex-end;background:#262626;border-radius:18px 18px 6px 18px}.bubble.b{align-self:flex-start;background:#171717;border:1px solid var(--line)}
.orb{position:relative;display:inline-block;border-radius:50%;animation:orb-breathe 4s ease-in-out infinite;background:radial-gradient(circle at 34% 28%,#FFF 0%,#D1FAE5 16%,#34D399 42%,#065F46 72%,#052016 100%);flex-shrink:0}
.orb i{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,.35) 40deg,rgba(255,255,255,0) 90deg);animation:orb-spin 6s linear infinite;mix-blend-mode:overlay}
.wave{display:flex;align-items:center;gap:5px;height:48px}.wave span{width:4px;border-radius:2px;background:#34D399;transform-origin:center;animation:wave 900ms ease-in-out infinite}
.paused .wave span,.wave.off span{animation-play-state:paused;background:#3A3A3A}
.drawer{position:fixed;top:0;bottom:0;left:var(--cx,50%);margin-left:-215px;width:min(330px,86vw);background:#101010;border-right:1px solid rgba(255,255,255,.08);z-index:51;transform:translateX(-110%);transition:transform 280ms cubic-bezier(.2,.9,.25,1);padding:18px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
.drawer.open{transform:none}
.composer{position:fixed;left:var(--cx,50%);transform:translateX(-50%);width:100%;max-width:430px;padding:0 16px;z-index:25}
.composer::before{content:"";position:absolute;left:0;right:0;top:-28px;bottom:-24px;background:linear-gradient(180deg,rgba(10,10,10,0),#0A0A0A 34px);z-index:-1;pointer-events:none}
.composer .box{border-radius:26px;background:#1A1A1A;border:1px solid rgba(255,255,255,.1);padding:10px 10px 8px 16px}
.composer input{width:100%;border:0;background:transparent;color:#F5F5F5;font-size:16px;height:36px;padding:0;outline:none}
.composer .box:focus-within{border-color:#34D399}
.tg{height:32px;padding:0 12px;border-radius:16px;border:1px solid rgba(255,255,255,.1);background:transparent;color:#D4D4D4;font-size:13px;display:inline-flex;align-items:center;gap:5px}
.tg[aria-pressed=true]{background:rgba(52,211,153,.12);border-color:rgba(52,211,153,.55);color:#34D399}
.steps{margin:6px 0 0;padding-left:18px;font-size:13px;color:#A3A3A3;line-height:1.6}.steps b{color:#F5F5F5;font-weight:600}
.caret{display:inline-block;width:7px;height:15px;margin-left:2px;background:#34D399;vertical-align:-2px;animation:caret 1s steps(1) infinite}
.prog{height:10px;border-radius:5px;background:#2A2A2A;overflow:hidden}.prog i{display:block;height:100%;border-radius:5px;background:var(--ac);transition:width 400ms cubic-bezier(.2,.8,.2,1)}
.prog.s{height:6px;border-radius:3px}.prog.s i{border-radius:3px}.prog.mute i{background:#A3A3A3}
.flat{border-radius:18px;background:#141414;border:1px solid rgba(255,255,255,.07);padding:14px 16px}
.medal{width:48px;height:48px;border-radius:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#A3A3A3;border:1px dashed rgba(255,255,255,.3)}
.medal.on{background:rgba(52,211,153,.14);border:1px solid rgba(52,211,153,.5);color:var(--ac)}
.daydot{width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(255,255,255,.25);color:#A3A3A3}
.daydot.on{background:rgba(52,211,153,.14);border:1px solid rgba(52,211,153,.5);color:var(--ac)}
.paside{display:none}
/* Feed: social and game layer */
.lvl{position:relative;flex-shrink:0;display:block}.lvl b{position:absolute;right:-4px;bottom:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#0A0A0A;border:1.5px solid var(--ac);color:var(--ac);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}
.streak{display:inline-flex;align-items:center;gap:2px;height:18px;padding:0 6px;border-radius:9px;background:rgba(252,211,77,.1);border:1px solid rgba(252,211,77,.35);color:var(--warn);font-size:11px;font-weight:600}
.ladder-track{position:relative;height:6px;border-radius:3px;background:#262626}.ladder-track i{position:absolute;top:0;bottom:0;border-radius:3px}
.ladder-entry{position:absolute;top:-4px;width:2px;height:14px;margin-left:-1px;background:#F5F5F5;opacity:.6;border-radius:1px}
.ladder-now{position:absolute;top:-5px;width:16px;height:16px;margin-left:-8px;border-radius:8px;background:var(--ac);border:3px solid #0A0A0A;box-shadow:0 0 0 1px var(--ac),0 0 12px rgba(52,211,153,.6);animation:tr-pulse 2s ease-out infinite}
.ladder-now.down{background:var(--bad);box-shadow:0 0 0 1px var(--bad),0 0 12px rgba(248,113,113,.5)}
.av.stack{width:24px;height:24px;border-radius:12px;font-size:9px;margin-left:-7px;border:2px solid #151515}.av.stack:first-child{margin-left:0}
.card.post{position:relative}.card.post.win{border-color:rgba(52,211,153,.35);background:linear-gradient(180deg,rgba(52,211,153,.07),#151515 45%)}
.card.post.hot{border-color:rgba(252,211,77,.4)}
.ribbon{position:absolute;top:-10px;left:16px;display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 10px;border-radius:11px;background:var(--warn);color:#2A1E00;font-size:11px;font-weight:700;box-shadow:0 6px 16px rgba(0,0,0,.4)}
.stories{display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;padding:2px 2px 4px;margin:0 -2px}.stories::-webkit-scrollbar{display:none}
.story{flex-shrink:0;width:64px;display:flex;flex-direction:column;align-items:center;gap:5px;color:#F5F5F5}
.story .ring{width:60px;height:60px;border-radius:30px;padding:2.5px;background:#2A2A2A;display:flex}.story .ring.live{background:conic-gradient(#34D399,#6EE7B7,#34D399)}.story .ring.bad{background:conic-gradient(#F87171,#FCA5A5,#F87171)}
.story .ring>span{flex:1;border-radius:50%;border:2.5px solid #0A0A0A;background:#1F1F1F;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700}
.story .h{font-size:11px;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.story .p{font-size:10px;font-weight:600;margin-top:-4px}
.game{display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:20px;background:linear-gradient(135deg,rgba(52,211,153,.10),rgba(52,211,153,0) 55%),#141414;border:1px solid rgba(52,211,153,.22);color:#F5F5F5}
.lvdial{--p:0;width:52px;height:52px;border-radius:26px;flex-shrink:0;background:conic-gradient(var(--ac) calc(var(--p)*1%),#2A2A2A 0);display:flex;align-items:center;justify-content:center}
.lvdial span{width:42px;height:42px;border-radius:21px;background:#141414;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}.lvdial small{font-size:8px;color:var(--mut);letter-spacing:.08em}.lvdial b{font-size:16px}
.moment{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:#121212;border:1px dashed rgba(255,255,255,.12);color:#F5F5F5}
.moment.pick{border:1px solid rgba(52,211,153,.35);background:linear-gradient(135deg,rgba(52,211,153,.10),#121212 60%)}
.moment .ic36{width:36px;height:36px}
.d2,.d3{display:flex;flex-direction:column;gap:10px}
.ic36{width:36px;height:36px;border-radius:18px;background:#1F1F1F;color:var(--tx);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.bd summary{list-style:none;cursor:pointer}.bd summary::-webkit-details-marker{display:none}.bd[open] summary .md{color:#fff}
.lvring{margin-top:12px;width:148px;height:148px;border-radius:74px;border:2px solid rgba(52,211,153,.6);background:radial-gradient(circle at 50% 35%,rgba(52,211,153,.22),rgba(52,211,153,.04));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;animation:tr-grow 380ms cubic-bezier(.2,.8,.2,1) 80ms both}
/* ---- Web layout (>= 900px): sidebar, top bar, content column, right rail ---- */
.shell{display:block}.side,.rail,.topbar{display:none}.only-d{display:none!important}
@media (min-width:900px){
  :root{--cx:calc(76px + (100vw - 76px)/2)}
  html{background:#050505}body{background:#0A0A0A}
  .only-m{display:none!important}.only-d{display:revert!important}
  .row.only-d,.btn.only-d,.hd.only-d{display:flex!important}.pill.only-d,.kbd.only-d{display:inline-flex!important}
  .shell{display:flex;min-height:100vh}
  .side{display:flex;flex-direction:column;gap:6px;position:sticky;top:0;height:100vh;width:76px;flex-shrink:0;padding:22px 12px;border-right:1px solid rgba(255,255,255,.06);background:#0C0C0C;z-index:30}
  .side .logo{font-size:24px;font-weight:700;letter-spacing:-.05em;padding:0 8px 18px;color:#F5F5F5;white-space:nowrap}.side .logo span{color:#34D399}
  .side-item{display:flex;align-items:center;justify-content:center;gap:12px;height:46px;border-radius:14px;color:#A3A3A3;font-size:15px;padding:0 12px;position:relative}
  .side-item:hover{background:#161616;color:#F5F5F5}.side-item.on{background:#242424;color:#fff}
  .side-label,.side-extra{display:none}.side-dot{position:absolute;top:10px;right:10px;width:8px;height:8px;border-radius:4px;background:#F87171}
  .mainc{flex:1;min-width:0;display:flex;flex-direction:column;align-items:stretch}
  /* The page fills the room under the top bar, not a whole extra screen (that added a scroll to every page). */
  .mainc>.app{min-height:0;flex:1 0 auto}
  .topbar{display:flex;align-items:center;gap:12px;padding:14px 28px;position:sticky;top:0;z-index:28;background:rgba(10,10,10,.85);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.05)}
  .topbar form{flex:1;max-width:520px}.topbar kbd,.kbd{font:inherit;font-size:11px;color:#8A8A8A;border:1px solid #2a2a2a;border-radius:6px;padding:1px 6px}
  .app,.app.pad{max-width:820px;width:100%;margin:0 auto;padding-bottom:60px;background-image:none}
  .app.focus{max-width:520px;padding-bottom:40px}.app.wide{max-width:1040px}
  .nav{display:none}
  .hd{padding:26px 28px 14px}.hd h1{font-size:22px}.main{padding:0 28px}
  .composer{max-width:720px;bottom:24px!important}.composer.shift{left:calc(var(--cx) + 130px)}
  /* The chat box lines up with the conversation column (760px) above it. */
  .chatapp .composer{max-width:792px}
  .sheet{top:50%;bottom:auto;transform:translate(-50%,-50%);width:min(560px,92vw);max-width:none;max-height:86vh;border-radius:24px;border:1px solid rgba(255,255,255,.1);animation:tr-pop 220ms cubic-bezier(.2,.8,.2,1) both}
  .toast{left:auto;right:24px;top:auto;bottom:24px;transform:none;width:360px}.toast.show{animation:tr-fade 200ms both}
  .drawer{display:none}
  .reqbanner{left:auto!important;right:24px!important;top:78px!important;transform:none!important;width:360px!important}
  .tbl{width:100%;border-collapse:collapse}.tbl th{font-size:12px;font-weight:600;color:#8A8A8A;text-align:left;padding:10px 12px;border-bottom:1px solid #222;white-space:nowrap}
  .tbl td{padding:12px;border-bottom:1px solid #1C1C1C;font-size:14px;vertical-align:middle}.tbl tr:hover td{background:#101010}.tbl .r{text-align:right}
  .pad2{padding:0 28px}
  .catgrid{display:grid;grid-template-columns:260px minmax(0,1fr);gap:24px;align-items:start}
  /* Chief is one chat with no history column: the conversation takes the width, centred at a readable measure. */
  .catgrid:not(:has(.chat-hist)){grid-template-columns:minmax(0,1fr)}.catgrid:not(:has(.chat-hist))>.msgcol{width:100%;max-width:760px;margin:0 auto}
  .split{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;padding:0 28px 40px;align-items:start}.split>.main{padding:0}
  .paside{display:flex;flex-direction:column;gap:16px;min-width:0}
  .d2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.d3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .d3 .qcard{flex-direction:column;align-items:flex-start}.d3 .qcard>.grow{width:100%}
  .chat-hist{position:sticky;top:76px;display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 100px);overflow:auto}
  /* Chat: an app view, not a page. The history list and the conversation are separate scroll panes; the page itself never scrolls. */
  .app.chatapp{height:100vh;height:100dvh;min-height:0}
  .mainc:has(>.app.chatapp){height:100vh;height:100dvh;display:flex;flex-direction:column}.mainc:has(>.app.chatapp)>.app{flex:1;height:auto}
  .chatapp .chatpanes{flex:1;min-height:0;padding-bottom:0!important;overflow:hidden;grid-template-rows:minmax(0,1fr);align-items:stretch}
  .chatapp .chat-hist{position:static;max-height:none;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:24px}
  .chatapp .msgcol{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:var(--cpad,160px);scrollbar-width:thin}
}
@media (min-width:1100px){
  :root{--cx:calc(240px + (100vw - 240px)/2)}
  .side{width:240px;padding:22px 16px}.side-item{justify-content:flex-start}.side-label{display:inline}.side-extra{display:block}
}
@media (min-width:1280px){
  :root{--cx:calc(240px + (100vw - 240px - 340px)/2)}
  .rail{display:flex;flex-direction:column;gap:14px;position:sticky;top:0;height:100vh;overflow:auto;width:340px;flex-shrink:0;padding:84px 20px 24px 0}
  .port-inline{display:none!important}
  body.norail{--cx:calc(240px + (100vw - 240px)/2)}
  .app.split-page{max-width:1180px}.split{grid-template-columns:minmax(0,1fr) 360px;gap:28px}
  /* The side panel never runs past the bottom of the screen: on short screens it scrolls inside itself. */
  .paside{position:sticky;top:84px;max-height:calc(100vh - 100px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#333 transparent}
}
/* Focus pages: the menu collapses to icons and the summary rail goes, unless the user opens the menu. */
@media (min-width:900px){
  body.slim{--cx:calc(76px + (100vw - 76px)/2)}
  body.slim .side{width:76px;padding:22px 12px}body.slim .side-item{justify-content:center}body.slim .side-label,body.slim .side-extra{display:none}
  body.slim.side-open{--cx:calc(240px + (100vw - 240px)/2)}
  body.slim.side-open .side{width:240px;padding:22px 16px}body.slim.side-open .side-item{justify-content:flex-start}body.slim.side-open .side-label{display:inline}body.slim.side-open .side-extra{display:block}
  body.slim .side{transition:width .2s ease}
}
.rail section.card{padding:16px}.rail h2{font-size:15px}
.rail .row a{color:#F5F5F5}
@keyframes tr-pop{0%{opacity:0;transform:translate(-50%,-50%) scale(.96)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes orb-breathe{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.06);filter:brightness(1.15)}}
@keyframes orb-spin{to{transform:rotate(360deg)}}
@keyframes wave{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
@keyframes caret{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes tr-grow{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes ring{0%{transform:scale(.8);opacity:.6}100%{transform:scale(1.7);opacity:0}}
@keyframes tr-fade{from{opacity:0}to{opacity:1}}
@keyframes tr-step{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes tr-sheet{from{transform:translate(-50%,100%)}to{transform:translate(-50%,0)}}
@keyframes tr-backdrop{from{opacity:0}to{opacity:1}}
@keyframes tr-toast{from{opacity:0;transform:translate(-50%,-16px) scale(.98)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes tr-pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.45)}70%{box-shadow:0 0 0 8px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
button,a{transition:transform 120ms ease,background-color 180ms ease,color 180ms ease,border-color 180ms ease,opacity 180ms ease}
button:active,a:active{transform:scale(.97)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:1ms!important;animation-delay:0ms!important;transition:none!important}}
/* Chat history and the new-chat feature grid. */
.chat-hist{display:none}.hlist{display:flex;flex-direction:column;gap:2px}.hgrp{font-size:11px;font-weight:600;color:#6B6B6B;text-transform:uppercase;letter-spacing:.06em;padding:12px 10px 4px}
.hitem{display:flex;align-items:center;border-radius:10px}.hitem a{flex:1;min-width:0;display:flex;align-items:center;gap:6px;padding:9px 10px;color:#D4D4D4;font-size:14px}.hitem a span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hitem:hover{background:#171717}.hitem.on{background:#1F1F1F}.hitem.on a{color:#fff}.hdel{flex:none;width:28px;height:28px;margin-right:4px;border:0;border-radius:8px;background:transparent;color:#8A8A8A;display:flex;align-items:center;justify-content:center;opacity:0;cursor:pointer}.hitem:hover .hdel,.hitem.on .hdel,.hdel:focus-visible{opacity:1}.hdel:hover{background:#2A2A2A;color:#F87171}
@media (hover:none){.hdel{opacity:1}}
.chat-hist .hnew{width:100%;height:40px;justify-content:center;margin-bottom:6px;flex:none}
.chatsbtn{height:36px;gap:6px;padding:0 12px;flex:none}
.catwelcome{gap:14px;margin:auto 0}.cwhead{align-items:center;text-align:center;gap:10px}.cwsub{margin:4px 0 0;font-size:14px}
.catfeat{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cfeat{display:flex;align-items:center;gap:12px;border-radius:16px;padding:12px 14px;color:#F5F5F5;text-align:left;font:inherit;cursor:pointer;border:1px solid rgba(255,255,255,.07);transition:border-color .15s,transform .15s;min-width:0}.cfeat:hover{border-color:color-mix(in srgb,var(--fc) 55%,transparent);transform:translateY(-1px)}
.cft{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.cfh{display:flex;align-items:center;justify-content:space-between;gap:8px}.cfh b{font-size:15px;white-space:nowrap}.cft .sm{line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cfi{flex:none;width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--fc) 14%,transparent)}
.cftag{white-space:nowrap;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#A3A3A3;padding:3px 7px;border-radius:999px;background:#1F1F1F;border:1px solid rgba(255,255,255,.06)}.cftag.s{margin-left:4px;padding:1px 6px;font-size:9px}
.trendrow{display:flex;align-items:center;gap:10px;min-width:0}.trendrow[hidden]{display:none}.trendlbl{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#A3A3A3;white-space:nowrap;flex:none}
.tchips{display:flex;gap:6px;overflow-x:auto;min-width:0;flex:1}.tchip{flex:none;display:flex;align-items:center;gap:6px;height:30px;padding:0 10px 0 6px;border-radius:15px;border:1px solid rgba(255,255,255,.08);background:#161616;color:#F5F5F5;font:inherit;font-size:12px;cursor:pointer}.tchip:hover{border-color:rgba(255,255,255,.2)}.tchip img{width:18px;height:18px;border-radius:50%}
.catmore{justify-content:center}.catmore .chip{gap:6px}
@media (max-width:899px){.cfeat{flex-direction:column;align-items:flex-start;gap:8px}.cft .sm{display:none}.cfh{flex-direction:column;align-items:flex-start;gap:4px}
 .catmore{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;margin:0 -16px;padding:0 16px}.catmore .chip{flex:none}}
/* Desktop: full-width app view. History is its own column, divided by a line, and scrolls on its own; so does the chat. */
@media (min-width:900px){
 .app.chatapp{max-width:none;margin:0;padding-bottom:0!important}.ic.only-d{display:flex!important}
 .catshell{flex:1;min-height:0;display:grid;grid-template-columns:272px minmax(0,1fr)}
 .chat-hist{display:flex;flex-direction:column;min-height:0;overflow-y:auto;overscroll-behavior:contain;border-right:1px solid rgba(255,255,255,.08);padding:18px 12px 24px;background:#0C0C0C}
 .catmain{display:flex;flex-direction:column;min-width:0;min-height:0}
 .catmain>.chatpanes{flex:1;min-height:0;overflow:hidden;padding-bottom:0!important}
 .catmain .msgcol{flex:1;width:100%;max-width:760px;margin:0 auto}
 .catmain>.hd{width:100%;max-width:808px;margin:0 auto}
}
@media (min-width:900px) and (max-height:820px){.cwhead .orb{display:none}.cwsub{display:none}}
/* Creator Studio: trade ticket, bot builder, studio cards. */
.tkpick{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:#141414;color:#F5F5F5;font:inherit;text-align:left;cursor:pointer}.tkpick:hover{border-color:rgba(255,255,255,.2)}
.tkimg{width:32px;height:32px;border-radius:50%;background:#262626;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;overflow:hidden;flex:none}.tkimg img{width:100%;height:100%;object-fit:cover}
.tklist{display:flex;flex-direction:column;gap:8px;margin-top:8px;padding:10px;border-radius:14px;background:#111;border:1px solid rgba(255,255,255,.08)}.tklist[hidden]{display:none}.tklist .f{height:42px}
#tk-res{max-height:300px;overflow-y:auto}.tkrow{display:flex;align-items:center;gap:12px;width:100%;padding:8px 10px;border-radius:12px;border:0;background:transparent;color:#F5F5F5;font:inherit;text-align:left;cursor:pointer}.tkrow:hover{background:#1C1C1C}.tkrow.off{opacity:.5;cursor:not-allowed}
.posacts{gap:6px;justify-content:flex-end;flex-wrap:nowrap}.posacts .btn{flex:none;width:auto;white-space:nowrap}
.tkf{gap:8px}.chip.cust{padding:0 10px;cursor:text}.chip.cust input{width:64px;border:0;background:transparent;color:#F5F5F5;font-size:13px;outline:none}.chip.cust:focus-within{border-color:#F5F5F5}
.tkta{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:#141414;color:#F5F5F5;font:inherit;font-size:14px;resize:vertical}
.cnew{display:flex;gap:12px;align-items:center;color:#F5F5F5;padding:16px;transition:border-color .15s}.cnew:hover{border-color:rgba(255,255,255,.2)}.cnew b{display:block;font-size:16px}.cnew .sm{display:block;line-height:1.4;margin-top:2px}
.signbox{position:fixed;left:50%;bottom:calc(24px + var(--sab));transform:translateX(-50%);z-index:90;display:flex;gap:12px;align-items:center;max-width:min(440px,calc(100vw - 32px));padding:14px 18px;border-radius:18px;background:#1A1A1A;border:1px solid rgba(252,211,77,.45);box-shadow:0 12px 40px rgba(0,0,0,.6);color:#F5F5F5}.signbox[hidden]{display:none}.signbox b{display:block}.signbox .sb-t{display:block;font-size:13px;color:#A3A3A3;margin-top:2px}
/* Scrolling still works everywhere; the bars just stay out of sight. */
*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none;width:0;height:0}
`;

export type NavKey = "feed" | "collection" | "me";
const NAV: [NavKey, string, string, string][] = [["feed", "/feed", "home", "Feed"], ["collection", "/trades", "cards", "Trades"], ["me", "/me", "user", "Me"]];

/** split: the body uses split(); on desktop its aside replaces the global right rail. */
export interface PageOpts { title: string; body: string; nav?: NavKey; head?: string; bare?: boolean; sheets?: string; extraClass?: string; focus?: boolean; split?: boolean; slim?: boolean }

export function page(o: PageOpts): string {
  const nav = o.nav
    ? `<nav class="nav" aria-label="Main">${NAV.map(([k, href, ic, label]) => `<a href="${href}" aria-label="${label}"${k === o.nav ? ' class="on" aria-current="page"' : ""}>${icon(ic)}</a>`).join("")}</nav>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0A0A0A"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Tribe"><meta name="apple-mobile-web-app-status-bar-style" content="black"><title>${esc(o.title)} · Tribe</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230A0A0A'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%2334D399'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
${o.head ?? ""}<style>${CSS}</style></head><body${o.split || o.slim ? ` class="norail${o.slim ? " slim" : ""}"` : ""}>
${o.focus ? "" : "<!--SHELL_OPEN-->"}<div class="app${o.nav ? " pad" : ""}${o.focus ? " focus" : ""}${o.split ? " split-page" : ""} ${o.extraClass ?? ""}">${o.body}</div>${o.focus ? "" : "<!--SHELL_CLOSE-->"}${nav}${o.sheets ?? ""}
<div class="toast" id="toast" role="status" aria-live="polite"><span class="tick">${icon("check", 14, "currentColor", 3)}</span><span id="toast-t"></span></div>
<script src="/app.js"></script></body></html>`;
}

// Components

export const back = (href: string) => `<a class="ic" href="${href}" aria-label="Back">${icon("back", 18, "currentColor", 2)}</a>`;
export const header = (title: string, sub: string, backHref: string, right = "") =>
  `<header class="hd">${back(backHref)}<div class="grow"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>${right}</header>`;

export const avatar = (handle: string, cls = "", dark = false) =>
  `<span class="av ${cls}${dark ? "" : ""}" aria-hidden="true">${esc(handle.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "??")}</span>`;

/** Custom badges used instead of emoji: a coloured disc with a line glyph (reactions use the same look). */
const GLYPHS: Record<string, string> = {
  sharp: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v3M12 19v3M2 12h3M19 12h3",
  chill: "M3 9.5c2 0 2-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2M3 15c2 0 2-2 4.5-2s2.5 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2",
  degen: "M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12z",
};
export const glyphBadge = (key: string, size = 20) =>
  `<span class="rx rx-${key}" style="--s:${size}px" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${GLYPHS[key] ?? ""}"/></svg></span>`;

/** Focus pages: show or hide the collapsed menu; remembered per browser. */
export const SIDE_JS = `(function(){var b=document.body;if(!b.classList.contains('slim'))return;
function set(open){b.classList.toggle('side-open',open);document.querySelectorAll('[data-sidetg]').forEach(function(t){t.setAttribute('aria-pressed',open?'true':'false');t.setAttribute('aria-label',open?'Hide menu':'Show menu')})}
var v;try{v=localStorage.getItem('tribe_side')}catch(e){}set(v==='open');
document.addEventListener('click',function(e){if(!e.target.closest('[data-sidetg]'))return;var open=!b.classList.contains('side-open');set(open);try{localStorage.setItem('tribe_side',open?'open':'closed')}catch(e){}})})()`;

export const sw = (on: boolean, label: string, attrs = "") => `<button class="sw" role="switch" aria-checked="${on}" aria-label="${esc(label)}" ${attrs}><i></i></button>`;

export const seg = (items: { label: string; href?: string; on: boolean; attrs?: string }[], small = false, label = "") =>
  `<div class="seg${small ? " s" : ""}" role="tablist" aria-label="${esc(label)}">${items.map((i) => (i.href !== undefined ? `<a role="tab" aria-selected="${i.on}" class="${i.on ? "on" : ""}" href="${esc(i.href)}">${esc(i.label)}</a>` : `<button role="tab" aria-selected="${i.on}" class="${i.on ? "on" : ""}" ${i.attrs ?? ""}>${esc(i.label)}</button>`)).join("")}</div>`;

export const sheet = (id: string, inner: string) => `<div class="backdrop" id="bd-${id}" data-close="${id}"></div><section class="sheet" id="${id}" role="dialog" aria-modal="true"><div class="grab"></div>${inner}</section>`;

/** Main column plus a desktop-only aside (hidden on phones; below the content from 900px, beside it from 1280px). Use with page({ split: true }). */
export const split = (main: string, aside: string, label = "Details") => `<div class="split">${main}<aside class="paside" aria-label="${esc(label)}">${aside}</aside></div>`;
export const progress = (pct: number, label: string, cls = "") =>
  `<div class="prog ${cls}" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></div>`;

export const stat = (k: string, v: string, cls = "") => `<div class="tile"><div class="k">${esc(k)}</div><div class="v ${cls}">${v}</div></div>`;
export const money2 = (n: number) => { const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); const [a, b] = s.split("."); return `${n < 0 ? "−" : ""}$${a}<small>.${b}</small>`; };
export const signCls = (n: number) => (n >= 0 ? "up" : "down");
export const polyline = (vals: number[], w: number, h: number): string => {
  if (vals.length < 2) vals = [0, 0, ...vals];
  const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
  return vals.map((v, i) => `${i ? "L" : "M"}${((i * w) / (vals.length - 1)).toFixed(1)} ${(h - 3 - ((v - mn) / r) * (h - 6)).toFixed(1)}`).join(" ");
};
export const notFound = (msg = "Not found") => page({ title: msg, body: `${header(msg, "", "/feed")}<main class="main"><div class="empty"><div class="md" style="font-weight:600">${esc(msg)}</div><a class="btn sm" href="/feed">Back to feed</a></div></main>` });
export const DISCLAIMER = "Copy trading is risky. Past results don't predict future ones, and Guard reduces but can't remove the chance of loss. Nothing in Tribe is financial advice.";

/** Cache-busting version for a browser bundle in public/. */
export function bundleVersion(file: string): string {
  try {
    return Math.round(statSync(new URL(`../public/${file}`, import.meta.url)).mtimeMs).toString(36);
  } catch {
    return "0";
  }
}
