// Lunar Jetman, the rebuild. Browser edition - rules and simulation only.
//
// Clean room. Rules came from the old manual, reviews and remake write-ups.
// Not one byte of the 1983 original was looked at.
//
// No DOM in this file, on purpose. Node loads it for the tests.
// This is the master copy of the rules. lunar_jetman.py is parked; a Windows build
// comes later and should start from here.
//
// Ideas, in no sensible order:
//   - teleporters as trailer cargo, like the original. Fixed pads were quicker. Guilty.
//   - two-player co-op (the Nebula remake has it). HUD would need a rethink.
//   - fixed-timestep update. dt is clamped, which is fine until it isn't.
//   - proper wave tables per level instead of the weighted bag in kinds().
'use strict';

const VERSION = '4.6.0';
const W = 320, H = 200, HUD = 20, HI_W = 1280, HI_H = 800;
const WORLD = 3072, GROUND = 170, HOME_X = 160, CEILING = HUD + 14;
const TAU = Math.PI * 2;

const mod = (a, n) => ((a % n) + n) % n;
const wrap = x => mod(x, WORLD);
function wdx(a, b) { const d = mod(a - b, WORLD); return d > WORLD / 2 ? d - WORLD : d; }
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const trunc = Math.trunc;
const uni = (a, b) => a + (b - a) * Math.random();
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
const randint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function removeItem(arr, it) { const i = arr.indexOf(it); if (i >= 0) arr.splice(i, 1); return i >= 0; }

// mulberry32. Seeded so the title-screen moon looks the same every boot.
function RNG(seed) {
  let s = (seed === undefined ? Math.random() * 4294967296 : seed * 2654435761) >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    random: next,
    uniform: (a, b) => a + (b - a) * next(),
    randint: (a, b) => a + Math.floor(next() * (b - a + 1)),
    choice: arr => arr[Math.floor(next() * arr.length)],
  };
}

const PAL = {
  W: [236, 236, 244], w: [150, 150, 172], K: [24, 24, 36], C: [90, 220, 255], c: [40, 130, 190],
  B: [70, 100, 235], b: [36, 50, 140], Y: [255, 224, 70], O: [255, 150, 40], R: [235, 60, 60],
  r: [140, 24, 36], G: [90, 230, 100], g: [30, 130, 60], M: [230, 80, 230], m: [130, 40, 140],
};
const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const PALC = {};
for (const k in PAL) PALC[k] = css(PAL[k]);

const ALIEN_SCORE = { drifter: 50, chaser: 80, bouncer: 100, diver: 150, heavy: 200 };
const ALIEN_SPEED = { drifter: 38, chaser: 34, bouncer: 42, diver: 50, heavy: 26 };
const ALIEN_HP = { heavy: 2 };
const ALIEN_HIT_FLASH = 0.14;
const DIVER_WARNING = 0.55;
const DIVER_AIM_LEAD = 60;
const DIVER_LOCK_RANGE = 50;
const LOW_FUEL_LEVEL = 15;
const LOW_FUEL_RESET = 25;
const LOW_FUEL_REPEAT = 6;
ALIEN_SCORE.ufo = 250; ALIEN_SPEED.ufo = 45;
const LEVEL_PROFILES = Object.freeze([
  Object.freeze({ name: 'DUST PLAIN', theme: 'dust', time: 160, maxAliens: 3, speed: 1.00, spawn: 2.2,
    kinds: Object.freeze(['drifter', 'drifter', 'drifter']), briefing: 'DRIFTERS OVER THE DEPOT' }),
  Object.freeze({ name: 'STATIC VALLEY', theme: 'static', time: 145, maxAliens: 4, speed: 1.08, spawn: 2.0,
    kinds: Object.freeze(['drifter', 'drifter', 'drifter', 'chaser', 'chaser']), briefing: 'CHASERS HAVE FOUND THE ROVER' }),
  Object.freeze({ name: 'CRATER BELT', theme: 'crater', time: 130, maxAliens: 5, speed: 1.16, spawn: 1.8,
    kinds: Object.freeze(['drifter', 'drifter', 'drifter', 'chaser', 'chaser', 'bouncer', 'bouncer']), briefing: 'BOUNCERS OWN THE LOW GROUND' }),
  Object.freeze({ name: 'RED TERMINATOR', theme: 'red', time: 115, maxAliens: 6, speed: 1.24, spawn: 1.6,
    kinds: Object.freeze(['drifter', 'drifter', 'drifter', 'chaser', 'chaser', 'bouncer', 'bouncer', 'diver', 'diver']), briefing: 'DIVERS MARK THEIR ATTACKS' }),
  Object.freeze({ name: 'IRON WASTE', theme: 'iron', time: 100, maxAliens: 7, speed: 1.32, spawn: 1.4,
    kinds: Object.freeze(['drifter', 'drifter', 'drifter', 'chaser', 'chaser', 'bouncer', 'bouncer', 'diver', 'diver', 'heavy', 'heavy']), briefing: 'HEAVIES NEED A SECOND HIT' }),
  Object.freeze({ name: 'BLACK SKY', theme: 'void', time: 85, maxAliens: 8, speed: 1.40, spawn: 1.2,
    kinds: Object.freeze(['drifter', 'drifter', 'drifter', 'chaser', 'chaser', 'bouncer', 'bouncer', 'diver', 'diver', 'heavy', 'heavy', 'ufo', 'ufo']), briefing: 'EVERYTHING IS NOW INVITED' }),
]);
function levelProfile(level) {
  const n = Math.max(1, trunc(level || 1));
  const base = LEVEL_PROFILES[Math.min(n, LEVEL_PROFILES.length) - 1];
  const extra = Math.max(0, n - LEVEL_PROFILES.length);
  if (!extra) return base;
  return {
    ...base,
    name: `${base.name} ${extra + 1}`,
    time: Math.max(75, base.time - extra * 10),
    maxAliens: Math.min(9, base.maxAliens + Math.ceil(extra / 2)),
    speed: base.speed + extra * 0.08,
    spawn: Math.max(0.6, base.spawn - extra * 0.2),
  };
}
// Explosion strips: frame count per kind, seconds per frame. Must match the PNGs.
const BOOM_FRAMES = { small: 7, air: 8, ground: 16, big: 16 };
const BOOM_DT = 0.05;

// ------------------------------------------------------------------ world
// The moon is a loop, WORLD px round. Every x goes through wrap()/wdx().
// Forget once and things teleport.
class Crater {
  // depth ~0.9r looks right. Science it isn't.
  constructor(x, r) { this.x = wrap(x); this.r = r; this.depth = trunc(r * 0.9); this.bridged = false; }
}

class Terrain {
  constructor(rng) {
    const ph = []; for (let i = 0; i < 8; i++) ph.push(rng.uniform(0, 6.283));
    // Sum of sines, whole-number frequencies, so it joins up at the seam. No noise library needed.
    this.h = new Array(WORLD);
    for (let x = 0; x < WORLD; x++) {
      const t = x / WORLD * TAU;
      const v = 4 * Math.sin(2 * t + ph[0]) + 3 * Math.sin(5 * t + ph[1])
        + 1.5 * Math.sin(13 * t + ph[2]) + 0.7 * Math.sin(31 * t + ph[3]);
      this.h[x] = GROUND + Math.round(v);
    }
    this.mount = new Array(1024);
    for (let x = 0; x < 1024; x++) {
      const t = x / 1024 * TAU;
      const v = 14 * Math.sin(3 * t + ph[4]) + 8 * Math.sin(7 * t + ph[5])
        + 4 * Math.sin(17 * t + ph[6]) + 2 * Math.sin(41 * t + ph[7]);
      this.mount[x] = trunc(138 + v);
    }
    this.craters = [];
    this.version = 0;
  }
  craterAt(x, margin = 0) {
    for (const c of this.craters) if (Math.abs(wdx(x, c.x)) < c.r + margin) return c;
    return null;
  }
  base(x) { return this.h[mod(trunc(x), WORLD)]; }
  // Bridged craters count as flat. The bowl is still drawn under the girder; nobody minds.
  surface(x) {
    let y = this.h[mod(trunc(x), WORLD)];
    const c = this.craterAt(x);
    if (c && !c.bridged) { const d = wdx(x, c.x) / c.r; y += trunc(c.depth * (1 - d * d)); }
    return y;
  }
}

class Player {
  constructor(x, y) {
    Object.assign(this, { x, y, vx: 0, vy: 0, face: 1, fuel: 100, onGround: true, inRover: false,
      carry: null, dead: false, deadT: 0, invuln: 0, walk: 0, thrust: false, cool: 0 });
  }
}
class Rover {
  constructor(x) { Object.assign(this, { x: wrap(x), dir: 1, v: 0, cargo: null, bridges: 2, wheel: 0,
    blocked: null, blockEpisode: null, blockDir: 0, blockedPulse: 0, cool: 0 }); }
  trailerX() { return wrap(this.x - this.dir * 25); }
}
class Item {
  constructor(kind, x, y) { Object.assign(this, { kind, x: wrap(x), y, vx: 0, vy: 0, state: 'fall' }); }
}
class Alien {
  constructor(kind, x, y, d, spd) {
    const hp = ALIEN_HP[kind] || 1;
    Object.assign(this, { kind, x, y, baseY: y, dir: d, vx: d * spd, vy: 0, t: uni(0, 6), ph: uni(0, 6), spd,
      diving: false, diveWarnT: 0, diveTargetX: null, hp, hpMax: hp, hitT: 0 });
  }
}
class Laser {
  constructor(x, y, d) {
    Object.assign(this, { x0: x, y, dir: d, len: 4, t: 0, dead: false, attached: true, col: choice(['C', 'M', 'Y', 'G', 'W']) });
  }
}
class Missile {
  constructor(x, y, kind) { Object.assign(this, { x, y, kind, vx: 0, vy: -55, hp: 3, t: 0 }); }
}
class Base {
  constructor(x) { this.x = wrap(x); this.alive = true; this.t = 0; }
}

class NoSfx { play() {} loop() {} stopLoops() {} }

function newInput() {
  return { left: false, right: false, up: false, fire: false, up_p: false, down_p: false, pick_p: false, fire_p: false };
}

// ------------------------------------------------------------------ game
// One big class. Yes, really. Split it when it hurts, not before.
class Game {
  constructor(sfx, seed) {
    this.rng = RNG(seed);
    this.sfx = sfx || new NoSfx();
    this.terr = new Terrain(this.rng);
    this.level = 1; this.score = 0; this.lives = 4; this.nextExtra = 10000; this.earthHits = 0; this.t = 0;
    this.tele = [wrap(HOME_X + 135), wrap(HOME_X + WORLD / 2 + 40)];
    this.rover = new Rover(HOME_X + 72);
    this.p = new Player(HOME_X - 30, this.terr.base(HOME_X - 30));
    this.items = []; this.aliens = []; this.lasers = []; this.shells = []; this.missiles = [];
    this.parts = []; this.rings = []; this.booms = [];
    this.base = new Base(0);
    this.placeBase();
    for (let i = 0; i < 40 && this.terr.craters.length < 8; i++)
      this.addCrater(this.rng.uniform(0, WORLD), this.rng.randint(9, 13));
    this.items.push(new Item('bomb', HOME_X + 4, GROUND - 40));
    this.items.push(new Item('bridge', HOME_X - 14, GROUND - 40));
    const cx = wrap(HOME_X + this.rng.choice([-1, 1]) * this.rng.uniform(380, 520));
    this.items.push(new Item('cannon', cx, GROUND - 60));
    this.timer = this.levelTime();
    this.fuelWarnT = 0; this.fuelWarnLatched = false;
    this.gameCueT = 0;
    // Local session figures for balancing. They never leave the page or survive a reload.
    this.stats = { diverTelegraphs: 0, diverLaunches: 0, diverPlayerHits: 0, diverCrashes: 0,
      roverBlockEvents: 0, roverBridgesLaid: 0, levelTransitions: 0 };
    this.nextBaseT = 0; this.kitT = 12; this.spawnT = 4;
    this.cam = this.p.x;
    this.msg = ''; this.msgT = 0; this.shake = 0; this.redFlash = 0;
    this.over = false; this.overReason = '';
    this.flash(`LEVEL 1: ${this.levelName()} - FETCH THE BOMB`, 5);
  }

  // Explicit profiles keep enemy introductions, timing and visual identity together.
  profile() { return levelProfile(this.level); }
  levelName() { return this.profile().name; }
  levelTime() { return this.profile().time; }
  maxAliens() { return this.profile().maxAliens; }
  spdMul() { return this.profile().speed; }
  spawnDelay() { return this.profile().spawn; }
  kinds() { return this.profile().kinds; }
  flash(text, t = 2.5) { this.msg = text; this.msgT = t; }
  playGameplayCue(name, cooldown = 0.12) {
    // The last-ten-seconds alarm has right of way; it is the one warning that can
    // end the level. Brief local cues also share a cooldown so a crowd of divers
    // does not become an accidental chord.
    if (this.gameCueT > 0 || (this.base.alive && this.timer <= 10)) return false;
    this.sfx.play(name); this.gameCueT = cooldown; return true;
  }
  addScore(n) {
    this.score += n;
    while (this.score >= this.nextExtra) {
      this.nextExtra += 10000; this.lives += 1;
      this.sfx.play('extra'); this.flash('EXTRA JETMAN!', 2);
    }
  }
  roverY() { const r = this.rover; return Math.min(this.terr.base(r.x - 10), this.terr.base(r.x), this.terr.base(r.x + 10)); }
  trailerTop() { return this.terr.base(this.rover.trailerX()) - 7; }

  explode(x, y, n = 24, cols = 'YORW', spd = 60, life = 0.8, grav = 40, boom = null) {
    for (let i = 0; i < n; i++) {
      const a = uni(0, TAU), v = uni(0.2, 1) * spd;
      this.parts.push([x, y, Math.cos(a) * v, Math.sin(a) * v, life * uni(0.5, 1), PALC[choice(cols)], grav]);
    }
    this.rings.push([x, y, 2, spd * 0.35, PALC[cols[0]]]);
    if (boom) this.booms.push([x, y, 0, boom]);
  }

  // All the no-go zones are so one unlucky crash can't strand the rover by the depot for good.
  addCrater(x, r, check = true) {
    x = wrap(x);
    const t = this.terr;
    if (check) {
      if (t.craters.length >= 16) return false;
      if (Math.abs(wdx(x, this.rover.x)) < 45 || Math.abs(wdx(x, this.rover.trailerX())) < 22) return false;
      if (Math.abs(wdx(x, HOME_X)) < 70 || (this.base.alive && Math.abs(wdx(x, this.base.x)) < 50)) return false;
      if (this.tele.some(tp => Math.abs(wdx(x, tp)) < 22)) return false;
      if (t.craters.some(c => Math.abs(wdx(x, c.x)) < r + c.r + 8)) return false;
    }
    t.craters.push(new Crater(x, r));
    t.version++;
    return true;
  }

  // 850-1400px out: far enough to need the rover, close enough not to be a chore.
  placeBase() {
    let x = 0;
    for (let i = 0; i < 200; i++) {
      x = wrap(this.rover.x + this.rng.choice([-1, 1]) * this.rng.uniform(850, 1400));
      if (Math.abs(wdx(x, HOME_X)) < 300) continue;
      if (this.tele.some(tp => Math.abs(wdx(x, tp)) < 220)) continue;
      break;
    }
    this.base = new Base(x);
    this.terr.craters = this.terr.craters.filter(c => Math.abs(wdx(c.x, x)) > 50 + c.r);
    this.terr.version++;
  }

  // ---- update
  update(dt, inp) {
    this.t += dt; this.msgT -= dt;
    this.gameCueT = Math.max(0, this.gameCueT - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.redFlash = Math.max(0, this.redFlash - dt);
    this.updatePlayer(dt, inp);
    if (this.over) return;
    this.updateWarnings(dt);
    this.updateRover(dt, inp);
    this.updateItems(dt);
    this.updateAliens(dt);
    this.updateShots(dt);
    if (this.over) return;
    this.updateMissiles(dt);
    if (this.over) return;
    this.updateBase(dt);
    this.updateFx(dt);
    const p = this.p;
    const target = (p.inRover || p.dead) ? this.rover.x : p.x;
    this.cam = wrap(this.cam + wdx(target, this.cam) * Math.min(1, 7 * dt));
    this.sfx.loop('thrust', p.thrust && !p.dead && !p.inRover);
    this.sfx.loop('engine', p.inRover && this.rover.v > 1);
  }

  updatePlayer(dt, inp) {
    const p = this.p, r = this.rover, t = this.terr;
    if (p.dead) {
      p.thrust = false;
      p.deadT -= dt;
      if (p.deadT <= 0) {
        if (this.lives <= 0) { this.end('JETMAN LOST IN ACTION'); return; }
        p.dead = false; p.inRover = true; p.vx = p.vy = 0; p.invuln = 2.5; p.fuel = Math.max(p.fuel, 40);
      }
      return;
    }
    p.invuln = Math.max(0, p.invuln - dt);
    p.cool = Math.max(0, p.cool - dt);
    if (p.inRover) {
      p.thrust = false;
      p.x = r.x; p.y = this.roverY() - 6;
      p.fuel = Math.min(100, p.fuel + 30 * dt);
      if (inp.up_p) {
        p.inRover = false; p.y = this.roverY() - 20; p.vy = -45; p.vx = 0; p.onGround = false;
        this.sfx.play('pick');
      } else if (inp.pick_p) this.layBridgeFromRover();
      if (inp.fire && r.cargo && r.cargo.kind === 'cannon' && r.cool <= 0) this.fireCannon();
      return;
    }
    // Jetpac-ish: floaty in the air, plodding on foot. The bomb makes you heavy, deliberately.
    const move = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (move) p.face = move;
    const heavy = p.carry !== null && p.carry.kind === 'bomb';
    const vmax = heavy ? 62 : 80;
    if (p.onGround) {
      p.vx = move * 38;
      if (move) p.walk += dt * 8;
    } else {
      p.vx += move * 200 * dt;
      if (!move) p.vx *= Math.max(0, 1 - 1.2 * dt);
      p.vx = clamp(p.vx, -vmax, vmax);
    }
    p.x = wrap(p.x + p.vx * dt);

    p.thrust = inp.up && p.fuel > 0;
    const sy = t.surface(p.x);
    if (p.thrust) {
      p.onGround = false;
      p.vy -= (heavy ? 210 : 260) * dt;
      p.fuel = Math.max(0, p.fuel - (p.carry ? 10 : 6.5) * dt);
      if (Math.random() < 0.9)
        this.parts.push([wrap(p.x - p.face * 4), p.y - 3, uni(-8, 8), uni(40, 70), 0.25, PALC[choice('YOR')], 0]);
    }
    if (p.onGround) {
      if (sy - p.y > 3) p.onGround = false; else p.y = sy;
    }
    if (!p.onGround) {
      p.vy += (heavy ? 150 : 120) * dt;
      p.vy = clamp(p.vy, -75, 115);
      p.y += p.vy * dt;
      if (p.y < CEILING) { p.y = CEILING; p.vy = Math.max(p.vy, 0); }
      if (p.y >= sy) { p.y = sy; p.vy = 0; p.onGround = true; }
    }
    if (inp.fire && p.cool <= 0) {
      this.lasers.push(new Laser(wrap(p.x + p.face * 6), p.y - 7, p.face));
      p.cool = 0.17;
      this.sfx.play('laser');
    }
    if (inp.pick_p) { if (p.carry) this.dropItem(); else this.tryPick(); }
    if (inp.down_p) {
      if (Math.abs(wdx(p.x, r.x)) < 16 && p.y >= this.roverY() - 26) this.enterRover();
      else if (p.onGround) {
        for (let i = 0; i < this.tele.length; i++)
          if (Math.abs(wdx(p.x, this.tele[i])) < 9) { this.teleport(i); break; }
      }
    }
  }

  updateWarnings(dt) {
    const p = this.p;
    if (p.dead || p.inRover || p.fuel >= LOW_FUEL_RESET) {
      this.fuelWarnLatched = false;
      this.fuelWarnT = 0;
      return;
    }
    this.fuelWarnT = Math.max(0, this.fuelWarnT - dt);
    if (p.fuel <= LOW_FUEL_LEVEL && (!this.fuelWarnLatched || this.fuelWarnT <= 0)) {
      this.fuelWarnLatched = true;
      this.fuelWarnT = LOW_FUEL_REPEAT;
      if (!(this.base.alive && this.timer <= 10)) this.sfx.play('warning');
      this.flash('LOW FUEL - RETURN TO THE ROVER', 1.5);
    }
  }

  enterRover() {
    const p = this.p, r = this.rover;
    p.inRover = true; p.vx = p.vy = 0;
    if (p.carry) {
      const it = p.carry; p.carry = null;
      if (it.kind === 'bridge' && r.bridges < 4) { r.bridges++; removeItem(this.items, it); }
      else if (r.cargo === null && it.kind !== 'bridge') { r.cargo = it; it.state = 'trailer'; }
      else { it.state = 'fall'; it.x = wrap(r.x + r.dir * 20); }
    }
    this.sfx.play('pick');
  }

  teleport(i) {
    const p = this.p;
    this.explode(p.x, p.y - 6, 20, 'CWB', 40, 0.6, 0);
    p.x = this.tele[1 - i]; p.y = this.terr.base(p.x); this.cam = p.x;
    this.explode(p.x, p.y - 6, 20, 'CWB', 40, 0.6, 0);
    this.sfx.play('teleport');
  }

  tryPick() {
    const p = this.p, r = this.rover;
    let best = null;
    for (const it of this.items) {
      if (it.state !== 'ground' && it.state !== 'fall') continue;
      if (Math.abs(wdx(it.x, p.x)) < 11 && Math.abs(it.y - p.y) < 14) { best = it; break; }
    }
    if (!best && r.cargo && Math.abs(wdx(p.x, r.trailerX())) < 13 && Math.abs(p.y - this.trailerTop()) < 18) {
      best = r.cargo; r.cargo = null;
    }
    if (best) { best.state = 'held'; p.carry = best; this.sfx.play('pick'); }
  }

  // Drops just ahead of you, so you can stand on a crater lip and lob a kit straight in.
  dropItem() {
    const p = this.p, it = p.carry;
    p.carry = null;
    it.state = 'fall';
    it.x = wrap(p.x + p.face * 6);
    it.y = Math.min(p.y, this.terr.surface(it.x)) - 1;
    it.vx = p.vx * 0.4; it.vy = Math.max(0, p.vy);
    this.sfx.play('drop');
  }

  layBridgeFromRover() {
    const r = this.rover;
    if (!r.blocked) this.flash('NO CRATER AHEAD', 1.2);
    else if (r.bridges <= 0) this.flash('NO BRIDGING UNITS - FETCH A KIT FROM THE DEPOT', 2.5);
    else {
      r.blocked.bridged = true; r.blocked = null; r.bridges--; this.terr.version++;
      r.blockEpisode = null; this.stats.roverBridgesLaid++;
      this.addScore(50); this.sfx.play('bridge');
    }
  }

  fireCannon() {
    const r = this.rover;
    const x = r.trailerX(), y = this.trailerTop() - 6;
    let target = null, bd = 1e9;
    for (const a of this.aliens) {
      const d = Math.hypot(wdx(a.x, x), a.y - y);
      if (d < bd && d < 220 && a.y < y) { bd = d; target = a; }
    }
    let dx, dy;
    if (target) { dx = wdx(target.x, x); dy = target.y - y; } else { dx = r.dir * 0.5; dy = -1; }
    const n = Math.hypot(dx, dy) || 1;
    this.shells.push([x, y, dx / n * 180, dy / n * 180, 1.4]);
    r.cool = 0.3;
    this.sfx.play('cannon');
  }

  updateRover(dt, inp) {
    const r = this.rover, p = this.p, t = this.terr;
    r.cool = Math.max(0, r.cool - dt);
    r.blockedPulse = Math.max(0, r.blockedPulse - dt);
    let drive = 0;
    if (p.inRover && !p.dead) drive = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    // Only turns when (nearly) stopped. Handbrake turns on the moon felt wrong.
    if (drive && drive !== r.dir) {
      r.v = Math.max(0, r.v - 90 * dt);
      if (r.v < 4) { r.dir = drive; r.v = 0; }
    } else if (drive) r.v = Math.min(46, r.v + 45 * dt);
    else r.v = Math.max(0, r.v - 50 * dt);
    const c = t.craterAt(r.x + r.dir * 15, 2);
    const blocked = (c && !c.bridged) ? c : null;
    r.blocked = blocked;
    if (!blocked || (r.blockEpisode && r.blockDir !== r.dir)) r.blockEpisode = null;
    if (blocked && p.inRover && drive === r.dir && r.blockEpisode !== blocked) {
      r.blockEpisode = blocked; r.blockDir = r.dir; r.blockedPulse = 0.35;
      this.stats.roverBlockEvents++;
      this.playGameplayCue('blocked');
    }
    if (r.v > 0) {
      if (r.blocked) r.v = 0;
      else {
        r.x = wrap(r.x + r.dir * r.v * dt);
        r.wheel += r.v * dt / 3 * r.dir;
        if (Math.random() < r.v / 60)
          this.parts.push([wrap(r.x - r.dir * 12), this.roverY() - 1, -r.dir * uni(5, 20), uni(-15, -5), 0.5, 'rgb(120,120,140)', 30]);
      }
    }
  }

  updateItems(dt) {
    const p = this.p, r = this.rover, t = this.terr;
    let nKits = 0;
    for (const it of [...this.items]) {
      if (it.kind === 'bridge') nKits++;
      if (it.state === 'held') { it.x = wrap(p.x + p.face * 7); it.y = p.y - 1; continue; }
      if (it.state === 'trailer') { it.x = r.trailerX(); it.y = this.trailerTop(); continue; }
      const sy = t.surface(it.x);
      if (it.state === 'ground') {
        if (sy > it.y + 1) { it.state = 'fall'; it.vy = 0; }
        else { it.y = sy; continue; }
      }
      it.vy = Math.min(160, it.vy + 170 * dt);
      it.x = wrap(it.x + it.vx * dt);
      it.vx *= Math.max(0, 1 - dt);
      it.y += it.vy * dt;
      const b = this.base;
      if (it.kind === 'bomb' && b.alive && Math.abs(wdx(it.x, b.x)) < 18 && it.y >= t.base(b.x) - 17) {
        removeItem(this.items, it); this.destroyBase(); continue;
      }
      if (it.kind === 'bridge') {
        const c = t.craterAt(it.x);
        if (c && !c.bridged && it.y >= t.base(it.x) - 3) {
          c.bridged = true; t.version++;
          removeItem(this.items, it);
          this.addScore(100); this.sfx.play('bridge'); this.flash('CRATER BRIDGED', 1.2);
          continue;
        }
      }
      const tx = r.trailerX(), ty = this.trailerTop();
      // Kits dropped on the trailer go into the rover's stock, not the cargo slot.
      if (Math.abs(wdx(it.x, tx)) < 10 && ty - 3 <= it.y && it.y <= ty + 8 && it.vy >= 0) {
        if (it.kind === 'bridge' && r.bridges < 4) {
          r.bridges++; removeItem(this.items, it);
          this.sfx.play('pick'); this.flash('BRIDGING UNIT STOWED ON ROVER', 1.5);
          continue;
        }
        if (it.kind !== 'bridge' && r.cargo === null) {
          r.cargo = it; it.state = 'trailer'; this.sfx.play('pick'); continue;
        }
      }
      if (it.y >= sy) { it.y = sy; it.state = 'ground'; it.vx = 0; }
    }
    // Depot drip-feeds kits so you can't soft-lock yourself. Mostly.
    if (nKits < 2) {
      this.kitT -= dt;
      if (this.kitT <= 0) {
        this.items.push(new Item('bridge', HOME_X - 14 + uni(-4, 4), GROUND - 40));
        this.kitT = 14;
      }
    } else this.kitT = 14;
  }

  updateAliens(dt) {
    const p = this.p, r = this.rover, t = this.terr;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.aliens.length < this.maxAliens()) {
      const side = choice([-1, 1]);
      const x = wrap(this.cam + side * (W / 2 + 14));
      const y = uni(CEILING + 6, 125);
      const kind = choice(this.kinds());
      const spd = ALIEN_SPEED[kind] * this.spdMul() * uni(0.85, 1.15);
      this.aliens.push(new Alien(kind, x, y, -side, spd));
      this.spawnT = this.spawnDelay();
    }
    for (const a of [...this.aliens]) {
      a.t += dt;
      a.hitT = Math.max(0, a.hitT - dt);
      const k = a.kind;
      if (k === 'drifter' || k === 'heavy') {
        a.x = wrap(a.x + a.dir * a.spd * dt);
        a.baseY += 5 * dt;
        a.y = a.baseY + Math.sin(a.t * 2.5 + a.ph) * 12;
      } else if (k === 'chaser') {
        let tx, ty;
        if (p.inRover || p.dead) { tx = r.x; ty = this.roverY() - 14; } else { tx = p.x; ty = p.y - 7; }
        const dx = wdx(tx, a.x), dy = ty - a.y, n = Math.hypot(dx, dy) || 1;
        a.vx += (dx / n * a.spd - a.vx) * 1.5 * dt;
        a.vy += (dy / n * a.spd - a.vy) * 1.5 * dt;
        a.x = wrap(a.x + a.vx * dt);
        a.y += a.vy * dt;
      } else if (k === 'bouncer') {
        a.vy += 90 * dt;
        a.x = wrap(a.x + a.dir * a.spd * dt);
        a.y += a.vy * dt;
        const gy = t.surface(a.x) - 4;
        if (a.y >= gy) { a.y = gy; a.vy = -uni(85, 115); }
      } else if (k === 'ufo') {
        // Sidles over, then swoops. Never lands, so no craters from these.
        const tx = (p.inRover || p.dead) ? r.x : p.x;
        a.vx += (clamp(wdx(tx, a.x), -1, 1) * a.spd - a.vx) * 0.8 * dt;
        a.x = wrap(a.x + a.vx * dt);
        a.y = clamp(a.baseY + Math.sin(a.t * 2.2 + a.ph) * 30, CEILING, t.surface(a.x) - 24);
      } else if (k === 'diver') {
        if (!a.diving) {
          if (a.diveWarnT > 0) {
            // Hold position while the brackets flash. A warning travelling sideways
            // at fifty pixels a second is a crossword clue, not a telegraph.
            a.y = a.baseY + Math.sin(a.t * 4) * 4;
            a.diveWarnT = Math.max(0, a.diveWarnT - dt);
            if (a.diveWarnT === 0) {
              // Commit to the warned position. Moving the marker after the warning
              // would turn useful information into a small yellow lie.
              const aim = a.diveTargetX === null ? r.x : a.diveTargetX;
              a.diving = true; a.vx = clamp(wdx(aim, a.x), -40, 40); a.vy = 30;
              this.stats.diverLaunches++;
            }
          } else {
            a.x = wrap(a.x + a.dir * a.spd * dt);
            a.y = a.baseY + Math.sin(a.t * 4) * 4;
            // Aims just ahead of the rover. Spiteful, but now at least announced.
            const aim = wrap(r.x + r.dir * DIVER_AIM_LEAD);
            if (Math.abs(wdx(aim, a.x)) < DIVER_LOCK_RANGE) {
              a.diveWarnT = DIVER_WARNING; a.diveTargetX = aim;
              this.stats.diverTelegraphs++;
              this.playGameplayCue('divewarn');
            }
          }
        } else {
          a.vy += 50 * dt;
          a.x = wrap(a.x + a.vx * dt);
          a.y += a.vy * dt;
        }
      }
      a.y = Math.max(a.y, CEILING - 4);
      // Crashes punch new craters - the best idea in the original, frankly.
      if (k !== 'bouncer' && k !== 'ufo' && a.y >= t.surface(a.x) - 3) {
        removeItem(this.aliens, a);
        if (k === 'diver') this.stats.diverCrashes++;
        this.explode(a.x, a.y, 16, 'WwO', 45, 0.8, 40, 'ground');
        if (this.addCrater(a.x, randint(8, 11))) {
          this.sfx.play('boom');
          for (const it of this.items) if (it.state === 'ground') it.state = 'fall';
        }
        continue;
      }
      if (Math.abs(wdx(a.x, this.cam)) > W * 1.6) { removeItem(this.aliens, a); continue; }
      if (!p.dead && !p.inRover && p.invuln <= 0 &&
          Math.abs(wdx(a.x, p.x)) < 8 && Math.abs(a.y - (p.y - 7)) < 9) {
        removeItem(this.aliens, a);
        if (k === 'diver') this.stats.diverPlayerHits++;
        this.killPlayer();
      }
    }
  }

  killPlayer() {
    const p = this.p;
    p.dead = true; p.deadT = 2; this.lives--;
    this.explode(p.x, p.y - 7, 40, 'WCYR', 70, 1.0, 40, 'air');
    this.sfx.play('die');
    if (p.carry) this.dropItem();
    p.vx = p.vy = 0;
    this.flash(this.lives > 0 ? 'JETMAN DOWN!' : 'LAST JETMAN LOST', 2);
  }

  killAlien(a) {
    if (!this.aliens.includes(a)) return false;
    a.hp--; // heavies take two; everything else pops first time
    if (a.hp > 0) {
      a.hitT = ALIEN_HIT_FLASH;
      this.explode(a.x, a.y, 6, 'WY', 30, 0.3);
      this.sfx.play('hit');
      return false;
    }
    removeItem(this.aliens, a);
    this.addScore(ALIEN_SCORE[a.kind]);
    this.explode(a.x, a.y, 18, a.kind !== 'drifter' ? 'YOWR' : 'GYW', 50, 0.8, 40, 'small');
    this.sfx.play('boom');
    return true;
  }

  updateShots(dt) {
    const p = this.p;
    for (const L of [...this.lasers]) {
      L.t += dt;
      if (L.attached) {
        // Beam root rides on the gun while he faces the same way. Turn round and it lets go.
        if (p.dead || p.inRover || p.face !== L.dir || L.dead) L.attached = false;
        else { L.x0 = wrap(p.x + p.face * 6); L.y = p.y - 7; }
      }
      // TODO: hit test is a thin line. A swept box would catch fast movers better.
      if (!L.dead) {
        L.len = Math.min(170, L.len + 900 * dt);
        for (const a of [...this.aliens]) {
          const d = wdx(a.x, L.x0) * L.dir;
          if (d >= -4 && d <= L.len && Math.abs(a.y - L.y) < 6) {
            this.killAlien(a); L.len = Math.max(d, 2); L.dead = true; L.attached = false; break;
          }
        }
        if (!L.dead) {
          for (const m of [...this.missiles]) {
            const d = wdx(m.x, L.x0) * L.dir;
            if (d >= -4 && d <= L.len && Math.abs(m.y - L.y) < 7) {
              this.hitMissile(m); L.len = Math.max(d, 2); L.dead = true; L.attached = false; break;
            }
          }
        }
      }
      if (L.t > 0.3) removeItem(this.lasers, L);
    }
    for (const s of [...this.shells]) {
      s[0] = wrap(s[0] + s[2] * dt); s[1] += s[3] * dt; s[4] -= dt;
      let hit = false;
      for (const a of [...this.aliens]) {
        if (Math.abs(wdx(a.x, s[0])) < 7 && Math.abs(a.y - s[1]) < 7) { this.killAlien(a); hit = true; break; }
      }
      if (!hit) {
        for (const m of [...this.missiles]) {
          if (Math.abs(wdx(m.x, s[0])) < 7 && Math.abs(m.y - s[1]) < 7) { this.hitMissile(m); hit = true; break; }
        }
      }
      if (hit || s[4] <= 0 || s[1] < HUD) removeItem(this.shells, s);
    }
  }

  hitMissile(m) {
    m.hp--;
    this.sfx.play('hit');
    this.explode(m.x, m.y, 6, 'WY', 30, 0.3);
    if (m.hp <= 0 && removeItem(this.missiles, m)) {
      this.addScore(300);
      this.explode(m.x, m.y, 30, 'YORW', 60, 0.8, 40, 'air');
      this.sfx.play('boom');
      this.flash('MISSILE DESTROYED', 1.5);
    }
  }

  // Two missiles. Both can be shot down - the Earth one is quick, so good luck.
  launch() {
    const b = this.base, y = this.terr.base(b.x) - 20;
    this.missiles.push(new Missile(wrap(b.x + 20), y, 'earth'));
    this.missiles.push(new Missile(wrap(b.x - 20), y, 'rover'));
    this.sfx.play('launch');
    this.flash('WARNING: MISSILES LAUNCHED AT EARTH AND ROVER!', 3);
  }

  updateMissiles(dt) {
    const r = this.rover;
    for (const m of [...this.missiles]) {
      m.t += dt;
      if (m.kind === 'earth') {
        m.vy -= 50 * dt;
        m.y += m.vy * dt;
        if (m.y < HUD - 10) {
          removeItem(this.missiles, m);
          this.earthHits++;
          this.redFlash = 0.6;
          this.sfx.play('bigboom');
          if (this.earthHits >= 3) { this.end('EARTH HAS BEEN DESTROYED'); return; }
          this.flash(`EARTH HIT! (${this.earthHits} OF 3)`, 3);
          continue;
        }
      } else {
        // Homing = nudge velocity towards the rover. Crude. Works.
        if (m.t > 0.8) {
          const tx = r.x, ty = this.roverY() - 8;
          const dx = wdx(tx, m.x), dy = ty - m.y, n = Math.hypot(dx, dy) || 1;
          const spd = Math.min(75, 46 + 3 * this.level);
          m.vx += (dx / n * spd - m.vx) * 1.3 * dt;
          m.vy += (dy / n * spd - m.vy) * 1.3 * dt;
          if (n < 10) { removeItem(this.missiles, m); this.roverHit(); if (this.over) return; continue; }
        }
        m.x = wrap(m.x + m.vx * dt);
        m.y += m.vy * dt;
      }
      if (Math.random() < 0.7) this.parts.push([m.x, m.y, uni(-6, 6), uni(-6, 6), 0.6, 'rgb(140,140,160)', -5]);
    }
  }

  roverHit() {
    const r = this.rover;
    this.lives--;
    this.shake = 0.6;
    this.explode(r.x, this.roverY(), 50, 'YORW', 80, 1.2, 40, 'big');
    this.sfx.play('bigboom');
    if (this.lives <= 0) this.end('YOUR ROVER WAS DESTROYED');
    else this.flash('ROVER HIT BY MISSILE! LIFE LOST', 3);
  }

  destroyBase() {
    const b = this.base;
    b.alive = false;
    const y = this.terr.base(b.x) - 8;
    for (let i = 0; i < 5; i++) this.explode(wrap(b.x + uni(-18, 18)), y + uni(-10, 5), 35, 'YORW', 90, 1.4);
    this.explode(b.x, this.terr.base(b.x), 10, 'YORW', 40, 1, 40, 'big');
    this.explode(wrap(b.x - 22), this.terr.base(b.x), 10, 'YOR', 40, 1, 40, 'ground');
    this.explode(wrap(b.x + 22), this.terr.base(b.x), 10, 'YOR', 40, 1, 40, 'ground');
    this.shake = 1.2;
    // 10 points per second left on the clock. Rewards rushing, which is the point.
    const bonus = 2000 * this.level + trunc(this.timer) * 10;
    this.addScore(bonus);
    this.sfx.play('bigboom');
    this.flash(`ALIEN BASE DESTROYED!  BONUS ${bonus}`, 4);
    this.missiles.length = 0;
    this.nextBaseT = 5;
  }

  updateBase(dt) {
    const b = this.base;
    b.t += dt;
    if (b.alive) {
      const before = this.timer;
      this.timer -= dt;
      if (this.timer <= 10 && Math.floor(before) !== Math.floor(this.timer)) this.sfx.play('alarm');
      if (this.timer <= 0) { this.launch(); this.timer = this.levelTime(); }
    } else {
      this.nextBaseT -= dt;
      if (this.nextBaseT <= 0) {
        this.level++;
        this.stats.levelTransitions++;
        this.placeBase();
        this.timer = this.levelTime();
        this.items.push(new Item('bomb', HOME_X + 4, GROUND - 40));
        const p = this.profile();
        this.flash(`LEVEL ${this.level}: ${p.name} - ${p.briefing}`, 4);
      }
    }
  }

  updateFx(dt) {
    for (const q of [...this.parts]) {
      q[3] += q[6] * dt; q[0] = wrap(q[0] + q[2] * dt); q[1] += q[3] * dt; q[4] -= dt;
      if (q[4] <= 0) removeItem(this.parts, q);
    }
    for (const b of [...this.booms]) { b[2] += dt; if (b[2] >= BOOM_FRAMES[b[3]] * BOOM_DT) removeItem(this.booms, b); }
    for (const g of [...this.rings]) { g[2] += 60 * dt; if (g[2] > g[3]) removeItem(this.rings, g); }
  }

  end(reason) { this.over = true; this.overReason = reason; this.sfx.stopLoops(); }
}

if (typeof module !== 'undefined') {
  module.exports = { VERSION, BOOM_FRAMES, PAL, PALC, ALIEN_SCORE, ALIEN_HIT_FLASH, LEVEL_PROFILES, levelProfile,
    DIVER_WARNING, DIVER_AIM_LEAD, DIVER_LOCK_RANGE, LOW_FUEL_LEVEL,
    LOW_FUEL_RESET, LOW_FUEL_REPEAT, Game, Alien, Laser, Missile, Item, newInput, wrap, wdx, W, H, HUD, WORLD, HOME_X, GROUND };
}
