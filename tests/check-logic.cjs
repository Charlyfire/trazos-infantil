// Dependency-free checks of the production handlers with a minimal simulated DOM.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let checks = 0;

function setup(width = 1280, height = 720) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const attrs = new Map();
      const listeners = new Map();
      const classes = new Set();
      elements.set(id, {
        hidden: ['exercise', 'completed'].includes(id), style: {},
        classList: { add: x => classes.add(x), remove: x => classes.delete(x) },
        addEventListener(name, handler) { listeners.set(name, handler); },
        dispatch(name, extra = {}) {
          const event = { pointerId: 1, isPrimary: true, button: 0, preventDefault() { this.defaultPrevented = true; }, ...extra };
          listeners.get(name)?.(event);
          return event;
        },
        setAttribute: (key, value) => attrs.set(key, String(value)),
        getAttribute: key => attrs.get(key),
        getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
        hasPointerCapture(pointer) { return this.capture === pointer; },
        setPointerCapture(pointer) { this.capture = pointer; },
        releasePointerCapture() { this.capture = null; },
        focus() {},
      });
    }
    return elements.get(id);
  }
  const document = element('document');
  document.querySelector = selector => element(selector.slice(1));
  const window = element('window');
  vm.runInNewContext(source, { document, window, requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {} });
  element('start').dispatch('click');
  return element;
}

function route(el) {
  const [sx, sy, ex, ey] = el('track').getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
  const length = Math.hypot(ex - sx, ey - sy);
  return (t, offset = 0) => ({ clientX: sx + (ex - sx) * t - (ey - sy) / length * offset, clientY: sy + (ey - sy) * t + (ex - sx) / length * offset });
}

function gesture(el, type, start = 0, end = 1, offset = 0) {
  const point = route(el);
  el('board').dispatch('pointerdown', { ...point(start), pointerType: type });
  for (let i = 1; i <= 50; i++) el('board').dispatch('pointermove', { ...point(start + (end - start) * i / 50, offset), pointerType: type });
  el('board').dispatch('pointerup', { ...point(end, offset), pointerType: type });
}
function check(condition, message) { assert.ok(condition, message); checks++; }

for (const dimensions of [[1280, 720], [1920, 1080], [375, 667], [844, 390]]) {
  for (const type of ['mouse', 'touch', 'pen']) {
    const el = setup(...dimensions);
    for (let index = 0; index < 4; index++) {
      gesture(el, type, 0.5);
      check(el('completed').hidden && el('ink').getAttribute('d') === '', 'Cannot start in the middle');
      gesture(el, type);
      check(!el('completed').hidden, `Completes trace ${index + 1} with ${type} at ${dimensions}`);
      el('repeat').dispatch('click');
      check(el('completed').hidden && el('ink').getAttribute('d') === '', 'Repeat clears the exercise');
      gesture(el, type);
      el('next').dispatch('click');
    }
    check(el('board').getAttribute('aria-label').includes('vertical'), 'Next cycles after the fourth trace');
  }
}

for (const type of ['mouse', 'touch', 'pen']) {
  const el = setup();
  const board = el('board');
  const point = route(el);
  const send = (name, t, offset = 0, extra = {}) => board.dispatch(name, { ...point(t, offset), pointerType: type, ...extra });
  send('pointerdown', 0);
  send('pointermove', 0.3, 65);
  const before = el('ink').getAttribute('d');
  send('pointermove', 0.4, 120);
  send('pointermove', 0.8);
  send('pointermove', 1);
  check(el('ink').getAttribute('d') === before && el('completed').hidden, 'Leaving and reentering ahead cannot bridge a gap');
  send('pointermove', 0.28);
  for (let i = 29; i <= 100; i++) send('pointermove', i / 100);
  check(!el('completed').hidden, 'Can rejoin behind the frontier and complete');
  el('repeat').dispatch('click');
  send('pointerdown', 0);
  send('pointermove', 0.4);
  send('pointerup', 0.4);
  send('pointerdown', 0.4);
  send('pointermove', 1);
  send('pointerup', 1);
  check(el('completed').hidden, 'Cannot continue after lifting at the midpoint');
  send('pointerdown', 0);
  send('pointermove', 0.2);
  send('pointercancel', 0.2);
  send('pointermove', 1);
  check(el('completed').hidden, 'Cancelled pointers cannot finish');
  send('pointerdown', 0);
  send('pointerdown', 0.5, 0, { pointerId: 2, isPrimary: false });
  send('pointermove', 1, 0, { pointerId: 2, isPrimary: false });
  check(el('completed').hidden, 'Second contact is ignored');
  send('pointermove', 0.4, 0, { getCoalescedEvents: () => [{ ...point(0.15) }, { ...point(0.4) }] });
  send('pointermove', 1);
  check(!el('completed').hidden, 'Coalesced events preserve valid motion');
  el('home-button').dispatch('click');
  check(!el('home').hidden && el('exercise').hidden, 'Home navigation works');
  check(el('document').dispatch('wheel').defaultPrevented, 'Wheel is prevented');
  check(el('document').dispatch('touchmove').defaultPrevented, 'Touch scroll is prevented');
  check(el('document').dispatch('gesturestart').defaultPrevented, 'Gesture zoom is prevented');
}

const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
check(css.includes('overflow: hidden') && css.includes('touch-action: none') && css.includes('overscroll-behavior: none'), 'CSS blocks scrolling and browser gestures');
console.log(`${checks} checks passed (simulated DOM; not a browser/PDI test).`);
