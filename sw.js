const CACHE='slime-ascendant-shell-v52';
const SHELL=['/','/manifest.webmanifest','/icon.svg','/cover.svg'];
const STATIC_ASSETS=new Set(['/manifest.webmanifest','/icon.svg','/cover.svg']);

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;

 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;

 // Dados dinâmicos nunca entram no Cache API: saúde do servidor e sessão precisam ser atuais.
 if(url.pathname==='/health'||url.pathname.startsWith('/api/'))return;

 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(async response=>{
   if(response.ok){
    const cache=await caches.open(CACHE);
    await cache.put('/',response.clone());
   }
   return response;
  }).catch(()=>caches.match('/')));
  return;
 }

 // Só cacheia os dois recursos estáticos usados pelo shell do aplicativo.
 if(!STATIC_ASSETS.has(url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response.ok&&!/\bno-store\b/i.test(response.headers.get('Cache-Control')||'')){
   await cache.put(request,response.clone());
  }
  return response;
 }));
});