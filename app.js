"use strict";

(() => {
  const SETTINGS = {
    pathWidth: 100,
    inkWidth: 72,
    tolerance: 80,
    startRadius: 54,
    endRadius: 50,
    lowerAreaRatio: 0.7,
    minColumnWidth: 220,
    sampleStep: 6, // Inspect actual movement between Pointer Event samples.
  };
  const Geometry = globalThis.TraceGeometry;
  const Templates = globalThis.TraceTemplates;
  const EXERCISES = Templates.catalog;
  const home = document.querySelector("#home");
  const exercise = document.querySelector("#exercise");
  const board = document.querySelector("#board");
  const completed = document.querySelector("#completed");
  const announcement = document.querySelector("#announcement");
  const demo = document.querySelector("#demo");
  const practice = document.querySelector("#practice");
  const picker = document.querySelector("#template");
  const activePointers = new Map();
  let exerciseIndex = 0;
  let mode = "demo";
  let routes = [];
  let audioContext;
  let resizeFrame;
  let lastSoundAt = -Infinity;

  for (const [index, template] of EXERCISES.entries()) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = template.name;
    picker.appendChild(option);
  }

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
    if (board.hasPointerCapture(id)) board.releasePointerCapture(id);
    updateMarkers(route);
  }

  function releaseAllPointers() {
    for (const id of [...activePointers.keys()]) releasePointer(id);
  }

  function updateMarkers(route) {
    for (const [index, stroke] of route.strokes.entries()) {
      const current = !route.finished && !stroke.finished && index === route.currentStroke;
      const nearEnd = stroke.closed && route.pointerId !== null && stroke.tracker.state.progress > stroke.path.length*0.65;
      stroke.origin.setAttribute("data-visible", String(current && !nearEnd));
      stroke.destination.setAttribute("data-visible", String(stroke.finished || (current && (!stroke.closed || nearEnd))));
    }
  }

  function resetStroke(stroke) {
    stroke.tracker.reset();
    stroke.inkPath = "";
    stroke.finished = false;
    stroke.ink.setAttribute("d", "");
    stroke.group.classList.remove("celebrating");
    stroke.group.setAttribute("data-finished", "false");
  }

  function resetRoute(route) {
    if (route.pointerId !== null) releasePointer(route.pointerId);
    route.currentStroke = 0;
    route.finished = false;
    route.strokes.forEach(resetStroke);
    route.group.setAttribute("data-finished", "false");
    updateMarkers(route);
  }

  function reset() {
    releaseAllPointers();
    routes.forEach(resetRoute);
    completed.hidden = true;
    announcement.textContent = "";
  }

  function makeStroke(route, spec, index) {
    const scale = spec.scale;
    const path = Geometry.createPath(spec.points);
    const start = path.points[0], end = path.points.at(-1);
    const group = svgNode("g", { class: "stroke", "data-stroke": index, "data-finished": "false" }, route.group);
    const pathString = spec.points.map((point, i) => `${i ? "L" : "M"}${point.x},${point.y}`).join(" ");
    svgNode("path", { class: "track-border", d: pathString, "stroke-width": (SETTINGS.pathWidth+6)*scale }, group);
    svgNode("path", { class: "track", d: pathString, "stroke-width": SETTINGS.pathWidth*scale, "data-closed": String(spec.closed) }, group);
    for (const guide of spec.guides) {
      const { tag, ...attributes } = guide;
      svgNode(tag, { class: "guide", ...attributes }, group);
    }
    const ink = svgNode("path", { class: "ink", d: "", "stroke-width": SETTINGS.inkWidth*scale }, group);
    const destination = svgNode("g", { class: "destination", transform: `translate(${end.x} ${end.y}) scale(${scale})` }, group);
    svgNode("circle", { class: "star-halo", r: 68 }, destination);
    svgNode("path", { class: "star", d: "M0-53 15-19 52-16 24 9 32 46 0 27-32 46-24 9-52-16-15-19Z" }, destination);
    const origin = svgNode("g", { class: "origin", transform: `translate(${start.x} ${start.y}) scale(${scale})` }, group);
    svgNode("circle", { class: "start-disc", r: SETTINGS.startRadius }, origin);
    const tangent = path.segments[0];
    const angle = Math.atan2(tangent.uy,tangent.ux)*180/Math.PI-90;
    svgNode("path", { class: "direction", d: "M-17-12 0 5 17-12 M0 5V-24", transform: `rotate(${angle})` }, origin);
    const tracker = Geometry.createTracker(path, {
      startRadius: SETTINGS.startRadius*scale,
      endRadius: SETTINGS.endRadius*scale,
      tolerance: Math.min(SETTINGS.tolerance*scale,spec.tolerance ?? Infinity),
      sampleStep: SETTINGS.sampleStep*scale,
      contains: point => point.x >= route.cell.x && point.x <= route.cell.x+route.cell.w
        && point.y >= route.cell.y && point.y <= route.cell.y+route.cell.h,
    });
    return { path, start, end, scale, group, ink, origin, destination, tracker, closed: spec.closed, finished: false, inkPath: "" };
  }

  function makeRoute(current, cell, index) {
    const scale = Math.min(1,cell.w/220,cell.h/300);
    const group = svgNode("g", { class: "route", "data-route": index, "data-finished": "false" });
    const route = { cell, group, strokes: [], currentStroke: 0, pointerId: null, finished: false };
    route.strokes = Templates.build(current.id,cell,scale).map((spec,i) => makeStroke(route,spec,i));
    updateMarkers(route);
    return route;
  }

  function layout() {
    releaseAllPointers();
    completed.hidden = true;
    announcement.textContent = "";
    board.replaceChildren();
    const { width, height } = board.getBoundingClientRect();
    board.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // Small viewports need a little extra room for the teacher's template picker.
    // In every case, drawings stay within the lower 70% of the display.
    const lowerTop = Math.max(height*(1-SETTINGS.lowerAreaRatio),height <= 450 ? 132 : 190);
    const footer = height <= 450 ? 92 : width <= 600 ? 120 : 140;
    const area = { x: 16, y: lowerTop, w: width-32, h: Math.max(1,height-lowerTop-footer) };
    const current = EXERCISES[exerciseIndex];
    const available = Math.floor(area.w/(current.minWidth || SETTINGS.minColumnWidth));
    const count = mode === "demo" ? 1 : Math.max(1,Math.min(current.copies,available));
    routes = Array.from({ length: count }, (_,index) => makeRoute(current,
      { x: area.x+index*area.w/count, y: area.y, w: area.w/count, h: area.h }, index));
    demo.setAttribute("aria-pressed", String(mode === "demo"));
    practice.setAttribute("aria-pressed", String(mode === "practice"));
    picker.value = String(exerciseIndex);
    board.setAttribute("aria-label", `${current.name}. ${mode === "demo" ? "Demostración" : "Práctica"}. Empieza cada trazo en el círculo y sigue el camino hasta su estrella.`);
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
    return { x: event.clientX-rect.left, y: event.clientY-rect.top };
  }

  function drawMarks(stroke, marks) {
    for (const { point, newSegment } of marks) stroke.inkPath += `${newSegment ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)} `;
    if (marks.length) stroke.ink.setAttribute("d",stroke.inkPath);
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

  function finishStroke(route, stroke) {
    stroke.finished = true;
    releasePointer(route.pointerId);
    stroke.group.setAttribute("data-finished","true");
    stroke.group.classList.add("celebrating");
    route.currentStroke++;
    if (route.currentStroke === route.strokes.length) {
      route.finished = true;
      route.group.setAttribute("data-finished","true");
    }
    updateMarkers(route);
    playPositiveSound();
    if (routes.every(item => item.finished)) {
      announcement.textContent = "¡Habéis llegado a las estrellas!";
      completed.hidden = false;
    }
  }

  function advance(route, event) {
    const stroke = route.strokes[route.currentStroke];
    drawMarks(stroke,stroke.tracker.move(coordinates(event)));
    updateMarkers(route);
    if (stroke.tracker.state.done) finishStroke(route,stroke);
  }

  board.addEventListener("pointerdown", event => {
    event.preventDefault();
    // Non-primary touch/pen pointers represent the other children.
    if (event.button !== 0 || activePointers.has(event.pointerId)) return;
    const point = coordinates(event);
    const route = routes.find(item => {
      if (item.finished || item.pointerId !== null) return false;
      const stroke = item.strokes[item.currentStroke];
      return Geometry.distance(point,stroke.start) <= SETTINGS.startRadius*stroke.scale;
    });
    if (!route) return;
    const stroke = route.strokes[route.currentStroke];
    // Preserve earlier strokes of this figure and every other child's work.
    resetStroke(stroke);
    prepareAudio();
    route.pointerId = event.pointerId;
    activePointers.set(event.pointerId,route);
    board.setPointerCapture(event.pointerId);
    drawMarks(stroke,stroke.tracker.start(point));
    updateMarkers(route);
  });

  board.addEventListener("pointermove", event => {
    event.preventDefault();
    const route = activePointers.get(event.pointerId);
    if (!route) return;
    const stroke = route.strokes[route.currentStroke];
    const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    for (const sample of samples.length ? samples : [event]) {
      advance(route,sample);
      if (stroke.finished) break;
    }
  });

  board.addEventListener("pointerup", event => {
    event.preventDefault();
    const route = activePointers.get(event.pointerId);
    if (!route) return;
    advance(route,event);
    releasePointer(event.pointerId);
  });
  for (const name of ["pointercancel","lostpointercapture"]) board.addEventListener(name,event => releasePointer(event.pointerId));

  document.querySelector("#start").addEventListener("click", () => { prepareAudio(); mode = "demo"; showExercise(0); });
  demo.addEventListener("click", () => setMode("demo"));
  practice.addEventListener("click", () => setMode("practice"));
  picker.addEventListener("change", () => {
    const index = Number(picker.value);
    if (Number.isInteger(index) && index >= 0 && index < EXERCISES.length) showExercise(index);
  });
  for (const id of ["repeat","clear"]) document.querySelector(`#${id}`).addEventListener("click",reset);
  for (const id of ["next","advance"]) document.querySelector(`#${id}`).addEventListener("click", () => showExercise((exerciseIndex+1)%EXERCISES.length));
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
  window.addEventListener("blur",releaseAllPointers);
  document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAllPointers(); });
  document.addEventListener("wheel",event => event.preventDefault(),{ passive: false });
  document.addEventListener("touchmove",event => event.preventDefault(),{ passive: false });
  document.addEventListener("gesturestart",event => event.preventDefault(),{ passive: false });
  document.addEventListener("contextmenu",event => event.preventDefault());
})();
