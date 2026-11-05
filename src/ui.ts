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
  updown: "M12 3v18M6 8l6-5 6 5M6 16l6 5 6-5",
};
export const FILLED = new Set(["bolt", "pause", "play"]);

export function icon(name: string, size = 20, color = "currentColor", sw = 1.9): string {
  const d = ICONS[name] ?? ICONS.help;
  const fill = FILLED.has(name);
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill ? color : "none"}" stroke="${fill ? "none" : color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

export const CSS = `
:root{--bg:#0A0A0A;--tx:#F5F5F5;--mut:#A3A3A3;--dim:#8A8A8A;--ac:#34D399;--ac-ink:#052E1C;--bad:#F87171;--warn:#FCD34D;--line:rgba(255,255,255,.07)}
*{box-sizing:border-box}html{background:#050505}
body{margin:0;background:#050505;color:var(--tx);font-family:'Geist',system-ui,sans-serif;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
a{color:var(--ac);text-decoration:none}a:hover{color:#6EE7B7}
button,input,textarea,select{font-family:inherit;cursor:pointer}input,textarea{cursor:text}
button{color:inherit}
.app{position:relative;max-width:430px;min-height:100vh;margin:0 auto;background-color:var(--bg);background-image:radial-gradient(ellipse 70% 22% at 50% 0%,rgba(255,255,255,.09),rgba(255,255,255,0) 100%);display:flex;flex-direction:column;animation:tr-fade 220ms ease-out both;overflow-x:hidden;overflow-x:clip}
.app.pad{padding-bottom:110px}
.hd{display:flex;align-items:center;gap:12px;padding:18px 20px 12px}
.hd h1{margin:0;font-size:16px;font-weight:600}.hd .sub{font-size:13px;color:var(--mut)}.hd .grow{flex:1;min-width:0}
.main{padding:0 20px;display:flex;flex-direction:column;gap:16px;flex:1}
.ic{width:44px;height:44px;border-radius:22px;background:#1F1F1F;border:1px solid var(--line);color:var(--tx);display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative}
.ic.s{width:36px;height:36px;border-radius:18px}
.badge{position:absolute;top:4px;right:4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#EF4444;color:#fff;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center}
.card{border-radius:22px;background:linear-gradient(180deg,#262626,#171717);border:1px solid var(--line);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);padding:16px}
.card.post{background:linear-gradient(180deg,#232323,#151515);padding:14px;display:flex;flex-direction:column;gap:12px}
.card.bad{border-color:rgba(248,113,113,.35)}.card.good{border-color:rgba(52,211,153,.35)}
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
.srctag{display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 6px;border-radius:9px;font-size:11px;font-weight:600;background:#1F1F1F;color:#BDBDBD;vertical-align:1px}.srctag.bot{background:rgba(52,211,153,.12);color:#6EE7B7}
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
.swmain{gap:14px;padding-bottom:120px}
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
.dtabs{display:flex;gap:4px;min-width:0}.dtabs a{padding:7px 10px;border-radius:999px;font-size:14px;font-weight:600;color:#A3A3A3;white-space:nowrap}.dtabs a:hover{color:#F5F5F5}.dtabs a.on{color:#0A0A0A;background:#F5F5F5}
/* Signals: calls with the caller's showcase, the stop-entry-target bar, and the caller's desk. */
.sig{display:flex;flex-direction:column;gap:12px}.sig.done{opacity:.92}
.achs{display:flex;flex-wrap:wrap;gap:6px}.ach{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:#1A1A1A;border:1px solid rgba(255,255,255,.07);font-size:12px;color:#D4D4D4}.ach.hot{color:#FB923C;border-color:rgba(251,146,60,.3)}
.sigbar .track{position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,.07)}.sigbar .track i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:linear-gradient(90deg,rgba(248,113,113,.55),rgba(52,211,153,.8))}
.sigbar b{position:absolute;top:50%;width:12px;height:12px;border-radius:6px;transform:translate(-50%,-50%)}.sigbar b.entry{width:2px;height:12px;border-radius:1px;background:#A3A3A3}.sigbar b.now{background:#34D399;box-shadow:0 0 0 4px rgba(52,211,153,.2)}.sigbar b.now.down{background:#F87171;box-shadow:0 0 0 4px rgba(248,113,113,.2)}
.sigact{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sigact .btn{gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Reactions and comments on a call. */
.sigsoc{gap:8px;flex-wrap:wrap}.sigsoc .chip.open{border-color:rgba(52,211,153,.5);background:#1F1F1F;color:#F5F5F5}.sigsoc [data-cmcount]:empty{display:none}.sigsoc [data-cmtoggle]{gap:6px}
.sigcm{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:14px;background:#141414;border:1px solid rgba(255,255,255,.06)}.sigcm[hidden]{display:none}.cmlist{display:flex;flex-direction:column;gap:12px;max-height:260px;overflow-y:auto;scrollbar-width:thin}
.cmrow{display:flex;gap:10px;align-items:flex-start}.cmform{display:flex;gap:8px}.cmform input{flex:1;min-width:0;height:38px;padding:0 12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:#0F0F0F;color:#F5F5F5;font:inherit;font-size:14px}.cmform input:focus{outline:none;border-color:#34D399}
.deskstats{gap:6px}.deskstats div{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border-radius:12px;background:#1A1A1A;text-align:center}.deskstats b{font-size:16px}.deskstats span{font-size:11px;color:#A3A3A3}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;counter-reset:st}.steps li{display:flex;flex-direction:column;gap:2px;padding-left:30px;position:relative;font-size:13px}.steps li::before{counter-increment:st;content:counter(st);position:absolute;left:0;top:0;width:20px;height:20px;border-radius:10px;background:rgba(52,211,153,.14);color:#34D399;font-size:11px;font-weight:700;display:grid;place-items:center}.steps span{color:#A3A3A3;font-size:12.5px;line-height:1.4}
.caller{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;background:#141414;border:1px solid rgba(255,255,255,.06);color:#F5F5F5}.caller:hover{background:#1A1A1A}.caller .rank{width:16px;text-align:center;color:#A3A3A3;font-size:12px;font-weight:700}
.lbsearch{display:flex;align-items:center;gap:10px;padding:0 14px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:#141414;color:#A3A3A3}.lbsearch:focus-within{border-color:#34D399}.lbsearch input{flex:1;min-width:0;height:100%;border:0;background:none;color:#F5F5F5;font:inherit;font-size:15px;outline:none}
.sharegrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}.shbtn{white-space:nowrap;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:#141414;color:#F5F5F5;font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-align:left}.shbtn:hover{background:#1C1C1C}
.shic{display:inline-grid;place-items:center;flex:none;width:28px;height:28px;border-radius:9px;font-size:13px;font-weight:800;line-height:1}
.fld{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#A3A3A3}.fld input,.fld textarea{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:#141414;color:#F5F5F5;font:inherit;font-size:15px;resize:vertical}.fld input:focus,.fld textarea:focus{outline:none;border-color:#34D399}
.chip:has(input:focus-visible){outline:2px solid #34D399;outline-offset:2px}
.swcard.arrive{animation:card-in .45s cubic-bezier(.3,1.3,.5,1) both}
@keyframes card-in{from{opacity:0;transform:translateY(40px) scale(.92)}to{opacity:1}}
[data-live].flash{animation:live-flash .9s ease-out}
@keyframes live-flash{0%{background:rgba(52,211,153,.25)}100%{background:transparent}}
.swfollow{max-width:360px;margin:0 auto;height:40px;font-size:14px}
/* The buttons sit over the card's bottom edge (above every card in the stack), with room left in the card so they cover nothing. */
.swcard{padding-bottom:52px}.swmain .swbar{position:relative;z-index:60;margin-top:-48px}
/* Phones are swipes only: following the trader lives on desktop (button or F). */
@media (max-width:899px){.swfollow{display:none!important}
  /* Phones: the card fills the screen between the header and the tab bar. */
  .swmain{padding:0 10px}.deck{height:calc(100vh - 190px);height:calc(100dvh - 190px);min-height:430px;margin:0 8px;--peek:16%}
  .swmain .swbar{margin-bottom:-16px}}
.bcard{padding:20px 20px 18px;gap:16px!important}.bcard #brief{gap:16px!important;flex:1 1 auto}
/* Deck side panel: runs to the bottom of the screen. Cat's brief takes all the room the portfolio and active trades leave,
   with its last trades and stats sitting at the bottom; on a short screen the brief scrolls inside itself. */
@media (min-width:900px){.paside:has(.bcard){height:calc(100vh - 100px);overflow:hidden}.paside .bcard{flex:1 1 0;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#333 transparent}.paside>section:not(.bcard){flex:none}.bcard .blast{margin-top:auto}}
.bheld{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:14px;background:#1A1A1A;font-size:15px}
.bcurve{display:flex;flex-direction:column;gap:6px}.bcurve svg{width:100%;height:64px;display:block}.bcurve b{font-size:14px}
/* Phones: the trader's record on the deck card (the side panel's job on desktop). Shorter phones drop the chart, then the chips. */
.mrec{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)}
.swcard>*{flex-shrink:0}.swcard>.mrec{flex:0 1 auto;min-height:0;overflow:hidden}
.mrec .bstats{gap:6px}.mrec .bstats span{padding:7px 2px;border-radius:10px;font-size:11px}.mrec .bstats b{font-size:15px}.mrec .btrade{padding:3px 9px;font-size:13px}
@media (max-height:760px){.mrec .mlast{display:none}}@media (max-height:700px){.mrec{display:none!important}}
@media (max-height:820px){.bcurve{display:none}}.bcard h2{font-size:18px!important;gap:10px!important}.bcard h2 .orb{width:24px!important;height:24px!important}
.av.xs{width:22px;height:22px;border-radius:11px;font-size:9px;flex:none}
.bhead .av{width:42px;height:42px;border-radius:21px;font-size:13px}.bhead b{font-size:17px}.bhead .xs{font-size:12.5px}
.brief{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}.brief li{display:flex;gap:11px;align-items:flex-start;font-size:15.5px;line-height:1.4;color:#E5E5E5}.brief li i{flex:none;width:9px;height:9px;border-radius:50%;margin-top:7px}
.blast{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.blast>.xs{font-size:13.5px}
.btrade{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:#1A1A1A;border:1px solid rgba(255,255,255,.06);font-size:15px}.btrade .srcic{display:inline-flex;color:#A3A3A3}
.bstats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;font-size:12.5px;color:#A3A3A3}.bstats span{display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 4px;border-radius:14px;background:#1A1A1A;text-align:center}.bstats b{color:#F5F5F5;font-size:19px}
#brief.loading{opacity:.45;transition:opacity .2s}
.acar{display:flex;flex-direction:column;gap:10px;border-radius:18px;background:#141414;border:1px solid rgba(255,255,255,.07);padding:12px 14px;overflow:hidden}
.aslides{display:grid;touch-action:pan-y;user-select:none}
.aslide{grid-area:1/1;display:flex;flex-direction:column;gap:8px;color:#F5F5F5;opacity:0;visibility:hidden;transform:translateX(14px);transition:opacity .3s,transform .3s,visibility 0s .3s}
.aslide.on{opacity:1;visibility:visible;transform:none;transition:opacity .3s,transform .3s}
.acbtn{display:inline-grid;place-items:center;width:24px;height:24px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:transparent;color:#D4D4D4;cursor:pointer}.acbtn:hover{background:#1F1F1F;color:#F5F5F5}
.mbars{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:10px;height:150px;align-items:end;padding:4px 2px 0}.mbar{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%}.mbar i{display:block;width:70%;max-width:46px;border-radius:8px 8px 3px 3px;min-height:4px}.mbar i.pos{background:linear-gradient(180deg,#6EE7B7,#10B981)}.mbar i.neg{background:linear-gradient(180deg,#FCA5A5,#EF4444)}
.mrow{border-top:1px solid #1F1F1F}.mrow summary{list-style:none;cursor:pointer;min-height:56px;padding:6px 0}.mrow summary::-webkit-details-marker{display:none}.mrow[open] summary{border-bottom:0}
@media(min-width:900px){.deck{width:100%;max-width:560px;margin:0 auto}.swmain .swbar,.swmain .swfollow{width:100%;max-width:560px;margin-left:auto;margin-right:auto}}
@media(prefers-reduced-motion:reduce){.swcard.arrive,[data-live].flash{animation:none}}
.reqband{margin:-16px -16px 0;padding:10px 16px;background:rgba(252,211,77,.12);color:#FCD34D;font-size:13px;display:flex;gap:6px;align-items:center}
.stamp{position:absolute;top:24px;padding:4px 12px;border:3px solid;border-radius:10px;font-weight:800;font-size:22px;letter-spacing:.06em;opacity:0;z-index:5;pointer-events:none;background:rgba(10,10,10,.55)}
.stamp.copy{left:18px;color:#34D399;border-color:#34D399;transform:rotate(-12deg)}.stamp.skip{right:18px;color:#F87171;border-color:#F87171;transform:rotate(12deg)}
.stamp.ask{left:50%;top:auto;bottom:28px;transform:translateX(-50%);color:#A7F3D0;border-color:#A7F3D0;white-space:nowrap}
.swread{border:1px solid;border-radius:16px;padding:12px;background:rgba(255,255,255,.02);margin-top:auto}
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
.chip:has(input:checked){background:#F5F5F5;border-color:#F5F5F5;color:#0A0A0A}
.sw{width:44px;height:26px;border-radius:13px;border:0;padding:3px;background:#3A3A3A;display:flex;justify-content:flex-start;flex-shrink:0}
.sw i{width:20px;height:20px;border-radius:10px;background:#fff;display:block}
.sw[aria-checked=true]{background:var(--ac);justify-content:flex-end}
.line{display:flex;align-items:center;gap:12px;min-height:52px;border-bottom:1px solid #1F1F1F;font-size:14px;color:var(--tx)}
.line .ico{width:34px;height:34px;border-radius:10px;background:#1F1F1F;border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.line .t{display:block}.line .s{display:block;font-size:12px;color:var(--mut)}
.bar{height:4px;border-radius:2px;background:#262626;overflow:hidden}.bar i{display:block;height:100%;background:var(--ac)}
.bar.r i{background:var(--bad)}
.nav{position:fixed;left:var(--cx,50%);bottom:24px;transform:translateX(-50%);display:flex;gap:4px;padding:5px;border-radius:30px;background:rgba(36,36,36,.78);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.07);box-shadow:0 12px 32px rgba(0,0,0,.55);z-index:30}
.nav a{width:44px;height:44px;border-radius:22px;color:#9A9A9A;display:flex;align-items:center;justify-content:center}
.nav a.on{background:#3A3A3A;color:#fff}
.backdrop.drawer-bd{z-index:50}
.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);z-index:50;display:none;animation:tr-backdrop 200ms both}
.sheet{position:fixed;left:var(--cx,50%);bottom:0;width:100%;max-width:430px;transform:translateX(-50%);max-height:88vh;overflow-y:auto;border-radius:28px 28px 0 0;background:linear-gradient(180deg,#1E1E1E,#121212 22%);border-top:1px solid rgba(255,255,255,.1);box-shadow:0 -24px 60px rgba(0,0,0,.6);z-index:51;display:none;padding:10px 20px 28px;animation:tr-sheet 340ms cubic-bezier(.2,.9,.25,1) both}
.sheet .grab{width:40px;height:4px;border-radius:2px;background:#404040;margin:0 auto 12px}
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
.composer input{width:100%;border:0;background:transparent;color:#F5F5F5;font-size:16px;height:36px;padding:0}
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
  .topbar{display:flex;align-items:center;gap:12px;padding:14px 28px;position:sticky;top:0;z-index:28;background:rgba(10,10,10,.85);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.05)}
  .topbar form{flex:1;max-width:520px}.topbar kbd,.kbd{font:inherit;font-size:11px;color:#8A8A8A;border:1px solid #2a2a2a;border-radius:6px;padding:1px 6px}
  .app,.app.pad{max-width:820px;width:100%;margin:0 auto;padding-bottom:60px;background-image:none}
  .app.focus{max-width:520px;padding-bottom:40px}.app.wide{max-width:1040px}
  .nav{display:none}
  .hd{padding:26px 28px 14px}.hd h1{font-size:22px}.main{padding:0 28px}
  .composer{max-width:720px;bottom:24px!important}.composer.shift{left:calc(var(--cx) + 130px)}
  .sheet{top:50%;bottom:auto;transform:translate(-50%,-50%);width:min(560px,92vw);max-width:none;max-height:86vh;border-radius:24px;border:1px solid rgba(255,255,255,.1);animation:tr-pop 220ms cubic-bezier(.2,.8,.2,1) both}
  .toast{left:auto;right:24px;top:auto;bottom:24px;transform:none;width:360px}.toast.show{animation:tr-fade 200ms both}
  .drawer{display:none}
  .reqbanner{left:auto!important;right:24px!important;top:78px!important;transform:none!important;width:360px!important}
  .tbl{width:100%;border-collapse:collapse}.tbl th{font-size:12px;font-weight:600;color:#8A8A8A;text-align:left;padding:10px 12px;border-bottom:1px solid #222;white-space:nowrap}
  .tbl td{padding:12px;border-bottom:1px solid #1C1C1C;font-size:14px;vertical-align:middle}.tbl tr:hover td{background:#101010}.tbl .r{text-align:right}
  .pad2{padding:0 28px}
  .catgrid{display:grid;grid-template-columns:260px minmax(0,1fr);gap:24px;align-items:start}
  .split{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;padding:0 28px 40px;align-items:start}.split>.main{padding:0}
  .paside{display:flex;flex-direction:column;gap:16px;min-width:0}
  .d2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.d3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .d3 .qcard{flex-direction:column;align-items:flex-start}.d3 .qcard>.grow{width:100%}
  .chat-hist{position:sticky;top:76px;display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 100px);overflow:auto}
  /* Ask Cat chat: an app view, not a page. The history list and the conversation are separate scroll panes; the page itself never scrolls. */
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
/* Focus pages (Ask Cat chat): the menu collapses to icons and the summary rail goes, unless the user opens the menu. */
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
`;

export type NavKey = "feed" | "signals" | "ranks" | "cat" | "guard" | "me";
const NAV: [NavKey, string, string, string][] = [["feed", "/feed", "home", "Feed"], ["signals", "/signals", "rise", "Signals"], ["ranks", "/ranks", "bars", "Leaderboard"], ["cat", "/cat", "cat", "Ask Cat"], ["guard", "/guard", "shield", "Guard"], ["me", "/me", "user", "Me"]];

/** split: the body uses split(); on desktop its aside replaces the global right rail. */
export interface PageOpts { title: string; body: string; nav?: NavKey; head?: string; bare?: boolean; sheets?: string; extraClass?: string; focus?: boolean; split?: boolean; slim?: boolean }

export function page(o: PageOpts): string {
  const nav = o.nav
    ? `<nav class="nav" aria-label="Main">${NAV.map(([k, href, ic, label]) => `<a href="${href}" aria-label="${label}"${k === o.nav ? ' class="on" aria-current="page"' : ""}>${icon(ic)}</a>`).join("")}</nav>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0A0A0A"><title>${esc(o.title)} · Tribe</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230A0A0A'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%2334D399'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
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
