'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function read(path) { return fs.readFileSync(path, 'utf8'); }

const html = read('index.html');
const match = html.match(/<script>([\\s\\S]*?)<\\/script>/i);
assert.ok(match, 'index.html precisa conter o script principal');
const app = match[1];
new vm.Script(app, { filename: 'index.html' });
for (const path of ['server.js', 'auth.js', 'sw.js']) {
  new vm.Script(read(path), { filename: path });
}

const ids = [...html.matchAll(/\\bid=[\"']([^\"']+)[\"']/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, 'IDs HTML duplicados');
const idSet = new Set(ids);
const used = [...app.matchAll(/\\$\\(['\"]([^'\"]+)['\"]\\)/g)].map((m) => m[1]);
const missing = [...new Set(used.filter((id) => !idSet.has(id)))];
assert.deepEqual(missing, [], 'referências a elementos ausentes no HTML');

const colorFn = app.match(/const dk=(.*);/);
assert.ok(colorFn, 'função de cor do slime ausente');
const dk = vm.runInNewContext(colorFn[1]);
const paletteFn = app.match(/const CO=(\\{[^;]+\\});/);
assert.ok(paletteFn, 'paleta de cores ausente');
const palette = vm.runInNewContext('(' + paletteFn[1] + ')');
for (const [name, color] of Object.entries(palette)) {
  const bright = dk(color, 1.32);
  assert.match(bright, /^#[0-9a-f]{6}$/i, 'cor inválida para ' + name + ': ' + bright);
  for (const offset of [1, 3, 5]) {
    assert.ok(parseInt(bright.slice(offset, offset + 2), 16) <= 255, 'canal RGB fora do limite');
  }
}

const sw = read('sw.js');
const cachePattern = sw.match(/if\\(response\\.ok&&!\\/(.*?)\\/i\\.test/);
assert.ok(cachePattern, 'regra de cache ausente');
const noStore = new RegExp(cachePattern[1], 'i');
assert.equal(noStore.test('no-store'), true, 'no-store deve ser excluído do cache');
assert.equal(noStore.test('public, max-age=86400'), false, 'cache público não deve ser excluído');

assert.match(app, /function startMusic\\(/, 'música de fundo precisa estar implementada');
assert.match(app, /function claimDailyReward\\(/, 'recompensa diária precisa ter trava contra repetição');
console.log('Smoke tests passaram. IDs verificados: ' + used.length + '.');
