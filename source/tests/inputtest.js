// Controller lifecycle checks. No browser or physical pad required: the point is
// to make the state machine prove what it does with awkward snapshots.
'use strict';

const { CONTROLLER_SETTING_LIMITS, DEFAULT_CONTROLLER_SETTINGS, normaliseControllerSettings,
  ControllerTracker, readPad } = require('../web/input.js');
const assert = (condition, message) => {
  if (!condition) { console.error('FAIL:', message); process.exit(1); }
};

function pad(index, state = {}, id = 'Test pad') {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  const axes = [0, 0];
  if (state.left) axes[0] = -1;
  if (state.right) axes[0] = 1;
  if (state.up) axes[1] = -1;
  if (state.down) axes[1] = 1;
  if (state.fire) buttons[0].pressed = true;
  if (state.pick) buttons[1].pressed = true;
  if (state.board) buttons[3].pressed = true;
  if (state.start) buttons[9].pressed = true;
  return { index, id, mapping: 'standard', connected: true, buttons, axes };
}

function axisPad(index, x, y = 0, id = 'Test pad') {
  const gp = pad(index, {}, id);
  gp.axes = [x, y];
  return gp;
}

assert(JSON.stringify(DEFAULT_CONTROLLER_SETTINGS) === JSON.stringify({
  deadZoneX: 0.4, deadZoneUp: 0.5, deadZoneDown: 0.6, hysteresis: 0,
}), 'defaults preserve v4.5.0 thresholds and release behaviour');
assert(Object.keys(readPad(null)).sort().join(',') ===
  'board,down,fire,left,menu,pick,right,start,up', 'controller actions include the settings menu button');

let configured = normaliseControllerSettings({ deadZoneX: -1, deadZoneUp: 2, deadZoneDown: NaN,
  hysteresis: Infinity });
assert(configured.deadZoneX === CONTROLLER_SETTING_LIMITS.deadZoneMin, 'horizontal dead zone clamps low');
assert(configured.deadZoneUp === CONTROLLER_SETTING_LIMITS.deadZoneMax, 'up dead zone clamps high');
assert(configured.deadZoneDown === DEFAULT_CONTROLLER_SETTINGS.deadZoneDown, 'invalid dead zone uses default');
assert(configured.hysteresis === DEFAULT_CONTROLLER_SETTINGS.hysteresis, 'invalid hysteresis uses default');
configured = normaliseControllerSettings({ deadZoneX: '0.2', hysteresis: 1 });
assert(configured.deadZoneX === DEFAULT_CONTROLLER_SETTINGS.deadZoneX, 'numeric strings are not silently accepted');
assert(configured.hysteresis === CONTROLLER_SETTING_LIMITS.hysteresisMax, 'hysteresis clamps high');

let t = new ControllerTracker();
let r = t.sample([pad(0)]);
assert(r.events.some(e => e.type === 'connected'), 'first connection reported');
assert(r.events.some(e => e.type === 'ready'), 'neutral controller arms');
assert(r.connectedCount === 1, 'diagnostics report connected controller count');

r = t.sample([pad(0, { fire: true })]);
assert(r.held.fire && r.pressed.fire, 'first fire press has held and edge');
assert(r.activeIndex === 0, 'meaningful input claims controller');
r = t.sample([pad(0, { fire: true })]);
assert(r.held.fire && !r.pressed.fire, 'held fire emits one edge');

r = t.sample([]);
assert(r.events.filter(e => e.type === 'disconnected' && e.active).length === 1, 'active disconnect reported once');
assert(!Object.values(r.held).some(Boolean), 'disconnect clears held gamepad input');
r = t.sample([]);
assert(!r.events.length, 'continued absence is quiet');

r = t.sample([pad(0, { fire: true, start: true })]);
assert(r.events.some(e => e.type === 'reconnected'), 'reconnection reported');
assert(r.waitingNeutral.includes(0), 'held reconnect is quarantined');
assert(!r.held.fire && !r.pressed.fire && !r.pressed.start, 'held reconnect cannot fire or unpause');
r = t.sample([pad(0)]);
assert(r.events.some(e => e.type === 'ready'), 'neutral sample re-arms controller');
r = t.sample([pad(0, { start: true })]);
assert(r.pressed.start, 'Start works after neutral recovery');
r = t.sample([pad(0, { start: true })]);
assert(!r.pressed.start, 'held Start emits one edge');

t = new ControllerTracker();
t.sample([pad(0), pad(1)]);
t.sample([pad(0), pad(1, { pick: true })]);
assert(t.activeIndex === 1, 'second pad can become active');
r = t.sample([pad(1, { pick: true })]);
assert(!r.events.some(e => e.type === 'disconnected' && e.active), 'unused pad disconnect does not impersonate active loss');
r = t.sample([]);
assert(r.events.some(e => e.type === 'disconnected' && e.active), 'actual active pad loss is identified');

t = new ControllerTracker();
t.sample([pad(0)]);
t.sample([pad(0, { fire: true })]);
t.reset();
r = t.sample([pad(0, { fire: true })]);
assert(r.waitingNeutral.includes(0) && !r.held.fire, 'focus reset quarantines controls still held');
r = t.sample([pad(0)]);
r = t.sample([pad(0, { fire: true })]);
assert(r.pressed.fire, 'control works again after focus-reset neutral');

t = new ControllerTracker();
t.sample([pad(0, {}, 'First pad')]);
t.sample([pad(0, { fire: true }, 'First pad')]);
r = t.sample([pad(0, { fire: true }, 'Replacement pad')]);
assert(r.events.some(e => e.type === 'disconnected' && e.active), 'same-index replacement disconnects active identity');
assert(r.events.some(e => e.type === 'reconnected'), 'same-index replacement reports reconnection');
assert(r.waitingNeutral.includes(0) && !r.held.fire, 'replacement pad must pass neutral gate');
r = t.sample([pad(0, {}, 'Replacement pad')]);
assert(r.events.some(e => e.type === 'ready'), 'replacement pad arms only after neutral');

t = new ControllerTracker();
const noisy = pad(0); noisy.axes = [NaN, Infinity];
r = t.sample([noisy]);
assert(r.events.some(e => e.type === 'ready'), 'invalid axis values are sanitised to neutral');
assert(r.diagnostics[0].axes.x === 0 && r.diagnostics[0].axes.y === 0,
  'controller diagnostics sanitise invalid axes');

t = new ControllerTracker();
t.sample([pad(0)]);
const menuPad = pad(0); menuPad.buttons[8].pressed = true;
r = t.sample([menuPad]);
assert(r.pressed.menu, 'View or Select opens controller settings once');
r = t.sample([menuPad]);
assert(!r.pressed.menu, 'held settings button has no repeat edge');
const neutralPad = pad(0); t.sample([neutralPad]);
const dpad = pad(0); dpad.buttons[15].pressed = true;
r = t.sample([dpad]);
assert(r.pressed.navRight, 'D-pad navigation edge is independent of analogue thresholds');

t = new ControllerTracker();
t.sample([axisPad(0, 0.4, -0.5)]);
assert(t.activeIndex === null, 'default threshold boundaries remain neutral');
r = t.sample([axisPad(0, 0.4001)]);
assert(r.held.right && r.activeIndex === 0, 'v4.5 horizontal threshold still engages above 0.4');
r = t.sample([axisPad(0, 0, -0.5001)]);
assert(r.held.up, 'v4.5 up threshold still engages above 0.5');
r = t.sample([axisPad(0, 0, 0.6001)]);
assert(r.pressed.down, 'v4.5 down threshold still engages above 0.6');

t = new ControllerTracker({ deadZoneX: 0.6, deadZoneUp: 0.7, deadZoneDown: 0.7 });
r = t.sample([axisPad(0, 0.5)]);
assert(r.events.some(e => e.type === 'ready') && !r.held.right, 'configured dead zone treats smaller drift as neutral');
r = t.sample([axisPad(0, 0.61)]);
assert(r.held.right, 'configured horizontal dead zone engages above its threshold');

t = new ControllerTracker({ deadZoneX: 0.4, hysteresis: 0.1 });
t.sample([axisPad(0, 0)]);
r = t.sample([axisPad(0, 0.41)]);
assert(r.held.right, 'axis engages at configured dead zone');
r = t.sample([axisPad(0, 0.35)]);
assert(r.held.right, 'hysteresis holds direction inside release band');
r = t.sample([axisPad(0, 0.29)]);
assert(!r.held.right, 'axis releases below dead zone minus hysteresis');

t = new ControllerTracker();
t.sample([pad(0)]);
t.sample([pad(0, { fire: true })]);
const publicSettings = t.configure({ deadZoneX: 0.55, hysteresis: 0.08 });
assert(publicSettings.deadZoneX === 0.55 && publicSettings.hysteresis === 0.08, 'configure returns validated settings');
publicSettings.deadZoneX = 0.1;
assert(t.getSettings().deadZoneX === 0.55, 'settings snapshots cannot mutate the tracker');
r = t.sample([pad(0, { fire: true })]);
assert(r.waitingNeutral.includes(0) && !r.held.fire && !r.pressed.fire,
  'settings changes re-quarantine held controls without creating an edge');
r = t.sample([pad(0)]);
assert(r.events.some(e => e.type === 'ready'), 'controller re-arms after settings-change neutral');

t = new ControllerTracker({ deadZoneX: 0.95, deadZoneUp: 0.95, deadZoneDown: 0.95 });
t.sample([pad(0)]);
r = t.sample([pad(0, { left: true, up: true })]);
assert(r.held.left && r.held.up, 'D-pad actions ignore analogue dead-zone settings');

console.log('controller lifecycle ok');
console.log('ALL OK');
