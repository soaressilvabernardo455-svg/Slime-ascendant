const http=require('http'),fs=require('fs'),crypto=require('crypto'),{WebSocketServer}=require('ws');
const R=Math.random,PW=['proj','orb','nova','raio','aura','meteoro','lanca','corrente','espinhos','furacao'],PS=['vida','dano','vel','recarga','ima','regen','xp','armadura','crit','sorte'];
const DIFFICULTIES={easy:{hp:.78,damage:.68,speed:.9,spawn:1.28,xp:1.12},medium:{hp:1,damage:1,speed:1,spawn:1,xp:1},hard:{hp:1.3,damage:1.28,speed:1.08,spawn:.9,xp:1.3},inferno:{hp:1.65,damage:1.7,speed:1.13,spawn:.84,xp:1.55}};
const BOSS_TICKS=[4500,9000,13500,18000],RUN_DURATION_TICKS=18000;
const CLASS_MAIN_POWER={normal:'proj',mago:'raio',cavaleiro:'orb',necromante:'nova',curandeiro:'aura',arqueiro:'proj'};
const CLASS_POWER_OWNER={orb:'cavaleiro',nova:'necromante',raio:'mago',aura:'curandeiro'};
const CLS={normal:{hp:100,sp:4.8,dm:.8,pw:'proj'},mago:{hp:70,sp:4.8,dm:.92,pw:'raio'},cavaleiro:{hp:150,sp:4.2,dm:1.05,pw:'orb'},necromante:{hp:85,sp:4.8,dm:1,pw:'nova'},curandeiro:{hp:110,sp:4.8,dm:.7,pw:'aura',heal:1},arqueiro:{hp:80,sp:5.2,dm:.9,pw:'proj',pr:2}};
const ET=[{h:w=>18+w*9,r:10,v:1.4,d:7,c:1,x:5},{h:w=>10+w*5,r:8,v:2.4,d:5,c:2,x:3},{h:w=>55+w*15,r:16,v:.9,d:14,c:6,x:20},{h:w=>300+w*55,r:26,v:.8,d:20,c:18,x:100},{h:w=>14+w*6,r:11,v:1.9,d:6,c:1,x:6},{h:w=>30+w*8,r:12,v:1.6,d:9,c:2,x:9},{h:w=>70+w*14,r:13,v:.7,d:10,c:2,x:22},{h:w=>5+w*1.2,r:7,v:2.25,d:1.5,c:1,x:2}];
const rooms=Object.create(null);let N=1,roomSequence=1;const ITEMS=['espada','escudo','botas','amuleto','anel','coracao'];const presence=new Map(),PRESENCE_TTL_MS=45000;
const DEV_ACCESS_CODE=String(process.env.SLIME_DEV_ACCESS_CODE||'6767');const devTokens=new Map(),devAttempts=new Map();
function pruneDevState(now=Date.now()){for(const [token,expiry] of devTokens)if(expiry<=now)devTokens.delete(token);for(const [ip,item] of devAttempts)if(now-item.startedAt>10*60*1000)devAttempts.delete(ip);if(devTokens.size>500){for(const token of devTokens.keys()){devTokens.delete(token);if(devTokens.size<=400)break}}if(devAttempts.size>2000){for(const ip of devAttempts.keys()){devAttempts.delete(ip);if(devAttempts.size<=1500)break}}}
function validDevToken(token){if(typeof token!=='string'||token.length!==64)return false;const expiry=devTokens.get(token);if(!expiry)return false;if(expiry<=Date.now()){devTokens.delete(token);return false}return true}
function randomSubset(items,count){const copy=items.slice(),take=Math.min(copy.length,Math.max(0,count|0));for(let i=0;i<take;i++){const j=i+Math.floor(R()*(copy.length-i));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy.slice(0,take)}
function sendJson(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload))}
async function readSmallJson(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2048)throw new Error('REQUEST_TOO_LARGE');chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new Error('INVALID_JSON')}}
const MAX_PLAYERS=4,MAX_CONNECTIONS=40,MAX_MESSAGE_RATE=45,VIEW_RADIUS=640,UPGRADE_KEYS=['vida','dano','vel','moeda'];
function allowMessage(ws){const now=Date.now();if(!ws.rateWindow||now-ws.rateWindow>=1000){ws.rateWindow=now;ws.rateCount=0}ws.rateCount++;return ws.rateCount<=MAX_MESSAGE_RATE}
function newRoom(k){return{k,ps:{},started:false,locked:false,startAt:0,hostId:0,lastRoomBroadcast:0,lastSnapshotAt:0,publicRoom:k==='geral',devRoom:null,autoStartAt:0,difficulty:'medium',bossIndex:0,pendingBossTiers:[],bossActive:false,activeBossTier:0,completed:false,arena:null,lastHordeWave:0}}
function roomForJoin(key){if(key==='geral'){let room=rooms.geral;if(room&&(room.locked||room.started||Object.keys(room.ps||{}).length>=MAX_PLAYERS)){const archived='@public-'+roomSequence++;room.k=archived;rooms[archived]=room;delete rooms.geral;room=null}if(!room)room=rooms.geral=newRoom('geral');return room}return rooms[key]||(rooms[key]=newRoom(key))}
const BLOCKED_NAME_WORDS=['admin','administrator','moderador','moderator','staff','owner','suporte','support','system','developer','porra','caralho','merda','bosta','puta','puto','foda','foder','viado','piranha','cacete','buceta','nazi','hitler','babaca','idiota','imbecil','putinha','putinhas','putaria','fdp','vtnc','arrombado','arrombada','desgraca','corno','escroto','otario','otaria','vagabundo','vagabunda'];
function normalizePlayerName(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/6/g,'g').replace(/7/g,'t').replace(/8/g,'b').replace(/@/g,'a').replace(/\$/g,'s')}
function isAllowedPlayerName(value){const name=String(value||'Slime').trim();if(!name||[...name].length>15)return false;const normalized=normalizePlayerName(name);if(!/^[a-z0-9_ -]+$/.test(normalized))return false;const tokens=normalized.split(/[_ -]+/).filter(Boolean);return !BLOCKED_NAME_WORDS.some(word=>tokens.some(token=>token===word||(token.startsWith(word)&&token.length-word.length<=3)))}
function cleanPlayerData(data){data=data&&typeof data==='object'?data:{};const cls=Object.prototype.hasOwnProperty.call(CLS,data.cls)?data.cls:'normal',candidate=String(data.name||'Slime').replace(/[<>]/g,'').trim().slice(0,15)||'Slime',name=isAllowedPlayerName(candidate)?candidate:'Slime',up={};for(const key of UPGRADE_KEYS){const n=Number(data.up&&data.up[key]);up[key]=Number.isFinite(n)?Math.max(0,Math.min(10,Math.floor(n))):0}const it=Array.isArray(data.it)?[...new Set(data.it.filter(key=>ITEMS.includes(key)))].slice(0,ITEMS.length):[];const options=data.devOptions&&typeof data.devOptions==='object'?data.devOptions:{};const devOptions={coins:!!options.coins,crystals:!!options.crystals,items:!!options.items,run:!!options.run};return{cls,name,up,it,devOptions}}
const cl=v=>Math.max(-1000000000000,Math.min(1000000000000,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const html=fs.readFileSync(__dirname+'/index.html');
const {handleAuthRequest}=require('./auth');
const srv=http.createServer(async(q,s)=>{
 const path=new URL(q.url,'http://x').pathname;
 if(path==='/api/dev/unlock'||path==='/api/dev/lock'){
  if(q.method!=='POST'){sendJson(s,405,{error:'Método não permitido.'});return}
  const origin=q.headers.origin;if(origin){try{if(new URL(origin).host.toLowerCase()!==String(q.headers.host||'').toLowerCase()){sendJson(s,403,{error:'Origem não permitida.'});return}}catch{sendJson(s,403,{error:'Origem não permitida.'});return}}
  const ip=String(q.headers['x-forwarded-for']||q.socket.remoteAddress||'unknown').split(',')[0].trim(),now=Date.now();pruneDevState(now);let attempt=devAttempts.get(ip);if(!attempt||now-attempt.startedAt>10*60*1000){attempt={startedAt:now,count:0};devAttempts.set(ip,attempt)}if(attempt.count>=8){sendJson(s,429,{error:'Muitas tentativas. Aguarde alguns minutos.'});return}
  try{const body=await readSmallJson(q),token=typeof body.token==='string'?body.token:'';if(path==='/api/dev/lock'){devTokens.delete(token);sendJson(s,200,{ok:true});return}attempt.count++;const supplied=Buffer.from(typeof body.code==='string'?body.code:'','utf8'),expected=Buffer.from(DEV_ACCESS_CODE,'utf8');if(!DEV_ACCESS_CODE||supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected)){sendJson(s,401,{error:'Código de desenvolvedor incorreto.'});return}if(devTokens.size>=500){sendJson(s,503,{error:'Muitas sessões de teste ativas. Tente novamente mais tarde.'});return}const session=crypto.randomBytes(32).toString('hex'),expiresAt=now+12*60*60*1000;devTokens.set(session,expiresAt);sendJson(s,200,{token:session,expiresAt});return}catch(error){sendJson(s,error.message==='REQUEST_TOO_LARGE'?413:400,{error:'Não foi possível processar o pedido.'});return}
 }
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

function mk(id,cls,name,up,it,devMode=false,devOptions={}){const data=cleanPlayerData({cls,name,up,it,devOptions});cls=data.cls;name=data.name;up=data.up;const flags=devMode?data.devOptions:{coins:false,crystals:false,items:false,run:false};it=flags.items?ITEMS.slice():data.it;const c=CLS[cls],u={};for(const k of UPGRADE_KEYS)u[k]=flags.items?10:data.up[k];const mh=flags.run?1000000:Math.round(c.hp*(1+.1*u.vida)*(it.includes('coracao')?1.25:1));const p={id,name,cls,u,up,it,x:800+R()*100,y:800+R()*100,hp:mh,mh,lv:1,xp:0,nx:5,pw:{[c.pw]:1},ps:{},cd:{},dx:0,dy:0,stopAfterStep:0,stopRequested:0,ch:null,chType:'',choiceExpiresAt:0,rerolls:3,d:0,co:flags.coins?999999999:0,cr:flags.crystals?999999999:0,devMode:!!devMode,devFlags:flags,buildRewardClaimed:false,sk:[],skTimer:0};return p}
function reset(r){r.es=[];r.sh=[];r.gm=[];r.hr=[];r.ch=[];r.loot=[];r.fx=[];r.ob=[];r.wave=1;r.t=0;r.sp=105;r.ov=0;r.bossIndex=0;r.pendingBossTiers=[];r.bossActive=false;r.activeBossTier=0;r.completed=false;r.arena=null;r.lastHordeWave=0;
 for(const i in r.ps){const p=r.ps[i];r.ps[i]=mk(+i,p.cls,p.name,p.up,p.it,p.devMode,p.devFlags)}}
function maxedCount(values){return Object.values(values||{}).filter(value=>Number(value)>=5).length}
function progressionPool(p){const ownedP=Object.keys(p.pw||{}).filter(k=>(p.pw[k]||0)>0).length,ownedS=Object.keys(p.ps||{}).filter(k=>(p.ps[k]||0)>0).length,maxedP=maxedCount(p.pw),unlimited=!!(p.devMode&&p.devFlags&&p.devFlags.run);const powers=PW.filter(k=>{const owner=CLASS_POWER_OWNER[k];if(owner&&p.cls!==owner)return false;const level=p.pw[k]||0;if(level>=5&&!unlimited)return false;if(level===4&&maxedP>=3&&!unlimited)return false;return level>0||ownedP<5||unlimited}).map(k=>'p:'+k);const passives=PS.filter(k=>{const level=p.ps[k]||0;if(level>=5&&!unlimited)return false;return level>0||ownedS<5||unlimited}).map(k=>'s:'+k);return [...powers,...passives]}
function maybeBuildReward(p){if(p.buildRewardClaimed||maxedCount(p.pw)<3||maxedCount(p.ps)<5)return false;p.ch=['r:coins','r:crystals'];p.chType='reward';p.choiceExpiresAt=0;return true}
function lv(p){p.lv++;p.xp-=p.nx;p.nx=Math.ceil(p.nx*1.17+1.4);const pool=progressionPool(p),shuffled=randomSubset(pool,pool.length),choices=shuffled.slice(0,3);p.ch=choices.slice(0,3);p.chType=p.ch.length?'level':'';p.choiceExpiresAt=0;if(!p.ch.length)p.ch=null;maybeBuildReward(p)}
function rerollSkills(p){if(!p.ch||p.chType!=='level')return;const pool=progressionPool(p),alternatives=pool.filter(option=>!p.ch.includes(option)),source=alternatives.length?alternatives:pool,choices=randomSubset(source,Math.min(3,source.length));if(!choices.length)return;if((p.rerolls||0)>0)p.rerolls--;else if(p.devFlags&&p.devFlags.crystals){}else if(p.cr>=10)p.cr-=10;else return;p.ch=choices;p.chType='level'}
function pick(p,i){const o=p.ch&&p.ch[+i];if(!o)return;if(p.chType==='reward'){if(o==='r:coins'){if(!(p.devFlags&&p.devFlags.coins))p.co+=500}else if(o==='r:crystals'){if(!(p.devFlags&&p.devFlags.crystals))p.cr+=25}else return;p.buildRewardClaimed=true;p.ch=null;p.chType='';p.choiceExpiresAt=0;if(p.xp>=p.nx)lv(p);return}if(o[0]!=='p'&&o[0]!=='s')return;const k=o.slice(2),values=o[0]==='p'?p.pw:p.ps,owned=Object.keys(values).filter(a=>(values[a]||0)>0),unlimited=!!(p.devMode&&p.devFlags&&p.devFlags.run);if(!unlimited&&values[k]>=5)return;if(o[0]==='p'){if(!unlimited&&values[k]===4&&maxedCount(p.pw)>=3)return;if(!(values[k]>0)&&owned.length>=5&&!unlimited)return;values[k]=(values[k]||0)+1}else{if(!(values[k]>0)&&owned.length>=5&&!unlimited)return;values[k]=(values[k]||0)+1;if(k==='vida'){const b=CLS[p.cls].hp*.2;p.mh+=b;p.hp+=b}}p.ch=null;p.chType='';p.choiceExpiresAt=0;if(!maybeBuildReward(p)&&p.xp>=p.nx)lv(p)}
function spawn(r,L,ty){if(!L.length)return;const w=r.wave,p=L[R()*L.length|0],a=R()*6.28,E=ET[ty],difficulty=DIFFICULTIES[r.difficulty]||DIFFICULTIES.medium,hp=E.h(w)*(difficulty.hp||1)*(1+.25*(L.length-1));r.es.push({x:cl(p.x+Math.cos(a)*420),y:cl(p.y+Math.sin(a)*420),ty,hp,mh:hp,r:E.r,v:E.v*(difficulty.speed||1),d:E.d*(difficulty.damage||1),attackCooldown:0})}
function spawnBoss(r,L,tier){const players=L.filter(p=>!p.d);if(!players.length)return;const center=players.reduce((a,p)=>({x:a.x+p.x/players.length,y:a.y+p.y/players.length}),{x:0,y:0}),difficulty=DIFFICULTIES[r.difficulty]||DIFFICULTIES.medium,base=ET[3],scale=1+.8*(tier-1),hp=base.h(r.wave)*scale*(difficulty.hp||1)*(1+.22*(players.length-1));r.es=[];r.sh=[];r.gm=[];r.hr=[];r.loot=[];r.arena={x:center.x,y:center.y,radius:620};r.bossActive=true;r.activeBossTier=tier;r.sp=9999;r.es.push({x:center.x+140,y:center.y-80,ty:3,hp,mh:hp,r:base.r+4*(tier-1),v:base.v*(difficulty.speed||1)*(.9+.08*tier),d:base.d*(difficulty.damage||1)*(1+.55*(tier-1)),attackCooldown:0,isBoss:true,bossTier:tier});r.fx.push(['n',center.x|0,center.y|0,260+35*tier,0,24])}
function dropChest(r,x,y,type){if(!Array.isArray(r.ch))r.ch=[];if(r.ch.length>=12){if(type==='boss')r.ch.shift();else return}const choices=['coin','coin','gem','gem','heal','medkit','bomb'],kind=type||choices[Math.floor(R()*choices.length)],hp=kind==='boss'?96:48;r.ch.push({x:cl(x),y:cl(y),type:kind,hp,maxHp:hp,life:2100,broken:false})}
function addLoot(r,x,y,type,amount){if(!Array.isArray(r.loot))r.loot=[];if(r.loot.length>=60)r.loot.shift();r.loot.push({x:cl(x),y:cl(y),type,amount:Math.max(1,Math.floor(amount||1)),life:1800})}
function chestUpgradePool(p){return progressionPool(p)}
function breakChest(r,q,L){if(q.broken)return;q.broken=true;r.fx.push(['a',q.x|0,q.y|0,34,0,12],['l',q.x|0,q.y|0,q.type,0,70]);if(q.type==='boss'){for(const p of L){if(p.d)continue;if(!(p.devFlags&&p.devFlags.coins))p.co+=250;if(!(p.devFlags&&p.devFlags.crystals))p.cr+=12;p.hp=Math.min(p.mh,p.hp+Math.ceil(p.mh*.35));if(!p.ch){p.ch=randomSubset(chestUpgradePool(p),3);p.chType=p.ch.length?'boss':'';p.choiceExpiresAt=p.ch.length?Date.now()+30000:0}}addLoot(r,q.x-24,q.y,'coin',250);addLoot(r,q.x+24,q.y,'gem',12);addLoot(r,q.x,q.y+22,'medkit',1);return}addLoot(r,q.x,q.y,q.type,q.type==='coin'?25+Math.floor(R()*41):q.type==='gem'?1+Math.floor(R()*3):1)}
function damageChests(r,x,y,range,damage,L){if(!(damage>0))return;const point={x,y};for(const q of r.ch||[]){if(q.broken||dist(q,point)>range+14)continue;q.hp=Math.max(0,(Number(q.hp)||48)-damage);if(q.hp<=0)breakChest(r,q,L)}}
function dropChestNearPlayer(r,L){if(!L.length)return;const p=L[Math.floor(R()*L.length)],a=R()*Math.PI*2,d=110+R()*110;dropChest(r,p.x+Math.cos(a)*d,p.y+Math.sin(a)*d)}
function step(r,L){if(r.completed)return;r.t++;r.ob=[];
 if(r.bossIndex<4&&r.t>=BOSS_TICKS[r.bossIndex]){r.bossIndex++;r.pendingBossTiers.push(r.bossIndex)}
 if(!r.bossActive&&r.pendingBossTiers.length)spawnBoss(r,L,r.pendingBossTiers.shift());
 if(r.t%600===0&&!r.bossActive){r.wave++;if(r.wave%2===0)for(const p of L)if(!(p.devFlags&&p.devFlags.crystals))p.cr++;if(r.wave%2===0)dropChestNearPlayer(r,L)}
 if(!r.bossActive&&--r.sp<1){const w=r.wave,difficulty=DIFFICULTIES[r.difficulty]||DIFFICULTIES.medium;r.sp=Math.max(120,Math.round((180-Math.min(w,18)*2)*(difficulty.spawn||1)));
  if(r.es.length<42)for(let i=0,n=1+Math.floor(w/8)+Math.max(0,L.length-1);i<n&&r.es.length<42;i++){const q=R();spawn(r,L,w>3&&q<.1?5:w>4&&q<.18?6:w>2&&q<.38?4:w>2&&q<.5?2:q<.74?1:0)}
  if(w>=4&&w%4===0&&r.lastHordeWave!==w){r.lastHordeWave=w;for(let i=0;i<16&&r.es.length<42;i++)spawn(r,L,7)}
 }
 for(const p of L){
  if(p.ch)continue;
  const c=CLS[p.cls],m=Math.hypot(p.dx,p.dy);if(m>1){p.dx/=m;p.dy/=m}
  const sp=c.sp*(1+.1*(p.ps.vel||0))*(1+.04*p.u.vel)*(p.it.includes('botas')?1.08:1);p.x=cl(p.x+p.dx*sp);p.y=cl(p.y+p.dy*sp);if(r.arena){const ax=p.x-r.arena.x,ay=p.y-r.arena.y,ad=Math.hypot(ax,ay)||1,limit=r.arena.radius-22;if(ad>limit){p.x=r.arena.x+ax/ad*limit;p.y=r.arena.y+ay/ad*limit;if(r.t%30===0){p.hp=Math.max(0,p.hp-8);r.fx.push(['a',p.x|0,p.y|0,26,0,5]);if(p.hp<=0){p.d=1;p.ch=null}}}}if(p.stopAfterStep>0&&--p.stopAfterStep===0){p.dx=0;p.dy=0;p.stopRequested=0}
  const dm=c.dm*(1+.15*(p.ps.dano||0))*(1+.08*p.u.dano)*(p.it.includes('espada')?1.12:1),cd=Math.max(.35,1-.1*(p.ps.recarga||0)),l=p.pw,hit=d=>d*(R()<Math.min(.6,.05*(p.ps.crit||0))?2:1);
  const near=g=>{let b=null;for(const e of r.es){const d=dist(e,p);if(d<g){g=d;b=e}}return b};
  const nearChest=g=>{let b=null;for(const q of r.ch||[]){if(q.broken)continue;const d=dist(q,p);if(d<g){g=d;b=q}}return b};
  const rdy=(k,t)=>{p.cd[k]=(p.cd[k]||0)-1;if(p.cd[k]<=0){p.cd[k]=t*cd;return 1}};
  if(p.cls==='cavaleiro'&&rdy('knightSword',48)){const target=near(165);if(target){target.hp-=hit(20*dm);r.fx.push(['s',p.x|0,p.y|0,target.x|0,target.y|0,7])}else p.cd.knightSword=0;damageChests(r,p.x,p.y,165,hit(18*dm),L)}
  if(p.cls==='cavaleiro'){p.shieldTimer=(p.shieldTimer||0)+1;if(p.shieldTimer>=210){p.shieldTimer=0;p.shieldUntil=r.t+42;r.fx.push(['n',p.x|0,p.y|0,66,0,7])}}
  
  if(l.proj&&rdy('proj',18)){const e=near(420),ch=nearChest(420),target=ch&&(!e||dist(ch,p)<dist(e,p))?ch:e;
   if(target){const n=1+(l.proj>2)+(l.proj>4)+(l.proj>=5?2:0),a0=Math.atan2(target.y-p.y,target.x-p.x);
    const signature=p.cls==='normal'&&l.proj>=5,archerMaster=p.cls==='arqueiro'&&l.proj>=5,shots=archerMaster?9:n;for(let i=0;i<shots;i++){const a=a0+(i-(shots-1)/2)*(archerMaster?.15:.2);r.sh.push({x:p.x,y:p.y,vx:Math.cos(a)*9,vy:Math.sin(a)*9,d:hit((7+3*l.proj)*(l.proj>=5?1.35:1)*dm),life:45,pr:(c.pr||0)+(l.proj>=5?5:0)+(archerMaster?4:0),targetChest:target===ch,tx:target.x,ty:target.y,burst:signature?58:0,burstDamage:hit((7+3*l.proj)*dm)*.55,special:signature?1:archerMaster?2:0})}}
   else p.cd.proj=0}
  if(p.cls==='cavaleiro'&&l.orb){const orbMax=l.orb>=5,n=orbMax?6:1+l.orb,radius=orbMax?82:65,spin=orbMax?.19:.1;for(let i=0;i<n;i++){const a=r.t*spin+i*6.283/n,o={x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius};r.ob.push([o.x|0,o.y|0,orbMax?1:0]);
   for(const e of r.es)if(dist(e,o)<e.r+10)e.hp-=hit(.3*(1+l.orb*.3)*(orbMax?1.8:1)*dm)}}
  if(p.cls==='necromante'&&l.nova&&rdy('nova',90)){const rr=90+12*l.nova+(l.nova>=5?48:0);r.fx.push(['n',p.x|0,p.y|0,rr,0,6]);
   for(const e of r.es)if(dist(e,p)<rr+e.r){e.hp-=hit((10+5*l.nova)*dm);if(l.nova>=5)r.fx.push(['sky',e.x|0,e.y|0,28,'shadow',18])}damageChests(r,p.x,p.y,rr,hit((10+5*l.nova)*dm),L)}
  if(p.cls==='mago'&&l.raio&&rdy('raio',45)){const master=l.raio>=5,range=master?520:380,limit=master?14:10,hits=randomSubset(r.es.filter(e=>dist(e,p)<range),Math.min(limit,1+l.raio+(master?8:4))),hitSet=new Set(hits);hits.forEach(e=>{const bolt=hit((14+4*l.raio)*(master?1.5:1)*dm);e.hp-=bolt;r.fx.push(['r',p.x|0,p.y|0,e.x|0,e.y|0,5],['sky',e.x|0,e.y|0,25,'lightning',18]);damageChests(r,e.x,e.y,18,bolt,L);if(master){const chain=r.es.filter(q=>q!==e&&!hitSet.has(q)&&dist(q,e)<105).sort((a,b)=>dist(a,e)-dist(b,e)).slice(0,2);for(const q of chain){hitSet.add(q);q.hp-=bolt*.55;r.fx.push(['r',e.x|0,e.y|0,q.x|0,q.y|0,5],['sky',q.x|0,q.y|0,20,'lightning',18]);damageChests(r,q.x,q.y,18,bolt*.55,L)}}})}
  if(l.meteoro&&rdy('meteoro',120)){const e=near(450);if(e){const rr=60+6*l.meteoro;r.fx.push(['sky',e.x|0,e.y|0,rr,'meteor',18],['n',e.x|0,e.y|0,rr,0,8]);for(const q of r.es)if(dist(q,e)<rr+q.r)q.hp-=hit((25+8*l.meteoro)*dm);damageChests(r,e.x,e.y,rr,hit((25+8*l.meteoro)*dm),L)}else p.cd.meteoro=0}
  if(p.cls==='curandeiro'&&l.aura){const master=l.aura>=5,rr=50+8*l.aura+(master?95:45);for(const e of r.es)if(dist(e,p)<rr+e.r)e.hp-=hit((.3+.12*l.aura)*(master?1.5:1)*dm);if(r.t%18===0)damageChests(r,p.x,p.y,rr,hit((3+1.5*l.aura)*(master?1.5:1)*dm),L)}
  if(l.lanca&&rdy('lanca',58)){const e=near(520),ch=nearChest(520),target=ch&&(!e||dist(ch,p)<dist(e,p))?ch:e;if(target){const a=Math.atan2(target.y-p.y,target.x-p.x);r.sh.push({x:p.x,y:p.y,vx:Math.cos(a)*12,vy:Math.sin(a)*12,d:hit((20+7*l.lanca)*dm),life:48,pr:5,targetChest:target===ch,tx:target.x,ty:target.y})}else p.cd.lanca=0}
  if(l.corrente&&rdy('corrente',72)){let from=p;const chain=r.es.filter(e=>dist(e,p)<430).sort((a,b)=>dist(a,p)-dist(b,p)).slice(0,Math.min(10,2+l.corrente+(l.corrente>=5?3:0)));for(const e of chain){e.hp-=hit((13+5*l.corrente)*dm);r.fx.push(['r',from.x|0,from.y|0,e.x|0,e.y|0,5]);damageChests(r,e.x,e.y,16,hit((13+5*l.corrente)*dm),L);from=e}}
  if(l.espinhos&&rdy('espinhos',24)){const rr=82+9*l.espinhos;r.fx.push(['n',p.x|0,p.y|0,rr,0,5]);for(const e of r.es)if(dist(e,p)<rr+e.r)e.hp-=hit((8+3*l.espinhos)*dm);damageChests(r,p.x,p.y,rr,hit((8+3*l.espinhos)*dm),L)}
  if(l.furacao&&rdy('furacao',150)){const rr=135+12*l.furacao;r.fx.push(['n',p.x|0,p.y|0,rr,0,9]);for(const e of r.es)if(dist(e,p)<rr+e.r){e.hp-=hit((28+9*l.furacao)*dm);const a=Math.atan2(e.y-p.y,e.x-p.x);e.x=cl(e.x+Math.cos(a)*18);e.y=cl(e.y+Math.sin(a)*18)}damageChests(r,p.x,p.y,rr,hit((28+9*l.furacao)*dm),L)}
  if(p.lv>=5&&rdy('ascensao',540)){const rr=150;for(const e of r.es)if(dist(e,p)<rr+e.r)e.hp-=hit((24+4*p.lv)*dm);damageChests(r,p.x,p.y,rr,hit((24+4*p.lv)*dm),L);p.hp=Math.min(p.mh,p.hp+Math.ceil(p.mh*.08));r.fx.push(['a',p.x|0,p.y|0,rr,0,18])}
  if(r.difficulty!=='inferno'&&r.t%30===0)p.hp=Math.min(p.mh,p.hp+Math.max(1,Math.ceil(p.mh*.005))+(p.ps.regen||0));
  if(c.heal&&r.t%(l.aura>=5?45:60)===0)for(const q of L)if(!q.d&&dist(q,p)<(l.aura>=5?300:220)){const healed=Math.min(q.mh,q.hp+(l.aura>=5?14:8));if(healed>q.hp&&l.aura>=5)r.fx.push(['sky',q.x|0,q.y|0,20,'heal',18]);q.hp=healed}
   if(r.t%20===0)damageChests(r,p.x,p.y,220,hit(16*dm),L)}
 if(r.sh.length>80)r.sh.splice(0,r.sh.length-80);
 for(let ei=0;ei<r.es.length;ei++){const e=r.es[ei];let b=null,bd=1e9,isSkeleton=false;for(const p of L){if(p.d)continue;const d=dist(p,e);if(d<bd){bd=d;b=p;isSkeleton=false}}for(const owner of L){for(const sk of owner.sk||[]){if(sk.hp<=0)continue;const d=dist(sk,e);if(d<bd){bd=d;b=sk;isSkeleton=true}}}
  if(!b)continue;
  let separateX=0,separateY=0;for(let oi=0;oi<r.es.length;oi++){if(oi===ei)continue;const other=r.es[oi],dx=e.x-other.x,dy=e.y-other.y,d=Math.hypot(dx,dy),gap=e.r+other.r+28;if(d<gap){const angle=d>.001?Math.atan2(dy,dx):(ei-oi)*2.399963229728653,force=Math.min(3,(gap-d)/gap*4);separateX+=Math.cos(angle)*force;separateY+=Math.sin(angle)*force}}
  let nx=e.x+(bd>0?(b.x-e.x)/bd:0)*e.v+separateX*3,ny=e.y+(bd>0?(b.y-e.y)/bd:0)*e.v+separateY*.95;const stopGap=e.r+(isSkeleton?14:27),nd=Math.hypot(nx-b.x,ny-b.y);if(nd<stopGap){const angle=nd>.001?Math.atan2(ny-b.y,nx-b.x):(r.t*.17+e.ty*2.4);nx=b.x+Math.cos(angle)*stopGap;ny=b.y+Math.sin(angle)*stopGap}e.x=cl(nx);e.y=cl(ny);
  const contact=dist(b,e);if(contact<e.r+(isSkeleton?18:38)){e.attackCooldown=(e.attackCooldown||0)-1;if(e.attackCooldown<=0){if(isSkeleton){b.hp=Math.max(0,b.hp-Math.max(1,e.d*.8));e.attackCooldown=65}else if(b.cls==='cavaleiro'&&(b.shieldUntil||0)>=r.t){e.attackCooldown=24;r.fx.push(['n',b.x|0,b.y|0,54,0,4])}else{const armor=Math.min(.85,.08*(b.ps.armadura||0)),damage=Math.max(1,e.d*(1-armor)*(b.it.includes('escudo')?.85:1));b.hp=Math.max(0,b.hp-damage);e.attackCooldown=75;if(b.hp===0){b.d=1;b.ch=null}}}}else if(e.attackCooldown>0)e.attackCooldown--}
 r.sh=r.sh.filter(s=>{if(s.targetChest){const angle=Math.atan2(s.ty-s.y,s.tx-s.x);s.vx=Math.cos(angle)*9;s.vy=Math.sin(angle)*9}s.x+=s.vx;s.y+=s.vy;if(--s.life<1)return 0;const hc=s.hc||(s.hc=new Set());if(s.targetChest){for(const q of r.ch||[])if(!q.broken&&!hc.has(q)&&dist(q,s)<25){hc.add(q);q.hp=Math.max(0,(Number(q.hp)||48)-s.d);if(q.hp<=0)breakChest(r,q,L);return 0}return 1}const h=s.h||(s.h=new Set());for(const e of r.es)if(e.hp>0&&!h.has(e)&&dist(e,s)<e.r+4){h.add(e);e.hp-=s.d;if(s.burst&&!s.burstUsed){s.burstUsed=1;for(const other of r.es)if(other!==e&&other.hp>0&&dist(other,e)<s.burst+other.r)other.hp-=s.burstDamage||s.d*.55;r.fx.push(['n',e.x|0,e.y|0,s.burst,0,6])}if(s.special===2)r.fx.push(['sky',e.x|0,e.y|0,s.burst||35,'arrow',18]);if(s.pr-->0)continue;return 0}for(const q of r.ch||[])if(!q.broken&&!hc.has(q)&&dist(q,s)<23){hc.add(q);q.hp=Math.max(0,(Number(q.hp)||48)-s.d);if(q.hp<=0)breakChest(r,q,L);if(s.pr-->0)continue;return 0}return 1});
 r.es=r.es.filter(e=>{if(e.hp>0)return 1;const E=ET[e.ty],difficulty=DIFFICULTIES[r.difficulty]||DIFFICULTIES.medium,xp=E.x*(difficulty.xp||1)*(1+Math.max(0,r.wave-1)*.025);r.gm.push({x:e.x,y:e.y,v:xp,life:1800});if(r.gm.length>42)r.gm.splice(0,r.gm.length-42);if(R()<.09){r.hr.push({x:e.x,y:e.y,life:1800});if(r.hr.length>28)r.hr.shift()}if(e.isBoss){r.bossActive=false;r.arena=null;r.activeBossTier=0;r.sp=120;dropChest(r,e.x,e.y,'boss');if((e.bossTier||1)>=4)r.completed=true}else if(e.ty===3)dropChest(r,e.x,e.y,'boss');else if(R()<.3)dropChest(r,e.x,e.y);
 for(const p of L){if(p.d)continue;const luckMultiplier=1+.1*(p.u.moeda||0)+.1*(p.ps.sorte||0);if(!(p.devFlags&&p.devFlags.coins))p.co+=Math.ceil(E.c*luckMultiplier*(p.it.includes('anel')?1.15:1));if(!(p.devFlags&&p.devFlags.crystals)){if(e.ty===2&&R()<.12)p.cr++;if(e.ty===3)p.cr+=3;if(e.isBoss)p.cr+=4}}return 0});
r.gm=r.gm.filter(g=>{if(--g.life<=0)return 0;for(const p of L){if(p.d)continue;const d=dist(p,g)||1;if(d<14){p.xp+=g.v*(1+.15*(p.ps.xp||0))*(p.it.includes('amuleto')?1.15:1);if(p.xp>=p.nx&&!p.ch)lv(p);return 0}if(d<60*(1+.4*(p.ps.ima||0))){g.x+=(p.x-g.x)/d*5;g.y+=(p.y-g.y)/d*5;break}}return 1});
 const magnetRange=p=>260*(1+.8*(p.ps.ima||0));
 const pullToward=(item,p,d)=>{const speed=Math.min(16,6+(magnetRange(p)-d)*.055);item.x+=(p.x-item.x)/d*speed;item.y+=(p.y-item.y)/d*speed};
 r.hr=r.hr.filter(h=>{if(--h.life<=0)return 0;for(const p of L){if(p.d)continue;const d=dist(p,h)||1;if(d<26){p.hp=Math.min(p.mh,p.hp+25);return 0}if(d<magnetRange(p))pullToward(h,p,d)}return 1});
 r.loot=(r.loot||[]).filter(q=>{if(--q.life<=0)return 0;for(const p of L){if(p.d)continue;const d=dist(p,q)||1;if(d<28){if(q.type==='coin'&&!(p.devFlags&&p.devFlags.coins))p.co+=q.amount;if(q.type==='gem'&&!(p.devFlags&&p.devFlags.crystals))p.cr+=q.amount;if(q.type==='heal')p.hp=Math.min(p.mh,p.hp+18);if(q.type==='medkit')p.hp=Math.min(p.mh,p.hp+55);if(q.type==='bomb'){for(const e of r.es)if(dist(e,q)<175+e.r)e.hp-=65+r.wave*5;r.fx.push(['n',q.x|0,q.y|0,175,0,10])}r.fx.push(['l',q.x|0,q.y|0,q.type,0,70]);return 0}if(d<magnetRange(p))pullToward(q,p,d)}return 1});
 r.ch=(r.ch||[]).filter(q=>!q.broken&&--q.life>0);
 r.fx=r.fx.filter(f=>--f[5]>0);if(r.fx.length>160)r.fx.splice(0,r.fx.length-160);
 for(const p of L){if(p.cls!=='necromante'){p.sk=[];continue}const summonLevel=Math.max(1,Math.min(5,p.pw.nova||1)),maxSk=summonLevel>=5?10:2+summonLevel,spawnEvery=Math.max(45,90-summonLevel*8);p.sk=p.sk||[];p.skTimer=(p.skTimer||0)+1;if(p.skTimer>=spawnEvery){p.skTimer=0;for(let i=0;i<(summonLevel>=3?2:1)&&p.sk.length<maxSk;i++){const a=R()*Math.PI*2;p.sk.push({x:p.x+Math.cos(a)*28,y:p.y+Math.sin(a)*28,hp:summonLevel>=5?96:24+8*summonLevel,life:summonLevel>=5?1900:900+100*summonLevel,hit:0,special:summonLevel>=5})}}p.sk=p.sk.filter(k=>{if(--k.life<=0||k.hp<=0)return false;let e=null,bd=1e9;for(const q of r.es){const d=dist(k,q);if(d<bd){bd=d;e=q}}if(e){const d=Math.max(1,bd);if(d>24){k.x+=(e.x-k.x)/d*2.5;k.y+=(e.y-k.y)/d*2.5}else if(++k.hit>=30){k.hit=0;e.hp-=4+2*summonLevel+(summonLevel>=5?6:0)}}return true})}
}

function roomMessage(r){
 const players=Object.values(r.ps).map(p=>({id:p.id,name:p.name,cls:p.cls}));
 const now=Date.now(),countdown=r.startAt?Math.max(0,Math.ceil((r.startAt-now)/1000)):0;
 const autoStartIn=!r.started&&!r.locked&&r.publicRoom&&r.autoStartAt?Math.max(0,Math.ceil((r.autoStartAt-now)/1000)):0;
 const payload=JSON.stringify({t:'room',phase:r.started?'playing':r.locked?'countdown':'waiting',countdown,autoStartIn,hostId:r.hostId,roomCode:r.k,players});
 wss.clients.forEach(c=>{if(c.r!==r||c.readyState!==1)return;if(c.bufferedAmount>262144){c.close(1013,'Conexão lenta demais');return}c.send(payload)});
}
function snapshot(r,own){
 const P=Object.values(r.ps),L=P.filter(p=>!p.d),near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=VIEW_RADIUS;
 const visible=(x,y)=>Math.hypot(x-own.x,y-own.y)<=VIEW_RADIUS;
 const effects=r.fx.filter(f=>(f[0]==='n'||f[0]==='a'||f[0]==='sky')?visible(f[1],f[2]):visible(f[1],f[2])||visible(f[3],f[4]));
 return JSON.stringify({w:r.wave,mp:r.map|0,pa:!!own.ch,o:P.length>0&&!L.length?1:0,win:!!r.completed,time:r.t||0,difficulty:r.difficulty||'medium',bossTier:r.activeBossTier||r.bossIndex||0,bossActive:!!r.bossActive,arena:r.arena?[r.arena.x|0,r.arena.y|0,r.arena.radius|0]:null,
  k:P.flatMap(p=>(p.sk||[]).filter(q=>visible(q.x,q.y)).map(q=>[q.x|0,q.y|0,q.special?1:0])),p:P.map(p=>({id:p.id,n:p.name,c:p.cls,x:p.x|0,y:p.y|0,h:p.hp|0,m:p.mh|0,l:p.lv,xp:p.xp,nx:p.nx,d:p.d,pw:p.pw,ps:p.ps,ch:p.ch,chType:p.chType,rerolls:p.rerolls||0,it:p.it,shield:p.shieldUntil>r.t?p.shieldUntil-r.t:0,co:p.devFlags&&p.devFlags.coins?999999999:p.co,cr:p.devFlags&&p.devFlags.crystals?999999999:p.cr,dev:!!p.devMode,sp:+(CLS[p.cls].sp*(1+.1*(p.ps.vel||0))*(1+.04*p.u.vel)*(p.it.includes('botas')?1.08:1)).toFixed(2)})),
  e:r.es.filter(e=>visible(e.x,e.y)).map(e=>[e.x|0,e.y|0,e.ty,Math.max(0,e.hp/e.mh),e.bossTier||0]),
  s:r.sh.filter(q=>visible(q.x,q.y)).slice(-80).map(q=>[q.x|0,q.y|0,q.special||0]),
  b:r.ob.filter(q=>visible(q[0],q[1])),
  g:r.gm.filter(q=>visible(q.x,q.y)).slice(-30).map(q=>[q.x|0,q.y|0]),
  f:effects,hr:r.hr.filter(q=>visible(q.x,q.y)).map(q=>[q.x|0,q.y|0]),loot:(r.loot||[]).filter(q=>visible(q.x,q.y)).map(q=>[q.x|0,q.y|0,q.type,q.amount]),ch:(r.ch||[]).filter(q=>visible(q.x,q.y)).map(q=>[q.x|0,q.y|0,q.type,Math.max(0,q.hp/(q.maxHp||48))])});
}
function tick(r){
 const now=Date.now(),P=Object.values(r.ps),L=P.filter(p=>!p.d);
 if(!P.length)return;
 if(!r.started&&!r.locked&&r.publicRoom&&r.autoStartAt&&now>=r.autoStartAt){r.locked=true;r.startAt=now+3500;r.lastRoomBroadcast=0}
 if(!r.started){
  if(r.locked&&r.startAt&&now>=r.startAt){r.started=true;r.startAt=0;r.wave=1;r.t=0;r.sp=105;r.bossIndex=0;r.pendingBossTiers=[];r.bossActive=false;r.activeBossTier=0;r.completed=false;r.arena=null;r.lastHordeWave=0;roomMessage(r)}
  else{if(now-r.lastRoomBroadcast>=350){r.lastRoomBroadcast=now;roomMessage(r)}return}
 }
 for(const p of P)if(p.ch&&p.chType==='boss'&&p.choiceExpiresAt&&now>=p.choiceExpiresAt)pick(p,0);
 const alive=P.filter(p=>!p.d);
 // Só quem está escolhendo uma melhoria de nível fica parado e protegido.
 // Os demais jogadores continuam se movendo e jogando normalmente.
 const activePlayers=alive.filter(p=>!(p.ch&&p.chType==='level'));
 if(activePlayers.length)step(r,activePlayers);
 if(now-r.lastSnapshotAt<50)return;
 r.lastSnapshotAt=now;
 wss.clients.forEach(client=>{
  const own=client.r===r&&r.ps[client.playerId];
  if(!own||client.readyState!==1)return;
  if(client.bufferedAmount>524288){client.close(1013,'Conexão lenta demais');return}
  client.send(snapshot(r,own));
 });
}
setInterval(()=>{for(const k of Object.keys(rooms)){const r=rooms[k];try{tick(r)}catch(e){console.error('Room tick error:',e)}}},33);
setInterval(()=>{wss.clients.forEach(client=>{if(client.isAlive===false){client.terminate();return}client.isAlive=false;try{client.ping()}catch(error){client.terminate()}})},25000);
process.on('uncaughtException',e=>console.error(e));

wss.on('connection',(ws,rq)=>{
 if(wss.clients.size>MAX_CONNECTIONS){ws.close(1013,'Servidor temporariamente cheio');return}
 let k=(new URL(rq.url,'http://x').searchParams.get('s')||'geral').slice(0,12),r=null;
 if(!/^[a-zA-Z0-9_-]{1,12}$/.test(k))k='geral';
 ws.r=null;ws.playerId=0;ws.rateWindow=Date.now();ws.rateCount=0;ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true});
 ws.on('error',error=>console.warn('WebSocket error:',error&&error.message||'erro de socket'));
 ws.on('message',(raw)=>{
  if(!allowMessage(ws)){try{ws.close(1008,'Limite de mensagens excedido')}catch(e){}return}
  if(raw.length>2048){try{ws.close(1009,'Mensagem muito grande')}catch(e){}return}
  let d;try{d=JSON.parse(raw.toString())}catch{return}
  if(!d||typeof d!=='object'||Array.isArray(d))return;
  if(d.t==='join'&&!ws.playerId){
   if(!isAllowedPlayerName(d.name)){ws.send(JSON.stringify({t:'error',message:'Esse nome não é permitido. Escolha outro.'}));return}
   const devMode=validDevToken(d.devToken);
   if(devMode&&k==='geral'){ws.send(JSON.stringify({t:'error',message:'O modo de desenvolvedor precisa usar uma sala privada.'}));return}
   if(!r){r=roomForJoin(k);if(!r.es)reset(r)}
   if(r.devRoom===null||typeof r.devRoom==='undefined')r.devRoom=devMode;
   if(r.devRoom!==devMode){ws.send(JSON.stringify({t:'error',message:'Esta sala pertence a outro modo de jogo.'}));ws.close(4003,'Tipo de sala incompatível');return}
   if(r.locked||r.started){ws.send(JSON.stringify({t:'error',message:'Esta sala já começou e não aceita novos jogadores.'}));ws.close(4001,'Sala fechada');return}
   if(Object.keys(r.ps).length>=MAX_PLAYERS){ws.send(JSON.stringify({t:'error',message:'Sala cheia. O limite é de 4 jogadores.'}));ws.close(4002,'Sala cheia');return}
   ws.r=r;
   const id=N++,data=cleanPlayerData(d);
   if(!Object.keys(r.ps).length){r.map=Math.max(0,Math.min(3,Math.floor(Number(d.map)||0)));r.difficulty=Object.prototype.hasOwnProperty.call(DIFFICULTIES,d.difficulty)?d.difficulty:'medium';r.hostId=id;if(r.publicRoom&&!r.autoStartAt)r.autoStartAt=Date.now()+12000}
   const player=mk(id,data.cls,data.name,data.up,data.it,devMode,data.devOptions);if(r.difficulty==='inferno'){player.mh=Math.max(1,Math.floor(player.mh*.5));player.hp=player.mh}r.ps[id]=player;ws.playerId=id;
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
  }else if(d.t==='reroll'){rerollSkills(p)}
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
