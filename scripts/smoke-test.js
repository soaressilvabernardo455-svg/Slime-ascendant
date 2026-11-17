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
assert.ok(app.includes('function createBackupCode('), 'exportação do progresso ausente');
assert.ok(app.includes('function importBackupCode('), 'importação do progresso ausente');
assert.ok(app.includes('function claimDailyReward('), 'trava da recompensa diária ausente');
assert.ok(app.includes('function startMusic('), 'música do jogo ausente');
assert.ok(app.includes('function updateRoomWait('), 'sala de espera online ausente');
assert.ok(app.includes("screen.orientation.unlock"), 'orientação do aparelho precisa ficar livre');
assert.ok(!app.includes("screen.orientation.lock('landscape')"), 'o jogo não pode forçar paisagem');
assert.ok(app.includes("credentials:'include'"), 'requisições de conta devem enviar cookies');
assert.ok(app.includes("if(connectTimer)clearTimeout(connectTimer)"), 'watchdog de entrada precisa ser limpo depois de entrar na sala');
assert.match(html, /version-pill">v4\.0</, 'a versão exibida no lobby precisa aumentar');

assert.match(server, /MAX_PLAYERS=4/, 'limite de quatro jogadores ausente');
assert.match(server, /MAX_CONNECTIONS=40/, 'limite de conexões simultâneas ausente');
assert.match(server, /let k=.*r=null/, 'a sala deve ser criada somente após join');
assert.match(server, /MAX_MESSAGE_RATE=45/, 'limite de frequência WebSocket ausente');
assert.match(server, /maxPayload:2048/, 'limite de tamanho de mensagem WebSocket ausente');
assert.match(server, /function cleanPlayerData/, 'validação dos dados enviados pelo cliente ausente');
assert.match(server, /UPGRADE_KEYS=\['vida','dano','vel','moeda'\]/, 'whitelist de melhorias permanentes ausente');
assert.match(server, /VIEW_RADIUS=640/, 'raio de visibilidade por jogador ausente');
assert.match(server, /choiceExpiresAt=p\.ch\.length\?Date\.now\(\)\+10000/, 'timeout de escolha de habilidade de 10s ausente');
assert.match(server, /function roomMessage/, 'mensagens da sala de espera ausentes');
assert.match(server, /r\.startAt=Date\.now\(\)\+5000/, 'contagem regressiva de início ausente');
assert.match(server, /separateX/, 'separação de monstros ausente');

assert.match(auth, /SameSite=Lax/, 'cookie de sessão precisa usar SameSite=Lax');
assert.match(auth, /Expires=/, 'cookie precisa ter expiração persistente');
assert.match(auth, /Secure/, 'cookie precisa usar HTTPS em produção');

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
