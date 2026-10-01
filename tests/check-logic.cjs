// Dependency-free production-handler checks. This is a simulated DOM, not a browser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }

function setup(width = 1280, height = 720) {
  const ids = new Map();
  const viewport = { width, height };
  function node(tag = 'div') {
    const attrs = new Map(), listeners = new Map(), classes = new Set(), captures = new Set();
    return {
      tag, hidden: false, style: {}, children: [], textContent: '',
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
      addEventListener(name, handler) { listeners.set(name, handler); },
      dispatch(name, extra = {}) {
        const event = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, preventDefault() { this.defaultPrevented = true; }, ...extra };
        listeners.get(name)?.(event);
        return event;
      },
      setAttribute(key, value) { attrs.set(key, String(value)); },
      getAttribute: key => attrs.get(key),
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren() { this.children = []; },
      getBoundingClientRect: () => ({ left: 0, top: 0, ...viewport }),
      hasPointerCapture: id => captures.has(id),
      setPointerCapture: id => captures.add(id),
      releasePointerCapture(id) { captures.delete(id); this.dispatch('lostpointercapture', { pointerId: id }); },
      focus() {},
    };
  }
  const el = id => {
    if (!ids.has(id)) { const item = node(); item.hidden = ['exercise', 'completed'].includes(id); ids.set(id, item); }
    return ids.get(id);
  };
  const document = el('document');
  document.querySelector = selector => el(selector.slice(1));
  document.createElementNS = (_, tag) => node(tag);
  const window = el('window');
  vm.runInNewContext(source, { document, window, requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {} });
  el('start').dispatch('click');
  el.viewport = viewport;
  return el;
}

const groups = el => el('board').children;
const ink = group => group.children.find(child => child.getAttribute('class') === 'ink');
const done = group => group.getAttribute('data-finished') === 'true';
function route(group) {
  const track = group.children.find(child => child.getAttribute('class') === 'track');
  const [sx, sy, ex, ey] = track.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
  const length = Math.hypot(ex - sx, ey - sy);
  const point = (t, offset = 0) => ({ clientX: sx + (ex-sx)*t - (ey-sy)/length*offset, clientY: sy + (ey-sy)*t + (ex-sx)/length*offset });
  point.scale = Number(track.getAttribute('stroke-width')) / 100;
  point.pathLength = length;
  return point;
}
function send(el, name, point, t, id = 1, type = 'mouse', offset = 0, extra = {}) {
  return el('board').dispatch(name, { ...point(t, offset), pointerId: id, pointerType: type, isPrimary: id === 1, ...extra });
}
function gesture(el, group, type = 'mouse', start = 0, end = 1, id = 1) {
  const point = route(group);
  send(el, 'pointerdown', point, start, id, type);
  for (let i = 1; i <= 50; i++) send(el, 'pointermove', point, start+(end-start)*i/50, id, type);
  send(el, 'pointerup', point, end, id, type);
}

for (const dimensions of [[1280,720], [1920,1080], [2560,1440], [375,667], [844,390], [320,320]]) {
  for (const mode of ['demo', 'practice']) {
    for (const type of ['mouse', 'touch', 'pen']) {
      const el = setup(...dimensions);
      el(mode).dispatch('click');
      for (let exercise = 0; exercise < 4; exercise++) {
        const current = groups(el);
        const max = exercise === 0 ? 5 : 3;
        const expected = mode === 'demo' ? 1 : Math.max(1, Math.min(max, Math.floor((dimensions[0]-32)/220)));
        check(current.length === expected, 'Correct number of paths for screen and mode');
        for (const group of current) {
          const point = route(group);
          const scale = point.scale;
          check(Math.min(point(0).clientY, point(1).clientY)-68*scale >= dimensions[1]*0.3-0.01, 'Whole drawing is below the top 30%');
          check(point.pathLength > 104*scale, `Start and destination do not overlap: ${dimensions}, ${mode}, exercise ${exercise}, length ${point.pathLength}, scale ${scale}`);
          gesture(el, group, type, 0.5);
          check(!done(group) && ink(group).getAttribute('d') === '', 'Cannot start in the middle');
          gesture(el, group, type);
          check(done(group), `Completes ${exercise}/${mode}/${type} at ${dimensions}`);
        }
        check(!el('completed').hidden, 'Group buttons appear only after all paths finish');
        el('repeat').dispatch('click');
        check(current.every(group => !done(group) && ink(group).getAttribute('d') === ''), 'Repeat clears all paths');
        check(el('completed').hidden, 'Repeat hides group completion');
        el('advance').dispatch('click');
      }
      check(el('board').getAttribute('aria-label').includes('vertical'), 'Fourth trace cycles to first');
    }
  }
}

for (const type of ['mouse', 'touch', 'pen']) {
  const el = setup();
  const group = groups(el)[0], point = route(group);
  send(el, 'pointerdown', point, 0, 1, type);
  send(el, 'pointermove', point, 0.3, 1, type, 65);
  const before = ink(group).getAttribute('d');
  send(el, 'pointermove', point, 0.4, 1, type, 120);
  send(el, 'pointermove', point, 0.8, 1, type);
  send(el, 'pointermove', point, 1, 1, type);
  check(ink(group).getAttribute('d') === before && !done(group), 'Cannot bridge a gap after going off the path');
  send(el, 'pointermove', point, 0.28, 1, type);
  for (let i=29; i<=100; i++) send(el, 'pointermove', point, i/100, 1, type);
  check(done(group), 'Can rejoin behind the frontier');
  el('clear').dispatch('click');
  gesture(el, group, type, 0, 0.4);
  gesture(el, group, type, 0.4, 1);
  check(!done(group), 'Must restart at the beginning after lifting');
  send(el, 'pointerdown', point, 0, 1, type);
  send(el, 'pointermove', point, 0.2, 1, type);
  send(el, 'pointercancel', point, 0.2, 1, type);
  send(el, 'pointermove', point, 1, 1, type);
  check(!done(group), 'Cancelled pointer cannot finish');
  send(el, 'pointerdown', point, 0, 1, type);
  send(el, 'pointermove', point, 0.4, 1, type, 0, { getCoalescedEvents: () => [point(0.15), point(0.4)] });
  send(el, 'pointermove', point, 1, 1, type);
  check(done(group), 'Coalesced samples preserve movement');
}

// Three children, staggered completion and non-primary native-style touch IDs.
for (let exercise = 0; exercise < 4; exercise++) {
  const el = setup(1920,1080);
  el('practice').dispatch('click');
  for (let i=0; i<exercise; i++) el('advance').dispatch('click');
  const current = groups(el), points = current.slice(0,3).map(route);
  for (let i=0; i<3; i++) send(el, 'pointerdown', points[i], 0, i+1, 'touch');
  for (let step=1; step<=30; step++) for (let i=0; i<3; i++) send(el, 'pointermove', points[i], step/100, i+1, 'touch');
  check(current.slice(0,3).every(g => ink(g).getAttribute('d').includes('L')), 'All three contacts advance independently');
  const secondInk = ink(current[1]).getAttribute('d');
  send(el, 'pointerdown', points[1], 0, 4, 'touch');
  send(el, 'pointermove', points[1], 1, 4, 'touch');
  check(ink(current[1]).getAttribute('d') === secondInk, 'A second finger cannot steal an occupied route');
  send(el, 'pointermove', points[1], 1, 1, 'touch');
  check(ink(current[1]).getAttribute('d') === secondInk && !done(current[0]), 'Moving into a neighbour cannot draw on their line');
  send(el, 'pointermove', points[0], 0.28, 1, 'touch');
  for (let step=29; step<=100; step++) send(el, 'pointermove', points[0], step/100, 1, 'touch');
  check(done(current[0]) && el('board').hasPointerCapture(2), 'Finishing one route retains other pointer captures');
  check(el('completed').hidden, 'One completion cannot end the whole group');
  send(el, 'pointercancel', points[1], 0.3, 2, 'touch');
  check(el('board').hasPointerCapture(3), 'Cancelling one child leaves another active');
  const thirdInk = ink(current[2]).getAttribute('d');
  send(el, 'pointerdown', points[1], 0, 2, 'touch');
  check(done(current[0]) && ink(current[2]).getAttribute('d') === thirdInk, 'Restarting a child keeps finished and active neighbours');
  for (let step=31; step<=100; step++) send(el, 'pointermove', points[2], step/100, 3, 'touch');
  for (let step=1; step<=100; step++) send(el, 'pointermove', points[1], step/100, 2, 'touch');
  for (const group of current.slice(3)) gesture(el, group, 'touch');
  check(current.every(done) && !el('completed').hidden, 'All paths can complete, with or without simultaneous contacts');
  el('clear').dispatch('click');
  send(el, 'pointerdown', points[0], 0, 1, 'touch');
  send(el, 'pointerdown', points[1], 0, 2, 'touch');
  el('demo').dispatch('click');
  check(groups(el).length === 1 && !el('board').hasPointerCapture(1) && !el('board').hasPointerCapture(2), 'Mode changes safely release all pointers');
  send(el, 'pointermove', points[0], 1, 1, 'touch');
  check(ink(groups(el)[0]).getAttribute('d') === '', 'Stale pointer cannot draw after a mode change');
}

const el = setup();
const p = route(groups(el)[0]);
send(el, 'pointerdown', p, 0, 1, 'mouse', 0, { button: 2 });
send(el, 'pointermove', p, 1);
check(!done(groups(el)[0]), 'Right mouse button is ignored');
send(el, 'pointerdown', p, 0);
el.viewport.width = 1920; el.viewport.height = 1080;
el('window').dispatch('resize');
check(!el('board').hasPointerCapture(1) && !done(groups(el)[0]), 'Resize restarts and releases active gestures');
el('home-button').dispatch('click');
check(!el('home').hidden && el('exercise').hidden, 'Home navigation works');
for (const name of ['wheel','touchmove','gesturestart']) check(el('document').dispatch(name).defaultPrevented, `${name} is prevented`);
const css = fs.readFileSync(path.join(root,'styles.css'),'utf8');
check(css.includes('overflow: hidden') && css.includes('touch-action: none') && css.includes('overscroll-behavior: none'), 'CSS prevents browser scrolling and gestures');
console.log(`${checks} checks passed (simulated DOM, including three independent simultaneous children).`);
