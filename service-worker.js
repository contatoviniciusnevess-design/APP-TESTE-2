const CACHE='diario-fitness-v16';
const CORE=['./','./index.html','./styles.css','./app.js','./motivation.js','./push.js','./config.js','./manifest.json','./assets/icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).catch(()=>caches.match('./index.html'))));});
self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch{data={body:event.data?event.data.text():''};}
  event.waitUntil(self.registration.showNotification(data.title||'Meu Diário Fitness',{
    body:data.body||'Não se esqueça dos seus objetivos de hoje.',
    icon:'./assets/icon.svg',
    badge:'./assets/icon.svg',
    tag:data.tag||'fitness-push',
    data:{url:data.url||'./'},
    renotify:false
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const target=event.notification.data?.url||'./';
    for(const client of list){if('focus' in client){client.navigate(target);return client.focus()}}
    if(clients.openWindow)return clients.openWindow(target);
  }));
});
