'use strict';

const fs = require('fs');
const path = require('path');
const {
  SFX_RECIPES, AMBIENT_RECIPES, AMBIENCE_BY_THEME,
  audioMeta, chooseVoiceSlot, renderSfx,
} = require('../web/sfx.js');

function assert(ok, message) { if (!ok) throw new Error(message); }
function peakOf(data) {
  let peak = 0;
  for (const value of data) {
    assert(Number.isFinite(value), 'rendered audio contains a non-finite sample');
    peak = Math.max(peak, Math.abs(value));
  }
  return peak;
}

for (const name of ['heavyhit', 'levelup', 'missilewarn']) {
  assert(SFX_RECIPES[name], 'missing new event recipe: ' + name);
  const a = renderSfx(SFX_RECIPES[name], 22050, 7);
  const b = renderSfx(SFX_RECIPES[name], 22050, 7);
  assert(a.length === b.length && a.every((v, i) => v === b[i]), name + ' must render deterministically');
  assert(peakOf(a) > 0.05, name + ' is effectively silent');
}

const themes = ['dust', 'static', 'crater', 'red', 'iron', 'void'];
assert(Object.keys(AMBIENT_RECIPES).length === themes.length, 'unexpected ambience count');
for (const theme of themes) {
  const recipe = AMBIENT_RECIPES[theme];
  assert(recipe && recipe.loop && recipe.dur >= 4, 'bad ambience recipe: ' + theme);
  assert(AMBIENCE_BY_THEME[theme] === theme, 'theme mapping missing: ' + theme);
  const data = renderSfx(recipe, 11025, 11);
  const peak = peakOf(data);
  assert(peak >= 0.07 && peak <= 0.2, theme + ' ambience outside quiet-bed range: ' + peak);
}

assert(audioMeta('warning').priority > audioMeta('laser').priority, 'warning must outrank laser');
assert(audioMeta('missilewarn').priority >= audioMeta('bigboom').priority, 'missile warning must survive explosions');
assert(audioMeta('alarm').max === 1 && audioMeta('levelup').max === 1, 'critical cues need instance limits');
let slot = chooseVoiceSlot([{ priority: 1, started: 2 }, { priority: 2, started: 3 }], 5, 2);
assert(slot.allow && slot.steal === 0, 'critical cue should steal the lowest-priority voice');
slot = chooseVoiceSlot([{ priority: 5, started: 1 }, { priority: 5, started: 2 }], 2, 2);
assert(!slot.allow && slot.steal === -1, 'low-priority cue must not evict warnings');
slot = chooseVoiceSlot([{ priority: 2, started: 1 }], 2, 2);
assert(slot.allow && slot.steal === -1, 'free voice slot should be used without stealing');

const webRoot = path.join(__dirname, '..', 'web');
for (const name of fs.readdirSync(webRoot).filter(n => /\.(?:js|html)$/i.test(n))) {
  const source = fs.readFileSync(path.join(webRoot, name), 'utf8');
  assert(!/\.(?:wav|mp3|ogg|m4a|aac)(?:["'`?#]|\b)/i.test(source), 'runtime audio file reference in ' + name);
}

console.log('procedural audio, ambience, priority and file-free runtime ok');
console.log('ALL OK');
