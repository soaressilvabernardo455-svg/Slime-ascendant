const http=require('http'),fs=require('fs'),{WebSocketServer}=require('ws');
const R=Math.random,PW=['proj','orb','nova','raio','aura','meteoro'],PS=['vida','dano','vel','recarga','ima','regen','xp'];
const CLS={normal:{hp:100,sp:3.5,dm:.8,pw:'proj'},mago:{hp:70,sp:3.5,dm:1.1,pw:'raio'},cavaleiro:{hp:150,sp:3,dm:.9,pw:'orb'},necromante:{hp:85,sp:3.5,dm:1,pw:'nova'},curandeiro:{hp:110,sp:3.5,dm:.7,pw:'aura',heal:1},arqueiro:{hp:80,sp:3.8,dm:.9,pw:'proj',pr:2}};
const ET=[{h:w=>18+w*9,r:10,v:1.4,d:7,c:1,x:1},{h:w=>10+w*5,r:8,v:2.4,d:5,c:2,x:2},{h:w=>90+w*25,r:16,v:.9,d:14,c:6,x:5},{h:w=>500+w*90,r:26,v:.8,d:20,c:40,x:40},{h:w=>14+w*6,r:11,v:1.9,d:6,c:3,x:3},{h:w=>30+w*8,r:12,v:1.6,d:9,c:3,x:3},{h:w=>70+w*14,r:13,v:.7,d:10,c:4,x:4}];
const rooms={};let N=1;
const cl=v=>Math.max(10,Math.min(1590,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const html=fs.readFileSync(__dirname+'/index.html');
const srv=http.createServer((q,s)=>{s.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});s.end(html)});
const wss=new WebSocketServer({server:srv});

function mk(id,cls,name,up){cls=CLS[cls]?cls:'normal';const c=CLS[cls],u={};
 for(const k of['vida','dano','vel','moeda'])u[k]=Math.min(10,Math.max(0,Math.floor(+(up&&up[k])||0)));
 const mh=Math.round(c.hp*(1+.1*u.vida));
 return{id,name:String(name||'Slime').slice(0,10),cls,u,up,x:800+R()*100,y:800+R()*100,hp:mh,mh,lv:1,xp:0,nx:5,pw:{[c.pw]:1},ps:{},cd:{},dx:0,dy:0,ch:null,d:0,co:0,cr:0}}
function reset(r){r.es=[];r.sh=[];r.gm=[];r.hr=[];r.fx=[];r.ob=[];r.wave=1;r.t=0;r.sp=30;r.ov=0;
 for(const i in r.ps){const p=r.ps[i];r.ps[i]=mk(+i,p.cls,p.name,p.up)}}
function lv(p){p.lv++;p.xp-=p.nx;p.nx=Math.ceil(p.nx*1.35+2);
 p.ch=[...PW.map(k=>'p:'+k),...PS.map(k=>'s:'+k)].filter(o=>((o[0]=='p'?p.pw:p.ps)[o.slice(2)]||0)<5).sort(()=>R()-.5).slice(0,3);
 if(!p.ch.length)p.ch=null}
function pick(p,i){const o=p.ch&&p.ch[+i];if(!o)return;const k=o.slice(2);
 if(o[0]=='p')p.pw[k]=(p.pw[k]||0)+1;
 else{p.ps[k]=(p.ps[k]||0)+1;if(k=='vida'){const b=CLS[p.cls].hp*.2;p.mh+=b;p.hp+=b}}
 p.ch=null;if(p.xp>=p.nx)lv(p)}
function spawn(r,L,ty){const w=r.wave,p=L[R()*L.length|0],a=R()*6.28,E=ET[ty],hp=E.h(w)*(1+.4*(L.length-1));
 r.es.push({x:cl(p.x+Math.cos(a)*520),y:cl(p.y+Math.sin(a)*520),ty,hp,mh:hp,r:E.r,v:E.v+(ty!=3?Math.min(w*.03,.8):0),d:E.d})}

function step(r,L){
 r.t++;r.ob=[];
 if(r.t%600==0){r.wave++;if(r.wave%2==0)for(const p of L)p.cr++;if(r.wave%5==0)spawn(r,L,3)}
 if(--r.sp<1){const w=r.wave;r.sp=Math.max(5,36-w*2);
  for(let i=0,n=(w>>1)+L.length;i<n;i++){const q=R();spawn(r,L,w>5&&q<.1?5:w>4&&q<.2?6:w>3&&q<.3?4:w>2&&q<.4?2:q<.65?1:0)}}
 for(const p of L){
  const c=CLS[p.cls],m=Math.hypot(p.dx,p.dy);if(m>1){p.dx/=m;p.dy/=m}
  const sp=c.sp*(1+.1*(p.ps.vel||0))*(1+.04*p.u.vel);p.x=cl(p.x+p.dx*sp);p.y=cl(p.y+p.dy*sp);
  const dm=c.dm*(1+.15*(p.ps.dano||0))*(1+.08*p.u.dano),cd=1-.1*(p.ps.recarga||0),l=p.pw;
  const near=g=>{let b=null;for(const e of r.es){const d=dist(e,p);if(d<g){g=d;b=e}}return b};
  const rdy=(k,t)=>{p.cd[k]=(p.cd[k]||0)-1;if(p.cd[k]<=0){p.cd[k]=t*cd;return 1}};
  if(l.proj&&rdy('proj',18)){const e=near(420);
   if(e){const n=1+(l.proj>2)+(l.proj>4),a0=Math.atan2(e.y-p.y,e.x-p.x);
    for(let i=0;i<n;i++){const a=a0+(i-(n-1)/2)*.2;r.sh.push({x:p.x,y:p.y,vx:Math.cos(a)*9,vy:Math.sin(a)*9,d:(7+3*l.proj)*dm,life:45,pr:c.pr||0})}}
   else p.cd.proj=0}
  if(l.orb){const n=1+l.orb;for(let i=0;i<n;i++){const a=r.t*.1+i*6.283/n,o={x:p.x+Math.cos(a)*65,y:p.y+Math.sin(a)*65};r.ob.push([o.x|0,o.y|0]);
   for(const e of r.es)if(dist(e,o)<e.r+8)e.hp-=.3*(1+l.orb*.3)*dm}}
  if(l.nova&&rdy('nova',90)){const rr=90+12*l.nova;r.fx.push(['n',p.x|0,p.y|0,rr,0,6]);
   for(const e of r.es)if(dist(e,p)<rr+e.r)e.hp-=(10+5*l.nova)*dm}
  if(l.raio&&rdy('raio',45))r.es.filter(e=>dist(e,p)<380).sort(()=>R()-.5).slice(0,1+l.raio).forEach(e=>{e.hp-=(14+4*l.raio)*dm;r.fx.push(['r',p.x|0,p.y|0,e.x|0,e.y|0,5])});
  if(l.meteoro&&rdy('meteoro',120)){const e=near(450);if(e){const rr=60+6*l.meteoro;r.fx.push(['n',e.x|0,e.y|0,rr,0,8]);for(const q of r.es)if(dist(q,e)<rr+q.r)q.hp-=(25+8*l.meteoro)*dm}else p.cd.meteoro=0}
  if(l.aura){const rr=50+8*l.aura;for(const e of r.es)if(dist(e,p)<rr+e.r)e.hp-=(.3+.12*l.aura)*dm}
  if(p.ps.regen&&r.t%30==0)p.hp=Math.min(p.mh,p.hp+p.ps.regen);
  if(c.heal&&r.t%60==0)for(const q of L)if(dist(q,p)<220)q.hp=Math.min(q.mh,q.hp+8)}
 for(const e of r.es){let b=L[0],bd=1e9;for(const p of L){const d=dist(p,e);if(d<bd){bd=d;b=p}}
  e.x+=(b.x-e.x)/(bd||1)*e.v;e.y+=(b.y-e.y)/(bd||1)*e.v;
  if(bd<e.r+12){b.hp-=e.d/20;if(b.hp<=0)b.d=1}}
 r.sh=r.sh.filter(s=>{s.x+=s.vx;s.y+=s.vy;if(--s.life<1)return 0;const h=s.h||(s.h=new Set());
  for(const e of r.es)if(e.hp>0&&!h.has(e)&&dist(e,s)<e.r+4){h.add(e);e.hp-=s.d;if(s.pr-->0)continue;return 0}return 1});
 r.es=r.es.filter(e=>{if(e.hp>0)return 1;const E=ET[e.ty];r.gm.push({x:e.x,y:e.y,v:E.x});if(R()<.05)r.hr.push({x:e.x,y:e.y});
  for(const p of L){p.co+=Math.ceil(E.c*(1+.1*p.u.moeda));if(e.ty==2&&R()<.12)p.cr++;if(e.ty==3)p.cr+=3}return 0});
 r.gm=r.gm.filter(g=>{for(const p of L){const d=dist(p,g)||1;
  if(d<14){p.xp+=g.v*(1+.15*(p.ps.xp||0));if(p.xp>=p.nx&&!p.ch)lv(p);return 0}
  if(d<60*(1+.4*(p.ps.ima||0))){g.x+=(p.x-g.x)/d*5;g.y+=(p.y-g.y)/d*5;break}}return 1});
 r.hr=r.hr.filter(h=>{for(const p of L)if(dist(p,h)<18){p.hp=Math.min(p.mh,p.hp+25);return 0}return 1});
 r.fx=r.fx.filter(f=>--f[5]>0)}

function tick(r){
 const P=Object.values(r.ps),L=P.filter(p=>!p.d),pa=P.some(p=>p.ch);
 if(P.length&&!pa){if(L.length)step(r,L);else{if(!r.ov)r.ov=90;if(--r.ov<1)reset(r)}}
 const m=JSON.stringify({w:r.wave,mp:r.map|0,pa:pa?1:0,o:r.ov?1:0,
  p:P.map(p=>({id:p.id,n:p.name,c:p.cls,x:p.x|0,y:p.y|0,h:p.hp|0,m:p.mh|0,l:p.lv,xp:p.xp,nx:p.nx,d:p.d,pw:p.pw,ps:p.ps,ch:p.ch,co:p.co,cr:p.cr,sp:+(CLS[p.cls].sp*(1+.1*(p.ps.vel||0))*(1+.04*p.u.vel)).toFixed(2)})),
  e:r.es.map(e=>[e.x|0,e.y|0,e.ty,e.hp/e.mh]),s:r.sh.map(s=>[s.x|0,s.y|0]),b:r.ob,g:r.gm.map(g=>[g.x|0,g.y|0]),f:r.fx,hr:r.hr.map(h=>[h.x|0,h.y|0])});
 wss.clients.forEach(c=>{if(c.r===r&&c.readyState==1)c.send(m)})}
setInterval(()=>{for(const k in rooms)tick(rooms[k])},33);

wss.on('connection',(ws,rq)=>{
 const k=(new URL(rq.url,'http://x').searchParams.get('s')||'geral').slice(0,12);
 const r=rooms[k]||(rooms[k]={k,ps:{}});if(!r.es)reset(r);
 const id=N++;ws.r=r;
 ws.on('message',raw=>{let d;try{d=JSON.parse(raw)}catch{return}
  if(d.t=='join'&&!r.ps[id]){if(!Object.keys(r.ps).length)r.map=Math.min(3,Math.max(0,+d.map||0));r.ps[id]=mk(id,d.cls,d.name,d.up);ws.send(JSON.stringify({t:'id',id}));return}
  const p=r.ps[id];if(!p)return;
  if(d.t=='in'){p.dx=+d.dx||0;p.dy=+d.dy||0}
  else if(d.t=='pick')pick(p,d.i)});
 ws.on('close',()=>{delete r.ps[id];if(!Object.keys(r.ps).length)delete rooms[k]})});
srv.listen(process.env.PORT||3000);
