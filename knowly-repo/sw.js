/* KNOWLY service worker: オンラインなら常に最新を取り、つながらないときは保存したものを出す */
const CACHE = "knowly-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const WAIT_MS = 4000;   // 4秒たっても返事がなければ、保存したものを先に出す

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if(req.method!=="GET" || url.origin!==location.origin) return;   // 外部(フォントなど)はブラウザにまかせる
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fetched = fetch(req).then(res => { if(res && res.ok) cache.put(req, res.clone()); return res; });
    try{
      return await Promise.race([fetched, new Promise((_,rej)=>setTimeout(()=>rej(new Error("slow")), WAIT_MS))]);
    }catch(err){
      const hit = await cache.match(req, {ignoreSearch:true}) || (req.mode==="navigate" ? await (cache.match("./index.html") || cache.match("./")) : undefined);
      if(hit){ fetched.catch(()=>{}); return hit; }
      return fetched;   // 保存したものがなければ、待ってみる
    }
  })());
});
