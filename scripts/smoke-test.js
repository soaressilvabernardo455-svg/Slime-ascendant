'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = (path) => fs.readFileSync(path, 'utf8');
const html = read('index.html');
const server = read('server.js');
const auth = read('auth.js');
const serviceWorker = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const capacitor = JSON.parse(read('android-app/capacitor.config.json'));
const offlinePage = read('android-app/www/offline.html');

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(scriptMatch, 'index.html precisa conter o script principal');
const app = scriptMatch[1];
new vm.Script(app, { filename: 'index.html' });
for (const [name, source] of Object.entries({ server, auth, serviceWorker })) {
  new vm.Script(source, { filename: name + '.js' });
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'IDs HTML não podem estar duplicados');
const idSet = new Set(ids);
const usedIds = [...app.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map((match) => match[1]);
const missingIds = [...new Set(usedIds.filter((id) => !idSet.has(id)))];
assert.deepEqual(missingIds, [], 'referências a elementos precisam existir no HTML');

const colorMatch = app.match(/const dk=(.*);/);
assert.ok(colorMatch, 'função de cor do slime ausente');
const adjustColor = vm.runInNewContext(colorMatch[1]);
const paletteMatch = app.match(/const CO=(\{[^;]+\});/);
assert.ok(paletteMatch, 'paleta de cores ausente');
const palette = vm.runInNewContext('(' + paletteMatch[1] + ')');
for (const [name, color] of Object.entries(palette)) {
  const bright = adjustColor(color, 1.32);
  assert.match(bright, /^#[0-9a-f]{6}$/i, 'cor inválida para ' + name + ': ' + bright);
  for (const offset of [1, 3, 5]) {
    assert.ok(Number.parseInt(bright.slice(offset, offset + 2), 16) <= 255,
      'canal RGB excedeu 255 para ' + name);
  }
}

const shopMatch = app.match(/const UPG=(\{[^;]+\});/);
assert.ok(shopMatch, 'melhorias permanentes do lobby ausentes');
const shopUpgrades = vm.runInNewContext('(' + shopMatch[1] + ')');
assert.deepEqual(Object.keys(shopUpgrades).sort(), ['dano', 'moeda', 'vel', 'vida'],
  'a loja do lobby deve conter apenas atributos permanentes');
assert.ok(app.includes('p.ps.ima'), 'ímã deve continuar como passiva de partida');
assert.ok(app.includes('p.ps.regen'), 'regeneração deve continuar como passiva de partida');
assert.ok(app.includes('function syncCloudProgressOnLogin('), 'sincronização automática na nuvem ausente');
assert.ok(app.includes("accountRequest('/api/progress','PUT'"), 'envio automático do progresso ausente');
assert.ok(!app.includes('backup-export') && !app.includes('createBackupCode('), 'a loja não deve exibir backup manual');
assert.ok(app.includes('function pingPresence('), 'presença de jogadores online ausente');
assert.ok(app.includes('function isAllowedPlayerName('), 'validação do nome no cliente ausente');
assert.ok(app.includes("'putinha','putinhas','putaria','fdp','vtnc'")&&server.includes("'putinha','putinhas','putaria','fdp','vtnc'"), 'filtro de nomes precisa cobrir variações comuns e ser igual no cliente e servidor');
assert.ok(app.includes('const cx=pp.x-W/2,cy=pp.y-H/2'), 'a câmera deve seguir sem bordas do mapa');
assert.match(app, /const oClamp=v=>Math\.max\(-1000000000/);
assert.match(app, /const PRICE=\{normal:\[0,0\],arqueiro:\[900,0\],cavaleiro:\[3000,0\],mago:\[5000,0\],curandeiro:\[0,600\],necromante:\[0,900\]\}/);
assert.ok(app.includes("if(p.cls==='necromante')"), 'necromante precisa invocar esqueletos');
assert.ok(app.includes('spawnEvery=Math.max(45,90-summonLevel*8)')&&server.includes('spawnEvery=Math.max(45,90-summonLevel*8)'), 'esqueletos devem invocar mais rápido conforme a habilidade evolui');
assert.ok(app.includes('e.hp-=4+2*summonLevel')&&server.includes('e.hp-=4+2*summonLevel'), 'dano dos esqueletos deve evoluir com a habilidade');
assert.ok(app.includes("classPower={normal:'proj',mago:'raio',cavaleiro:'orb',necromante:'nova',curandeiro:'aura',arqueiro:'proj'}")&&server.includes("classPower={normal:'proj',mago:'raio',cavaleiro:'orb',necromante:'nova',curandeiro:'aura',arqueiro:'proj'}"), 'melhoria especial da classe deve aparecer nas escolhas de XP');
assert.ok(server.includes('p.lv===5&&(p.pw.meteoro||0)<5&&((p.pw.meteoro||0)>0||op.length<5)'), 'servidor não pode obrigar o Meteoro sem espaço para um novo poder');
assert.ok(app.includes('p.lv===5&&(p.pw.meteoro||0)<5&&((p.pw.meteoro||0)>0||op.length<5)'), 'modo offline não pode obrigar o Meteoro sem espaço para um novo poder');
const serverLevelStart = server.indexOf('function lv(p){');
const serverLevelEnd = server.indexOf('function pick(p,i){', serverLevelStart);
const offlineLevelStart = app.indexOf('function offlineLevel(p){');
const offlineLevelEnd = app.indexOf('function offlinePick(i){', offlineLevelStart);
assert.ok(serverLevelStart >= 0 && serverLevelEnd > serverLevelStart, 'função de nível online deve ser testável');
assert.ok(offlineLevelStart >= 0 && offlineLevelEnd > offlineLevelStart, 'função de nível offline deve ser testável');
const testRandomSubset = (items, count) => { const copy = items.slice(), take = Math.min(copy.length, Math.max(0, count | 0)); for (let i = 0; i < take; i++) { const j = i + Math.floor(0.5 * (copy.length - i)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy.slice(0, take); };
const serverLevelUp = new Function('PW', 'PS', 'R', 'randomSubset', server.slice(serverLevelStart, serverLevelEnd) + ';return lv;')(
  ['proj','orb','nova','raio','aura','meteoro','lanca','corrente','espinhos','furacao'],
  ['vida','dano','vel','recarga','ima','regen','xp','armadura','crit','sorte'],
  () => 0.5,
  testRandomSubset
);
const offlineLevelUp = new Function(app.slice(offlineLevelStart, offlineLevelEnd) + ';return offlineLevel;')();
const levelPlayer = (powers) => ({ lv: 4, xp: 0, nx: 5, pw: Object.fromEntries(powers.map((key) => [key, 1])), ps: {}, ch: null });
for (const [name, levelUp] of [['online', serverLevelUp], ['offline', offlineLevelUp]]) {
  const fullWithoutMeteor = levelPlayer(['proj','orb','nova','raio','aura']);
  levelUp(fullWithoutMeteor);
  assert.ok(!fullWithoutMeteor.ch?.includes('p:meteoro'), name + ': não oferecer poder novo quando os cinco espaços estão ocupados');
  const fullWithMeteor = levelPlayer(['proj','orb','nova','raio','meteoro']);
  levelUp(fullWithMeteor);
  assert.ok(fullWithMeteor.ch?.includes('p:meteoro'), name + ': permitir melhorar Meteoro que já está equipado');
  const roomForMeteor = levelPlayer(['proj','orb','nova','raio']);
  levelUp(roomForMeteor);
  assert.ok(roomForMeteor.ch?.includes('p:meteoro'), name + ': oferecer Meteoro quando existe espaço');
}

assert.ok(app.includes('(S.k||[])'), 'esqueletos precisam ser desenhados na partida');
assert.ok(!app.includes('wx(W,H,S.mp|0,t)'), 'efeitos de partículas da tela do lobby não devem aparecer na partida');
assert.ok(!app.includes('const grain=86'), 'remover granulação de pontos do mapa durante a partida');
const onlineHandler=app.match(/socket\.onmessage=e=>\{([\s\S]*?)\n  \};/);
assert.ok(onlineHandler, 'handler de snapshots online ausente');
assert.ok(!/lw=0;gc=0;gk=0/.test(onlineHandler[1]), 'contadores de saldo não podem ser zerados em cada snapshot');
assert.ok(app.includes('const ECONOMY_VERSION=1,MAP_ACCESS_VERSION=1;'), 'versão de reparo da economia ausente');
assert.ok(app.includes('SV.co=0;SV.cr=0;SV.economyVersion=ECONOMY_VERSION'), 'saldos antigos inflados precisam ser corrigidos uma única vez');
assert.ok(app.includes('localEconomyIsNewer')&&app.includes('remoteEconomyIsNewer'), 'merge da nuvem precisa respeitar a versão da economia');
assert.ok(auth.includes('economyVersion: Math.max(0, Math.min(1,'), 'servidor precisa preservar a versão da economia');
const joinSection=app.match(/function joinOnline\(roomCode,button\)\{([\s\S]*?)const openSocket/);
assert.ok(joinSection&&/lw=0;gc=0;gk=0/.test(joinSection[1]), 'contadores precisam iniciar uma vez por partida');
assert.ok(app.includes('function drawBiomeLandmark('), 'decorações grandes dos biomas ausentes');
assert.ok(app.includes('function mkS(ty){')&&app.includes('for(let i=0;i<7;i++)SPR[i]=mkS(i)'), 'monstros precisam usar sprites vetoriais suaves em alta resolução');
assert.ok(app.includes('c.imageSmoothingEnabled=true;c.drawImage(SPR[ty]'), 'sprites de monstros precisam ser renderizados com suavização');
assert.ok(server.includes("'/cover.svg':['cover.svg','image/svg+xml']"), 'servidor precisa entregar a capa SVG do jogo');
assert.ok(app.includes('if((h&3)===0)drawBiomeLandmark(0,0,map,h)')&&app.includes('if((h&7)===0)drawForestLandmark(0,0,h)'), 'biomas precisam renderizar árvores, dunas, gelo e rochas de lava');
assert.ok(app.includes('c.scale(1.04*(1+squash),.98*(1-squash))'), 'slime precisa manter proporções mais equilibradas');
assert.ok(app.includes('function drawGround(cx,cy,W,H,map){')&&app.includes('const chunk=540')&&app.includes('roadStep=map===2?940:860'), 'textura de terreno limpa ausente');
assert.ok(!app.includes('drawGround(0,0,W,H,map);wx(W,H,map,t)'), 'partículas flutuantes não devem aparecer no lobby');
assert.ok(html.includes('id="create-room"')&&app.includes("$('create-room').onclick"), 'criação de sala privada ausente');
assert.ok(app.includes("joinOnline(code,$('create-room'))"), 'sala privada precisa conectar com código compartilhável');
assert.ok(html.includes('id="ts"')&&html.includes('data-t="s"'), 'aba de configurações ausente');
assert.ok(app.includes('id="reset-game"')&&app.includes('Todo o progresso deste perfil será apagado'), 'reset precisa pedir confirmação');
assert.ok(app.includes('const qualityDprCap=()=>SV.quality===0?1:SV.quality===1?DEVICE_DPR_CAP:Math.min(2,DEVICE_DPR_CAP+.5)'), 'qualidade alta precisa ter teto de resolução maior');
assert.ok(app.includes('quality:Number.isInteger(Number(raw.quality))')&&app.includes('showFps:raw.showFps?1:0'), 'salvamento local/nuvem deve preservar qualidade e FPS');
assert.ok(auth.includes('quality: Number.isInteger(quality)')&&auth.includes('showFps: raw.showFps ? 1 : 0'), 'banco de dados deve preservar qualidade e FPS');
assert.ok(app.includes('quality:local.quality,showFps:local.showFps'), 'sincronização de conta deve preservar as preferências deste aparelho');
assert.ok(app.includes('DPR=Math.min(devicePixelRatio||1,qualityDprCap())')&&app.includes('const qualityDprCap=()=>SV.quality===0?1:SV.quality===1?DEVICE_DPR_CAP:Math.min(2,DEVICE_DPR_CAP+.5)'), 'seletor de qualidade precisa aplicar o limite de resolução correto');
assert.ok(app.includes("settings.querySelector('#setting-fps')")&&app.includes("' FPS'"), 'opção de FPS precisa exibir contador');
assert.ok(app.includes('refreshAccountWhenActive'), 'sessão deve ser revalidada ao voltar ao jogo');
assert.equal((app.match(/if\(p\.cls==='necromante'\)/g)||[]).length,1, 'invocação offline não pode executar duplicada');
assert.match(app, /const MAPS=\[\['Floresta Antiga',0,0\],\['Deserto Dourado',6000,0\],\['Tundra Gelada',15000,0\],\['Vulcão Carmesim',0,300\]\]/);
assert.match(app, /const ITEMS=\{espada:\['Espada Afiada','\+12% de dano',1800,0\],escudo:\['Escudo','-15% de dano recebido',2200,0\],botas:\['Botas Velozes','\+8% de velocidade',1400,0\],amuleto:\['Amuleto','\+15% de XP',0,120\],anel:\['Anel da Sorte','\+15% de moedas',0,160\],coracao:\['Coração de Cristal','\+25% de vida máxima',0,200\]\}/);
assert.match(app, /const ucost=l=>Math\.round\(220\*Math\.pow\(l\+1,1\.42\)\)/);
assert.ok(app.includes("SV.co+=25;SV.cr+=2"), 'recompensa diária deve refletir a economia reajustada');
assert.ok(app.includes('function claimDailyReward('), 'trava da recompensa diária ausente');
assert.ok(app.includes('function startMusic('), 'música do jogo ausente');
assert.ok(app.includes('function updateRoomWait('), 'sala de espera online ausente');
assert.ok(app.includes("screen.orientation.unlock"), 'orientação do aparelho precisa ficar livre');
assert.ok(!app.includes("screen.orientation.lock('landscape')"), 'o jogo não pode forçar paisagem');
assert.ok(app.includes("credentials:'include'"), 'requisições de conta devem enviar cookies');
assert.ok(app.includes("if(connectTimer)clearTimeout(connectTimer)"), 'watchdog de entrada precisa ser limpo depois de entrar na sala');
assert.match(html, /version-pill">v4\.9</, 'a versão exibida no lobby precisa aumentar');

assert.match(server, /MAX_PLAYERS=4/, 'limite de quatro jogadores ausente');
assert.match(server, /MAX_CONNECTIONS=40/, 'limite de conexões simultâneas ausente');
assert.match(server, /let k=.*r=null/, 'a sala deve ser criada somente após join');
assert.match(server, /MAX_MESSAGE_RATE=45/, 'limite de frequência WebSocket ausente');
assert.match(server, /maxPayload:2048/, 'limite de tamanho de mensagem WebSocket ausente');
assert.match(server, /function cleanPlayerData/, 'validação dos dados enviados pelo cliente ausente');
assert.match(server, /function roomForJoin/, 'fila e rotação de salas públicas ausente');
assert.match(server, /autoStartAt/, 'início automático da sala pública ausente');
assert.match(server, /function isAllowedPlayerName/, 'bloqueio de nomes no servidor ausente');
assert.match(server, /PRESENCE_TTL_MS=45000/, 'expiração de presença ausente');
assert.match(server, /path==='\/presence'/, 'endpoint de presença ausente');
assert.match(server, /online:presence\.size/ , 'contagem de jogadores online ausente');
assert.match(server, /playing,rooms/, 'contagem de jogadores em partidas ausente');
assert.match(server, /Math\.max\(-1000000000,Math\.min\(1000000000,v\)/, 'limite global do mapa infinito ausente');
assert.match(server, /UPGRADE_KEYS=\['vida','dano','vel','moeda'\]/, 'whitelist de melhorias permanentes ausente');
assert.match(server, /VIEW_RADIUS=640/, 'raio de visibilidade por jogador ausente');
assert.match(server, /p\.chType=p\.ch\.length\?'level':'';p\.choiceExpiresAt=0/, 'escolha de nível não deve expirar automaticamente');
assert.match(server, /const activePlayers=alive\.filter\(p=>!\(p\.ch&&p\.chType==='level'\)\)/, 'somente o jogador escolhendo XP deve ficar parado');
assert.match(server, /if\(activePlayers\.length\)step\(r,activePlayers\)/, 'os demais jogadores devem continuar a partida durante a escolha de XP');
assert.match(server, /SLIME_DEV_ACCESS_CODE\|\|'6767'/, 'código padrão do modo desenvolvedor deve ser 6767');
assert.match(server, /p\.chType==='boss'&&p\.choiceExpiresAt/, 'escolhas de baú do chefe mantêm o timeout próprio');
assert.match(server, /function roomMessage/, 'mensagens da sala de espera ausentes');
assert.match(server, /r\.startAt=Date\.now\(\)\+5000/, 'contagem regressiva de início ausente');
assert.match(server, /separateX/, 'separação de monstros ausente');
assert.ok(server.includes('(ei-oi)*2.399963229728653')&&app.includes('(ei-oi)*2.399963229728653'), 'inimigos sobrepostos exatamente precisam ser separados');
assert.ok(server.includes('separateX*3')&&app.includes('sx*3')&&server.includes('Math.min(3,(gap-d)/gap*4)')&&app.includes('Math.min(3,(gap-od)/gap*4)')&&server.includes('gap=e.r+other.r+28')&&app.includes('gap=e.r+other.r+28'), 'separação de inimigos precisa ter força suficiente');
assert.ok(server.includes("['l',q.x|0,q.y|0,q.type,0,70]")&&app.includes("['l',q.x|0,q.y|0,q.type,0,70]")&&app.includes("labels={coin:"), 'baús precisam mostrar visualmente o tipo de recompensa');
assert.ok(server.includes('i<n&&r.es.length<36'), 'spawn online precisa respeitar o limite de monstros durante cada lote');
assert.ok(app.includes('i<n&&r.es.length<36'), 'spawn offline precisa respeitar o limite de monstros durante cada lote');
assert.ok(server.includes('life:1800')&&server.includes('r.gm.length>30')&&server.includes('r.hr.length>20'), 'drops online precisam expirar e ter limites de quantidade');
assert.ok(app.includes('life:1800')&&app.includes('r.gm.length>30')&&app.includes('r.hr.length>20'), 'drops offline precisam expirar e ter limites de quantidade');

assert.match(auth, /SameSite=Lax/, 'cookie de sessão precisa usar SameSite=Lax');
assert.match(auth, /Expires=/, 'cookie precisa ter expiração persistente');
assert.match(auth, /Secure/, 'cookie precisa usar HTTPS em produção');
assert.match(auth, /progress_json JSONB/, 'coluna de salvamento automático na nuvem ausente');
assert.match(auth, /function cleanProgress/, 'validação do progresso na nuvem ausente');
assert.match(auth, /pathname === '\/api\/progress' && req.method === 'GET'/, 'leitura do progresso na nuvem ausente');
assert.match(auth, /pathname === '\/api\/progress' && req.method === 'PUT'/, 'gravação do progresso na nuvem ausente');

assert.equal(manifest.orientation, 'any', 'manifest deve aceitar retrato e paisagem');
assert.equal(capacitor.server.errorPath, 'offline.html', 'APK precisa apontar para a página local de reconexão');
const offlineScript = offlinePage.split('<script>')[1]?.split('</script>')[0];
assert.ok(offlineScript, 'página offline do APK precisa ter lógica de nova tentativa');
new vm.Script(offlineScript, { filename: 'android-app/www/offline.html' });
assert.ok(offlinePage.includes('window.location.replace(target)'), 'página offline precisa tentar abrir o jogo automaticamente');


const cachePattern = serviceWorker.match(/if\(response\.ok&&!\/(.*?)\/i\.test/);
assert.ok(cachePattern, 'filtro de Cache-Control ausente');
const noStore = new RegExp(cachePattern[1], 'i');
assert.equal(noStore.test('no-store'), true, 'no-store deve ser excluído do cache');
assert.equal(noStore.test('public, max-age=86400'), false, 'cache público não deve ser excluído');

assert.ok(html.includes('id="fps-indicator"')&&app.includes('fpsNode.textContent!==fpsText')&&app.includes('fpsNode.style.display!==fpsDisplay'), 'FPS precisa aparecer em uma camada DOM visível durante a partida');
assert.ok(html.includes("url('/cover.svg')")&&html.includes('#m::before'), 'capa ilustrada do lobby ausente');
assert.ok(app.includes('function resetGameCanvas()')&&app.includes("globalCompositeOperation='source-over'")&&app.includes("x.filter='none'"), 'canvas deve limpar estado visual entre quadros para evitar artefatos/estática');
assert.ok(app.includes('const chunk=540')&&app.includes('h&7')&&app.includes('h&3'), 'mapas devem reduzir detalhes muito pequenos e densos');
assert.ok(app.includes('bezierCurveTo(-25,-22,-16,-34,-4,-35)')&&app.includes('const aura=['), 'slimes e monstros devem ter acabamento visual melhor');
assert.ok(app.includes('skill-special-card')&&app.includes('MELHORIA ESPECIAL · NÍVEL 5/5'), 'a quinta melhoria deve ter apresentação especial exclusiva');
assert.ok(app.includes('class-stats')&&app.includes('data-biome')&&app.includes('--upgrade-color'), 'classes, mapas e melhorias precisam de apresentação visual distinta');
assert.ok(app.includes('top:calc(env(safe-area-inset-top,0px) + 88px)'), 'indicador de FPS deve ficar abaixo da barra de vida');
assert.ok(app.includes('c.bezierCurveTo(7,12,-7,12,-17,7)')&&!app.includes('c.bezierCurveTo(3,10,-3,10,-7,5)'), 'corpo do slime precisa ter uma base única e suave');
assert.ok(app.includes('e.attackCooldown=75')&&app.includes('const stopGap=e.r+27')&&app.includes('const contact=oDist(p,e)'), 'modo offline precisa espaçar monstros e limitar ataques a 2,5 segundos');
assert.ok(server.includes('e.attackCooldown=75')&&server.includes('const stopGap=e.r+27')&&server.includes('attackCooldown:0'), 'servidor precisa espaçar monstros e limitar ataques a 2,5 segundos');
console.log('Smoke tests aprovados. Referências DOM: ' + usedIds.length + '; classes: 6; upgrades permanentes: ' + Object.keys(shopUpgrades).length + '.');

assert.ok(app.includes("if(t===b.dataset.t)panel.scrollTop=0"), 'trocar de aba deve voltar o painel ao topo');
assert.ok(app.includes('const chunk=540')&&!app.includes('const grain=86')&&!app.includes('wx(W,H,S.mp|0,t)'), 'floresta deve evitar ruído excessivo de pequenos pixels');
assert.ok(app.includes('gameSafeTop+88'), 'HUD da partida deve respeitar a área segura superior');
assert.ok(app.includes("slime(pg,0,0,SV.sel,t,false,0,0)")&&!app.includes("slime(x,0,0,SV.sel,t,false,0,0)"), 'o lobby deve desenhar apenas uma prévia do slime');
assert.ok(html.includes('.player-chips{display:flex!important'), 'saldo de moedas e cristais precisa estar visível no lobby');
assert.ok(app.includes('MAP_ACCESS_VERSION=1') && app.includes('filter(i=>Number(i)!==3)'), 'Vulcão Carmesim antigo liberado sem pagamento deve voltar a exigir cristais');
assert.ok(auth.includes('MAP_ACCESS_VERSION = 1') && auth.includes('maps.splice(volcanoIndex, 1)'), 'migração de mapa antigo precisa ocorrer também na nuvem');
assert.ok(app.includes('async function toggleDeveloperMode()') && app.includes("fetch('/api/dev/unlock'"), 'painel de desenvolvedor precisa autenticar no servidor');
assert.ok(server.includes("path==='/api/dev/unlock'") && server.includes('crypto.timingSafeEqual'), 'ativação de desenvolvedor precisa validar segredo no servidor');
assert.ok(server.includes('r.devRoom!==devMode') && server.includes("devMode&&k==='geral'"), 'sala de desenvolvedor precisa ficar isolada da sala pública e de jogadores normais');
assert.ok(app.includes('devToken:developerModeEnabled?developerToken'), 'token de desenvolvedor precisa ser enviado na conexão de teste');
assert.ok(app.includes("developerModeEnabled?Object.keys(ITEMS)") && app.includes("p.pw=Object.fromEntries"), 'modo de teste offline precisa liberar itens, poderes e recursos');
assert.ok(app.includes("if(!player.dev&&data.w>SV.best)") && app.includes('if(!p.devMode&&p.co>gc)'), 'resultados do modo de teste não podem contaminar o progresso normal');
assert.ok(server.includes('dropChestNearPlayer') && server.includes("q.type==='medkit'") && server.includes("q.type==='bomb'"), 'baús online precisam entregar moedas, gemas, cura, kit médico e explosivos');
assert.ok(app.includes('offlineDropChestNearPlayer') && app.includes("q.type==='medkit'") && app.includes("q.type==='bomb'") && app.includes('(S.ch||[])'), 'baús precisam funcionar e aparecer no modo offline');
assert.ok(app.includes('offlineDamageChests(r,p,p.x,p.y,220,hit(16*dm))'), 'ataque básico offline precisa atingir baús próximos');
assert.ok(server.includes('damageChests(r,p.x,p.y,220,hit(16*dm),L)'), 'ataque básico online precisa atingir baús próximos');
assert.ok(app.includes('if(q.targetChest){for(const chest') && server.includes('if(s.targetChest){for(const q'), 'projéteis que miram baús não podem ser bloqueados por monstros');
assert.ok(app.includes("r.fx.push(['a',q.x|0,q.y|0,34,0,12],['l',q.x|0,q.y|0,q.type,0,70])") && server.includes("r.fx.push(['a',q.x|0,q.y|0,34,0,12],['l',q.x|0,q.y|0,q.type,0,70])"), 'abrir baú precisa mostrar efeito visual e a recompensa');

assert.ok(server.includes("p.cls==='cavaleiro'&&rdy('knightSword',48)")&&app.includes("p.cls==='cavaleiro'&&rdy('knightSword',48)"), 'Cavaleiro precisa atacar com espada em intervalos de 1,6 segundo');
assert.ok(server.includes("b.cls==='cavaleiro'&&(b.shieldUntil||0)>=r.t")&&app.includes("p.cls==='cavaleiro'&&(p.shieldUntil||0)>=r.t"), 'escudo temporário do Cavaleiro precisa bloquear contato online e offline');
assert.ok(app.includes("else if(k==='s')"), 'golpe de espada do Cavaleiro precisa ter efeito visual');
assert.ok(app.includes("if(ty===2){")&&app.includes("else if(ty===5){")&&app.includes("else if(ty===6){"), 'golem, fantasma e monstro vegetal precisam de silhuetas diferentes');
assert.ok(server.includes("w>2&&q<.08?5")&&app.includes("w>2&&q<.08?5")&&server.includes("w>1&&q<.36?4"), 'inimigos variados precisam começar a aparecer nas primeiras ondas');
assert.ok(app.includes("max||(!developerModeEnabled&&SV.co<cost)"), 'upgrades gratuitos de teste não podem depender do saldo normal');
assert.ok(app.includes("developerModeEnabled?'🪙 ∞　💎 ∞'"), 'modo de teste deve exibir saldo ilimitado sem alterar o perfil');

assert.ok(server.includes('function randomSubset(items,count)') && app.includes('offlineRandomSubset=(items,count)'), 'seleção aleatória de habilidades deve usar embaralhamento correto');
assert.ok(!server.includes(".sort(()=>R()-.5)") && !app.includes(".sort(()=>Math.random()-.5)"), 'não usar comparador aleatório inconsistente');
assert.ok(app.includes("function offlineTick(){if(!OFF||!OR||document.hidden)return"), 'modo offline precisa pausar ao enviar o aplicativo para segundo plano');
assert.ok(server.includes("it:p.it,shield:p.shieldUntil>r.t") && app.includes("it:p.it,shield:p.shieldUntil>r.t"), 'snapshots online e offline precisam enviar itens e duração do escudo');
assert.ok(app.includes('function updateItemHUD(p)') && app.includes('updateItemHUD(p);'), 'HUD deve refletir os itens realmente equipados inclusive no modo DEV');
const itemHudStart=app.indexOf('function updateItemHUD(p){');
const itemHudEnd=app.indexOf('function powerHUD(p){',itemHudStart);
const itemHudSource=app.slice(itemHudStart,itemHudEnd);
assert.ok(itemHudSource.includes("key=items.join('|')")&&itemHudSource.includes('visible=active&&items.length>0'), 'HUD de itens deve detectar os itens atuais e o estado da partida');
assert.ok(itemHudSource.includes("panel.style.display=button.dataset.open==='1'?'flex':'none'")&&itemHudSource.includes("$('item-count').textContent=String(items.length)"), 'HUD de itens precisa abrir, fechar e mostrar a quantidade correta');
assert.ok(app.includes("if(q.shield>0){x.save()"), 'escudo ativo do Cavaleiro precisa de indicador visual contínuo');
assert.ok(app.includes("p.dev?'🪙 ∞  💎 ∞'"), 'HUD do modo DEV precisa mostrar recursos ilimitados');
assert.ok(!app.includes('x.fillRect(X-5,Y,Y+0,0)'), 'remover desenho inválido do esqueleto');

const serverXpMatch=server.match(/const ET=(\[[\s\S]*?\]);/);
const offlineXpMatch=app.match(/const OET=(\[[\s\S]*?\]);/);
assert.ok(serverXpMatch&&offlineXpMatch, 'tabelas de XP dos monstros precisam existir');
const serverMonsterXp=vm.runInNewContext(serverXpMatch[1]).map(enemy=>enemy.x);
const offlineMonsterXp=vm.runInNewContext(offlineXpMatch[1]).map(enemy=>enemy.x);
assert.deepEqual(serverMonsterXp,[5,3,20,100,6,9,14], 'XP online deve recompensar os monstros mais perigosos');
assert.deepEqual(offlineMonsterXp,serverMonsterXp, 'XP offline deve ser igual ao multiplayer');
assert.ok(app.includes("stats.textContent='VIDA '+attr.hp+'  ·  DANO '+(attr.dm*10).toFixed(1).replace('.',',')+'  ·  VEL '+attr.sp.toFixed(1)")&&!app.includes("Math.round(attr.dm*100)+'%'"), 'dano nas cartas de classe deve ser numérico, não percentual');
assert.ok(app.includes("x.arc(0,-9,5.2,0,Math.PI*2)")&&!app.includes("x.fillRect(X-4,Y-9,8,8)"), 'esqueletos devem usar desenho vetorial suave, não quadradinhos');
assert.ok(server.includes("filter(q=>visible(q.x,q.y)).map(q=>[q.x|0,q.y|0])"), 'snapshots não devem enviar esqueletos fora do raio visível');

assert.ok(serviceWorker.includes('shell-v26'), 'service worker precisa invalidar a versão antiga do shell');

assert.ok(app.includes("if(OFF&&offlineTimer){clearInterval(offlineTimer);offlineTimer=0}") && app.includes("if(OFF&&OR&&!offlineTimer){offlineTimer=setInterval(offlineTick,33);offlineTick()}"), 'timer offline precisa parar em segundo plano e retomar ao voltar');
assert.ok(app.includes('let GAME_SAFE_TOP=28;') && app.includes('const gameSafeTop=GAME_SAFE_TOP;'), 'área segura do HUD deve ser calculada no resize e não em todos os frames');
assert.ok(app.includes("if(fpsNode.style.display!==fpsDisplay)fpsNode.style.display=fpsDisplay") && app.includes("if($('fim').style.display!=='flex')$('fim').style.display='flex'"), 'renderização não deve reescrever o DOM repetidamente a cada frame');
assert.ok(app.includes('moving=m2&&!p.d&&!S.pa&&Math.hypot(lookX,lookY)>.12'), 'vetor do joystick deve ser reutilizado no desenho do player');
assert.ok(server.includes('if(devAttempts.size>2000)'), 'mapa de limitação DEV deve ter limite de memória');

assert.ok(app.includes("key=items.join('|'),active=GAME_STATE==='PLAYING'||GAME_STATE==='GAMEOVER'")&&app.includes('visible=active&&items.length>0')&&app.includes('Array.isArray(p&&p.it)?p.it:SV.items'), 'HUD de itens precisa aparecer com os itens do modo DEV também');
assert.ok(app.includes("try{ws.send(JSON.stringify({t:'pick',i}))}catch(e)"), 'envio de melhoria deve lidar com desconexões');
assert.ok(app.includes("try{ws.send(JSON.stringify({t:'in',dx,dy}))}catch(e)"), 'envio de movimento deve lidar com desconexões');
assert.ok(server.includes('c.bufferedAmount>262144')&&server.includes('client.bufferedAmount>524288'), 'servidor precisa limitar filas de WebSocket em conexões lentas');


// Regression checks for progression pacing, pickup magnet and skeleton targeting.
assert.ok(app.includes('p.nx=Math.ceil(p.nx*1.17+1.4)'), 'curva de XP deve evitar travar a progressão');
assert.ok(app.includes('const magnetRange=150*(1+.65*(p.ps.ima||0))'), 'ímã deve alcançar corações e itens com alcance confortável');
assert.ok(app.includes('h.x+=(p.x-h.x)/d*9;h.y+=(p.y-h.y)/d*9'), 'corações devem ser puxados com velocidade suficiente');
assert.ok(app.includes('for(let i=0;i<16&&r.es.length<42;i++)offlineSpawn(r,p,7)'), 'hordas devem ter mais monstros fracos');
assert.ok(server.includes('const stopGap=e.r+(isSkeleton?14:27)'), 'monstros devem conseguir alcançar e atacar esqueletos');
assert.ok(server.includes('const magnetRange=p=>150*(1+.65*(p.ps.ima||0))'), 'servidor deve aplicar o ímã a corações e itens');
