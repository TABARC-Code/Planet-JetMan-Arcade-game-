// Lunar Jetman controller input. Kept separate from the browser shell so the
// awkward unplug/reconnect cases can be tested without pretending Node has gamepads.
'use strict';

const CONTROLLER_SETTING_LIMITS = Object.freeze({ deadZoneMin: 0.05, deadZoneMax: 0.95, hysteresisMax: 0.25 });
const DEFAULT_CONTROLLER_SETTINGS = Object.freeze({
  deadZoneX: 0.4,
  deadZoneUp: 0.5,
  deadZoneDown: 0.6,
  hysteresis: 0,
});

function setting(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function normaliseControllerSettings(value = {}, base = DEFAULT_CONTROLLER_SETTINGS) {
  const source = value && typeof value === 'object' ? value : {};
  const fallback = base && typeof base === 'object' ? base : DEFAULT_CONTROLLER_SETTINGS;
  const lim = CONTROLLER_SETTING_LIMITS;
  return Object.freeze({
    deadZoneX: setting(source.deadZoneX, fallback.deadZoneX, lim.deadZoneMin, lim.deadZoneMax),
    deadZoneUp: setting(source.deadZoneUp, fallback.deadZoneUp, lim.deadZoneMin, lim.deadZoneMax),
    deadZoneDown: setting(source.deadZoneDown, fallback.deadZoneDown, lim.deadZoneMin, lim.deadZoneMax),
    hysteresis: setting(source.hysteresis, fallback.hysteresis, 0, lim.hysteresisMax),
  });
}

const cleanAxis = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
function readAxes(gp) {
  return {
    x: gp && gp.axes ? cleanAxis(gp.axes[0]) : 0,
    y: gp && gp.axes ? cleanAxis(gp.axes[1]) : 0,
  };
}
const axisHeld = (amount, deadZone, hysteresis, wasHeld) =>
  amount > Math.max(0, deadZone - (wasHeld ? hysteresis : 0));

function samplePad(gp, settings, previousStick = {}) {
  const b = i => !!(gp && gp.buttons && gp.buttons[i] && gp.buttons[i].pressed);
  const axes = readAxes(gp), ax = axes.x, ay = axes.y;
  const stick = {
    left: axisHeld(-ax, settings.deadZoneX, settings.hysteresis, previousStick.left),
    right: axisHeld(ax, settings.deadZoneX, settings.hysteresis, previousStick.right),
    up: axisHeld(-ay, settings.deadZoneUp, settings.hysteresis, previousStick.up),
    down: axisHeld(ay, settings.deadZoneDown, settings.hysteresis, previousStick.down),
  };
  const state = {
    left: stick.left || b(14),
    right: stick.right || b(15),
    up: stick.up || b(12),
    down: stick.down || b(13),
    fire: b(0) || b(7),
    pick: b(1) || b(2),
    board: b(3),
    start: b(9),
    menu: b(8),
  };
  return { state, stick, axes };
}

function readPad(gp, settings = DEFAULT_CONTROLLER_SETTINGS) {
  return samplePad(gp, normaliseControllerSettings(settings)).state;
}

function isNeutral(state) {
  return !Object.values(state).some(Boolean);
}

class ControllerTracker {
  constructor(settings) {
    this.settings = normaliseControllerSettings(settings);
    this.previous = new Map();
    this.previousStick = new Map();
    this.previousNav = new Map();
    this.connected = new Map();
    this.armed = new Map();
    this.seen = new Set();
    this.activeIndex = null;
  }

  getSettings() { return { ...this.settings }; }

  configure(settings) {
    const next = normaliseControllerSettings(settings, this.settings);
    const changed = Object.keys(next).some(key => next[key] !== this.settings[key]);
    this.settings = next;
    if (changed) this.reset();
    return this.getSettings();
  }

  reset() {
    this.previous.clear();
    this.previousStick.clear();
    this.previousNav.clear();
    for (const index of this.connected.keys()) this.armed.set(index, false);
  }

  sample(pads) {
    const current = new Map();
    for (const gp of pads || []) {
      if (gp && gp.connected !== false) current.set(gp.index, gp);
    }

    const events = [];
    const replacements = new Set();
    for (const [index, gp] of current) {
      const old = this.connected.get(index);
      if (old && ((old.id || '') !== (gp.id || '') || (old.mapping || '') !== (gp.mapping || ''))) replacements.add(index);
    }
    for (const [index, gp] of this.connected) {
      if (current.has(index) && !replacements.has(index)) continue;
      const active = index === this.activeIndex;
      events.push({ type: 'disconnected', index, id: gp.id || '', active });
      this.previous.delete(index);
      this.previousStick.delete(index);
      this.previousNav.delete(index);
      this.armed.delete(index);
      if (active) this.activeIndex = null;
    }

    const held = { left: false, right: false, up: false, fire: false };
    const pressed = { up: false, down: false, pick: false, fire: false, start: false, menu: false,
      navLeft: false, navRight: false, navUp: false, navDown: false };
    const meaningful = [];

    for (const [index, gp] of current) {
      const fresh = !this.connected.has(index) || replacements.has(index);
      if (fresh) {
        events.push({ type: this.seen.has(index) ? 'reconnected' : 'connected', index, id: gp.id || '', active: false });
        this.seen.add(index);
        this.armed.set(index, false);
      }

      const sampled = samplePad(gp, this.settings, this.previousStick.get(index));
      const state = sampled.state;
      const nav = {
        left: !!(gp.buttons && gp.buttons[14] && gp.buttons[14].pressed),
        right: !!(gp.buttons && gp.buttons[15] && gp.buttons[15].pressed),
        up: !!(gp.buttons && gp.buttons[12] && gp.buttons[12].pressed),
        down: !!(gp.buttons && gp.buttons[13] && gp.buttons[13].pressed),
      };
      if (!this.armed.get(index)) {
        if (isNeutral(state)) {
          this.armed.set(index, true);
          this.previous.set(index, state);
          this.previousStick.set(index, sampled.stick);
          this.previousNav.set(index, nav);
          events.push({ type: 'ready', index, id: gp.id || '', active: false });
        }
        continue;
      }

      const prev = this.previous.get(index) || readPad(null);
      const prevNav = this.previousNav.get(index) || { left: false, right: false, up: false, down: false };
      held.left ||= state.left;
      held.right ||= state.right;
      held.up ||= state.up;
      held.fire ||= state.fire;
      pressed.up ||= state.up && !prev.up;
      pressed.down ||= (state.down || state.board) && !(prev.down || prev.board);
      pressed.pick ||= state.pick && !prev.pick;
      pressed.fire ||= state.fire && !prev.fire;
      pressed.start ||= state.start && !prev.start;
      pressed.menu ||= state.menu && !prev.menu;
      pressed.navLeft ||= nav.left && !prevNav.left;
      pressed.navRight ||= nav.right && !prevNav.right;
      pressed.navUp ||= nav.up && !prevNav.up;
      pressed.navDown ||= nav.down && !prevNav.down;

      if (!isNeutral(state)) meaningful.push(index);
      this.previous.set(index, state);
      this.previousStick.set(index, sampled.stick);
      this.previousNav.set(index, nav);
    }

    if (meaningful.length && !meaningful.includes(this.activeIndex)) this.activeIndex = meaningful[0];
    this.connected = current;
    return {
      held,
      pressed,
      events,
      activeIndex: this.activeIndex,
      connectedCount: current.size,
      waitingNeutral: [...current.keys()].filter(index => !this.armed.get(index)),
      diagnostics: [...current.entries()].map(([index, gp]) => ({
        index, id: gp.id || '', mapping: gp.mapping || '', axes: readAxes(gp),
        armed: !!this.armed.get(index), active: index === this.activeIndex,
      })),
    };
  }
}

const LJInput = { CONTROLLER_SETTING_LIMITS, DEFAULT_CONTROLLER_SETTINGS, normaliseControllerSettings,
  ControllerTracker, readPad, readAxes, isNeutral };
if (typeof module !== 'undefined') module.exports = LJInput;
if (typeof globalThis !== 'undefined') globalThis.LJInput = LJInput;
