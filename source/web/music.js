// Background music, as code. "Moon Punk" - an original tune, written for this game.
//
// Style brief was Melodyloops' punk section: fast, loud, power chords, eighth-note bass,
// a skank beat in the chorus. Their tracks are paid and licensed, so nothing of theirs is
// copied here - this is just the genre, which nobody owns. Yet.
//
// 176 BPM, E minor-ish. Intro 2 bars, then verse 8, chorus 8, bridge 4, and it loops back
// to the verse. ~30s rendered once at start-up, ~0.3s of work at 22 kHz. Then it's free.
//
// Ideas: second verse with a lead line; a slower, sadder variant for game over;
// pitch the whole thing up a semitone each level. That last one might be annoying. Might be great.
'use strict';

const MUSIC_BPM = 176;

// Song sheet. Roots for the guitar/bass, per bar. Kept as plain text so it reads like a chart.
const MUSIC_SONG = {
  intro:  { bars: ['E2', 'E2'], beat: 'rock', guitar: 'none', fillLast: true },
  verse:  { bars: ['E2', 'E2', 'C2', 'D2', 'E2', 'E2', 'C2', 'D2'], beat: 'rock', guitar: 'mute' },
  chorus: { bars: ['G2', 'D2', 'A2', 'C3', 'G2', 'D2', 'A2', 'B2'], beat: 'skank', guitar: 'open', lead: true },
  bridge: { bars: ['E2', 'C2', 'D2', 'B1'], beat: 'half', guitar: 'ring', fillLast: true },
};
const MUSIC_ORDER = ['intro', 'verse', 'chorus', 'bridge'];
const MUSIC_LOOP_FROM = 'verse';  // the intro only plays once

// Chorus lead: [note, length in eighths], one line per bar. Hummable, I hope.
const MUSIC_LEAD = [
  [['B4', 2], ['B4', 1], ['A4', 1], ['G4', 2], ['D5', 2]],
  [['D5', 3], ['E5', 1], ['D5', 2], ['A4', 2]],
  [['C#5', 2], ['C#5', 1], ['B4', 1], ['A4', 2], ['E5', 2]],
  [['E5', 3], ['G5', 1], ['E5', 2], ['D5', 2]],
  [['B4', 2], ['B4', 1], ['A4', 1], ['G4', 2], ['D5', 2]],
  [['D5', 3], ['E5', 1], ['F#5', 2], ['A5', 2]],
  [['G5', 2], ['F#5', 1], ['E5', 1], ['C#5', 2], ['A4', 2]],
  [['B4', 4], ['D#5', 2], ['F#5', 2]],
];

// Drum grids, 8 eighths a bar. k = kick, s = snare, h = hat. Lower case = quieter.
const MUSIC_BEATS = {
  rock:  { k: 'X...X.x.', s: '..X...X.', h: 'xxxxxxxx' },
  skank: { k: 'X.X.X.X.', s: '.X.X.X.X', h: 'xxxxxxxx' },
  half:  { k: 'X.....x.', s: '....X...', h: 'x.x.x.x.' },
};

function musicFreq(name) {
  const m = /^([A-G])(#?)(-?\d)$/.exec(name);
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  return 440 * Math.pow(2, (12 * (+m[3] + 1) + semi - 69) / 12);
}

function renderMusic(sr) {
  const e8 = 60 / MUSIC_BPM / 2;            // one eighth note, seconds
  const bar = e8 * 8;
  let totalBars = 0;
  for (const s of MUSIC_ORDER) totalBars += MUSIC_SONG[s].bars.length;
  const n = Math.ceil(totalBars * bar * sr);
  const drums = new Float32Array(n), bass = new Float32Array(n), gtr = new Float32Array(n), lead = new Float32Array(n);
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };

  // One note into a buffer. Simple oscillator + exponential decay + one-pole low-pass. That's the whole band.
  function note(buf, t0, dur, f, wave, vol, decay, cutoff, duty = 0.5) {
    const i0 = Math.floor(t0 * sr), len = Math.floor(dur * sr), a = 1 - Math.exp(-2 * Math.PI * cutoff / sr);
    let ph = 0, y = 0;
    for (let i = 0; i < len && i0 + i < n; i++) {
      ph = (ph + f / sr) % 1;
      let x = wave === 'saw' ? 2 * ph - 1 : wave === 'tri' ? 4 * Math.abs(ph - 0.5) - 1 : (ph < duty ? 1 : -1);
      const t = i / sr;
      x *= vol * Math.exp(-t / decay) * Math.min(1, t * 400) * Math.min(1, (len - i) / (sr * 0.004));
      y += a * (x - y);
      buf[i0 + i] += y;
    }
  }
  function kick(t0, vol) {
    const i0 = Math.floor(t0 * sr), len = Math.floor(0.14 * sr);
    let ph = 0;
    for (let i = 0; i < len && i0 + i < n; i++) {
      const t = i / sr, f = 45 + 110 * Math.exp(-t * 35);
      ph += f / sr;
      drums[i0 + i] += Math.sin(2 * Math.PI * ph) * vol * Math.exp(-t * 22);
    }
  }
  function snare(t0, vol) {
    const i0 = Math.floor(t0 * sr), len = Math.floor(0.16 * sr);
    let ph = 0, y = 0;
    for (let i = 0; i < len && i0 + i < n; i++) {
      const t = i / sr;
      ph += 190 / sr;
      y += 0.5 * (rnd() - y);  // a bit of low-pass so it's crack, not hiss
      drums[i0 + i] += (y * 0.9 * Math.exp(-t * 20) + Math.sin(2 * Math.PI * ph) * 0.5 * Math.exp(-t * 35)) * vol;
    }
  }
  function hat(t0, vol, len = 0.03) {
    const i0 = Math.floor(t0 * sr), m = Math.floor(len * sr);
    let prev = 0;
    for (let i = 0; i < m && i0 + i < n; i++) {
      const w = rnd(), x = w - prev;  // first difference = cheap high-pass
      prev = w;
      drums[i0 + i] += x * vol * Math.exp(-(i / sr) * 90);
    }
  }
  function fill(t0) {  // snare roll over the second half of a bar
    for (let k = 0; k < 8; k++) snare(t0 + bar / 2 + k * e8 / 2, 0.35 + k * 0.06);
  }

  let b = 0, loopStart = 0;
  for (const name of MUSIC_ORDER) {
    const sec = MUSIC_SONG[name], beat = MUSIC_BEATS[sec.beat];
    if (name === MUSIC_LOOP_FROM) loopStart = b * bar;
    sec.bars.forEach((root, bi) => {
      const t0 = b * bar, fr = musicFreq(root);
      const last = bi === sec.bars.length - 1;
      if (bi === 0 && name !== 'intro') hat(t0, 0.5, 0.6);  // crash at the top of each section, near enough
      for (let k = 0; k < 8; k++) {
        const t = t0 + k * e8;
        const filling = last && sec.fillLast && k >= 4;
        if (beat.k[k] !== '.' && !filling) kick(t, beat.k[k] === 'X' ? 1 : 0.6);
        if (beat.s[k] !== '.' && !filling) snare(t, beat.s[k] === 'X' ? 0.7 : 0.4);
        if (beat.h[k] !== '.') hat(t, 0.16);
        // bass: root eighths, octave pop on the last eighth of the chorus bars
        if (sec.beat !== 'half' || k % 2 === 0) {
          const oct = sec.lead && k === 7 ? 2 : 1;
          note(bass, t, e8 * (sec.beat === 'half' ? 2 : 1) * 0.95, fr * oct, 'pulse', 0.5, 0.25, 900, 0.3);
        }
        // guitar: power chord = root, fifth, octave. Muted chugs, open eighths, or one big ring.
        const g = sec.guitar;
        if (g === 'none' || (g === 'ring' && k !== 0)) continue;
        const len = g === 'ring' ? bar : e8 * 0.95, dec = g === 'mute' ? 0.07 : g === 'open' ? 0.22 : 0.9;
        const cut = g === 'mute' ? 1400 : 3200;
        for (const [mul, vol] of [[2, 0.35], [2 * 1.4983, 0.3], [4, 0.2]]) {
          note(gtr, t, len, fr * mul, 'saw', vol, dec, cut);
          note(gtr, t, len, fr * mul * 1.004, 'saw', vol * 0.6, dec, cut);  // slight detune = two guitars
        }
      }
      if (last && sec.fillLast) fill(t0);
      if (sec.lead) {
        let k = 0;
        for (const [nm, len8] of MUSIC_LEAD[bi]) {
          note(lead, t0 + k * e8, len8 * e8 * 0.92, musicFreq(nm), 'pulse', 0.3, 0.6, 3000, 0.25);
          k += len8;
        }
      }
      b++;
    });
  }
  // distortion on the guitars only - tanh soft clip. Turn drive up for more punk, less music.
  const out = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = drums[i] * 0.9 + bass[i] * 0.8 + Math.tanh(gtr[i] * 3) * 0.32 + lead[i] * 0.7;
    out[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
  return { data: out, sr, loopStart, loopEnd: totalBars * bar };
}

if (typeof module !== 'undefined') module.exports = { renderMusic, MUSIC_BPM };
