import { createHash } from "node:crypto";
import { Router } from "express";
import { page } from "./ui.js";
import { svgToPng } from "./views/trader.js";

const BG = "#0A0A0A";

/** The favicon's mark. Drawn as shapes, not text, because the Docker image has no fonts. Maskable icons fill the square. */
const iconSvg = (size: number, fullBleed: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32"${fullBleed ? "" : ' rx="8"'} fill="${BG}"/><circle cx="16" cy="16" r="7" fill="#34D399"/></svg>`;

const ICONS: Record<string, [size: number, fullBleed: boolean]> = {
  "/icon-192.png": [192, false],
  "/icon-512.png": [512, false],
  "/icon-maskable-512.png": [512, true],
  "/apple-touch-icon.png": [180, true], // iOS rounds the corners itself and shows transparency as black
};

const MANIFEST = {
  id: "/",
  name: "Tribe",
  short_name: "Tribe",
  description: "Copy trader-built baskets with your own limits, guarded onchain.",
  start_url: "/feed", // signed out, this lands on sign-in rather than the marketing page
  scope: "/",
  display: "standalone",
  background_color: BG,
  theme_color: BG,
  categories: ["finance"],
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "Portfolio", url: "/portfolio" },
    { name: "Guard", url: "/guard" },
  ],
};

const offlinePage = () =>
  page({
    title: "Offline",
    focus: true,
    body: `<main class="main" style="min-height:100vh;justify-content:center"><div class="empty"><div class="md" style="font-weight:600">You're offline</div><p class="sm mut" style="margin:0">Tribe needs a connection to show live prices and balances.</p><button class="btn sm" onclick="location.reload()">Try again</button></div></main><script>addEventListener('online',function(){location.reload()})</script>`,
  });

/**
 * Handles page navigations only, and caches nothing but the offline page. Account pages and API calls must never come
 * from a cache: a stale balance misleads, and a shared device would keep the last user's pages. Requests this worker
 * doesn't answer (orders, /api/sign/wait, assets) go to the network as if it weren't installed.
 */
const workerJs = (version: string) => `const CACHE = "tribe-${version}";
const OFFLINE = "/offline";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.registration.navigationPreload?.enable();
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith((async () => {
    try {
      return (await e.preloadResponse) || (await fetch(e.request));
    } catch {
      return caches.match(OFFLINE, { cacheName: CACHE });
    }
  })());
});
`;

export function pwaRouter(): Router {
  const r = Router();
  const offline = offlinePage();
  // A new offline page gets a new worker; the template is hashed too, so worker changes roll out on their own.
  const worker = workerJs(createHash("sha256").update(offline).update(workerJs("")).digest("hex").slice(0, 12));
  const png = new Map<string, Buffer>();

  r.get("/manifest.webmanifest", (_q, res) => res.type("application/manifest+json").set("Cache-Control", "public, max-age=3600").send(JSON.stringify(MANIFEST)));
  // Must sit at the root to control the whole app. no-cache so browsers pick up a new worker straight away.
  r.get("/sw.js", (_q, res) => res.type("application/javascript").set("Cache-Control", "no-cache").send(worker));
  // Sent directly, not through the app's html(), so the copy the worker stores never carries anyone's account chrome.
  r.get("/offline", (_q, res) => res.type("html").set("Cache-Control", "no-cache").send(offline));
  for (const [path, [size, fullBleed]] of Object.entries(ICONS)) {
    r.get(path, (_q, res) => {
      if (!png.has(path)) png.set(path, svgToPng(iconSvg(size, fullBleed)));
      res.type("image/png").set("Cache-Control", "public, max-age=86400").send(png.get(path));
    });
  }
  return r;
}
