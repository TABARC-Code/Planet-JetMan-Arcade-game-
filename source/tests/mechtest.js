// Same checks as mechtest.py, against the browser rules. Run: node tests/mechtest.js
// If these pass and the Python ones pass, the two copies probably still agree. Probably.
'use strict';
const L = require('../web/game.js');
const { Game, Alien, Missile, LEVEL_PROFILES, levelProfile, newInput, wrap, wdx } = L;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } };

const G = () => { const g = new Game(null, 5); g.spawnT = 1e9; return g; };
function run(g, n, keys = {}) {
  const inp = newInput();
  for (let f = 0; f < n; f++) {
    for (const k in keys) inp[k] = k.endsWith('_p') ? (f === 0 && keys[k]) : keys[k];
    g.update(1 / 60, inp);
  }
}

assert(LEVEL_PROFILES.length === 6, 'six authored level profiles');
assert(levelProfile(1).name === 'DUST PLAIN' && levelProfile(1).time === 160,
  'level one keeps the original opening pace');
assert(levelProfile(4).kinds.includes('diver') && !levelProfile(3).kinds.includes('diver'),
  'divers arrive on the named fourth level');
assert(levelProfile(5).kinds.includes('heavy') && levelProfile(6).kinds.includes('ufo'),
  'heavy and UFO introductions are explicit');
assert(levelProfile(7).time === 75 && levelProfile(7).maxAliens === 9 && levelProfile(7).spawn === 1,
  'post-profile escalation preserves the established limits');
console.log('level profiles ok');

let g = G(), p = g.p;
const bomb = g.items.find(i => i.kind === 'bomb');
run(g, 120); p.x = bomb.x; p.y = bomb.y; p.onGround = true;
run(g, 1, { pick_p: true }); assert(p.carry === bomb, 'pick bomb');
p.x = g.base.x; p.y = 100; p.onGround = false;
const lvl = g.level;
run(g, 1, { pick_p: true }); run(g, 120); assert(!g.base.alive, 'base destroyed');
run(g, 360); assert(g.level === lvl + 1 && g.base.alive, 'next level');
assert(g.stats.levelTransitions === 1, 'level transition counted once');
console.log('bomb ok');

g = G(); p = g.p; let c = g.terr.craters[0];
const kit = g.items.find(i => i.kind === 'bridge');
run(g, 120); p.carry = kit; kit.state = 'held'; p.x = c.x; p.y = 60; p.onGround = false;
run(g, 1, { pick_p: true }); run(g, 90); assert(c.bridged, 'kit bridges crater'); console.log('bridge kit ok');

g = G(); p = g.p; let r = g.rover; c = g.terr.craters[1];
r.x = wrap(c.x - c.r - 40); r.dir = 1; p.inRover = true;
for (let f = 0; f < 300 && g.stats.roverBlockEvents === 0; f++) run(g, 1, { right: true });
assert(r.blocked === c, 'rover blocked');
assert(g.stats.roverBlockEvents === 1 && r.blockedPulse > 0, 'rover blockage counted once with pulse');
run(g, 60, { right: true }); assert(g.stats.roverBlockEvents === 1, 'held drive does not repeat blockage event');
run(g, 1, { pick_p: true }); assert(c.bridged && r.bridges === 1, 'rover lays bridge');
assert(g.stats.roverBridgesLaid === 1, 'bridge recovery counted once');
run(g, 200, { right: true }); assert(wdx(r.x, c.x) > 0, 'rover crossed'); console.log('rover bridge ok');

g = G(); p = g.p; r = g.rover; const b2 = g.items.find(i => i.kind === 'bomb');
run(g, 60); p.carry = b2; b2.state = 'held'; p.x = wrap(r.trailerX() - 6); p.face = 1; p.y = g.terr.base(p.x); p.onGround = true;
run(g, 1, { pick_p: true }); run(g, 30); assert(r.cargo === b2, 'trailer load');
run(g, 1, { pick_p: true }); assert(p.carry === b2 && !r.cargo, 'trailer unload'); console.log('trailer ok');

g = G(); p = g.p; p.x = g.tele[0]; p.y = g.terr.base(p.x); p.onGround = true; run(g, 2);
run(g, 1, { down_p: true }); assert(Math.abs(wdx(p.x, g.tele[1])) < 2, 'teleport'); console.log('teleport ok');

g = G(); p = g.p; r = g.rover; p.fuel = 10; p.x = r.x; p.y = g.terr.base(r.x); p.onGround = true;
run(g, 1, { down_p: true }); assert(p.inRover, 'board'); run(g, 120); assert(p.fuel > 60, 'refuel');
run(g, 1, { up_p: true }); assert(!p.inRover, 'leave'); console.log('rover enter/exit ok');

g = G(); g.timer = 0.01; const lives = g.lives; run(g, 2); assert(g.missiles.length === 2, 'launch');
run(g, 3600); assert(g.lives === lives - 1 && g.earthHits === 1, 'missiles land'); console.log('missiles ok');

g = G(); g.earthHits = 2; g.timer = 0.01; run(g, 600); assert(g.over, 'earth destroyed'); console.log('earth over ok');

g = G(); const n = g.terr.craters.length;
let ax = wrap(g.rover.x + 400);
while (g.terr.craters.some(c2 => Math.abs(wdx(ax, c2.x)) < 40) || Math.abs(wdx(ax, g.base.x)) < 60) ax = wrap(ax + 25);
const a = new Alien('diver', ax, 150, 1, 40); a.diving = true; a.vx = 0; a.vy = 60;
g.aliens.push(a); g.cam = a.x; run(g, 120); assert(g.terr.craters.length === n + 1, 'crash crater'); console.log('crash crater ok');
assert(g.stats.diverCrashes === 1, 'diver crash counted once');

const diverHeard = [];
g = new Game({ play: name => diverHeard.push(name), loop() {}, stopLoops() {} }, 5); g.spawnT = 1e9;
r = g.rover;
const aim = wrap(r.x + r.dir * L.DIVER_AIM_LEAD);
const telegraph = new Alien('diver', aim, 70, 1, 0); g.aliens.push(telegraph);
run(g, 1);
assert(!telegraph.diving && telegraph.diveWarnT === L.DIVER_WARNING, 'diver enters exact warning state before diving');
assert(telegraph.diveTargetX === aim && g.stats.diverTelegraphs === 1, 'diver captures wrap-safe target once');
assert(diverHeard.filter(n => n === 'divewarn').length === 1, 'diver warning cue plays once on entry');
r.x = wrap(r.x + 300);
run(g, Math.floor(L.DIVER_WARNING * 60) - 1);
assert(!telegraph.diving, 'diver cannot launch before warning expires');
run(g, 2);
assert(telegraph.diving && g.stats.diverLaunches === 1, 'diver launches once after warning');
assert(Math.sign(telegraph.vx) === Math.sign(wdx(aim, telegraph.x)) || telegraph.vx === 0, 'diver honours captured target after rover moves');
console.log('diver telegraph ok');

g = G(); r = g.rover; r.x = L.WORLD - 20; r.dir = 1;
const seamAim = wrap(r.x + L.DIVER_AIM_LEAD);
const seamDiver = new Alien('diver', seamAim, 70, 1, 0); g.aliens.push(seamDiver);
run(g, 1); assert(seamDiver.diveWarnT > 0 && seamDiver.diveTargetX === seamAim, 'diver lock works across world seam');

g = G(); const h = new Alien('heavy', wrap(g.p.x + 30), 60, 1, 0); g.aliens.push(h); g.p.face = 1;
assert(h.hp === 2 && h.hpMax === 2 && h.hitT === 0, 'heavy damage state initialised');
g.killAlien(h); assert(g.aliens.includes(h) && h.hp === 1 && h.hitT > 0, 'heavy survives with hit flash');
g.updateAliens(L.ALIEN_HIT_FLASH / 2); assert(h.hitT > 0 && h.hp < h.hpMax, 'hit flash remains briefly');
g.updateAliens(L.ALIEN_HIT_FLASH); assert(h.hitT === 0 && h.hp < h.hpMax, 'persistent damaged state outlives flash');
const heavyScore = g.score; g.killAlien(h); assert(!g.aliens.includes(h) && g.score === heavyScore + L.ALIEN_SCORE.heavy, 'heavy dies and scores once');
g.killAlien(h); assert(g.score === heavyScore + L.ALIEN_SCORE.heavy, 'stale heavy cannot score twice');
const d = new Alien('drifter', wrap(g.p.x + 40), 60, 1, 0); g.aliens.push(d); g.killAlien(d);
assert(!g.aliens.includes(d), 'one-hit enemy still dies immediately');
console.log('enemy damage state ok');

g = G(); g.level = 6; const u = new Alien('ufo', wrap(g.p.x + 60), 60, 1, 45); g.aliens.push(u); g.cam = g.p.x;
run(g, 600); assert(!g.terr.craters.some(c2 => Math.abs(wdx(c2.x, u.x)) < 5) , 'ufo never cratered'); console.log('ufo ok');

// sound is code now - make sure every recipe and the music render to something sane
const { SFX_RECIPES, renderSfx } = require('../web/sfx.js');
for (const k in SFX_RECIPES) {
  const d = renderSfx(SFX_RECIPES[k], 44100);
  let peak = 0; for (const v of d) { assert(Number.isFinite(v), 'sfx ' + k + ' NaN'); peak = Math.max(peak, Math.abs(v)); }
  assert(peak > 0.05 && peak <= 1, 'sfx ' + k + ' level ' + peak);
}
assert(SFX_RECIPES.warning.dur > SFX_RECIPES.alarm.dur, 'warning is distinct from countdown pip');
assert(SFX_RECIPES.divewarn.dur < L.DIVER_WARNING, 'diver cue leaves time to react');
assert(SFX_RECIPES.blocked.dur < SFX_RECIPES.warning.dur, 'rover thunk is distinct from urgency warning');
const mus = require('../web/music.js').renderMusic(22050);
assert(mus.data.length > 22050 * 20 && mus.loopStart > 0 && mus.loopEnd > mus.loopStart, 'music shape');
assert(mus.data.every(Number.isFinite), 'music NaN');
console.log('sound ok (' + Object.keys(SFX_RECIPES).length + ' effects + ' + (mus.data.length / 22050).toFixed(0) + 's music)');

const heard = [];
g = new Game({ play: name => heard.push(name), loop() {}, stopLoops() {} }, 5); g.spawnT = 1e9;
g.p.inRover = false; g.p.fuel = L.LOW_FUEL_LEVEL - 1; run(g, 1);
assert(heard.filter(n => n === 'warning').length === 1, 'low fuel warns on entry');
run(g, Math.floor(L.LOW_FUEL_REPEAT * 60) - 2);
assert(heard.filter(n => n === 'warning').length === 1, 'low fuel warning respects cooldown');
run(g, 3); assert(heard.filter(n => n === 'warning').length === 2, 'low fuel warning repeats');
g.p.inRover = true; run(g, 1); g.p.inRover = false; g.p.fuel = L.LOW_FUEL_LEVEL - 1; run(g, 1);
assert(heard.filter(n => n === 'warning').length === 3, 'rover refuel resets low fuel warning');
console.log('low fuel warning ok');
heard.length = 0; g = new Game({ play: name => heard.push(name), loop() {}, stopLoops() {} }, 5); g.spawnT = 1e9;
g.p.fuel = L.LOW_FUEL_LEVEL - 1; g.timer = 9;
run(g, 1);
assert(!heard.includes('warning') && g.fuelWarnLatched, 'final countdown suppresses low-fuel audio but keeps warning state');
console.log('warning priority ok');
console.log('ALL OK');
