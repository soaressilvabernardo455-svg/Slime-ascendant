const http=require('http'),fs=require('fs'),{WebSocketServer}=require('ws');
const R=Math.random,PW=['proj','orb','nova','raio','aura','meteoro','lanca','corrente','espinhos','furacao'],PS=['vida','dano','vel','recarga','ima','regen','xp','armadura','crit','sorte'];
const CLS={normal:{hp:100,sp:4.8,dm:.8,pw:'proj'},mago:{hp:70,sp:4.8,dm:.92,pw:'raio'},cavaleiro:{hp:150,sp:4.2,dm:1.05,pw:'orb'},necromante:{hp:85,sp:4.8,dm:1,pw:'nova'},curandeiro:{hp:110,sp:4.8,dm:.7,pw:'aura',heal:1},arqueiro:{hp:80,sp:5.2,dm:.9,pw:'proj',pr:2}};
const ET=[{h:w=>18+w*9,r:10,v:1.4,d:7,c:1,x:1},{h:w=>10+w*5,r:8,v:2.4,d:5,c:2,x:2},{h:w=>55+w*15,r:16,v:.9,d:14,c:6,x:5},{h:w=>300+w*55,r:26,v:.8,d:20,c:18,x:40},{h:w=>14+w*6,r:11,v:1.9,d:6,c:1,x:3},{h:w=>30+w*8,r:12,v:1.6,d:9,c:2,x:3},{h:w=>70+w*14,r:13,v:.7,d:10,c:2,x:4}];
const rooms=Object.create(null);let N=1,roomSequence=1;const ITEMS=['espada','escudo','botas','amuleto','anel','coracao'];const presence=new Map(),PRESENCE_TTL_MS=45000;
const MAX_PLAYERS=4,MAX_CONNECTIONS=40,MAX_MESSAGE_RATE=45,VIEW_RADIUS=640,UPGRADE_KEYS=['vida','dano','vel','moeda'];
function allowMessage(ws){const now=Date.now();if(!ws.rateWindow||now-ws.rateWindow>=1000){ws.rateWindow=now;ws.rateCount=0}ws.rateCount++;return ws.rateCount<=MAX_MESSAGE_RATE}
function newRoom(k){return{k,ps:{},started:false,locked:false,startAt:0,hostId:0,lastRoomBroadcast:0,lastSnapshotAt:0,publicRoom:k==='geral',autoStartAt:0}}
function roomForJoin(key){if(key==='geral'){let room=rooms.geral;if(room&&(room.locked||room.started||Object.keys(room.ps||{}).length>=MAX_PLAYERS)){const archived='@public-'+roomSequence++;room.k=archived;rooms[archived]=room;delete rooms.geral;room=null}if(!room)room=rooms.geral=newRoom('geral');return room}return rooms[key]||(rooms[key]=newRoom(key))}
const BLOCKED_NAME_WORDS=['admin','administrator','moderador','moderator','staff','owner','suporte','support','system','developer','porra','caralho','merda','bosta','puta','puto','foda','foder','viado','piranha','cacete','buceta','nazi','hitler'];
function normalizePlayerName(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/7/g,'t').replace(/@/g,'a').replace(/\$/g,'s')}
function isAllowedPlayerName(value){const name=String(value||'Slime').trim();if(!name||[...name].length>10)return false;const normalized=normalizePlayerName(name);if(!/^[a-z0-9_ -]+$/.test(normalized))return false;const compact=normalized.replace(/[^a-z0-9]/g,'');return !BLOCKED_NAME_WORDS.some(word=>compact.includes(word))}
function cleanPlayerData(data){data=data&&typeof data==='object'?data:{};const cls=Object.prototype.hasOwnProperty.call(CLS,data.cls)?data.cls:'normal',name=String(data.name||'Slime').replace(/[<>]/g,'').trim().slice(0,10)||'Slime',up={};for(const key of UPGRADE_KEYS){const n=Number(data.up&&data.up[key]);up[key]=Number.isFinite(n)?Math.max(0,Math.min(10,Math.floor(n))):0}const it=Array.isArray(data.it)?[...new Set(data.it.filter(key=>ITEMS.includes(key)))].slice(0,ITEMS.length):[];return{cls,name,up,it}}
const cl=v=>Math.max(-1000000000,Math.min(1000000000,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const html=fs.readFileSync(__dirname+'/index.html');
const {handleAuthRequest}=require('./auth');
const srv=http.createServer(async(q,s)=>{
 const path=new URL(q.url,'http://x').pathname;
 if(await handleAuthRequest(q,s,path))return;
 if(path==='/health'&&q.method==='GET'){
  const now=Date.now();for(const [id,lastSeen] of presence)if(now-lastSeen>PRESENCE_TTL_MS)presence.delete(id);
  let connected=0,playing=0;for(const room of Object.values(rooms)){const count=Object.keys(room.ps||{}).length;connected+=count;if(room.started)playing+=count}
  s.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'same-origin'});
  s.end(JSON.stringify({status:'ok',online:presence.size,players:connected,playing,rooms:Object.keys(rooms).length,uptime:Math.floor(process.uptime())}));return;
 }
 if(path==='/presence'&&q.method==='GET'){
  const key=new URL(q.url,'http://x').searchParams.get('id')||'';if(/^[a-zA-Z0-9_-]{12,64}$/.test(key)){const now=Date.now();for(const [id,lastSeen] of presence)if(now-lastSeen>PRESENCE_TTL_MS)presence.delete(id);presence.set(key,now);if(presence.size>10000)presence.delete(presence.keys().next().value)}
  s.writeHead(204,{'Cache-Control':'no-store'});s.end();return;
 }
 const assets={'/sw.js':['sw.js','application/javascript; charset=utf-8'],'/manifest.webmanifest':['manifest.webmanifest','application/manifest+json; charset=utf-8'],'/icon.svg':['icon.svg','image/svg+xml'],'/cover.svg':['cover.svg','image/svg+xml']};
 if(assets[path]){
  const [file,type]=assets[path];
  try{s.writeHead(200,{'Content-Type':type,'Cache-Control':path==='/sw.js'?'no-cache':'public, max-age=86400','Service-Worker-Allowed':'/'});s.end(fs.readFileSync(__dirname+'/'+file));}
  catch(e){s.writeHead(404);s.end('Not found')}
  return;
 }
 s.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});s.end(html);
});
const wss=new WebSocketServer({server:srv,maxPayload:2048,perMessageDeflate:false});

function mk(id,cls,name,up,it){const data=cleanPlayerData({cls,name,up,it});cls=data.cls;name=data.name;up=data.up;it=data.it;const c=CLS[cls],u={};
 for(const k of UPGRADE_KEYS)u[k]=data.up[k];
 const mh=Math.round(c.hp*(1+.1*u.vida)*(it.includes('coracao')?1.25:1));
 return{id,name,cls,u,up,it,x:800+R()*100,y:800+R()*100,hp:mh,mh,lv:1,xp:0,nx:5,pw:{[c.pw]:1},ps:{},cd:{},dx:0,dy:0,stopAfterStep:0,stopRequested:0,ch:null,choiceExpiresAt:0,d:0,co:0,cr:0}}
function reset(r){r.es=[];r.sh=[];r.gm=[];r.hr=[];r.fx=[];r.ob=[];r.wave=1;r.t=0;r.sp=30;r.ov=0;
 for(const i in r.ps){const p=r.ps[i];r.ps[i]=mk(+i,p.cls,p.name,p.up,p.it)}}
function lv(p){p.lv++;p.xp-=p.nx;p.nx=Math.ceil(p.nx*1.35+2);
 const op=Object.keys(p.pw).filter(k=>p.pw[k]>0),os=Object.keys(p.ps).filter(k=>p.ps[k]>0);
 const pool=[...PW.filter(k=>(p.pw[k]||0)>0?p.pw[k]<5:op.length<5).map(k=>'p:'+k),...PS.filter(k=>(p.ps[k]||0)>0?p.ps[k]<5:os.length<5).map(k=>'s:'+k)];
 const shuffled=pool.sort(()=>R()-.5);p.ch=p.lv===5&&(p.pw.meteoro||0)<5&&((p.pw.meteoro||0)>0||op.length<5)?['p:meteoro',...shuffled.filter(k=>k!=='p:meteoro')].slice(0,3):shuffled.slice(0,3);p.choiceExpiresAt=p.ch.length?Date.now()+10000:0;if(!p.ch.length)p.ch=null}
function pick(p,i){const o=p.ch&&p.ch[+i];if(!o)return;const k=o.slice(2),owned=Object.keys(o[0]=='p'?p.pw:p.ps).filter(a=>(o[0]=='p'?p.pw:p.ps)[a]>0);
 if(o[0]=='p'){if(!(p.pw[k]>0)&&owned.length>=5)return;if((p.pw[k]||0)>=5)return;p.pw[k]=(p.pw[k]||0)+1}
 else{if(!(p.ps[k]>0)&&owned.length>=5)return;if((p.ps[k]||0)>=5)return;p.ps[k]=(p.ps[k]||0)+1;if(k=='vida'){const b=CLS[p.cls].hp*.2;p.mh+=b;p.hp+=b}}
 p.ch=null;p.choiceExpiresAt=0;if(p.xp>=p.nx)lv(p)}
function spawn(r,L,ty){const w=r.wave,p=L[R()*L.length|0],a=R()*6.28,E=ET[ty],hp=E.h(w)*(1+.4*(L.length-1));
 r.es.push({x:cl(p.x+Math.cos(a)*520),y:cl(p.y+Math.sin(a)*520),ty,hp,mh:hp,r:E.r,v:E.v+(ty!=3?Math.min(w*.03,.8):0),d:E.d,attackCooldown:0})}

function step(r,L){
 r.t++;r.ob=[];
 if(r.t%600==0){r.wave++;if(r.wave%2==0)for(const p of L)p.cr++;if(r.wave%5==0)spawn(r,L,3)}
 if(--r.sp<1){const w=r.wave;r.sp=Math.max(20,60-w*2);
  if(r.es.length<45)for(let i=0,n=1+(w>>2)+L.length-1;i<n&&r.es.length<45;i++){const q=R();spawn(r,L,w>5&&q<.1?5:w>4&&q<.2?6:w>3&&q<.3?4:w>2&&q<.4?2:q<.65?1:0)}}
 for(const p of L){
  if(p.ch)continue;
  const c=CLS[p.cls],m=Math.hypot(p.dx,p.dy);if(m>1){p.dx/=m;p.dy/=m}
  const sp=c.sp*(1+.1*(p.ps.vel||0))*(1+.04*p.u.vel)*(p.it.includes('botas')?1.08:1);p.x=cl(p.x+p.dx*sp);p.y=cl(p.y+p.dy*sp);if(p.stopAfterStep>0&&--p.stopAfterStep===0){p.dx=0;p.dy=0;p.stopRequested=0}
  const dm=c.dm*(1+.15*(p.ps.dano||0))*(1+.08*p.u.dano)*(p.it.includes('espada')?1.12:1),cd=Math.max(.35,1-.1*(p.ps.recarga||0)),l=p.pw,hit=d=>d*(R()<Math.min(.6,.05*(p.ps.crit||0))?2:1);
  const near=g=>{let b=null;for(const e of r.es){const d=dist(e,p);if(d<g){g=d;b=e}}return b};
  const rdy=(k,t)=>{p.cd[k]=(p.cd[k]||0)-1;if(p.cd[k]<=0){p.cd[k]=t*cd;return 1}};
  if(l.proj&&rdy('proj',18)){const e=near(420);
   if(e){const n=1+(l.proj>2)+(l.proj>4),a0=Math.atan2(e.y-p.y,e.x-p.x);
    for(let i=0;i<n;i++){const a=a0+(i-(n-1)/2)*.2;r.sh.push({x:p.x,y:p.y,vx:Math.cos(a)*9,vy:Math.sin(a)*9,d:hit((7+3*l.proj)*dm),life:45,pr:c.pr||0})}}
   else p.cd.proj=0}
  if(l.orb){const n=1+l.orb;for(let i=0;i<n;i++){const a=r.t*.1+i*6.283/n,o={x:p.x+Math.cos(a)*65,y:p.y+Math.sin(a)*65};r.ob.push([o.x|0,o.y|0]);
   for(const e of r.es)if(dist(e,o)<e.r+8)e.hp-=hit(.3*(1+l.orb*.3)*dm)}}
  if(l.nova&&rdy('nova',90)){const rr=90+12*l.nova;r.fx.push(['n',p.x|0,p.y|0,rr,0,6]);
   for(const e of r.es)if(dist(e,p)<rr+e.r)e.hp-=hit((10+5*l.nova)*dm)}
  if(l.raio&&rdy('raio',45))r.es.filter(e=>dist(e,p)<380).sort(()=>R()-.5).slice(0,1+l.raio).forEach(e=>{e.hp-=hit((14+4*l.raio)*dm);r.fx.push(['r',p.x|0,p.y|0,e.x|0,e.y|0,5])});
  if(l.meteoro&&rdy('meteoro',120)){const e=near(450);if(e){const rr=60+6*l.meteoro;r.fx.push(['n',e.x|0,e.y|0,rr,0,8]);for(const q of r.es)if(dist(q,e)<rr+q.r)q.hp-=hit((25+8*l.meteoro)*dm)}else p.cd.meteoro=0}
  if(l.aura){const rr=50+8*l.aura;for(const e of r.es)if(dist(e,p)<rr+e.r)e.hp-=hit((.3+.12*l.aura)*dm)}
  if(l.lanca&&rdy('lanca',58)){const e=near(520);if(e){const a=Math.atan2(e.y-p.y,e.x-p.x);r.sh.push({x:p.x,y:p.y,vx:Math.cos(a)*12,vy:Math.sin(a)*12,d:hit((20+7*l.lanca)*dm),life:48,pr:5})}else p.cd.lanca=0}
  if(l.corrente&&rdy('corrente',72)){let from=p;const chain=r.es.filter(e=>dist(e,p)<430).sort((a,b)=>dist(a,p)-dist(b,p)).slice(0,Math.min(2+l.corrente,6));for(const e of chain){e.hp-=hit((13+5*l.corrente)*dm);r.fx.push(['r',from.x|0,from.y|0,e.x|0,e.y|0,5]);from=e}}
  if(l.espinhos&&rdy('espinhos',24)){const rr=82+9*l.espinhos;r.fx.push(['n',p.x|0,p.y|0,rr,0,5]);for(const e of r.es)if(dist(e,p)<rr+e.r)e.hp-=hit((8+3*l.espinhos)*dm)}
  if(l.furacao&&rdy('furacao',150)){const rr=135+12*l.furacao;r.fx.push(['n',p.x|0,p.y|0,rr,0,9]);for(const e of r.es)if(dist(e,p)<rr+e.r){e.hp-=hit((28+9*l.furacao)*dm);const a=Math.atan2(e.y-p.y,e.x-p.x);e.x=cl(e.x+Math.cos(a)*18);e.y=cl(e.y+Math.sin(a)*18)}}
  if(p.ps.regen&&r.t%30==0)p.hp=Math.min(p.mh,p.hp+p.ps.regen);
  if(c.heal&&r.t%60==0)for(const q of L)if(!q.d&&dist(q,p)<220)q.hp=Math.min(q.mh,q.hp+8)}
 for(const e of r.es){let b=null,bd=1e9;for(const p of L){if(p.d)continue;const d=dist(p,e);if(d<bd){bd=d;b=p}}
  if(!b)continue;
  let separateX=0,separateY=0;for(const other of r.es){if(other===e)continue;const dx=e.x-other.x,dy=e.y-other.y,d=Math.hypot(dx,dy),gap=e.r+other.r+10;if(d>0&&d<gap){const force=(gap-d)/gap;separateX+=dx/d*force;separateY+=dy/d*force}}
  let nx=e.x+(bd>0?(b.x-e.x)/bd:0)*e.v+separateX*.95,ny=e.y+(bd>0?(b.y-e.y)/bd:0)*e.v+separateY*.95;const stopGap=e.r+22,nd=Math.hypot(nx-b.x,ny-b.y);if(nd<stopGap){const angle=nd>.001?Math.atan2(ny-b.y,nx-b.x):(r.t*.17+e.ty*2.4);nx=b.x+Math.cos(angle)*stopGap;ny=b.y+Math.sin(angle)*stopGap}e.x=cl(nx);e.y=cl(ny);
  const contact=dist(b,e);if(contact<e.r+34){e.attackCooldown=(e.attackCooldown||0)-1;if(e.attackCooldown<=0){const armor=Math.min(.85,.08*(b.ps.armadura||0)),damage=Math.max(1,e.d*(1-armor)*(b.it.includes('escudo')?.85:1));b.hp=Math.max(0,b.hp-damage);e.attackCooldown=75;if(b.hp===0){b.d=1;b.ch=null}}}else if(e.attackCooldown>0)e.attackCooldown--}
 r.sh=r.sh.filter(s=>{s.x+=s.vx;s.y+=s.vy;if(--s.life<1)return 0;const h=s.h||(s.h=new Set());
  for(const e of r.es)if(e.hp>0&&!h.has(e)&&dist(e,s)<e.r+4){h.add(e);e.hp-=s.d;if(s.pr-->0)continue;return 0}return 1});
 r.es=r.es.filter(e=>{if(e.hp>0)return 1;const E=ET[e.ty];r.gm.push({x:e.x,y:e.y,v:E.x,life:1800});if(r.gm.length>120)r.gm.splice(0,r.gm.length-120);if(R()<.05){r.hr.push({x:e.x,y:e.y,life:1800});if(r.hr.length>20)r.hr.shift()}
  for(const p of L){if(p.d)continue;p.co+=Math.ceil(E.c*(1+.1*p.u.moeda+.1*(p.ps.sorte||0))*(p.it.includes('anel')?1.15:1));if(e.ty==2&&R()<.12)p.cr++;if(e.ty==3)p.cr+=3}return 0});
 r.gm=r.gm.filter(g=>{if(--g.life<=0)return 0;for(const p of L){if(p.d)continue;const d=dist(p,g)||1;
  if(d<14){p.xp+=g.v*(1+.15*(p.ps.xp||0))*(p.it.includes('amuleto')?1.15:1);if(p.xp>=p.nx&&!p.ch)lv(p);return 0}
  if(d<60*(1+.4*(p.ps.ima||0))){g.x+=(p.x-g.x)/d*5;g.y+=(p.y-g.y)/d*5;break}}return 1});
 r.hr=r.hr.filter(h=>{if(--h.life<=0)return 0;for(const p of L)if(!p.d&&dist(p,h)<18){p.hp=Math.min(p.mh,p.hp+25);return 0}return 1});
 r.fx=r.fx.filter(f=>--f[5]>0);
 for(const p of L){if(p.cls!=='necromante'){p.sk=[];continue}p.sk=p.sk||[];p.skTimer=(p.skTimer||0)+1;if(p.skTimer>=360){p.skTimer=0;for(let i=0;i<2&&p.sk.length<4;i++){const a=R()*Math.PI*2;p.sk.push({x:p.x+Math.cos(a)*28,y:p.y+Math.sin(a)*28,hp:24,life:900,hit:0})}}p.sk=p.sk.filter(k=>{if(--k.life<=0||k.hp<=0)return false;let e=null,bd=1e9;for(const q of r.es){const d=dist(k,q);if(d<bd){bd=d;e=q}}if(e){const d=Math.max(1,bd);if(d>24){k.x+=(e.x-k.x)/d*2.5;k.y+=(e.y-k.y)/d*2.5}else if(++k.hit>=30){k.hit=0;e.hp-=4}}return true})}
}

function roomMessage(r){
 const players=Object.values(r.ps).map(p=>({id:p.id,name:p.name,cls:p.cls}));
 const now=Date.now(),countdown=r.startAt?Math.max(0,Math.ceil((r.startAt-now)/1000)):0;
 const autoStartIn=!r.started&&!r.locked&&r.publicRoom&&r.autoStartAt?Math.max(0,Math.ceil((r.autoStartAt-now)/1000)):0;
 const payload=JSON.stringify({t:'room',phase:r.started?'playing':r.locked?'countdown':'waiting',countdown,autoStartIn,hostId:r.hostId,roomCode:r.k,players});
 wss.clients.forEach(c=>{if(c.r===r&&c.readyState===1)c.send(payload)});
}
function snapshot(r,own){
 const P=Object.values(r.ps),L=P.filter(p=>!p.d),near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=VIEW_RADIUS;
 const visible=(x,y)=>Math.hypot(x-own.x,y-own.y)<=VIEW_RADIUS;
 const effects=r.fx.filter(f=>f[0]==='n'?visible(f[1],f[2]):visible(f[1],f[2])||visible(f[3],f[4]));
 return JSON.stringify({w:r.wave,mp:r.map|0,pa:!!own.ch,o:P.length>0&&!L.length?1:0,
  k:P.flatMap(p=>(p.sk||[]).map(q=>[q.x|0,q.y|0])),p:P.map(p=>({id:p.id,n:p.name,c:p.cls,x:p.x|0,y:p.y|0,h:p.hp|0,m:p.mh|0,l:p.lv,xp:p.xp,nx:p.nx,d:p.d,pw:p.pw,ps:p.ps,ch:p.ch,co:p.co,cr:p.cr,sp:+(CLS[p.cls].sp*(1+.1*(p.ps.vel||0))*(1+.04*p.u.vel)*(p.it.includes('botas')?1.08:1)).toFixed(2)})),
  e:r.es.filter(e=>visible(e.x,e.y)).map(e=>[e.x|0,e.y|0,e.ty,Math.max(0,e.hp/e.mh)]),
  s:r.sh.filter(q=>visible(q.x,q.y)).map(q=>[q.x|0,q.y|0]),
  b:r.ob.filter(q=>visible(q[0],q[1])),
  g:r.gm.filter(q=>visible(q.x,q.y)).map(q=>[q.x|0,q.y|0]),
  f:effects,hr:r.hr.filter(q=>visible(q.x,q.y)).map(q=>[q.x|0,q.y|0])});
}
function tick(r){
 const now=Date.now(),P=Object.values(r.ps),L=P.filter(p=>!p.d);
 if(!P.length)return;
 if(!r.started&&!r.locked&&r.publicRoom&&r.autoStartAt&&now>=r.autoStartAt){r.locked=true;r.startAt=now+3500;r.lastRoomBroadcast=0}
 if(!r.started){
  if(r.locked&&r.startAt&&now>=r.startAt){r.started=true;r.startAt=0;r.wave=1;r.t=0;r.sp=30;roomMessage(r)}
  else{if(now-r.lastRoomBroadcast>=350){r.lastRoomBroadcast=now;roomMessage(r)}return}
 }
 for(const p of P)if(p.ch&&p.choiceExpiresAt&&now>=p.choiceExpiresAt)pick(p,0);
 const alive=P.filter(p=>!p.d);
 if(alive.length)step(r,alive);
 if(now-r.lastSnapshotAt<50)return;
 r.lastSnapshotAt=now;
 wss.clients.forEach(client=>{
  const own=client.r===r&&r.ps[client.playerId];
  if(!own||client.readyState!==1)return;
  client.send(snapshot(r,own));
 });
}
setInterval(()=>{for(const k of Object.keys(rooms)){const r=rooms[k];try{tick(r)}catch(e){console.error('Room tick error:',e)}}},33);
process.on('uncaughtException',e=>console.error(e));

wss.on('connection',(ws,rq)=>{
 if(wss.clients.size>MAX_CONNECTIONS){ws.close(1013,'Servidor temporariamente cheio');return}
 let k=(new URL(rq.url,'http://x').searchParams.get('s')||'geral').slice(0,12),r=null;
 if(!/^[a-zA-Z0-9_-]{1,12}$/.test(k))k='geral';
 ws.r=null;ws.playerId=0;ws.rateWindow=Date.now();ws.rateCount=0;
 ws.on('error',error=>console.warn('WebSocket error:',error&&error.message||'erro de socket'));
 ws.on('message',(raw)=>{
  if(!allowMessage(ws)){try{ws.close(1008,'Limite de mensagens excedido')}catch(e){}return}
  if(raw.length>2048){try{ws.close(1009,'Mensagem muito grande')}catch(e){}return}
  let d;try{d=JSON.parse(raw.toString())}catch{return}
  if(!d||typeof d!=='object'||Array.isArray(d))return;
  if(d.t==='join'&&!ws.playerId){
   if(!isAllowedPlayerName(d.name)){ws.send(JSON.stringify({t:'error',message:'Esse nome não é permitido. Escolha outro.'}));return}
   if(!r){r=roomForJoin(k);if(!r.es)reset(r);ws.r=r}
   if(r.locked||r.started){ws.send(JSON.stringify({t:'error',message:'Esta sala já começou e não aceita novos jogadores.'}));ws.close(4001,'Sala fechada');return}
   if(Object.keys(r.ps).length>=MAX_PLAYERS){ws.send(JSON.stringify({t:'error',message:'Sala cheia. O limite é de 4 jogadores.'}));ws.close(4002,'Sala cheia');return}
   const id=N++,data=cleanPlayerData(d);
   if(!Object.keys(r.ps).length){r.map=Math.max(0,Math.min(3,Math.floor(Number(d.map)||0)));r.hostId=id;if(r.publicRoom&&!r.autoStartAt)r.autoStartAt=Date.now()+12000}
   const player=mk(id,data.cls,data.name,data.up,data.it);r.ps[id]=player;ws.playerId=id;
   if(r.publicRoom&&Object.keys(r.ps).length>=MAX_PLAYERS)r.autoStartAt=Date.now()+1200;
   ws.send(JSON.stringify({t:'id',id,host:id===r.hostId,roomCode:r.k}));
   r.lastRoomBroadcast=0;roomMessage(r);return;
  }
  const p=r&&r.ps[ws.playerId];if(!p)return;
  if(d.t==='start'){
   if(p.id!==r.hostId||r.locked||r.started)return;
   r.autoStartAt=0;r.locked=true;r.startAt=Date.now()+5000;r.lastRoomBroadcast=0;roomMessage(r);return;
  }
  if(d.t==='in'){
   const dx=Number(d.dx),dy=Number(d.dy);
   if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
   const nx=Math.max(-1,Math.min(1,dx)),ny=Math.max(-1,Math.min(1,dy));
   if(nx||ny){p.dx=nx;p.dy=ny;p.stopAfterStep=0;p.stopRequested=0}
   else if(!p.stopRequested&&(p.dx||p.dy)){p.stopAfterStep=1;p.stopRequested=1}
  }else if(d.t==='pick'){
   const choice=Number(d.i);if(Number.isInteger(choice)&&choice>=0&&choice<3)pick(p,choice);
  }
 });
 ws.on('close',()=>{
  if(r&&ws.playerId&&r.ps[ws.playerId]){
   delete r.ps[ws.playerId];
   if(r.hostId===ws.playerId&&!r.started)r.hostId=Number(Object.keys(r.ps)[0]||0);
   r.lastRoomBroadcast=0;
   if(!Object.keys(r.ps).length){delete rooms[r.k];return}
   roomMessage(r);
  }
 });
});
srv.listen(process.env.PORT||3000);
