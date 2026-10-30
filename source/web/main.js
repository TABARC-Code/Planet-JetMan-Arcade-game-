// Lunar Jetman, the rebuild. Browser edition - drawing, sound, input, the loop.
//
// Draws at 320x200 into an offscreen canvas, then scales it 4x with smoothing off.
// HUD text goes on the big canvas so it stays sharp.
//
// Thoughts:
//   - WebGL if it ever stutters. It doesn't. Canvas 2D copes with a few hundred rects.
//   - key remapping and volume sliders can wait; controller response now has its own panel.
//   - integer scaling would be prettier than free scaling. Later.
'use strict';

// ------------------------------------------------------------------ sprites (original art)
// Jetman, rover kit and items are drawn as strings. Daft, but you can diff them.
// The larger suit keeps a fixed palette and silhouette across every pose: white
// pressure shell, cyan visor, cobalt pack, amber chest panel and dark edging.
const JET_TOP = [
  '......wwwww......', '....wwWWWWWww....', '...wWWWWWWWWWw...',
  '...wWWCCCCWWWw...', '...wWWCCCcWWWw...', '...wWWWWWWWWWw...',
  '....wwwwwww......', '..BBbwWWWWWw.....', '.bBBBwWYYYWWw....',
  '.bBBBwWWCWWWw....', '.bBBBwWWWWWWw....', '..BBbwWWWWWw.Y...',
  '....wWWWWWWwWY...', '....wWWWWWWw.....', '.....wWWWWw......',
];
const JET_LEGS = {
  stand: ['.....WW..WW......', '....wWW..WWw.....', '....WWW..WWW.....', '...wWWW..WWWw....', '...wwww..wwww....'],
  walk1: ['.....WW..WW......', '....WWW...WW.....', '...WWW.....WW....', '..wWWW.....WWW...', '..wwww.....wwww..'],
  walk2: ['.....WW..WW......', '.....WW.WWW......', '......WW..WWW....', '......WW...WWW...', '.....www...wwww..'],
  fly: ['.....WW..WW......', '....wWW..WWw.....', '.....WW..WW......', '.....OO..OO......', '.....Y....Y......'],
};
const ITEM_ART = {
  bomb: ['......YO.', '.....K...', '...RRRR..', '..RRWRRR.', '.RRWRRRRr',
    '.RRRRRRRr', '.RRRRRRrr', '..RRRRrr.', '...rrrr..'],
  bridge: ['OOOOOOOOOOOOOO', 'OO.OO.OO.OO.OO', 'O.O..O..O..O.O', 'OOOOOOOOOOOOOO', 'ww..........ww'],
  cannon: ['........wwww', '......wwWWw.', '....wwWWw...', '..wWWWw.....',
    '.wWWWWWw....', 'wwwwwwwww...', '.K.....K....'],
};

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function spriteFromRows(rows) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const cv = makeCanvas(w, h), x = cv.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, xx) => {
    if (PALC[ch]) { x.fillStyle = PALC[ch]; x.fillRect(xx, y, 1, 1); }
  }));
  return cv;
}
function flipCanvas(src) {
  const cv = makeCanvas(src.width, src.height), x = cv.getContext('2d');
  x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
  return cv;
}
function alienVariant(src, mode, frameNo) {
  const cv = makeCanvas(src.width, src.height), x = cv.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = mode === 'hit' ? 'rgba(255,245,190,.82)' : 'rgba(150,18,24,.48)';
  x.fillRect(0, 0, cv.width, cv.height);
  if (mode === 'damaged') {
    // A deterministic little scorch, not a fresh random scribble every frame.
    const sx = 2 + (frameNo * 3) % Math.max(2, cv.width - 5);
    const sy = 2 + (frameNo * 2) % Math.max(2, cv.height - 5);
    x.fillStyle = 'rgba(20,20,28,.92)';
    x.fillRect(sx, sy, 1, 4);
    x.fillRect(sx + 1, sy + 2, 2, 1);
    x.fillStyle = 'rgba(255,170,45,.95)';
    x.fillRect(sx - 1, sy + 1, 1, 2);
  }
  x.globalCompositeOperation = 'source-over';
  return cv;
}
function stripFrames(img, n) {
  const fw = Math.floor(img.width / n), out = [];
  for (let i = 0; i < n; i++) {
    const cv = makeCanvas(fw, img.height);
    cv.getContext('2d').drawImage(img, i * fw, 0, fw, img.height, 0, 0, fw, img.height);
    out.push(cv);
  }
  return out;
}
function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}

const art = {};
async function buildArt() {
  art.jet = {};
  for (const k in JET_LEGS) {
    const s = spriteFromRows(JET_TOP.concat(JET_LEGS[k]));
    art.jet[k + '_1'] = s; art.jet[k + '_-1'] = flipCanvas(s);
  }
  art.item = {};
  for (const k in ITEM_ART) {
    const s = spriteFromRows(ITEM_ART[k]);
    art.item[k + '_1'] = s; art.item[k + '_-1'] = flipCanvas(s);
  }
  const img = {};
  for (const name in ASSET_DATA.img) img[name] = await loadImage(ASSET_DATA.img[name]);
  art.alien = {}; art.alienFlip = {}; art.alienHit = {}; art.alienHitFlip = {};
  art.alienDamaged = {}; art.alienDamagedFlip = {};
  for (const k of ['drifter', 'chaser', 'bouncer', 'diver', 'heavy', 'ufo']) {
    art.alien[k] = stripFrames(img['alien_' + k], 4);
    art.alienFlip[k] = art.alien[k].map(flipCanvas);
    art.alienHit[k] = art.alien[k].map((f, i) => alienVariant(f, 'hit', i));
    art.alienHitFlip[k] = art.alienHit[k].map(flipCanvas);
    art.alienDamaged[k] = art.alien[k].map((f, i) => alienVariant(f, 'damaged', i));
    art.alienDamagedFlip[k] = art.alienDamaged[k].map(flipCanvas);
  }
  art.exp = {};
  for (const k in BOOM_FRAMES) { const im = img['exp_' + k]; art.exp[k] = stripFrames(im, Math.round(im.width / im.height)); }
  art.earth = img.earth;
  art.bgBack = img.bg_back;
  art.bgStars = img.bg_stars;
  art.silo = img.silo;
}

// ------------------------------------------------------------------ pixel primitives
// Hand-rolled so nothing gets antialiased. ctx.arc would smear the lot.
function P(c, col, x, y) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
function R(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function line(c, col, x0, y0, x1, y1, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  c.fillStyle = col;
  if (x0 === x1) { c.fillRect(x0, Math.min(y0, y1), w, Math.abs(y1 - y0) + 1); return; }
  if (y0 === y1) { c.fillRect(Math.min(x0, x1), y0, Math.abs(x1 - x0) + 1, w); return; }
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function circ(c, col, cx, cy, r, width = 0, top = false) {
  c.fillStyle = col;
  const half = dy => Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
  const ihalf = dy => (Math.abs(dy) <= r - 1) ? Math.round(Math.sqrt((r - 1) * (r - 1) - dy * dy)) : -1;
  for (let dy = -r; dy <= (top ? 0 : r); dy++) {
    const hw = half(dy);
    if (!width) { c.fillRect(cx - hw, cy + dy, 2 * hw + 1, 1); continue; }
    const iw = ihalf(dy);
    if (iw < 0) c.fillRect(cx - hw, cy + dy, 2 * hw + 1, 1);
    else { c.fillRect(cx - hw, cy + dy, hw - iw, 1); c.fillRect(cx + iw + 1, cy + dy, hw - iw, 1); }
  }
}
const gsx = (g, x) => trunc(wdx(x, g.cam)) + W / 2;

// ------------------------------------------------------------------ cached terrain strips
// Ground is drawn once into a world-wide strip; only columns under new craters get redone.
// Repainting 320 columns a frame was the biggest cost by miles. Not any more.
class TerrainCache {
  static get(t) {
    if (!TerrainCache.cur || TerrainCache.cur.terr !== t) TerrainCache.cur = new TerrainCache(t);
    TerrainCache.cur.sync();
    return TerrainCache.cur;
  }
  constructor(t) {
    this.terr = t;
    this.mountY = Math.min(...t.mount);
    const mh = 176 - this.mountY;
    this.mount = makeCanvas(1024, mh);
    const m = this.mount.getContext('2d');
    for (let x = 0; x < 1024; x++) {
      const my = t.mount[x] - this.mountY;
      R(m, 'rgb(34,34,60)', x, my + 1, 1, mh - my);
      P(m, 'rgb(70,70,110)', x, my);
    }
    this.groundY = Math.min(...t.h) - 2;
    this.ground = makeCanvas(WORLD, H - this.groundY);
    this.gctx = this.ground.getContext('2d');
    this.sig = new Set();
    this.drawCols(0, WORLD);
  }
  drawCols(x0, x1) {
    const t = this.terr, s = this.gctx, oy = this.groundY, gh = H - oy;
    for (let x = x0; x < x1; x++) {
      const wx = mod(x, WORLD);
      s.clearRect(wx, 0, 1, gh);
      const top = t.h[wx] - oy;
      const cr = t.craterAt(wx);
      if (cr) {
        const d = wdx(wx, cr.x) / cr.r;
        const y = top + trunc(cr.depth * (1 - d * d));
        R(s, 'rgb(88,88,110)', wx, y, 1, gh - y);
        R(s, 'rgb(60,60,80)', wx, y, 1, 4);
        P(s, 'rgb(150,150,170)', wx, y);
        if (Math.abs(Math.abs(d) - 1) < 0.12) P(s, 'rgb(190,190,205)', wx, top - 1);
      } else {
        R(s, 'rgb(88,88,110)', wx, top, 1, gh - top);
        P(s, 'rgb(225,225,238)', wx, top);
        P(s, 'rgb(165,165,185)', wx, top + 1);
        for (let yy = top + 4; yy < gh; yy += 3) {
          const ay = yy + oy;
          if ((wx * 7 + ay * 13) % 11 === 0) P(s, 'rgb(66,66,86)', wx, yy);
          else if ((wx * 5 + ay * 3) % 23 === 0) P(s, 'rgb(120,120,140)', wx, yy);
        }
      }
    }
  }
  sync() {
    const cur = new Set(this.terr.craters.map(c => c.x + '|' + c.r));
    let same = cur.size === this.sig.size;
    if (same) for (const k of cur) if (!this.sig.has(k)) { same = false; break; }
    if (same) return;
    const changed = [...cur].filter(k => !this.sig.has(k)).concat([...this.sig].filter(k => !cur.has(k)));
    for (const k of changed) {
      const [xs, rs] = k.split('|'); const x = trunc(+xs), r = +rs;
      this.drawCols(x - r - 2, x + r + 3);
    }
    this.sig = cur;
  }
}
function blitWrappedImg(c, img, left, y) {
  for (let x = -mod(left, img.width); x < W; x += img.width) c.drawImage(img, x, y);
}
function blitWrapped(c, strip, left, period, y) {
  left = mod(left, period);
  const first = Math.min(W, period - left), h = strip.height;
  c.drawImage(strip, left, 0, first, h, 0, y, first, h);
  if (first < W) c.drawImage(strip, 0, 0, W - first, h, first, y, W - first, h);
}

const STARS = (() => {
  const r = RNG(3), cols = ['rgb(255,255,255)', 'rgb(180,200,255)', 'rgb(255,230,180)', 'rgb(140,140,170)'];
  const s = [];
  for (let i = 0; i < 110; i++) s.push([r.uniform(0, 640), r.uniform(HUD + 1, 150), r.random(), r.choice(cols)]);
  return s;
})();

// Each named level keeps the shared lunar palette, then adds one readable landmark language.
// These are decoration only: collision remains the terrain's business.
const LEVEL_LOOKS = Object.freeze({
  dust:   { sky: 'rgba(92,70,38,.10)', accent: 'rgb(210,172,92)', prop: 'rocks' },
  static: { sky: 'rgba(30,80,120,.10)', accent: 'rgb(90,210,255)', prop: 'aerials' },
  crater: { sky: 'rgba(85,65,105,.12)', accent: 'rgb(195,150,235)', prop: 'crystals' },
  red:    { sky: 'rgba(145,24,20,.13)', accent: 'rgb(255,100,54)', prop: 'pylons' },
  iron:   { sky: 'rgba(100,86,62,.12)', accent: 'rgb(225,190,105)', prop: 'girders' },
  void:   { sky: 'rgba(20,0,55,.20)', accent: 'rgb(185,115,255)', prop: 'obelisks' },
});
function levelLook(g) {
  const p = g.profile ? g.profile() : { theme: 'dust' };
  return LEVEL_LOOKS[p.theme] || LEVEL_LOOKS.dust;
}
function drawLevelLandmarks(c, g, look, now) {
  const first = Math.floor((g.cam - W / 2) / 96) - 1;
  for (let n = first; n < first + 6; n++) {
    const wx = wrap(n * 96 + 33), x = gsx(g, wx);
    if (x < -24 || x > W + 24) continue;
    const y = g.terr.base(wx) - 1, dim = 'rgb(68,68,88)';
    if (look.prop === 'rocks') {
      R(c, dim, x - 7, y - 4, 13, 4); R(c, look.accent, x - 3, y - 6, 5, 2);
    } else if (look.prop === 'aerials') {
      line(c, dim, x, y, x, y - 19); line(c, look.accent, x - 5, y - 15, x + 5, y - 15);
      if (trunc(now * 3 + n) % 2 === 0) P(c, look.accent, x, y - 22);
    } else if (look.prop === 'crystals') {
      line(c, look.accent, x - 6, y, x - 2, y - 13); line(c, look.accent, x - 2, y - 13, x + 2, y);
      line(c, dim, x + 1, y, x + 6, y - 9); line(c, dim, x + 6, y - 9, x + 8, y);
    } else if (look.prop === 'pylons') {
      line(c, dim, x - 7, y, x, y - 18); line(c, dim, x, y - 18, x + 7, y);
      line(c, look.accent, x - 4, y - 7, x + 4, y - 7);
    } else if (look.prop === 'girders') {
      strokeR(c, dim, x - 8, y - 13, 16, 13); line(c, look.accent, x - 7, y - 12, x + 7, y - 2);
      line(c, look.accent, x + 7, y - 12, x - 7, y - 2);
    } else {
      R(c, 'rgb(22,16,34)', x - 5, y - 24, 10, 24); line(c, look.accent, x - 4, y - 23, x, y - 28);
      line(c, look.accent, x, y - 28, x + 4, y - 23);
    }
  }
}

// ------------------------------------------------------------------ world drawing
// Order matters: sky, ground, props, rover, Jetman, baddies, fx, then the HUD band.
function drawWorld(c, g, now) {
  const cam = g.cam, t = g.terr;
  const look = levelLook(g);
  R(c, 'rgb(2,4,16)', 0, 0, W, H);
  // ansimuz nebula, two slow layers. Both loop at 272px.
  blitWrappedImg(c, art.bgBack, trunc(cam * 0.03), HUD);
  blitWrappedImg(c, art.bgStars, trunc(cam * 0.07), HUD);
  R(c, look.sky, 0, HUD, W, 130 - HUD);
  for (const [x, y, tw, col] of STARS) {
    const sx = mod(x - cam * 0.08, 640);
    if (sx < W) P(c, Math.sin(now * 3 + tw * 50) > 0.85 ? 'rgb(90,90,110)' : col, trunc(sx), trunc(y));
  }
  const ex = trunc(250 - mod(cam * 0.02, 40));
  c.drawImage(art.earth, ex, 38);
  if (g.redFlash > 0) {
    const ew = art.earth.width >> 1;
    circ(c, 'rgb(255,120,40)', ex + ew, 38 + ew, trunc(16 * g.redFlash / 0.6) + 2);
  }
  const tc = TerrainCache.get(t);
  blitWrapped(c, tc.mount, trunc(cam * 0.35) - W / 2, 1024, tc.mountY);
  blitWrapped(c, tc.ground, trunc(cam - W / 2), WORLD, tc.groundY);
  drawLevelLandmarks(c, g, look, now);
  for (const cr of t.craters) {
    if (!cr.bridged) continue;
    const sx = gsx(g, cr.x);
    if (sx > -40 && sx < W + 40) {
      const x0 = sx - cr.r - 2, x1 = sx + cr.r + 2;
      for (let x = x0; x <= x1; x++) {
        const y = t.base(wrap(cam + x - W / 2));
        P(c, PALC.O, x, y); P(c, PALC.O, x, y + 2);
        P(c, mod(x - x0, 4) < 2 ? PALC.O : PALC.r, x, y + 1);
      }
    }
  }
  drawDepot(c, g, now);
  for (const tp of g.tele) drawTeleporter(c, g, tp, now);
  drawBase(c, g, now);
  for (const it of g.items) if (it.state === 'ground' || it.state === 'fall') drawItem(c, g, it, 1);
  drawRover(c, g, now);
  const p = g.p;
  if (!p.dead && !p.inRover && (p.invuln <= 0 || trunc(now * 12) % 2 === 0)) {
    const sx = gsx(g, p.x);
    const legs = p.onGround ? (Math.abs(p.vx) < 1 ? 'stand' : (trunc(p.walk) % 2 === 0 ? 'walk1' : 'walk2')) : 'fly';
    const spr = art.jet[legs + '_' + p.face];
    c.drawImage(spr, sx - (spr.width >> 1), trunc(p.y) - spr.height);
  }
  if (p.carry) drawItem(c, g, p.carry, p.face);
  for (const a of g.aliens) {
    const sx = gsx(g, a.x);
    if (sx > -20 && sx < W + 20) {
      if (a.kind === 'diver' && a.diveWarnT > 0) {
        const y = trunc(a.y), col = trunc(now * 12) % 2 ? PALC.Y : PALC.O;
        // Corner brackets and chevrons read in silhouette as well as colour.
        line(c, col, sx - 9, y - 8, sx - 5, y - 8); line(c, col, sx - 9, y - 8, sx - 9, y - 4);
        line(c, col, sx + 9, y - 8, sx + 5, y - 8); line(c, col, sx + 9, y - 8, sx + 9, y - 4);
        line(c, col, sx - 4, y + 10, sx, y + 14); line(c, col, sx, y + 14, sx + 4, y + 10);
        if (a.diveWarnT < DIVER_WARNING * 0.45) {
          line(c, PALC.R, sx - 3, y + 15, sx, y + 18); line(c, PALC.R, sx, y + 18, sx + 3, y + 15);
        }
      }
      const flipped = a.dir < 0 && a.kind !== 'diver';
      let bank = flipped ? art.alienFlip : art.alien;
      if (a.hitT > 0) bank = flipped ? art.alienHitFlip : art.alienHit;
      else if (a.hp < a.hpMax) bank = flipped ? art.alienDamagedFlip : art.alienDamaged;
      const frames = bank[a.kind];
      const fr = frames[trunc(a.t * 8) % frames.length];
      c.drawImage(fr, sx - (fr.width >> 1), trunc(a.y) - (fr.height >> 1));
    }
  }
  for (const m of g.missiles) {
    const sx = gsx(g, m.x);
    if (sx > -20 && sx < W + 20) {
      const n = Math.hypot(m.vx, m.vy) || 1, ux = m.vx / n, uy = m.vy / n;
      const x0 = sx - ux * 5, y0 = m.y - uy * 5, x1 = sx + ux * 5, y1 = m.y + uy * 5;
      line(c, PALC.W, x0, y0, x1, y1, 2);
      P(c, PALC.R, trunc(x1 + ux), trunc(y1 + uy));
      P(c, trunc(now * 20) % 2 ? PALC.Y : PALC.O, trunc(x0 - ux), trunc(y0 - uy));
    }
  }
  for (const L of g.lasers) {
    const sx = gsx(g, L.x0), x1 = sx + L.dir * L.len, y = trunc(L.y);
    line(c, L.t < 0.2 ? PALC[L.col] : 'rgb(90,90,110)', sx, y, trunc(x1), y);
    line(c, PALC.W, trunc(x1 - L.dir * 8), y, trunc(x1), y);
  }
  for (const s of g.shells) R(c, PALC.Y, gsx(g, s[0]) - 1, trunc(s[1]) - 1, 2, 2);
  for (const q of g.parts) {
    const sx = gsx(g, q[0]);
    if (sx >= 0 && sx < W) P(c, q[5], sx, trunc(q[1]));
  }
  for (const b of g.booms) {
    const sx = gsx(g, b[0]), frames = art.exp[b[3]];
    if (sx > -50 && sx < W + 50) {
      const fr = frames[Math.min(frames.length - 1, trunc(b[2] / BOOM_DT))];
      // ground blasts sit on the surface; the rest are centred
      const grounded = b[3] === 'ground' || b[3] === 'big';
      c.drawImage(fr, sx - (fr.width >> 1), trunc(b[1]) - (grounded ? fr.height : fr.height >> 1));
    }
  }
  for (const r of g.rings) {
    const sx = gsx(g, r[0]);
    if (sx > -60 && sx < W + 60) circ(c, r[4], sx, trunc(r[1]), trunc(r[2]), 1);
  }
  R(c, '#000', 0, 0, W, HUD);
}

function drawItem(c, g, it, face) {
  const sx = gsx(g, it.x);
  if (sx > -20 && sx < W + 20) {
    const spr = art.item[it.kind + '_' + (it.kind === 'cannon' ? face : 1)];
    c.drawImage(spr, sx - (spr.width >> 1), trunc(it.y) - spr.height);
  }
}

function drawDepot(c, g, now) {
  const sx = gsx(g, HOME_X);
  if (sx <= -60 || sx >= W + 60) return;
  const gy = g.terr.base(HOME_X);
  c.drawImage(art.silo, sx - 52, g.terr.base(HOME_X - 45) - art.silo.height + 1);
  R(c, 'rgb(60,60,80)', sx - 30, gy - 1, 60, 2);
  R(c, PALC.w, sx + 18, gy - 14, 16, 13);
  R(c, PALC.B, sx + 17, gy - 16, 18, 3);
  R(c, trunc(now * 2) % 2 ? PALC.C : PALC.c, sx + 22, gy - 10, 3, 3);
  R(c, PALC.K, sx + 28, gy - 9, 4, 8);
  line(c, PALC.W, sx - 30, gy - 1, sx - 30, gy - 24);
  for (let i = 0; i < 7; i++) {
    const off = trunc(Math.sin(now * 5 + i * 0.8) * 1.2);
    P(c, PALC.R, sx - 29 + i, gy - 24 + off);
    P(c, PALC.W, sx - 29 + i, gy - 23 + off);
    P(c, PALC.B, sx - 29 + i, gy - 22 + off);
  }
  for (let k = -24; k < 16; k += 6) P(c, PALC.Y, sx + k, gy - 1);
}

function drawTeleporter(c, g, x, now) {
  const sx = gsx(g, x);
  if (sx <= -20 || sx >= W + 20) return;
  const gy = g.terr.base(x);
  R(c, PALC.b, sx - 9, gy - 2, 18, 3);
  R(c, PALC.C, sx - 7, gy - 3, 14, 1);
  for (let k = 0; k < 4; k++) {
    const yy = gy - 4 - trunc(mod(now * 25 + k * 7, 28));
    const col = k % 2 ? PALC.C : PALC.c;
    P(c, col, sx - 6, yy); P(c, col, sx + 6, yy); P(c, PALC.W, sx, yy - 3);
  }
}

function drawBase(c, g, now) {
  const b = g.base;
  if (!b.alive) return;
  const sx = gsx(g, b.x);
  if (sx <= -60 || sx >= W + 60) return;
  const gy = g.terr.base(b.x);
  R(c, 'rgb(90,30,40)', sx - 26, gy - 3, 52, 4);
  circ(c, PALC.r, sx, gy - 3, 15, 0, true);
  circ(c, PALC.R, sx, gy - 3, 15, 1, true);
  circ(c, PALC.R, sx, gy - 3, 9, 1, true);
  [-10, -5, 0, 5, 10].forEach((k, i) => {
    P(c, (trunc(now * 5) + i) % 3 === 0 ? PALC.Y : 'rgb(90,20,20)', sx + k, gy - 6);
  });
  for (const tx of [sx - 23, sx + 20]) {
    R(c, PALC.w, tx, gy - 22, 3, 19);
    for (let yy = gy - 20; yy < gy - 3; yy += 4) P(c, PALC.K, tx + 1, yy);
    P(c, trunc(now * 3) % 2 ? PALC.R : PALC.Y, tx + 1, gy - 23);
  }
  if (g.timer < 25) {
    for (let mx of [sx - 20, sx + 20]) {
      mx += mx > sx ? 3 : -3;
      line(c, PALC.W, mx, gy - 4, mx, gy - 14, 2);
      P(c, PALC.R, mx, gy - 15);
    }
  }
  line(c, PALC.w, sx, gy - 18, sx, gy - 24);
  const ca = trunc(4 * Math.cos(now * 2));
  line(c, PALC.W, sx - ca, gy - 25, sx + ca, gy - 25);
}

function drawRover(c, g, now) {
  const r = g.rover, sx = gsx(g, r.x);
  if (sx <= -70 || sx >= W + 70) return;
  const d = r.dir, by = g.roverY();
  const tx = r.trailerX(), tsx = gsx(g, tx), ty = g.terr.base(tx);
  const wheel = (cx, cy, spin, radius = 5) => {
    circ(c, PALC.K, cx, cy, radius);
    circ(c, 'rgb(78,82,102)', cx, cy, radius - 1);
    circ(c, PALC.K, cx, cy, Math.max(1, radius - 3));
    const hx = Math.round((radius - 2) * Math.cos(spin));
    const hy = Math.round((radius - 2) * Math.sin(spin));
    P(c, PALC.W, cx + hx, cy + hy); P(c, PALC.W, cx - hx, cy - hy);
    P(c, PALC.b, cx + hy, cy - hx); P(c, PALC.b, cx - hy, cy + hx);
  };

  // A low equipment sled with two wheels reads as part of the rover rather than
  // a loose rectangle which happens to follow it across the moon.
  line(c, PALC.w, sx - d * 20, by - 7, tsx + d * 11, ty - 7);
  R(c, PALC.K, tsx - 12, ty - 9, 24, 2);
  R(c, PALC.W, tsx - 11, ty - 8, 22, 2);
  R(c, PALC.B, tsx - 10, ty - 6, 20, 2);
  wheel(tsx - 7, ty - 3, r.wheel, 3);
  wheel(tsx + 7, ty - 3, r.wheel, 3);
  if (r.cargo) {
    const spr = art.item[r.cargo.kind + '_' + (r.cargo.kind === 'cannon' ? d : 1)];
    c.drawImage(spr, tsx - (spr.width >> 1), ty - 9 - spr.height);
  }

  for (const o of [-13, 0, 13]) {
    const wy = g.terr.base(r.x + o) - 4, cx = sx + o;
    line(c, PALC.w, cx, wy, cx - d * 3, by - 9);
    wheel(cx, wy, r.wheel + o * 0.15);
  }

  // Layered chassis, cab and service panels. At this resolution silhouette earns
  // its keep before decorative pixels do, hence the dark continuous outline.
  R(c, PALC.K, sx - 21, by - 14, 42, 8);
  R(c, PALC.W, sx - 20, by - 13, 40, 5);
  R(c, PALC.B, sx - 20, by - 10, 40, 4);
  R(c, PALC.b, sx - 18, by - 7, 36, 2);
  for (const px of [-15, -10, -5]) P(c, trunc(now * 4 + px) % 3 ? PALC.C : PALC.Y, sx + d * px, by - 11);
  for (let i = 0; i < r.bridges; i++) R(c, PALC.O, sx - d * 7 - 5, by - 15 - i * 2, 10, 1);

  const cx = sx + d * 7;
  circ(c, PALC.K, cx, by - 14, 7, 0, true);
  circ(c, PALC.c, cx, by - 14, 6, 0, true);
  line(c, PALC.C, cx - 5, by - 16, cx + 5, by - 16);
  P(c, PALC.W, cx - d * 3, by - 18);
  if (g.p.inRover && !g.p.dead) {
    R(c, PALC.W, cx - 2, by - 19, 4, 4);
    R(c, PALC.C, cx + d, by - 18, 2, 2);
  }

  const ax = sx - d * 14;
  line(c, PALC.w, ax, by - 14, ax - d * 2, by - 23);
  P(c, trunc(now * 2) % 2 ? PALC.R : 'rgb(80,0,0)', ax - d * 2, by - 24);
  const nose = sx + d * 21;
  line(c, PALC.w, nose, by - 12, nose + d * 3, by - 9);
  const noseCol = r.blocked && trunc(now * 8) % 2 ? PALC.R : PALC.Y;
  R(c, noseCol, d > 0 ? nose : nose - 1, by - 12, 2, 2);
  if (r.blocked) {
    const hx = sx + d * 26, hy = by - 20, spread = r.blockedPulse > 0 ? 5 : 3;
    line(c, PALC.O, hx - spread, hy - 3, hx, hy + 2);
    line(c, PALC.O, hx, hy + 2, hx + spread, hy - 3);
    P(c, PALC.W, hx, hy - 5);
  }
}

// ------------------------------------------------------------------ HUD (hi-res)
// Fixed 1280x800 layout. Positions are magic numbers - move one, check the lot.
const FONT = 'Consolas, "Lucida Console", "Courier New", monospace';
const pad = (n, w) => String(Math.max(0, trunc(n))).padStart(w, '0');
function text(f, size, s, x, y, col = '#fff', center = false, shadow = true) {
  f.font = `bold ${size}px ${FONT}`;
  f.textBaseline = 'top';
  if (center) x -= f.measureText(s).width / 2;
  if (shadow) { f.fillStyle = '#000'; f.fillText(s, x + 3, y + 3); }
  f.fillStyle = col; f.fillText(s, x, y);
}
function strokeR(f, col, x, y, w, h) { f.strokeStyle = col; f.lineWidth = 1; f.strokeRect(Math.round(x) + 0.5, y + 0.5, Math.round(w) - 1, h - 1); }

function drawHud(f, g, now, hiscore) {
  text(f, 30, 'SCORE ' + pad(g.score, 6), 16, 4, PALC.Y);
  text(f, 30, 'HI ' + pad(Math.max(hiscore, g.score), 6), 330, 4, PALC.C);
  const look = levelLook(g);
  text(f, 30, `LEVEL ${g.level} ${g.levelName ? g.levelName() : ''}`, 590, 4, look.accent);
  f.imageSmoothingEnabled = false;
  for (let i = 0; i < Math.min(g.lives, 8); i++) f.drawImage(art.jet.stand_1, 780 + i * 28, 4, 22, 27);
  text(f, 30, 'EARTH', 1040, 4, PALC.B);
  for (let i = 0; i < 3; i++) R(f, i < g.earthHits ? PALC.R : PALC.G, 1150 + i * 38, 10, 30, 18);
  text(f, 22, 'FUEL', 16, 40, PALC.W);
  R(f, 'rgb(60,60,70)', 78, 43, 200, 18);
  R(f, g.p.fuel > 35 ? PALC.G : (g.p.fuel > 15 ? PALC.Y : PALC.R), 78, 43, trunc(2 * g.p.fuel), 18);
  if (g.base.alive) {
    text(f, 22, 'BASE COUNTDOWN ' + pad(g.timer, 3), 300, 40, g.timer < 15 && trunc(now * 4) % 2 ? PALC.R : PALC.W);
  } else text(f, 22, 'BASE DESTROYED', 300, 40, PALC.G);
  const r = g.rover;
  text(f, 22, `ROVER BRIDGES ${r.bridges}  TRAILER ${r.cargo ? r.cargo.kind.toUpperCase() : 'EMPTY'}`, 590, 40, PALC.O);
  text(f, 22, 'CARRYING ' + (g.p.carry ? g.p.carry.kind.toUpperCase() : '-'), 1040, 40, PALC.W);
  // scanner: whole moon in one strip, centred on the camera
  const sx0 = 16, sy0 = 66, sw = HI_W - 32, sh = 10;
  R(f, 'rgb(20,20,40)', sx0, sy0, sw, sh);
  strokeR(f, 'rgb(70,70,110)', sx0, sy0, sw, sh);
  const view = W / WORLD * sw;
  strokeR(f, 'rgb(60,60,100)', sx0 + sw / 2 - view / 2, sy0, view, sh);
  const px = x => trunc(sx0 + sw / 2 + wdx(x, g.cam) / WORLD * sw);
  for (const cr of g.terr.craters) R(f, cr.bridged ? PALC.O : 'rgb(100,100,120)', px(cr.x) - 2, sy0 + 6, 5, 3);
  for (const tp of g.tele) R(f, PALC.C, px(tp) - 2, sy0 + 1, 4, 3);
  R(f, PALC.B, px(HOME_X) - 3, sy0 + 1, 6, 8);
  if (g.base.alive) R(f, trunc(now * 4) % 2 ? PALC.R : PALC.Y, px(g.base.x) - 4, sy0, 8, sh);
  for (const it of g.items) R(f, { bomb: PALC.Y, bridge: PALC.O, cannon: PALC.w }[it.kind], px(it.x) - 1, sy0 + 2, 3, 3);
  for (const a of g.aliens) R(f, PALC.M, px(a.x), sy0 + 3, 2, 2);
  for (const m of g.missiles) R(f, PALC.R, px(m.x) - 2, sy0 + 1, 4, 8);
  R(f, PALC.W, px(g.rover.x) - 3, sy0 + 3, 7, 5);
  if (!g.p.inRover) R(f, PALC.C, px(g.p.x) - 1, sy0 + 1, 3, 8);
  if (g.base.alive) {
    const d = wdx(g.base.x, g.cam);
    if (Math.abs(d) > W / 2) text(f, 22, d > 0 ? 'BASE >>' : '<< BASE', d > 0 ? HI_W - 150 : 20, 90, PALC.R);
  }
  if (r.blocked && g.p.inRover) {
    const instruction = r.bridges ? 'CRATER AHEAD — PRESS X TO LAY A BRIDGE' : 'CRATER AHEAD — NO BRIDGES';
    R(f, 'rgba(5,8,20,.82)', 330, 86, 620, 34);
    text(f, 20, instruction, HI_W / 2, 91, PALC.O, true);
  }
  if (g.msgT > 0) text(f, 30, g.msg, HI_W / 2, 300, trunc(now * 6) % 2 ? PALC.Y : PALC.W, true);
}

function drawTelemetry(f, g) {
  const s = g.stats, p = S.pad;
  R(f, 'rgba(5,8,20,.88)', 18, 128, 360, 150);
  strokeR(f, PALC.C, 18, 128, 360, 150);
  text(f, 18, 'FIELD TELEMETRY — F2 CLOSES', 34, 140, PALC.C);
  text(f, 16, `DIVER WARN ${s.diverTelegraphs}  LAUNCH ${s.diverLaunches}  CRASH ${s.diverCrashes}`, 34, 174, PALC.W);
  text(f, 16, `DIVER HITS ${s.diverPlayerHits}  ROVER BLOCKS ${s.roverBlockEvents}`, 34, 202, PALC.W);
  text(f, 16, `BRIDGES LAID ${s.roverBridgesLaid}  LEVEL SHIFTS ${s.levelTransitions}`, 34, 230, PALC.W);
  const active = p.activeIndex === null ? '-' : p.activeIndex;
  text(f, 16, `PADS ${p.connectedCount}  ACTIVE ${active}  WAITING ${p.waitingNeutral.length}`, 34, 258, PALC.Y);
}

const TITLE_LINES = [
  ['ARROWS / WASD', 'MOVE  -  UP = JETPAC THRUST'],
  ['SPACE / Z / CTRL', 'FIRE LASER (OR ROVER CANNON)'],
  ['X / SHIFT / ENTER', 'PICK UP / DROP  -  IN ROVER: LAY BRIDGE'],
  ['DOWN / S', 'BOARD ROVER  -  USE TELEPORTER PAD'],
  ['UP (IN ROVER)', 'LEAVE THE ROVER'],
  ['P  M  N  B  F  F2  F3  ESC', 'PAUSE  MUTE  MUSIC  AMBIENCE  FULLSCREEN  DATA  PAD SETUP  TITLE'],
];
const HOWTO = [
  'Carry the BOMB to the alien base and drop it from ABOVE.',
  "Drop items on the rover's trailer to haul them. Kits = bridges.",
  'Rover cannot cross craters: drop a bridge kit in, or press X.',
  'Rover refuels your jetpac. Aliens crashing make new craters!',
  'If the countdown ends, shoot down the missile chasing your rover.',
];
function drawTitle(f, now, hiscore) {
  R(f, 'rgba(0,0,10,0.59)', 0, 0, HI_W, HI_H);
  const cols = [PALC.Y, PALC.O, PALC.R, PALC.M, PALC.C, PALC.G];
  text(f, 84, 'LUNAR JETMAN', HI_W / 2, 70, cols[trunc(now * 3) % cols.length], true);
  text(f, 30, 'THE REBUILD  -  A CLEAN-ROOM TRIBUTE', HI_W / 2, 170, PALC.C, true);
  let y = 240;
  for (const [k, v] of TITLE_LINES) { text(f, 22, k, 260, y, PALC.Y); text(f, 22, v, 560, y, PALC.W); y += 32; }
  y += 16;
  for (const l of HOWTO) { text(f, 22, l, HI_W / 2, y, 'rgb(190,190,220)', true); y += 30; }
  if (trunc(now * 2) % 2) text(f, 30, touchMode ? 'TAP FIRE TO START' : 'PRESS FIRE TO START', HI_W / 2, 680, PALC.G, true);
  text(f, 22, 'HI-SCORE ' + pad(hiscore, 6), HI_W / 2, 735, PALC.C, true);
  text(f, 16, `VERSION ${VERSION}  -  ART & SOUND CREDITS: SEE CREDITS`, HI_W / 2, 770, 'rgb(120,120,150)', true, false);
}

// ------------------------------------------------------------------ audio
// Every runtime sound is generated: effects from the recipes in sfx.js, music from music.js.
// The browser loads no audio files. Web Audio won't start until the player presses something -
// browser rules, not mine - so buffers get built on that first press.
// The music is rendered at page load though (it takes ~0.5s), so that press doesn't stall.
let MUSIC_DATA = null;
class WebSfx {
  constructor() {
    this.ctx = null; this.muted = false; this.musicOn = true; this.ambientOn = true; this.paused = false;
    this.buf = {}; this.vol = {}; this.loops = {}; this.active = []; this.lastPlayed = {};
    this.music = null; this.musicGain = null; this.ambient = null; this.ambientTheme = null;
    this.maxVoices = 16;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 1; this.sfxBus.connect(this.master);
    this.ambientBus = this.ctx.createGain(); this.ambientBus.gain.value = this.ambientLevel(); this.ambientBus.connect(this.master);
    const sr = this.ctx.sampleRate;
    for (const name in SFX_RECIPES) {
      const data = renderSfx(SFX_RECIPES[name], sr);
      const buf = this.ctx.createBuffer(1, data.length, sr);
      buf.getChannelData(0).set(data);
      this.buf[name] = buf;
    }
    for (const name in AMBIENT_RECIPES) {
      const data = renderSfx(AMBIENT_RECIPES[name], sr);
      const buf = this.ctx.createBuffer(1, data.length, sr);
      buf.getChannelData(0).set(data);
      this.buf['ambient:' + name] = buf;
    }
    this.vol.engine = 0.7; this.vol.thrust = 0.8;
    this.startMusic();
    if (this.ambientTheme) this.setAmbience(this.ambientTheme, this.paused);
  }
  startMusic() {
    if (!this.ctx || this.music || !MUSIC_DATA) return;
    const m = MUSIC_DATA, buf = this.ctx.createBuffer(1, m.data.length, m.sr);
    buf.getChannelData(0).set(m.data);
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.loopStart = m.loopStart; src.loopEnd = m.loopEnd;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicLevel();
    src.connect(this.musicGain).connect(this.master);
    src.start();
    this.music = src;
  }
  // Music sits under the effects. 0.3 felt right; 0.5 drowned the laser.
  musicLevel(paused = this.paused) { return (this.muted || !this.musicOn) ? 0 : paused ? 0.1 : 0.3; }
  ambientLevel(paused = this.paused) { return (this.muted || !this.ambientOn) ? 0 : paused ? 0.10 : 0.28; }
  setMusic(paused = this.paused) {
    this.paused = !!paused;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicLevel(), this.ctx.currentTime, 0.08);
  }
  setPaused(paused) {
    this.paused = !!paused;
    this.setMusic(this.paused);
    if (this.ambientBus) this.ambientBus.gain.setTargetAtTime(this.ambientLevel(), this.ctx.currentTime, 0.08);
  }
  setMuted(on) {
    this.muted = !!on;
    if (this.muted) this.stopLoops();
    if (!this.ctx) return;
    this.setPaused(this.paused);
    this.setAmbience(this.ambientTheme, this.paused);
  }
  setAmbientOn(on) {
    this.ambientOn = !!on;
    if (!this.ctx) return;
    this.setAmbience(this.ambientTheme, this.paused);
    this.ambientBus.gain.setTargetAtTime(this.ambientLevel(), this.ctx.currentTime, 0.08);
  }
  source(name, bus = 'sfx', level = 1) {
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[name];
    const gn = this.ctx.createGain(); gn.gain.value = (this.vol[name] || 1) * level;
    s.connect(gn).connect(bus === 'ambient' ? this.ambientBus : this.sfxBus);
    s.voiceGain = gn;
    return s;
  }
  duckFor(seconds, amount) {
    if (!this.ctx || !amount) return;
    const now = this.ctx.currentTime;
    for (const [node, normal] of [[this.musicGain, this.musicLevel()], [this.ambientBus, this.ambientLevel()]]) {
      if (!node) continue;
      const p = node.gain; p.cancelScheduledValues(now); p.setValueAtTime(p.value, now);
      p.setTargetAtTime(normal * (1 - amount), now, 0.025);
      p.setTargetAtTime(normal, now + seconds, 0.12);
    }
  }
  play(name) {
    if (!this.ctx || this.muted || !this.buf[name]) return false;
    const now = this.ctx.currentTime, meta = audioMeta(name);
    if (now - (this.lastPlayed[name] ?? -Infinity) < meta.cooldown) return false;
    this.active = this.active.filter(v => !v.done);
    if (this.active.filter(v => v.name === name).length >= meta.max) return false;
    const slot = chooseVoiceSlot(this.active, meta.priority, this.maxVoices);
    if (!slot.allow) return false;
    if (slot.steal >= 0) { const old = this.active[slot.steal]; old.done = true; try { old.source.stop(); } catch (e) { /* ended */ } }
    this.active = this.active.filter(v => !v.done);
    const source = this.source(name), voice = { name, source, priority: meta.priority, started: now, done: false };
    source.onended = () => { voice.done = true; };
    this.active.push(voice); this.lastPlayed[name] = now; source.start();
    this.duckFor(Math.min(0.7, SFX_RECIPES[name].dur), meta.duck);
    return true;
  }
  loop(name, on) {
    if (!this.ctx) return;
    const cur = this.loops[name];
    if (on && !this.muted) {
      if (!cur && this.buf[name]) { const s = this.source(name); s.loop = true; s.start(); this.loops[name] = s; }
    } else if (cur) { try { cur.stop(); } catch (e) { /* already stopped */ } delete this.loops[name]; }
  }
  stopLoops() { for (const n of Object.keys(this.loops)) this.loop(n, false); }
  setAmbience(theme, paused = this.paused) {
    const pauseChanged = this.paused !== !!paused;
    this.ambientTheme = theme || null; this.paused = !!paused;
    if (!this.ctx) return;
    if (pauseChanged) this.ambientBus.gain.setTargetAtTime(this.ambientLevel(), this.ctx.currentTime, 0.08);
    const fadeOut = current => {
      if (!current) return;
      current.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
      try { current.source.stop(this.ctx.currentTime + 0.3); } catch (e) { /* already ended */ }
    };
    if (this.muted || !this.ambientOn || !theme || !AMBIENCE_BY_THEME[theme]) {
      fadeOut(this.ambient); this.ambient = null; return;
    }
    if (this.ambient && this.ambient.theme === theme) return;
    fadeOut(this.ambient);
    const key = 'ambient:' + AMBIENCE_BY_THEME[theme], source = this.source(key, 'ambient');
    source.loop = true;
    const gain = source.voiceGain; gain.gain.value = 0; gain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.08);
    source.start(); this.ambient = { theme, source, gain };
  }
}

// ------------------------------------------------------------------ input
// e.code = physical keys, so WASD sits in the right place on AZERTY too.
// Gamepads: standard mapping only. Odd pads will do odd things.
const KEYS = {
  left: ['ArrowLeft', 'KeyA', 'KeyQ'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'], fire: ['Space', 'KeyZ', 'ControlLeft', 'ControlRight'],
  pick: ['KeyX', 'KeyC', 'ShiftLeft', 'ShiftRight', 'Enter'],
};
const held = new Set(), touchHeld = new Set();
let edges = new Set();
let touchMode = false;
const actionOf = code => Object.keys(KEYS).find(k => KEYS[k].includes(code));
const CONTROLLER_SETTINGS_KEY = 'lj_controller_settings_v1';
function loadControllerSettings() {
  try {
    const raw = localStorage.getItem(CONTROLLER_SETTINGS_KEY);
    return raw ? LJInput.normaliseControllerSettings(JSON.parse(raw)) : LJInput.DEFAULT_CONTROLLER_SETTINGS;
  } catch (e) { return LJInput.DEFAULT_CONTROLLER_SETTINGS; }
}
function saveControllerSettings(value) {
  try { localStorage.setItem(CONTROLLER_SETTINGS_KEY, JSON.stringify(value)); } catch (e) { /* private mode */ }
}
const controllers = new LJInput.ControllerTracker(loadControllerSettings());

function pollInput(inp) {
  const has = a => KEYS[a].some(k => held.has(k)) || touchHeld.has(a);
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = controllers.sample(pads);
  S.pad = pad;
  let suppressFrame = false;
  for (const event of pad.events) {
    if (event.type === 'disconnected' && event.active) {
      S.lostPad = event.index;
      edges = new Set();
      suppressFrame = true;
      if (S.state === 'play') {
        S.state = 'pause';
        sfx.stopLoops();
        sfx.setPaused(true);
        sfx.play('warning');
      }
      showSystemNotice('CONTROLLER DISCONNECTED', 'Reconnect it or use the keyboard. Press P to resume.', 'warning', Infinity);
    } else if ((event.type === 'connected' || event.type === 'reconnected') && event.index === S.lostPad) {
      showSystemNotice('CONTROLLER RECONNECTED', 'Release its controls; it will re-arm from neutral.', 'info', Infinity);
    } else if (event.type === 'ready' && event.index === S.lostPad) {
      const detail = S.state === 'pause' ? 'Press Start or P when you are ready to continue.' : 'Controller input restored; keyboard play can continue.';
      showSystemNotice('CONTROLLER READY', detail, 'info', 6);
      S.lostPad = null;
    }
  }
  if (pad.pressed.menu) {
    if (controllerSettingsOpen()) closeControllerSettings(false);
    else openControllerSettings();
    suppressFrame = true;
  }
  if (controllerSettingsOpen()) {
    updateControllerPanel(pad);
    routeControllerSettingsPad(pad);
    Object.assign(inp, newInput());
    return;
  }
  if (Object.values(pad.pressed).some(Boolean)) sfx.init();
  if (pad.pressed.start) edges.add('pause');
  inp.left = !suppressFrame && (has('left') || pad.held.left);
  inp.right = !suppressFrame && (has('right') || pad.held.right);
  inp.up = !suppressFrame && (has('up') || pad.held.up);
  inp.fire = !suppressFrame && (has('fire') || pad.held.fire);
  inp.up_p = !suppressFrame && (edges.has('up') || pad.pressed.up);
  inp.down_p = !suppressFrame && (edges.has('down') || pad.pressed.down);
  inp.pick_p = !suppressFrame && (edges.has('pick') || pad.pressed.pick);
  inp.fire_p = !suppressFrame && (edges.has('fire') || pad.pressed.fire);
}

// ------------------------------------------------------------------ hiscore
// localStorage. Private browsing eats it; nothing to be done.
// Idea: top-ten table with initials, like it's 1983.
function loadHi() { try { return parseInt(localStorage.getItem('lj_rebuild_hi') || '0', 10) || 0; } catch (e) { return 0; } }
function saveHi(v) { try { localStorage.setItem('lj_rebuild_hi', String(v)); } catch (e) { /* private mode */ } }

// ------------------------------------------------------------------ main
const screenCv = document.getElementById('screen');
const sctx = screenCv.getContext('2d');
const gameCanvas = makeCanvas(W, H);
const gctx = gameCanvas.getContext('2d');
const sfx = new WebSfx();

// Letterboxed to whatever the window is.
function fit() {
  const s = Math.min(window.innerWidth / HI_W, window.innerHeight / HI_H);
  screenCv.style.width = Math.floor(HI_W * s) + 'px';
  screenCv.style.height = Math.floor(HI_H * s) + 'px';
}
window.addEventListener('resize', fit);

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); }
  else if (document.exitFullscreen) document.exitFullscreen();
}

const S = { state: 'title', demo: null, g: null, overT: 0, now: 0, hiscore: loadHi(), inp: newInput(),
  notice: null, lostPad: null, showTelemetry: false,
  pad: { activeIndex: null, connectedCount: 0, waitingNeutral: [] } };

function showSystemNotice(headline, detail, kind = 'info', seconds = 4) {
  S.notice = { headline, detail, kind, until: seconds === Infinity ? Infinity : S.now + seconds };
}

const controllerDialog = () => document.getElementById('controllerSettings');
const controllerSettingNames = ['deadZoneX', 'deadZoneUp', 'deadZoneDown', 'hysteresis'];
function controllerSettingsOpen() { const d = controllerDialog(); return !!(d && d.open); }
function syncControllerForm(settings) {
  for (const name of controllerSettingNames) {
    const input = document.getElementById(name);
    input.value = Math.round(settings[name] * 100);
    document.getElementById(name + 'Value').textContent = input.value + '%';
  }
}
function readControllerForm() {
  const draft = {};
  for (const name of controllerSettingNames) draft[name] = Number(document.getElementById(name).value) / 100;
  return LJInput.normaliseControllerSettings(draft);
}
function openControllerSettings() {
  const dialog = controllerDialog();
  if (!dialog || dialog.open) return;
  if (S.state === 'play') { S.state = 'pause'; sfx.stopLoops(); sfx.setPaused(true); }
  held.clear(); touchHeld.clear(); edges = new Set();
  syncControllerForm(controllers.getSettings());
  if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  document.getElementById('controllerSettingsTitle').focus();
  updateControllerPanel(S.pad);
}
function closeControllerSettings(applied) {
  const dialog = controllerDialog();
  if (!dialog || !dialog.open) return;
  if (applied) {
    const settings = controllers.configure(readControllerForm());
    saveControllerSettings(settings);
    showSystemNotice('CONTROLLER SETTINGS SAVED', 'Release the controller, then press Start or P.', 'info', 6);
  }
  dialog.close();
}
function updateControllerPanel(pad) {
  const status = document.getElementById('controllerStatus');
  const diag = document.getElementById('controllerDiagnostics');
  if (!status || !diag) return;
  const list = pad && pad.diagnostics ? pad.diagnostics : [];
  let statusText = 'No controller detected — keyboard controls still work.';
  if (list.length) {
    const active = list.find(p => p.active) || list[0];
    statusText = active.armed
      ? `Controller ${active.index + 1} connected — ${active.active ? 'active and ready' : 'ready'}.`
      : `Controller ${active.index + 1} connected — release all controls to finish reconnecting.`;
  }
  if (status.textContent !== statusText) status.textContent = statusText;
  const lines = [`Pads connected: ${list.length}`, `Active pad: ${pad && pad.activeIndex !== null ? pad.activeIndex + 1 : 'none'}`];
  for (const p of list) {
    const x = (p.axes.x >= 0 ? '+' : '') + p.axes.x.toFixed(2);
    const y = (p.axes.y >= 0 ? '+' : '') + p.axes.y.toFixed(2);
    lines.push(`Pad ${p.index + 1}: ${(p.id || 'unnamed').slice(0, 56)}`);
    lines.push(`Left stick: X ${x}, Y ${y} — ${p.armed ? 'ready' : 'waiting for neutral'}`);
  }
  diag.textContent = lines.join('\n');
}
function routeControllerSettingsPad(pad) {
  const focusable = [...controllerDialog().querySelectorAll('input,button')];
  if (!focusable.length) return;
  let index = Math.max(0, focusable.indexOf(document.activeElement));
  if (pad.pressed.navUp || pad.pressed.navDown) {
    index = mod(index + (pad.pressed.navDown ? 1 : -1), focusable.length);
    focusable[index].focus();
  }
  const active = document.activeElement;
  if (active && active.matches('input[type="range"]') && (pad.pressed.navLeft || pad.pressed.navRight)) {
    const step = Number(active.step) || 1;
    active.value = Math.max(Number(active.min), Math.min(Number(active.max), Number(active.value) + (pad.pressed.navRight ? step : -step)));
    active.dispatchEvent(new Event('input'));
  }
  if (pad.pressed.fire && active && active.tagName === 'BUTTON') active.click();
  if (pad.pressed.pick) closeControllerSettings(false);
}
function setupControllerSettings() {
  const dialog = controllerDialog();
  for (const name of controllerSettingNames) {
    document.getElementById(name).addEventListener('input', e => {
      document.getElementById(name + 'Value').textContent = e.target.value + '%';
    });
  }
  document.getElementById('controllerApply').addEventListener('click', () => closeControllerSettings(true));
  document.getElementById('controllerDefaults').addEventListener('click', () => syncControllerForm(LJInput.DEFAULT_CONTROLLER_SETTINGS));
  document.getElementById('controllerCancel').addEventListener('click', () => closeControllerSettings(false));
  dialog.addEventListener('cancel', e => { e.preventDefault(); closeControllerSettings(false); });
  dialog.addEventListener('close', () => screenCv.focus());
}

window.addEventListener('keydown', e => {
  if (!e.repeat && e.code === 'F3') { e.preventDefault(); controllerSettingsOpen() ? closeControllerSettings(false) : openControllerSettings(); return; }
  if (controllerSettingsOpen()) {
    if (e.code === 'Escape') { e.preventDefault(); closeControllerSettings(false); }
    return;
  }
  sfx.init();
  const a = actionOf(e.code);
  if (a) e.preventDefault();
  if (!e.repeat) {
    if (a) edges.add(a);
    if (e.code === 'KeyP') edges.add('pause');
    if (e.code === 'KeyM') sfx.setMuted(!sfx.muted);
    if (e.code === 'KeyN') { sfx.musicOn = !sfx.musicOn; sfx.setMusic(S.state === 'pause'); }
    if (e.code === 'KeyB') sfx.setAmbientOn(!sfx.ambientOn);
    if (e.code === 'KeyF') toggleFullscreen();
    if (e.code === 'F2') { e.preventDefault(); S.showTelemetry = !S.showTelemetry; }
    if (e.code === 'Escape' && S.state !== 'title') { sfx.stopLoops(); sfx.setAmbience(null); S.state = 'title'; }
  }
  held.add(e.code);
});
window.addEventListener('keyup', e => held.delete(e.code));
window.addEventListener('blur', () => { held.clear(); touchHeld.clear(); edges = new Set(); controllers.reset(); });
// Pause when the tab's hidden - otherwise you come back to a dead Jetman and a smug alien.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    held.clear(); touchHeld.clear(); edges = new Set(); controllers.reset();
    if (S.state === 'play') { S.state = 'pause'; sfx.stopLoops(); sfx.setPaused(true); }
  }
});

function setupTouch() {
  const box = document.getElementById('touch');
  // game-icons.net glyphs (CC BY 3.0) on the buttons. Text label stays if one's missing.
  // Buttons only appear after a touch, so desktop players never see them.
  const icon = { up: 'icon_rocket-thruster', fire: 'icon_laser-blast', pick: 'icon_grab', down: 'icon_mars-curiosity' };
  for (const a in icon) {
    const btn = box.querySelector(`[data-a="${a}"]`), src = ASSET_DATA.icon && ASSET_DATA.icon[icon[a]];
    if (btn && src) btn.innerHTML = `<img src="${src}" alt="${a}" style="width:44px;height:44px;pointer-events:none">`;
  }
  box.querySelectorAll('[data-a]').forEach(btn => {
    const a = btn.dataset.a;
    const on = e => { e.preventDefault(); sfx.init(); if (!touchHeld.has(a)) edges.add(a); touchHeld.add(a); btn.classList.add('on'); };
    const off = e => { e.preventDefault(); touchHeld.delete(a); btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
  });
  const showTouch = () => { touchMode = true; box.style.display = 'block'; };
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) showTouch();
  window.addEventListener('pointerdown', e => { sfx.init(); if (e.pointerType === 'touch') showTouch(); });
  document.getElementById('pauseBtn').addEventListener('pointerdown', e => { e.preventDefault(); edges.add('pause'); });
}

function step(dt) {
  const inp = S.inp;
  pollInput(inp);
  if (edges.has('pause') && (S.state === 'play' || S.state === 'pause')) {
    S.state = S.state === 'play' ? 'pause' : 'play';
    sfx.stopLoops();
    sfx.setPaused(S.state === 'pause');
    if (S.state === 'play') S.notice = null;
  }
  if (S.state === 'title') {
    S.demo.cam = wrap(S.demo.cam + 30 * dt);
    S.demo.base.t += dt;
    if (inp.fire_p || inp.pick_p) {
      S.g = new Game(sfx); S.state = 'play'; sfx.setPaused(false);
      sfx.setAmbience(S.g.profile().theme, false); sfx.play('start');
    }
  } else if (S.state === 'play') {
    S.g.update(dt, inp);
    sfx.setAmbience(S.g.profile().theme, false);
    if (S.g.over) {
      S.state = 'over'; S.overT = 0;
      sfx.setPaused(true);
      if (S.g.score > S.hiscore) { S.hiscore = S.g.score; saveHi(S.hiscore); }
    }
  } else if (S.state === 'over') {
    S.overT += dt;
    S.g.updateFx(dt);
    if (S.overT > 1.5 && (inp.fire_p || inp.pick_p)) { S.state = 'title'; sfx.setAmbience(null); }
  }
  edges = new Set();
}

function render() {
  const world = S.state === 'title' ? S.demo : S.g;
  drawWorld(gctx, world, S.now);
  sctx.imageSmoothingEnabled = false;
  R(sctx, '#000', 0, 0, HI_W, HI_H);
  let ox = 0, oy = 0;
  if (world.shake > 0) { ox = randint(-6, 6); oy = randint(-6, 6); }
  sctx.drawImage(gameCanvas, ox, oy, HI_W, HI_H);
  if (world.redFlash > 0) R(sctx, `rgba(255,40,20,${(0.43 * world.redFlash / 0.6).toFixed(3)})`, 0, 0, HI_W, HI_H);
  if (S.state === 'title') drawTitle(sctx, S.now, S.hiscore);
  else {
    drawHud(sctx, S.g, S.now, S.hiscore);
    if (S.showTelemetry) drawTelemetry(sctx, S.g);
    if (S.state === 'pause') text(sctx, 84, 'PAUSED', HI_W / 2, 330, PALC.Y, true);
    else if (S.state === 'over') {
      text(sctx, 84, 'GAME OVER', HI_W / 2, 280, PALC.R, true);
      text(sctx, 30, S.g.overReason, HI_W / 2, 390, PALC.W, true);
      text(sctx, 30, `FINAL SCORE ${pad(S.g.score, 6)}   LEVEL ${S.g.level}`, HI_W / 2, 440, PALC.Y, true);
      if (S.overT > 1.5) text(sctx, 22, touchMode ? 'TAP FIRE' : 'PRESS FIRE', HI_W / 2, 500, PALC.C, true);
    }
    if (S.notice && (S.notice.until === Infinity || S.now < S.notice.until)) {
      const col = S.notice.kind === 'warning' ? PALC.O : PALC.C;
      R(sctx, 'rgba(5,8,20,.88)', 170, 510, HI_W - 340, 120);
      strokeR(sctx, col, 170, 510, HI_W - 340, 120, 4);
      text(sctx, 34, S.notice.headline, HI_W / 2, 552, col, true);
      text(sctx, 20, S.notice.detail, HI_W / 2, 596, PALC.W, true);
    } else if (S.notice) S.notice = null;
  }
}

let last = 0;
function frame(ts) {
  const dt = last ? Math.min(Math.max((ts - last) / 1000, 0), 1 / 30) : 1 / 60;
  last = ts;
  S.now += dt;
  step(dt);
  render();
  requestAnimationFrame(frame);
}

// ---- automated checks: index.html?selftest=FRAMES or ?stage=1 (static scene for screenshots)
// The autopilot is a monkey on the controls. Not clever, but it finds crashes.
function autopilot(frameNo) {
  if (frameNo % 40 === 0) autopilot.mode = choice(['left', 'right', 'idle', 'right', 'left']);
  const m = autopilot.mode || 'idle';
  held.clear();
  if (m === 'left') held.add('ArrowLeft');
  if (m === 'right') held.add('ArrowRight');
  if (Math.random() < 0.55) held.add('ArrowUp');
  if (Math.random() < 0.3) held.add('Space');
  if (Math.random() < 0.01) edges.add('up');
  if (Math.random() < 0.02) edges.add('down');
  if (Math.random() < 0.02) edges.add('pick');
}
function runSelftest(n) {
  const out = document.getElementById('result');
  for (const kind of ['drifter', 'chaser', 'bouncer', 'diver', 'heavy', 'ufo']) {
    const banks = [art.alien[kind], art.alienHit[kind], art.alienDamaged[kind], art.alienHitFlip[kind], art.alienDamagedFlip[kind]];
    if (banks.some(b => b.length !== art.alien[kind].length)) throw new Error('alien variant frame count: ' + kind);
    for (const bank of banks) for (let i = 0; i < bank.length; i++) {
      if (bank[i].width !== art.alien[kind][i].width || bank[i].height !== art.alien[kind][i].height)
        throw new Error('alien variant dimensions: ' + kind);
    }
  }
  const t0 = performance.now();
  let games = 1, maxLevel = 1;
  for (let f = 1; f <= n; f++) {
    if (S.state === 'title' && f > 2) edges.add('fire');
    autopilot(f);
    S.now += 1 / 60;
    step(1 / 60);
    if (f % 10 === 0) render();
    if (S.state === 'over') { S.state = 'title'; games++; }
    if (S.g) maxLevel = Math.max(maxLevel, S.g.level);
  }
  render();
  const ms = performance.now() - t0;
  sfx.init();
  const nb = Object.keys(sfx.buf).length;
  const audio = sfx.ctx ? `audio=${sfx.ctx.state} buffers=${nb} ambience=${Object.keys(AMBIENT_RECIPES).length} music=${sfx.music ? (MUSIC_DATA.data.length / MUSIC_DATA.sr).toFixed(1) + 's' : 'none'}` : 'audio=unavailable';
  out.textContent = `SELFTEST OK frames=${n} games=${games} maxLevel=${maxLevel} ms=${ms.toFixed(0)} ${audio}`;
  document.title = out.textContent;
}
function stageScene(level = 6) {
  const chosenLevel = Math.max(1, Math.min(6, trunc(level) || 6));
  const g = new Game(sfx, 2);
  g.level = chosenLevel; g.timer = g.levelTime();
  S.g = g; S.state = 'play';
  for (let i = 0; i < 60; i++) g.update(1 / 60, newInput());
  const r = g.rover; r.x = wrap(g.base.x - 90);
  const bomb = g.items.find(i => i.kind === 'bomb'); r.cargo = bomb; bomb.state = 'trailer';
  g.p.x = wrap(g.base.x - 40); g.p.y = 110; g.p.onGround = false; g.cam = g.p.x;
  ['drifter', 'chaser', 'bouncer', 'diver', 'heavy', 'ufo'].forEach((k, i) => g.aliens.push(new Alien(k, wrap(g.cam - 140 + i * 52), 50 + (i % 2) * 40, 1, 0)));
  const stagedHeavy = g.aliens.find(a => a.kind === 'heavy');
  stagedHeavy.hp = 1; // persistent damaged frames
  g.aliens.find(a => a.kind === 'chaser').hitT = 1; // bright impact frame
  const stagedDiver = g.aliens.find(a => a.kind === 'diver');
  stagedDiver.diveWarnT = DIVER_WARNING * 0.65; stagedDiver.diveTargetX = r.x;
  r.blocked = g.terr.craters[0]; r.blockedPulse = 1;
  Object.assign(g.stats, { diverTelegraphs: 3, diverLaunches: 2, diverCrashes: 1, roverBlockEvents: 2 });
  g.timer = 12; g.flash(`LEVEL ${g.level}: ${g.levelName()} - ART STAGE`, 99);
  const L = new Laser(wrap(g.p.x + 6), g.p.y - 7, 1); L.len = 100; g.lasers.push(L);
  g.missiles.push(new Missile(wrap(g.base.x + 20), 120, 'earth'));
  g.booms.push([wrap(g.cam + 100), 70, 0.12, 'small'], [wrap(g.cam + 130), 100, 0.15, 'air'],
    [wrap(g.cam - 100), g.terr.base(g.cam - 100), 0.3, 'ground']);
  g.updateItems(0);
  S.now = 2.3;
  render();
  document.getElementById('result').textContent = 'STAGE OK';
}

window.addEventListener('error', e => {
  const out = document.getElementById('result');
  if (out) out.textContent = 'ERROR: ' + e.message + ' @' + e.lineno;
  document.title = 'ERROR: ' + e.message;
});

(async function boot() {
  fit();
  MUSIC_DATA = renderMusic(22050);  // ~0.5s, before the title shows, so nobody notices
  await buildArt();
  setupTouch();
  setupControllerSettings();
  try {
    const link = document.createElement('link'); link.rel = 'icon';
    link.href = art.jet.fly_1.toDataURL(); document.head.appendChild(link);
  } catch (e) { /* ignore */ }
  S.demo = new Game(null, 11);
  S.demo.p.inRover = true;
  const q = new URLSearchParams(location.search);
  S.showTelemetry = q.has('telemetry');
  if (q.has('selftest')) { runSelftest(parseInt(q.get('selftest'), 10) || 3600); return; }
  if (q.has('stage')) { stageScene(parseInt(q.get('stage'), 10)); return; }
  requestAnimationFrame(frame);
})();
