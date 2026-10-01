"use strict";

(() => {
  const SETTINGS = {
    pathWidth: 100,
    inkWidth: 72,
    tolerance: 80,
    startRadius: 54,
    endRadius: 50,
    lowerAreaRatio: 0.7, // Keep children's paths in the lower 70% of the display.
    minColumnWidth: 220,
  };

  // Each child gets a separate column; a demonstration uses the whole area.
  const EXERCISES = [
    { name: "Línea vertical de arriba hacia abajo", start: [0.5, 0], end: [0.5, 1], copies: 5 },
    { name: "Línea horizontal de izquierda a derecha", start: [0, 0.5], end: [1, 0.5], copies: 3 },
    { name: "Línea diagonal descendente", start: [0, 0], end: [1, 1], copies: 3 },
    { name: "Línea diagonal ascendente", start: [0, 1], end: [1, 0], copies: 3 },
  ];

  const home = document.querySelector("#home");
  const exercise = document.querySelector("#exercise");
  const board = document.querySelector("#board");
  const completed = document.querySelector("#completed");
  const announcement = document.querySelector("#announcement");
  const demo = document.querySelector("#demo");
  const practice = document.querySelector("#practice");
  const activePointers = new Map();
  let exerciseIndex = 0;
  let mode = "demo";
  let routes = [];
  let audioContext;
  let resizeFrame;
  let lastSoundAt = -Infinity;

  function svgNode(tag, attributes = {}, parent = board) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    parent.appendChild(node);
    return node;
  }

  function releasePointer(id) {
    const route = activePointers.get(id);
    if (!route) return;
    activePointers.delete(id);
    route.pointerId = null;
    route.previous = null;
    if (board.hasPointerCapture(id)) board.releasePointerCapture(id);
  }

  function releaseAllPointers() {
    for (const id of [...activePointers.keys()]) releasePointer(id);
  }

  function resetRoute(route) {
    if (route.pointerId !== null) releasePointer(route.pointerId);
    route.progress = 0;
    route.previous = null;
    route.inkPath = "";
    route.finished = false;
    route.ink.setAttribute("d", "");
    route.group.classList.remove("celebrating");
    route.group.setAttribute("data-finished", "false");
  }

  function reset() {
    releaseAllPointers();
    routes.forEach(resetRoute);
    completed.hidden = true;
    announcement.textContent = "";
  }

  function makeRoute(current, cell, index) {
    // Scale on small screens, keeping start and destination from overlapping.
    const scale = Math.min(1, cell.w / 220, cell.h / 300);
    const padding = 68 * scale;
    const point = ([x, y]) => ({ x: cell.x + padding + x * (cell.w - 2 * padding), y: cell.y + padding + y * (cell.h - 2 * padding) });
    const start = point(current.start);
    const end = point(current.end);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const group = svgNode("g", { class: "route", "data-route": index, "data-finished": "false" });
    const path = `M${start.x},${start.y} L${end.x},${end.y}`;
    svgNode("path", { class: "track-border", d: path, "stroke-width": (SETTINGS.pathWidth + 6) * scale }, group);
    svgNode("path", { class: "track", d: path, "stroke-width": SETTINGS.pathWidth * scale }, group);
    const ink = svgNode("path", { class: "ink", d: "", "stroke-width": SETTINGS.inkWidth * scale }, group);
    const destination = svgNode("g", { class: "destination", transform: `translate(${end.x} ${end.y}) scale(${scale})` }, group);
    svgNode("circle", { class: "star-halo", r: 68 }, destination);
    svgNode("path", { class: "star", d: "M0-53 15-19 52-16 24 9 32 46 0 27-32 46-24 9-52-16-15-19Z" }, destination);
    const origin = svgNode("g", { class: "origin", transform: `translate(${start.x} ${start.y}) scale(${scale})` }, group);
    svgNode("circle", { class: "start-disc", r: SETTINGS.startRadius }, origin);
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI - 90;
    svgNode("path", { class: "direction", d: "M-17-12 0 5 17-12 M0 5V-24", transform: `rotate(${angle})` }, origin);
    return { start, end, length, ux: (end.x - start.x) / length, uy: (end.y - start.y) / length,
      scale, cell, group, ink, pointerId: null, previous: null, progress: 0, finished: false, inkPath: "" };
  }

  function layout() {
    releaseAllPointers();
    completed.hidden = true;
    announcement.textContent = "";
    board.replaceChildren();
    const { width, height } = board.getBoundingClientRect();
    board.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const lowerTop = height * (1 - SETTINGS.lowerAreaRatio);
    // Leave space below the paths for the large completion controls.
    const footer = height <= 450 ? 92 : width <= 600 ? 120 : 140;
    const area = { x: 16, y: lowerTop, w: width - 32, h: Math.max(1, height - lowerTop - footer) };
    const current = EXERCISES[exerciseIndex];
    const available = Math.floor(area.w / SETTINGS.minColumnWidth);
    const count = mode === "demo" ? 1 : Math.max(1, Math.min(current.copies, available));
    routes = Array.from({ length: count }, (_, index) => makeRoute(current,
      { x: area.x + index * area.w / count, y: area.y, w: area.w / count, h: area.h }, index));
    demo.setAttribute("aria-pressed", String(mode === "demo"));
    practice.setAttribute("aria-pressed", String(mode === "practice"));
    board.setAttribute("aria-label", `${current.name}. ${mode === "demo" ? "Demostración" : "Práctica"}. Empieza cada línea en su círculo y sigue el camino hasta su estrella.`);
  }

  function showExercise(index) {
    exerciseIndex = index;
    home.hidden = true;
    exercise.hidden = false;
    layout();
  }

  function setMode(nextMode) {
    if (mode === nextMode) return;
    mode = nextMode;
    layout();
  }

  function coordinates(event) {
    const rect = board.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function project(route, point) {
    return (point.x - route.start.x) * route.ux + (point.y - route.start.y) * route.uy;
  }

  function onPath(route, point, projected) {
    const along = Math.max(0, Math.min(route.length, projected));
    const x = route.start.x + route.ux * along;
    const y = route.start.y + route.uy * along;
    // A pointer always belongs to its original column, even near another path.
    const inCell = point.x >= route.cell.x && point.x <= route.cell.x + route.cell.w
      && point.y >= route.cell.y && point.y <= route.cell.y + route.cell.h;
    return inCell && Math.hypot(point.x - x, point.y - y) <= SETTINGS.tolerance * route.scale;
  }

  function drawTo(route, along, newSegment = false) {
    const distance = Math.max(0, Math.min(route.length, along));
    const x = route.start.x + route.ux * distance;
    const y = route.start.y + route.uy * distance;
    route.inkPath += `${newSegment ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)} `;
    route.ink.setAttribute("d", route.inkPath);
  }

  function prepareAudio() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext ||= new Audio();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    } catch { /* Audio is optional. */ }
  }

  function playPositiveSound() {
    if (!audioContext || audioContext.state !== "running") return;
    try {
      const now = audioContext.currentTime;
      if (now - lastSoundAt < 0.5) return; // Keep simultaneous celebrations quiet.
      lastSoundAt = now;
      [523.25, 659.25].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const volume = audioContext.createGain();
        const start = now + index * 0.13;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        volume.gain.setValueAtTime(0, start);
        volume.gain.linearRampToValueAtTime(0.045, start + 0.025);
        volume.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        oscillator.connect(volume);
        volume.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.32);
        oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
      });
    } catch { /* Drawing continues if sound is unavailable. */ }
  }

  function finish(route) {
    route.finished = true;
    releasePointer(route.pointerId);
    route.group.setAttribute("data-finished", "true");
    route.group.classList.add("celebrating");
    playPositiveSound();
    if (routes.every(item => item.finished)) {
      announcement.textContent = "¡Habéis llegado a las estrellas!";
      completed.hidden = false;
    }
  }

  function advance(route, event) {
    const point = coordinates(event);
    const projected = project(route, point);
    if (!onPath(route, point, projected)) {
      route.previous = null;
      return;
    }
    const along = Math.max(0, Math.min(route.length, projected));
    if (route.previous === null) {
      if (along > route.progress) return;
      route.previous = along;
      drawTo(route, along, true);
      return;
    }
    drawTo(route, along);
    route.progress = Math.max(route.progress, along);
    route.previous = along;
    const endRadius = SETTINGS.endRadius * route.scale;
    if (route.progress >= route.length - endRadius && Math.hypot(point.x - route.end.x, point.y - route.end.y) <= endRadius) finish(route);
  }

  board.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    // Non-primary touch/pen pointers are needed for simultaneous children.
    if ((event.pointerType === "mouse" && event.button !== 0) || activePointers.has(event.pointerId)) return;
    const point = coordinates(event);
    const route = routes.find(item => !item.finished && item.pointerId === null
      && Math.hypot(point.x - item.start.x, point.y - item.start.y) <= SETTINGS.startRadius * item.scale);
    if (!route) return;
    resetRoute(route);
    prepareAudio();
    route.pointerId = event.pointerId;
    activePointers.set(event.pointerId, route);
    board.setPointerCapture(event.pointerId);
    // Ink starts at the real contact; never invent a segment inside the start.
    route.previous = Math.max(0, Math.min(route.length, project(route, point)));
    route.progress = route.previous;
    drawTo(route, route.previous, true);
    drawTo(route, route.previous);
  });

  board.addEventListener("pointermove", (event) => {
    event.preventDefault();
    const route = activePointers.get(event.pointerId);
    if (!route) return;
    const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    for (const sample of samples.length ? samples : [event]) {
      advance(route, sample);
      if (route.finished) break;
    }
  });

  board.addEventListener("pointerup", (event) => {
    event.preventDefault();
    const route = activePointers.get(event.pointerId);
    if (!route) return;
    advance(route, event);
    releasePointer(event.pointerId);
  });
  for (const name of ["pointercancel", "lostpointercapture"]) board.addEventListener(name, event => releasePointer(event.pointerId));

  document.querySelector("#start").addEventListener("click", () => { prepareAudio(); mode = "demo"; showExercise(0); });
  demo.addEventListener("click", () => setMode("demo"));
  practice.addEventListener("click", () => setMode("practice"));
  for (const id of ["repeat", "clear"]) document.querySelector(`#${id}`).addEventListener("click", reset);
  for (const id of ["next", "advance"]) document.querySelector(`#${id}`).addEventListener("click", () => showExercise((exerciseIndex + 1) % EXERCISES.length));
  document.querySelector("#home-button").addEventListener("click", () => {
    reset();
    exercise.hidden = true;
    home.hidden = false;
    document.querySelector("#start").focus({ preventScroll: true });
  });

  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { if (!exercise.hidden) layout(); });
  });
  window.addEventListener("blur", releaseAllPointers);
  document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAllPointers(); });
  document.addEventListener("wheel", event => event.preventDefault(), { passive: false });
  document.addEventListener("touchmove", event => event.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", event => event.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", event => event.preventDefault());
})();
