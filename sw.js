const CACHE = "flourish-static-v21";
const FILES = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./views.js",
  "./data.js",
  "./cloud.js",
  "./help.js",
  "./qrcode.js",
  "./manifest.json",
  "./favicon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(fill(FILES).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(tidy().then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function fill(files) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    files.map(async (file) => {
      try {
        const response = await fetch(new URL(file, self.location.href), { cache: "reload" });
        if (response && response.ok) await cache.put(file, response);
      } catch {
        /* a missing file must not block install */
      }
    }),
  );
}

async function tidy() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("flourish-") && key !== CACHE).map((key) => caches.delete(key)));
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      try {
        await cache.put(request, response.clone());
      } catch {
        /* some responses cannot be stored */
      }
    }
    if (response) return response;
  } catch {
    /* offline or a dropped connection */
  }
  try {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === "navigate" || request.destination === "document") {
      const shell = (await cache.match("./index.html")) || (await cache.match("index.html"));
      if (shell) return shell;
    }
  } catch {
    /* cache unavailable */
  }
  return new Response("Flourish could not reach the network. Open the link once more while you are online.", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
