// Sound effects, as code. No audio files ship with the game - every sound below is a recipe,
// rendered to a buffer at start-up.
//
// The recipes were reworked by ear-and-spectrum from the CC0 "512 Sound Effects" pack
// (Juhani Junkala): tools/sfx_analyse.py measures the originals, tools/sfx_compare.py
// checks these against them. Close enough to fool most ears. Not all of them.
//
// Recipe = a few voices mixed together, plus optional echo.
//   wave   square | pulse | tri | saw | sine | noise   (noise = white, low-passed at f/2)
//   f      [[t, hz], ...]   glides between points, log-scale, so sweeps sound even
//   steps  [[t, hz], ...]   same idea but jumps - arpeggios, chiptune style
//   amp    [[t, level], ...] straight lines between points, 0..1
//   lp     [[t, hz], ...]   one-pole low-pass on that voice. Cheap; does the job
//   vib    [rate, cents]    vibrato
//   am     [rate, depth]    tremolo - the engine's putt-putt
//   echo   { delay, decay, count } on the whole mix
//
// Ideas: a proper ADSR helper would shorten these tables. A tiny title-screen tune, too.
'use strict';

const SFX_RECIPES = {
  // ~2 kHz -> 250 Hz dive in a tenth of a second. Triangle-ish with a bit of edge.
  laser: { dur: 0.15, gain: 0.55, voices: [
    { wave: 'tri', f: [[0, 2050], [0.02, 1450], [0.12, 256], [0.15, 215]], amp: [[0, 1], [0.10, 0.82], [0.15, 0]] },
    { wave: 'saw', f: [[0, 2050], [0.02, 1450], [0.12, 256], [0.15, 215]], amp: [[0, 0.18], [0.10, 0.12], [0.15, 0]] },
  ] },

  // Two-note coin, roughly A6 then C#7. Square, filtered so it doesn't scratch.
  pick: { dur: 0.09, gain: 0.7, voices: [
    { wave: 'square', lp: [[0, 4500]], steps: [[0, 1738], [0.045, 2247]], amp: [[0, 1], [0.03, 0.85], [0.06, 0.75], [0.09, 0]] },
  ] },

  // Three quick buzzy blips, last one higher. Thin pulse, so it's all edge.
  drop: { dur: 0.06, gain: 0.35, voices: [
    { wave: 'pulse', duty: 0.125, steps: [[0, 935], [0.03, 1470]],
      amp: [[0, 1], [0.013, 0.9], [0.015, 0.3], [0.017, 0.95], [0.028, 0.9], [0.03, 0.3], [0.032, 0.9], [0.055, 0.6], [0.06, 0]] },
  ] },

  // Clunk-clunk-ding. Pulse arpeggio with a dusting of noise.
  bridge: { dur: 0.14, gain: 0.55, voices: [
    { wave: 'pulse', duty: 0.25, steps: [[0, 500], [0.02, 262], [0.035, 290], [0.05, 316], [0.06, 750], [0.075, 830], [0.09, 522]],
      amp: [[0, 0.9], [0.01, 1], [0.12, 0.85], [0.14, 0]] },
    { wave: 'noise', f: [[0, 6000], [0.14, 7000]], amp: [[0, 0.35], [0.14, 0]] },
  ] },

  // Dull thud - low square under bright-ish noise.
  hit: { dur: 0.16, gain: 0.6, voices: [
    { wave: 'square', steps: [[0, 250], [0.02, 100], [0.04, 105], [0.08, 300], [0.11, 130]], amp: [[0, 0.7], [0.13, 0.15], [0.16, 0]],
      lp: [[0, 2500]] },
    { wave: 'noise', f: [[0, 3600]], amp: [[0, 0.8], [0.13, 0.25], [0.16, 0]] },
  ] },

  // Small explosion. Odd one: it gets brighter as it fades, so the noise rate climbs.
  boom: { dur: 0.61, gain: 0.75, voices: [
    { wave: 'noise', f: [[0, 6000], [0.3, 9500], [0.6, 8500]],
      amp: [[0, 1], [0.1, 0.72], [0.2, 0.48], [0.3, 0.36], [0.4, 0.25], [0.5, 0.15], [0.61, 0]] },
  ] },

  // The big one. Bright crack, then it rolls off into a low rumble over two seconds.
  bigboom: { dur: 2.15, gain: 0.8, voices: [
    { wave: 'noise', f: [[0, 7500], [0.5, 4200], [1.2, 1900], [2.1, 1000]], lp: [[0, 7000], [0.6, 2600], [1.3, 1100], [2.1, 700]],
      amp: [[0, 1], [0.45, 0.95], [0.6, 0.9], [0.9, 0.7], [1.2, 0.55], [1.5, 0.6], [1.8, 0.4], [2.0, 0.27], [2.15, 0]] },
    { wave: 'tri', f: [[0, 130], [0.7, 110], [2.1, 55]], vib: [11, 900],
      amp: [[0, 0.1], [0.6, 0.5], [1.4, 0.45], [2.0, 0.2], [2.15, 0]] },
  ] },

  // Thump: noise crack, then a sub-bass dive 190 -> 25 Hz and a rumbling tail.
  cannon: { dur: 0.77, gain: 0.9, voices: [
    { wave: 'noise', f: [[0, 5000]], amp: [[0, 1], [0.06, 0.2], [0.1, 0]] },
    { wave: 'square', f: [[0, 190], [0.06, 75], [0.12, 33], [0.2, 28], [0.77, 25]], lp: [[0, 1400], [0.2, 500], [0.77, 300]],
      amp: [[0, 0.9], [0.2, 1], [0.35, 0.55], [0.5, 0.3], [0.6, 0.14], [0.7, 0.02], [0.77, 0]] },
    { wave: 'noise', f: [[0, 2600]], lp: [[0, 1500], [0.3, 420]],
      amp: [[0, 0.3], [0.2, 0.45], [0.3, 0.12], [0.5, 0.05], [0.7, 0.01], [0.77, 0]] },
  ] },

  // Jetman's last word. ~500 Hz cry, scoops up, sags, with an off-harmonic at 1.5x.
  die: { dur: 0.38, gain: 0.8, voices: [
    { wave: 'square', f: [[0, 400], [0.04, 400], [0.08, 517], [0.12, 500], [0.22, 483], [0.34, 467]], vib: [10, 70], lp: [[0, 1500]],
      amp: [[0, 0.35], [0.06, 0.6], [0.1, 1], [0.18, 0.85], [0.24, 0.4], [0.3, 0.18], [0.38, 0]] },
    { wave: 'tri', f: [[0, 600], [0.08, 767], [0.14, 750], [0.34, 700]], vib: [10, 70],
      amp: [[0, 0.3], [0.1, 0.5], [0.22, 0.3], [0.3, 0.15], [0.38, 0]] },
    { wave: 'tri', f: [[0.05, 1700], [0.32, 1600]], amp: [[0, 0], [0.06, 0.25], [0.22, 0.2], [0.38, 0]] },
  ] },

  // Rising two-voice C-major fanfare, ending on a shimmer.
  extra: { dur: 0.52, gain: 0.55, voices: [
    { wave: 'square', steps: [[0, 175], [0.04, 225], [0.08, 250], [0.12, 300], [0.16, 350], [0.2, 400], [0.24, 500], [0.28, 525]],
      lp: [[0, 3000]], amp: [[0, 1], [0.48, 0.9], [0.52, 0]] },
    { wave: 'square', steps: [[0, 350], [0.04, 425], [0.08, 550], [0.12, 600], [0.16, 700], [0.2, 875], [0.24, 1000], [0.28, 1050],
      [0.32, 1325], [0.34, 1050], [0.36, 1325], [0.38, 1050], [0.40, 1325], [0.42, 1050], [0.44, 1325], [0.46, 1050], [0.48, 1325]],
      lp: [[0, 3500]], amp: [[0, 0.7], [0.48, 0.65], [0.52, 0]] },
    { wave: 'square', steps: [[0.3, 650]], amp: [[0, 0], [0.3, 0], [0.31, 0.4], [0.48, 0.4], [0.52, 0]] },
  ] },

  // Menu "go": quick upward sweep, echoed three times.
  start: { dur: 0.31, gain: 0.7, echo: { delay: 0.1, decay: 0.25, count: 2 }, voices: [
    { wave: 'square', f: [[0, 930], [0.02, 1350], [0.04, 1800], [0.05, 2220], [0.06, 3570], [0.07, 4450], [0.09, 3870]], lp: [[0, 6000]], amp: [[0, 0.9], [0.02, 1], [0.05, 0.6], [0.08, 0.35], [0.1, 0]] },
    { wave: 'noise', f: [[0, 9000]], amp: [[0, 0], [0.04, 0.4], [0.09, 0.2], [0.1, 0]] },
  ] },

  // Teleport: five rising sweeps, fading. Sci-fi by numbers.
  teleport: { dur: 0.88, gain: 0.6, echo: { delay: 0.18, decay: 0.72, count: 4 }, voices: [
    { wave: 'square', f: [[0, 1100], [0.02, 1262], [0.08, 2355], [0.14, 4416], [0.18, 4800]], lp: [[0, 7000]],
      amp: [[0, 1], [0.12, 0.85], [0.17, 0.5], [0.18, 0]] },
  ] },

  // Missile launch: whoosh that swells, then the burn drops away.
  launch: { dur: 0.78, gain: 0.8, voices: [
    { wave: 'noise', f: [[0, 9000], [0.1, 10000], [0.25, 6000], [0.35, 3500], [0.5, 2200], [0.78, 1600]],
      lp: [[0, 9000], [0.2, 6000], [0.35, 3200], [0.5, 1800], [0.78, 1300]],
      amp: [[0, 0.06], [0.05, 0.3], [0.15, 0.6], [0.25, 0.85], [0.32, 0.85], [0.45, 0.55], [0.56, 0.5], [0.6, 0.2], [0.7, 0.08], [0.78, 0]] },
    { wave: 'saw', f: [[0.25, 520], [0.45, 64], [0.78, 50]], lp: [[0, 900]], amp: [[0, 0], [0.28, 0.3], [0.5, 0.25], [0.6, 0.08], [0.78, 0]] },
  ] },

  // Rover engine, loops. Low putt-putt: pulse flips 32/55 Hz, noise chuffs at 8 Hz.
  // Exactly 1s so the loop seam lands on whole cycles.
  engine: { dur: 1.0, gain: 0.55, loop: true, voices: [
    { wave: 'pulse', duty: 0.2, steps: [[0, 32], [0.2, 55], [0.45, 32], [0.65, 55], [0.9, 32]], lp: [[0, 900]], amp: [[0, 0.8], [1, 0.8]] },
    { wave: 'noise', f: [[0, 6500]], lp: [[0, 4500]], am: [8, 0.6], amp: [[0, 0.6], [1, 0.6]] },
  ] },

  // The two below are original - no reference sound, just what felt right.
  thrust: { dur: 0.3, gain: 0.25, loop: true, voices: [
    { wave: 'noise', f: [[0, 3700]], lp: [[0, 2400]], amp: [[0, 1], [0.3, 1]] },
  ] },
  alarm: { dur: 0.09, gain: 0.45, voices: [
    { wave: 'square', f: [[0, 1250]], amp: [[0, 1], [0.07, 0.6], [0.09, 0]] },
  ] },
  // A bright rising chirp: short enough to leave the player the promised half-second
  // of thinking time before the diver commits.
  divewarn: { dur: 0.24, gain: 0.34, voices: [
    { wave: 'tri', f: [[0, 430], [0.11, 720], [0.24, 980]],
      amp: [[0, 0], [0.015, 0.9], [0.10, 0.45], [0.13, 0.8], [0.22, 0.25], [0.24, 0]] },
  ] },
  // One dull mechanical refusal per crater encounter, rather than a pneumatic
  // drill for every frame the player keeps the accelerator down.
  blocked: { dur: 0.18, gain: 0.4, voices: [
    { wave: 'square', f: [[0, 105], [0.18, 72]], lp: [[0, 700]],
      amp: [[0, 0.9], [0.04, 0.5], [0.09, 0.65], [0.18, 0]] },
    { wave: 'noise', f: [[0, 1800]], lp: [[0, 650]], amp: [[0, 0.45], [0.05, 0.12], [0.18, 0]] },
  ] },
  // A separate two-part warning for low fuel and controller loss. The countdown
  // keeps its sharp single pip, so players can tell the problems apart by ear.
  warning: { dur: 0.42, gain: 0.48, voices: [
    { wave: 'square', steps: [[0, 760], [0.09, 520], [0.21, 760], [0.30, 520]], lp: [[0, 2600]],
      amp: [[0, 0.9], [0.075, 0.75], [0.10, 0], [0.20, 0], [0.21, 0.9], [0.285, 0.75], [0.31, 0], [0.42, 0]] },
    { wave: 'tri', f: [[0, 190], [0.1, 130], [0.21, 190], [0.31, 130]],
      amp: [[0, 0.35], [0.1, 0], [0.2, 0], [0.21, 0.35], [0.31, 0], [0.42, 0]] },
  ] },
};

// ---- the renderer. Pure maths, no Web Audio, so node can run it for the comparison tests.
function sfxCurve(points, t, log) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      const k = (t - t0) / ((t1 - t0) || 1);
      return log ? v0 * Math.pow(v1 / v0, k) : v0 + (v1 - v0) * k;
    }
  }
  return points[points.length - 1][1];
}
function sfxStep(points, t) {
  let v = points[0][1];
  for (const [tt, vv] of points) { if (t >= tt) v = vv; else break; }
  return v;
}

function renderSfx(recipe, sr, seed = 1) {
  const n = Math.max(1, Math.floor(recipe.dur * sr));
  const out = new Float32Array(n);
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2147483648 - 1; };
  for (const v of recipe.voices) {
    let ph = 0, lp = 0, f = 0, cut = 0, alpha = 1, n1 = 0, n2 = 0, na = 1;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if ((i & 31) === 0) {          // control rate: every 32 samples is plenty
        f = v.steps ? sfxStep(v.steps, t) : sfxCurve(v.f, t, true);
        if (v.vib) f *= Math.pow(2, v.vib[1] / 1200 * Math.sin(2 * Math.PI * v.vib[0] * t));
        if (v.lp) { cut = sfxCurve(v.lp, t, true); alpha = 1 - Math.exp(-2 * Math.PI * cut / sr); }
        if (v.wave === 'noise') na = 1 - Math.exp(-2 * Math.PI * Math.min(f * 0.5, sr * 0.45) / sr);
      }
      const a = sfxCurve(v.amp, t, false);
      if (a <= 0 && !v.lp) continue;
      ph = (ph + f / sr) % 1;
      let x;
      switch (v.wave) {
        case 'square': x = ph < 0.5 ? 1 : -1; break;
        case 'pulse': x = ph < (v.duty || 0.25) ? 1 : -1; break;
        case 'tri': x = 4 * Math.abs(ph - 0.5) - 1; break;
        case 'saw': x = 2 * ph - 1; break;
        case 'sine': x = Math.sin(2 * Math.PI * ph); break;
        default: n1 += na * (rnd() - n1); n2 += na * (n1 - n2); x = n2 * 2.2;  // noise, 2-pole LP
      }
      if (v.am) x *= 1 - v.am[1] * (0.5 + 0.5 * Math.sin(2 * Math.PI * v.am[0] * t));
      x *= a;
      if (v.lp) { lp += alpha * (x - lp); x = lp; }
      out[i] += x;
    }
  }
  if (recipe.echo) {
    const d = Math.floor(recipe.echo.delay * sr), src = out.slice();
    for (let k = 1; k <= recipe.echo.count; k++) {
      const g = Math.pow(recipe.echo.decay, k);
      for (let i = 0; i + k * d < n; i++) out[i + k * d] += src[i] * g;
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = (recipe.gain || 0.5) / (peak || 1);
  for (let i = 0; i < n; i++) out[i] *= g;
  return out;
}

if (typeof module !== 'undefined') module.exports = { SFX_RECIPES, renderSfx };
