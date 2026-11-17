'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const html = read('index.html');
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/i);
assert.ok(inlineScript, 'index.html deve conter o script principal');
const appScript = inlineScript[1];
new vm.Script(appScript, { filename: 'index.html' });

for (const path of ['server.js', 'auth.js', 'sw.js']) {
  new vm.Script(read(path), { filename: path });
}

const declaredIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicates = declaredIds.filter((id, index) => declaredIds.indexOf(id) !== index);
assert.deepEqual(duplicates, [], 'IDs HTML não podem estar duplicados');

const idSet = new Set(declaredIds);
const usedIds = [...appScript.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map((match) => match[1]);
const missingIds = [...new Set(usedIds.filter((id) => !idSet.has(id)))];
assert.deepEqual(missingIds, [], 'todo elemento acessado por $(id) precisa existir no HTML');

const dkMatch = appScript.match(/const dk=(.*);/);
assert.ok(dkMatch, 'função de ajuste de cor precisa existir');
const adjustColor = vm.runInNewContext(dkMatch[1]);
const paletteMatch = appScript.match(/const CO=(\{[^;]+\});/);
assert.ok(paletteMatch, 'paleta dos personagens precisa existir');
const palette = vm.runInNewContext('(' + paletteMatch[1] + ')');

for (const [className, color] of Object.entries(palette)) {
  const bright = adjustColor(color, 1.32);
  assert.match(bright, /^#[0-9a-f]{6}$/i, \`cor de brilho inválida para \${className}: \${bright}\`);
  for (const offset of [1, 3, 5]) {
    assert.ok(Number.parseInt(bright.slice(offset, offset + 2), 16) <= 255,
      \`canal de cor excedeu 255 para \${className}\`);
  }
}

const serviceWorker = read('sw.js');
const cachePattern = serviceWorker.match(/if\(response\.ok&&!\/(.*?)\/i\.test/);
assert.ok(cachePattern, 'filtro de Cache-Control deve existir');
const noStore = new RegExp(cachePattern[1], 'i');
assert.equal(noStore.test('no-store'), true, 'no-store deve ser reconhecido');
assert.equal(noStore.test('public, max-age=86400'), false, 'cache público não deve ser bloqueado');

console.log(\`Smoke tests passaram: JavaScript, IDs HTML, cores dos personagens e filtro de cache. \${usedIds.length} referências DOM verificadas.\`);
