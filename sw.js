/* Cache name follows the app version passed at registration (sw.js?v=X.Y.Z): a new version installs a new cache. */
const V=new URL(self.location).searchParams.get('v')||'0',C='gt7-lab-'+V;
const F=['./','./index.html','./manifest.webmanifest'],O=['./icon-192.png','./icon-512.png','./setup-lab-banner.png'];
/* core files must cache; icons and banner are optional so a missing file never breaks the install */
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F).then(()=>Promise.all(O.map(u=>c.add(u).catch(()=>0))))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
/* rete prima, cache solo offline: la versione precedente serviva sempre la copia in cache e un sito gia' installato restava bloccato sulla prima versione scaricata.
   cache:'no-cache' obbliga a rivalidare anche quando Pages risponde con una scadenza HTTP di qualche minuto. */
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 if(new URL(e.request.url).origin!==location.origin)return;
 e.respondWith(fetch(e.request,{cache:'no-cache'}).then(n=>{
  if(n.ok){const cp=n.clone();caches.open(C).then(c=>c.put(e.request,cp))}return n}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
