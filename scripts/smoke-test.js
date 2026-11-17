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
assert.ok(app.includes('const cx=pp.x-W/2,cy=pp.y-H/2'), 'a câmera deve seguir sem bordas do mapa');
assert.match(app, /const oClamp=v=>Math\.max\(-1000000000/);
assert.match(app, /const PRICE=\{normal:\[0,0\],arqueiro:\[900,0\],cavaleiro:\[3000,0\],mago:\[5000,0\],curandeiro:\[0,600\],necromante:\[0,900\]\}/);
assert.ok(app.includes("if(p.cls==='necromante')"), 'necromante precisa invocar esqueletos');
assert.ok(app.includes('(S.k||[])'), 'esqueletos precisam ser desenhados na partida');
assert.ok(!app.includes('wx(W,H,S.mp|0,t)'), 'efeitos de partículas da tela do lobby não devem aparecer na partida');
assert.ok(!app.includes('const grain=86'), 'remover granulação de pontos do mapa durante a partida');
const onlineHandler=app.match(/socket\.onmessage=e=>\{([\s\S]*?)\n  \};/);
assert.ok(onlineHandler, 'handler de snapshots online ausente');
assert.ok(!/lw=0;gc=0;gk=0/.test(onlineHandler[1]), 'contadores de saldo não podem ser zerados em cada snapshot');
assert.ok(app.includes('const ECONOMY_VERSION=1;'), 'versão de reparo da economia ausente');
assert.ok(app.includes('SV.co=0;SV.cr=0;SV.economyVersion=ECONOMY_VERSION'), 'saldos antigos inflados precisam ser corrigidos uma única vez');
assert.ok(app.includes('localEconomyIsNewer')&&app.includes('remoteEconomyIsNewer'), 'merge da nuvem precisa respeitar a versão da economia');
assert.ok(auth.includes('economyVersion: Math.max(0, Math.min(1,'), 'servidor precisa preservar a versão da economia');
const joinSection=app.match(/function joinOnline\(roomCode,button\)\{([\s\S]*?)const openSocket/);
assert.ok(joinSection&&/lw=0;gc=0;gk=0/.test(joinSection[1]), 'contadores precisam iniciar uma vez por partida');
assert.ok(app.includes('function drawBiomeLandmark('), 'decorações grandes dos biomas ausentes');
assert.ok(app.includes('if(h%2===0)drawBiomeLandmark(X,Y,map,h)'), 'biomas precisam renderizar árvores, dunas, gelo e rochas de lava');
assert.ok(app.includes('c.scale(1.42*(1+squash),.98*(1-squash))'), 'slime precisa ter silhueta larga de gelatina em vez de esfera');
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
assert.match(html, /version-pill">v4\.1</, 'a versão exibida no lobby precisa aumentar');

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
assert.match(server, /choiceExpiresAt=p\.ch\.length\?Date\.now\(\)\+10000/, 'timeout de escolha de habilidade de 10s ausente');
assert.match(server, /function roomMessage/, 'mensagens da sala de espera ausentes');
assert.match(server, /r\.startAt=Date\.now\(\)\+5000/, 'contagem regressiva de início ausente');
assert.match(server, /separateX/, 'separação de monstros ausente');

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

console.log('Smoke tests aprovados. Referências DOM: ' + usedIds.length + '; classes: 6; upgrades permanentes: ' + Object.keys(shopUpgrades).length + '.');
