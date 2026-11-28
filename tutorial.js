/* Mestre Slime — tutorial integrado */
(function(root){
'use strict';
const KEY='slimeTutorialSeen_v2';
const steps=[
['Boas-vindas à Arena','Sou o Mestre Slime. Vou explicar o essencial para sua aventura.'],
['Lobby, classes e loja','No lobby você escolhe sua classe, mapa e equipamentos. Use moedas e cristais para desbloquear conteúdo.'],
['Controles e combate','Durante a batalha, arraste o dedo para mover seu slime. Seus ataques acontecem automaticamente.'],
['Gemas e evolução','Colete as gemas de XP. Ao subir de nível, escolha uma habilidade ou melhoria para fortalecer seu slime.'],
['Chefes e cooperativo','A cada 5 ondas surge um chefe. Para jogar com amigos, entrem usando o mesmo código de sala.'],
['Pronto para jogar','Boa sorte! Você pode abrir este guia novamente pelo botão ? no lobby.']
];
function init(options){
 if(!root.document||!document.body)return null;
 if(root.SlimeTutorial){if(options&&options.open)root.SlimeTutorial.open(0);return root.SlimeTutorial;}
 const host=document.getElementById('m')||document.body;
 const style=document.createElement('style');
 style.textContent=`
 #slime-tutorial-btn{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);right:14px;z-index:26;width:38px;height:38px;min-height:38px;padding:0;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#2e7545,#102619);border:1px solid #a7f3b8;color:#effff2;font:900 18px system-ui;box-shadow:0 5px 18px #0009,0 0 18px #4ade8033}
 #slime-tutorial-backdrop{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:18px;background:#020a06c9;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
 #slime-tutorial-backdrop[hidden]{display:none}
 #slime-tutorial-box{width:min(100%,410px);padding:19px;border-radius:22px;background:radial-gradient(circle at 10% 0,#28613a66,transparent 48%),linear-gradient(155deg,#142c1d,#08140d);border:1px solid #8ce5a177;color:#f1fff4;box-shadow:0 25px 70px #000d}
 .tut-head{display:flex;align-items:center;gap:12px;margin-bottom:15px}.tut-orb{width:54px;height:54px;flex:none;border-radius:17px;display:grid;place-items:center;font-size:29px;background:radial-gradient(circle at 30% 25%,#eaffef,#4ade80 42%,#14532d 100%);box-shadow:0 0 24px #4ade8055}
 .tut-kicker{font-size:10px;font-weight:900;letter-spacing:.16em;color:#9bf2b1}.tut-title{font-size:19px;font-weight:900;margin-top:3px}.tut-count{font-size:12px;color:#badbc4;margin-top:3px}
 .tut-msg{font-size:14px;line-height:1.55;margin:0;padding:16px;border-radius:15px;background:#06150dba;border:1px solid #8ce5a133;min-height:86px}
 .tut-progress{display:flex;gap:6px;margin:15px 0}.tut-progress i{height:5px;flex:1;border-radius:8px;background:#ffffff20}.tut-progress i.on{background:linear-gradient(90deg,#4ade80,#bbf7d0)}
 .tut-actions{display:flex;gap:8px}.tut-actions button{min-height:40px;border-radius:12px;padding:8px 13px;border:1px solid #ffffff2b;background:#1b3926;color:#effff2;font-weight:800}.tut-actions #tut-next{margin-left:auto;background:linear-gradient(120deg,#86efac,#22a653);color:#062412;border-color:#c5ffd2}
 @media(max-width:620px){#slime-tutorial-btn{bottom:calc(env(safe-area-inset-bottom,0px) + 92px);right:11px;width:38px;height:38px}}
 @media(prefers-reduced-motion:no-preference){#slime-tutorial-box{animation:tutPop .22s cubic-bezier(.2,.8,.2,1)}@keyframes tutPop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}}
 `;
 document.head.appendChild(style);
 const btn=document.createElement('button');btn.id='slime-tutorial-btn';btn.type='button';btn.textContent='?';btn.setAttribute('aria-label','Abrir tutorial do Mestre Slime');btn.title='Tutorial';
 const overlay=document.createElement('div');overlay.id='slime-tutorial-backdrop';overlay.hidden=true;
 overlay.innerHTML='<section id="slime-tutorial-box" role="dialog" aria-modal="true" aria-labelledby="tut-title"><div class="tut-head"><div class="tut-orb" aria-hidden="true">✦</div><div><div class="tut-kicker">GUIA DO AVENTUREIRO</div><div class="tut-title" id="tut-title">Mestre Slime</div><div class="tut-count" id="tut-count"></div></div></div><p class="tut-msg" id="tut-msg"></p><div class="tut-progress" id="tut-progress"></div><div class="tut-actions"><button type="button" id="tut-prev">Anterior</button><button type="button" id="tut-skip">Pular</button><button type="button" id="tut-next">Próximo</button></div></section>';
 host.appendChild(btn);document.body.appendChild(overlay);
 let index=0;
 const $=id=>document.getElementById(id);
 function render(){const s=steps[index];$('tut-title').textContent=s[0];$('tut-msg').textContent=s[1];$('tut-count').textContent='ETAPA '+(index+1)+' DE '+steps.length;$('tut-prev').disabled=index===0;$('tut-next').textContent=index===steps.length-1?'Concluir':'Próximo';$('tut-progress').innerHTML=steps.map((_,i)=>'<i class="'+(i<=index?'on':'')+'"></i>').join('');}
 function open(n){index=Number.isInteger(n)&&n>=0&&n<steps.length?n:0;render();overlay.hidden=false;}
 function close(){overlay.hidden=true;try{localStorage.setItem(KEY,'1')}catch(e){}btn.classList.remove('pulse');}
 function next(){if(index<steps.length-1){index++;render()}else close()}
 function prev(){if(index>0){index--;render()}}
 btn.addEventListener('click',()=>overlay.hidden?open(0):close());
 $('tut-prev').addEventListener('click',prev);$('tut-next').addEventListener('click',next);$('tut-skip').addEventListener('click',close);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
 ['go','priv','off'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('click',()=>{if(!overlay.hidden)close()})});
 let seen=false;try{seen=localStorage.getItem(KEY)==='1'}catch(e){}
 const api=root.SlimeTutorial={open,close,next,prev,getStep:()=>index,MSG:steps.map(s=>s[1])};
 if(!seen||options&&options.open)open(0);
 return api;
}
root.initTutorial=init;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init());else init();
})(typeof window!=='undefined'?window:globalThis);
