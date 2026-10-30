// Processed-art contract checks. These catch broken strips before the browser
// turns one damaged PNG into four unrelated slices.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = (condition, message) => {
  if (!condition) { console.error('FAIL:', message); process.exit(1); }
};
const root = path.resolve(__dirname, '..');
function png(name) {
  const data = fs.readFileSync(path.join(root, 'assets', name));
  assert(data.toString('hex', 0, 8) === '89504e470d0a1a0a', `${name} is a PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), depth: data[24], colour: data[25] };
}

const aliens = {
  'alien_drifter.png': [4, 13, 12], 'alien_chaser.png': [4, 13, 10],
  'alien_bouncer.png': [4, 16, 12], 'alien_diver.png': [4, 15, 15],
  'alien_heavy.png': [4, 19, 12], 'alien_ufo.png': [4, 16, 16],
};
for (const [name, [frames, frameWidth, height]] of Object.entries(aliens)) {
  const im = png(name);
  assert(im.width === frames * frameWidth && im.height === height, `${name} keeps four equal frames`);
  assert(im.depth === 8 && im.colour === 6, `${name} keeps 8-bit RGBA alpha`);
}

const explosions = { 'exp_small.png': 7, 'exp_air.png': 8, 'exp_ground.png': 16, 'exp_big.png': 16 };
for (const [name, frames] of Object.entries(explosions)) {
  const im = png(name);
  assert(im.width === im.height * frames, `${name} frame count matches the runtime table`);
}
const back = png('bg_back.png'), stars = png('bg_stars.png');
assert(back.width === stars.width && back.height === stars.height, 'parallax layers share a clean loop size');
assert(png('earth.png').width === 28 && png('earth.png').height === 28, 'Earth keeps its square HUD silhouette');
assert(png('silo.png').width === 14 && png('silo.png').height === 35, 'fuel silo keeps its narrow depot silhouette');

const packed = fs.readFileSync(path.join(root, 'web', 'assets.js'), 'utf8');
for (const name of [...Object.keys(aliens), ...Object.keys(explosions), 'bg_back.png', 'bg_stars.png', 'earth.png', 'silo.png']) {
  assert(packed.includes(name.replace('.png', '')), `${name} is present in the packed browser assets`);
}

const main = fs.readFileSync(path.join(root, 'web', 'main.js'), 'utf8');
const jetTopMatch = main.match(/const JET_TOP = \[([\s\S]*?)\n\];/);
const jetLegMatch = main.match(/const JET_LEGS = \{([\s\S]*?)\n\};/);
assert(jetTopMatch && jetLegMatch, 'Jetman source sprites remain explicit and testable');
const rows = text => [...text.matchAll(/'([^']+)'/g)].map(m => m[1]);
const jetTop = rows(jetTopMatch[1]), jetLegs = rows(jetLegMatch[1]);
assert(jetTop.length === 15 && jetLegs.length === 20, 'Jetman keeps 15 shared body rows and four five-row poses');
for (const row of [...jetTop, ...jetLegs]) {
  assert(row.length === 17, 'every Jetman row keeps the 17-pixel animation grid');
  assert(/^[.WwCBbYORrKcgGmM]+$/.test(row), 'Jetman uses only the declared game palette');
}
assert(main.includes('for (const o of [-13, 0, 13])'), 'rover keeps three articulated wheel positions');
assert(main.includes('R(c, PALC.K, sx - 21, by - 14, 42, 8)'), 'rover keeps the 42-pixel outlined chassis');
assert(main.includes('wheel(tsx - 7') && main.includes('wheel(tsx + 7'), 'equipment trailer keeps its two-wheel silhouette');

console.log('art asset and original sprite contract ok');
console.log('ALL OK');
