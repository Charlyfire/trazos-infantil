"use strict";

(() => {
  const SETTINGS = {
    pathWidth: 100,
    inkWidth: 36,
    tolerance: 80,
    startRadius: 54,
    endRadius: 50,
    lowerAreaRatio: 0.7,
    minColumnWidth: 220,
    sampleStep: 6, // Inspect actual movement between Pointer Event samples.
    demoSpeed: 95,
    demoMinDuration: 5000,
    demoMaxDuration: 12000,
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
  const individualControls = document.querySelector("#individual-controls");
  const settingsPanel = document.querySelector("#settings-panel");
  const settingsButton = document.querySelector("#settings-button");
  const playButton = document.querySelector("#play-demo");
  const teacherPanel = document.querySelector("#teacher-panel");
  // Presentation only: share icon paths between related template families.
  const TEMPLATE_ICONS = {
    vertical: "M16 4v24m-8-8 8 8 8-8",
    horizontal: "M4 16h24m-8-8 8 8-8 8",
    down: "M6 6l20 20M14 26h12V14",
    up: "M6 26 26 6M14 6h12v12",
    plus: "M16 5v22M5 16h22",
    ovals: "M3 16h26M12 16a4 8 0 1 0 8 0 4 8 0 1 0-8 0",
    wave: "M3 16c4-15 9-15 13 0s9 15 13 0",
    circle: "M16 4a12 12 0 1 0 0 24 12 12 0 1 0 0-24",
    "double-circle": "M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26M16 9a7 7 0 1 0 0 14 7 7 0 1 0 0-14",
    "circle-plus": "M10 8a8 8 0 1 0 0 16 8 8 0 1 0 0-16M25 10v12M19 16h12",
    cross: "M6 6l20 20M6 26 26 6",
  };
  TEMPLATE_ICONS["bars-dots"] = TEMPLATE_ICONS.vertical;
  TEMPLATE_ICONS["dot-wave"] = TEMPLATE_ICONS.wave;
  TEMPLATE_ICONS["dots-line"] = TEMPLATE_ICONS.horizontal;
  const preferences = { heightRatio: SETTINGS.lowerAreaRatio, assisted: false };
  try {
    const saved = JSON.parse(window.localStorage.getItem("trazos.preferences.v1"));
    if (saved && Number.isFinite(saved.heightRatio)) preferences.heightRatio = Math.max(0.45,Math.min(0.7,saved.heightRatio));
    if (saved && typeof saved.assisted === "boolean") preferences.assisted = saved.assisted;
  } catch { /* Optional device preferences; file:// or private storage may deny access. */ }
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
  const activePointers = new Map();
  let exerciseIndex = 0;
  let mode = "demo";
  let routes = [];
  let audioContext;
  let resizeFrame;
  let lastSoundAt = -Infinity;
  let demonstration = null;
  let demoFrame = null;
  let demoDot = null;

  function activate(button, callback) {
    let pressed = null;
    // Native compatibility clicks may omit secondary touch contacts. Handle
    // pointers directly so a child can repeat while another keeps drawing.
    button.addEventListener("pointerdown", event => {
      if (button.disabled || event.button !== 0 || pressed !== null) return;
      event.preventDefault();
      pressed = event.pointerId;
      button.setPointerCapture(pressed);
    });
    button.addEventListener("pointerup", event => {
      if (pressed !== event.pointerId) return;
      event.preventDefault();
      pressed = null;
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      const box = button.getBoundingClientRect();
      if (!button.disabled && event.clientX >= box.left && event.clientX <= box.left+box.width
        && event.clientY >= box.top && event.clientY <= box.top+box.height) callback();
    });
    for (const name of ["pointercancel","lostpointercapture"]) button.addEventListener(name, event => {
      if (pressed === event.pointerId) pressed = null;
      if (name === "pointercancel" && button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    });
    button.addEventListener("click", event => {
      event.preventDefault();
      if (!button.disabled && (event.detail === 0 || event.detail === undefined)) callback();
    });
  }

  function savePreferences() {
    try { window.localStorage.setItem("trazos.preferences.v1",JSON.stringify(preferences)); } catch { /* Optional. */ }
  }

  function updateTeacherControls() {
    const labels = { 70: "Altura habitual", 65: "Un poco más baja", 60: "Baja", 55: "Más baja", 50: "Muy baja", 45: "La más baja" };
    document.querySelector("#height-label").textContent = labels[Math.round(preferences.heightRatio*100)] || "Altura ajustada";
    document.querySelector("#height-down").disabled = preferences.heightRatio <= 0.45;
    document.querySelector("#height-up").disabled = preferences.heightRatio >= 0.7;
    document.querySelector("#strict").setAttribute("aria-pressed",String(!preferences.assisted));
    document.querySelector("#help").setAttribute("aria-pressed",String(preferences.assisted));
    playButton.hidden = mode !== "demo";
    playButton.disabled = reducedMotion || activePointers.size > 0;
  }

  function refreshCompletion() {
    const allFinished = routes.length > 0 && routes.every(route => route.finished);
    exercise.setAttribute("data-all-finished",String(allFinished));
    // With multiple children, keep every individual repeat button reachable.
    completed.hidden = !(allFinished && routes.length === 1);
    individualControls.hidden = !completed.hidden;
    announcement.textContent = allFinished ? "¡Habéis llegado a las estrellas!" : "";
  }

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
    route.strokes[route.currentStroke]?.tracker.pause();
    if (board.hasPointerCapture(id)) board.releasePointerCapture(id);
    updateMarkers(route);
    updateTeacherControls();
  }

  function releaseAllPointers() {
    for (const id of [...activePointers.keys()]) releasePointer(id);
  }

  function updateMarkers(route) {
    for (const [index, stroke] of route.strokes.entries()) {
      const preview = demonstration?.route === route;
      const current = preview ? index === demonstration.strokeIndex : !route.finished && !stroke.finished && index === route.currentStroke;
      const pausedResume = current && !preview && preferences.assisted && route.pointerId === null && stroke.tracker.state.lastAccepted !== null;
      const progress = preview ? demonstration.fraction : stroke.tracker.state.progress/stroke.path.length;
      const nearEnd = stroke.closed && (preview || route.pointerId !== null || pausedResume) && progress > 0.65;
      const marker = pausedResume ? stroke.tracker.state.lastAccepted : stroke.start;
      stroke.origin.setAttribute("transform",`translate(${marker.x} ${marker.y}) scale(${stroke.scale})`);
      stroke.origin.setAttribute("data-resume",String(pausedResume));
      const along = pausedResume ? stroke.tracker.state.along : 0;
      const tangent = stroke.path.segments.find(segment => segment.start+segment.length >= along) || stroke.path.segments.at(-1);
      stroke.direction.setAttribute("transform",`rotate(${Math.atan2(tangent.uy,tangent.ux)*180/Math.PI-90})`);
      stroke.origin.setAttribute("data-visible", String(current && (pausedResume || (!nearEnd && (preview || !stroke.resuming)))));
      stroke.destination.setAttribute("data-visible", String(stroke.finished || (current && (!stroke.closed || nearEnd))));
    }
  }

  function resetStroke(stroke) {
    stroke.tracker.reset();
    stroke.inkPath = "";
    stroke.finished = false;
    stroke.resuming = false;
    stroke.ink.setAttribute("d", "");
    stroke.group.classList.remove("celebrating");
    stroke.group.setAttribute("data-finished", "false");
  }

  function resetRoute(route) {
    if (demonstration?.route === route) cancelDemonstration();
    if (route.pointerId !== null) releasePointer(route.pointerId);
    route.currentStroke = 0;
    route.finished = false;
    route.strokes.forEach(resetStroke);
    route.group.setAttribute("data-finished", "false");
    updateMarkers(route);
  }

  function reset() {
    cancelDemonstration();
    releaseAllPointers();
    routes.forEach(resetRoute);
    refreshCompletion();
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
    const goalArt = svgNode("g", { class: "goal-art" }, destination);
    svgNode("path", { class: "star", d: "M0-53 15-19 52-16 24 9 32 46 0 27-32 46-24 9-52-16-15-19Z" }, goalArt);
    svgNode("path", { class: "star-shine", d: "M-8-30-3-39 4-24 M-32-9-22-10" }, goalArt);
    const origin = svgNode("g", { class: "origin", "data-kind": route.templateId === "vertical" ? "rocket" : "arrow", transform: `translate(${start.x} ${start.y}) scale(${scale})` }, group);
    const startArt = svgNode("g", { class: "start-art" }, origin);
    svgNode("circle", { class: "start-glow", r: 60 }, startArt);
    svgNode("circle", { class: "start-disc", r: SETTINGS.startRadius }, startArt);
    if (route.templateId === "vertical") makeRocket(startArt);
    const tangent = path.segments[0];
    const angle = Math.atan2(tangent.uy,tangent.ux)*180/Math.PI-90;
    const direction = svgNode("path", { class: "direction", d: route.templateId === "vertical" ? "M-10 36 0 46 10 36 M0 46V30" : "M-17-12 0 5 17-12 M0 5V-24", transform: `rotate(${angle})` }, origin);
    const tracker = Geometry.createTracker(path, {
      startRadius: SETTINGS.startRadius*scale,
      endRadius: SETTINGS.endRadius*scale,
      tolerance: Math.min(SETTINGS.tolerance*scale,spec.tolerance ?? Infinity),
      sampleStep: SETTINGS.sampleStep*scale,
      joinRadius: SETTINGS.inkWidth*scale/2,
      contains: point => point.x >= route.cell.x && point.x <= route.cell.x+route.cell.w
        && point.y >= route.cell.y && point.y <= route.cell.y+route.cell.h,
    });
    return { path, start, end, scale, group, ink, origin, direction, destination, tracker, closed: spec.closed, finished: false, resuming: false, inkPath: "" };
  }

  function makeRocket(parent) {
    const rocket = svgNode("g", { class: "rocket", "aria-hidden": "true" }, parent);
    svgNode("path", { class: "rocket-flame", d: "M-10-24Q-14-33 0-43 14-33 10-24Z" }, rocket);
    svgNode("path", { class: "rocket-fin", d: "M-15-14Q-33-10-30 15l16-7 M15-14Q33-10 30 15L14 8" }, rocket);
    svgNode("path", { class: "rocket-body", d: "M-16-25Q-24 7 0 27 24 7 16-25Z" }, rocket);
    svgNode("path", { class: "rocket-nose", d: "M-11 13Q0 31 11 13Z" }, rocket);
    svgNode("circle", { class: "rocket-window", cx: 0, cy: -7, r: 9 }, rocket);
    svgNode("path", { class: "rocket-shine", d: "M-8-19q-3 7-2 12" }, rocket);
  }

  function makeRoute(current, cell, index) {
    const scale = Math.min(1,cell.w/220,cell.h/300);
    const group = svgNode("g", { class: "route", "data-route": index, "data-finished": "false" });
    const route = { cell, group, templateId: current.id, strokes: [], currentStroke: 0, pointerId: null, finished: false };
    route.strokes = Templates.build(current.id,cell,scale).map((spec,i) => makeStroke(route,spec,i));
    updateMarkers(route);
    return route;
  }

  function layout() {
    cancelDemonstration();
    releaseAllPointers();
    completed.hidden = true;
    announcement.textContent = "";
    board.replaceChildren();
    individualControls.replaceChildren();
    const { width, height } = board.getBoundingClientRect();
    board.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // Small viewports need a little extra room for the teacher's template picker.
    // In every case, drawings stay within the lower 70% of the display.
    const controlBottom = teacherPanel.offsetHeight ? teacherPanel.getBoundingClientRect().bottom+16 : height <= 450 ? 132 : 190;
    const lowerTop = Math.max(height*(1-preferences.heightRatio),controlBottom);
    const footer = height <= 450 ? 92 : width <= 600 ? 120 : 140;
    const current = EXERCISES[exerciseIndex];
    // Keep the five vertical lanes together on very wide PDIs, with their
    // individual repeat controls aligned beneath the same columns.
    const areaWidth = mode === "practice" && current.id === "vertical" ? Math.min(width-32,1360) : width-32;
    const area = { x: (width-areaWidth)/2, y: lowerTop, w: areaWidth, h: Math.max(1,height-lowerTop-footer) };
    individualControls.style.left = `${area.x}px`;
    individualControls.style.right = `${width-area.x-area.w}px`;
    exercise.setAttribute("data-template",current.id);
    document.querySelector("#template-symbol").setAttribute("d",TEMPLATE_ICONS[current.id]);
    const available = Math.floor(area.w/(current.minWidth || SETTINGS.minColumnWidth));
    const count = mode === "demo" ? 1 : Math.max(1,Math.min(current.copies,available));
    routes = Array.from({ length: count }, (_,index) => makeRoute(current,
      { x: area.x+index*area.w/count, y: area.y, w: area.w/count, h: area.h }, index));
    for (const [index, route] of routes.entries()) {
      const button = document.createElement("button");
      button.setAttribute("type","button");
      button.setAttribute("class","individual-repeat");
      button.setAttribute("data-repeat-route",index);
      button.setAttribute("aria-label",`Repetir figura ${index+1}`);
      const icon = svgNode("svg",{ viewBox: "0 0 32 32", "aria-hidden": "true" },button);
      svgNode("path",{ d: "M7 11a11 11 0 1 1-1 9 M7 4v8h8" },icon);
      const label = document.createElement("span");
      label.textContent = "REPETIR";
      button.appendChild(label);
      activate(button, () => {
        if (!routes.includes(route)) return;
        resetRoute(route);
        refreshCompletion();
      });
      individualControls.appendChild(button);
    }
    demoDot = svgNode("circle",{ class: "demo-point", "data-visible": "false", r: 18, cx: 0, cy: 0 });
    demo.setAttribute("aria-pressed", String(mode === "demo"));
    practice.setAttribute("aria-pressed", String(mode === "practice"));
    picker.value = String(exerciseIndex);
    updateTeacherControls();
    refreshCompletion();
    board.setAttribute("aria-label", `${current.name}. ${mode === "demo" ? "Demostración" : "Práctica"}. Empieza cada trazo en ${current.id === "vertical" ? "el círculo con el cohete" : "el círculo"} y sigue el camino hasta su estrella.`);
    if (mode === "demo" && settingsPanel.hidden && !reducedMotion) playDemonstration();
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

  function cancelDemonstration() {
    if (demoFrame !== null) cancelAnimationFrame(demoFrame);
    demoFrame = null;
    demonstration = null;
    demoDot?.setAttribute("data-visible","false");
    playButton.setAttribute("aria-pressed","false");
    playButton.setAttribute("aria-label","Ver demostración lenta");
    playButton.setAttribute("title","Ver demostración lenta");
    document.querySelector("#demo-symbol").setAttribute("d","m10 5 18 11-18 11Z");
    exercise.setAttribute("data-demonstrating","false");
    routes.forEach(updateMarkers);
  }

  function playDemonstration() {
    if (mode !== "demo" || !routes.length || !settingsPanel.hidden || reducedMotion || activePointers.size) return;
    cancelDemonstration();
    const session = { route: routes[0], strokeIndex: 0, fraction: 0, started: null, pause: false };
    demonstration = session;
    demoDot.setAttribute("data-visible","true");
    playButton.setAttribute("aria-pressed","true");
    playButton.setAttribute("aria-label","Detener demostración");
    playButton.setAttribute("title","Detener demostración");
    document.querySelector("#demo-symbol").setAttribute("d","M8 8h16v16H8Z");
    exercise.setAttribute("data-demonstrating","true");

    function positionDot() {
      const stroke = session.route.strokes[session.strokeIndex];
      const point = Geometry.at(stroke.path,stroke.path.length*session.fraction);
      demoDot.setAttribute("cx",point.x);
      demoDot.setAttribute("cy",point.y);
      demoDot.setAttribute("r",18*stroke.scale);
      updateMarkers(session.route);
    }
    function frame(timestamp) {
      if (demonstration !== session) return;
      if (session.started === null) session.started = timestamp;
      const stroke = session.route.strokes[session.strokeIndex];
      if (session.pause) {
        const last = session.strokeIndex === session.route.strokes.length-1;
        if (timestamp-session.started >= (last ? 1000 : 600)) {
          if (last) { cancelDemonstration(); return; }
          session.strokeIndex++;
          session.fraction = 0;
          session.started = timestamp;
          session.pause = false;
        }
      } else {
        const duration = Math.max(SETTINGS.demoMinDuration,Math.min(SETTINGS.demoMaxDuration,stroke.path.length/(SETTINGS.demoSpeed*stroke.scale)*1000));
        session.fraction = Math.min(1,(timestamp-session.started)/duration);
        if (session.fraction === 1) { session.pause = true; session.started = timestamp; }
      }
      positionDot();
      demoFrame = requestAnimationFrame(frame);
    }
    positionDot();
    demoFrame = requestAnimationFrame(frame);
  }

  function openSettings() {
    cancelDemonstration();
    releaseAllPointers();
    settingsPanel.hidden = false;
    settingsButton.setAttribute("aria-expanded","true");
    document.querySelector("#settings-close").focus({ preventScroll: true });
  }

  function closeSettings() {
    settingsPanel.hidden = true;
    settingsButton.setAttribute("aria-expanded","false");
    settingsButton.focus({ preventScroll: true });
  }

  function changeHeight(delta) {
    const next = Math.round(Math.max(0.45,Math.min(0.7,preferences.heightRatio+delta))*100)/100;
    if (next === preferences.heightRatio) return;
    preferences.heightRatio = next;
    savePreferences();
    layout();
  }

  function setAssisted(value) {
    preferences.assisted = value;
    releaseAllPointers();
    routes.forEach(updateMarkers);
    savePreferences();
    updateTeacherControls();
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
    refreshCompletion();
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
    if (!settingsPanel.hidden || event.button !== 0 || activePointers.has(event.pointerId)) return;
    cancelDemonstration();
    const point = coordinates(event);
    const route = routes.find(item => {
      if (item.finished || item.pointerId !== null) return false;
      const stroke = item.strokes[item.currentStroke];
      if (preferences.assisted && stroke.tracker.state.lastAccepted) return stroke.tracker.canResume(point);
      return Geometry.distance(point,stroke.start) <= SETTINGS.startRadius*stroke.scale;
    });
    if (!route) return;
    const stroke = route.strokes[route.currentStroke];
    // Preserve earlier strokes of this figure and every other child's work.
    let marks;
    if (preferences.assisted && stroke.tracker.state.lastAccepted) {
      marks = stroke.tracker.resume(point);
      stroke.resuming = true;
    } else {
      resetStroke(stroke);
      marks = stroke.tracker.start(point);
    }
    prepareAudio();
    route.pointerId = event.pointerId;
    activePointers.set(event.pointerId,route);
    board.setPointerCapture(event.pointerId);
    drawMarks(stroke,marks);
    updateMarkers(route);
    updateTeacherControls();
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

  activate(document.querySelector("#start"), () => { prepareAudio(); mode = "demo"; showExercise(0); });
  activate(demo, () => setMode("demo"));
  activate(practice, () => setMode("practice"));
  activate(playButton, () => { if (demonstration) cancelDemonstration(); else playDemonstration(); });
  activate(settingsButton, () => { if (settingsPanel.hidden) openSettings(); else closeSettings(); });
  activate(document.querySelector("#settings-close"),closeSettings);
  activate(document.querySelector("#height-down"), () => changeHeight(-0.05));
  activate(document.querySelector("#height-up"), () => changeHeight(0.05));
  activate(document.querySelector("#strict"), () => setAssisted(false));
  activate(document.querySelector("#help"), () => setAssisted(true));
  picker.addEventListener("change", () => {
    const index = Number(picker.value);
    if (Number.isInteger(index) && index >= 0 && index < EXERCISES.length) showExercise(index);
  });
  for (const id of ["repeat","clear"]) activate(document.querySelector(`#${id}`),reset);
  for (const id of ["next","advance"]) activate(document.querySelector(`#${id}`), () => showExercise((exerciseIndex+1)%EXERCISES.length));
  activate(document.querySelector("#home-button"), () => {
    reset();
    settingsPanel.hidden = true;
    settingsButton.setAttribute("aria-expanded","false");
    exercise.hidden = true;
    home.hidden = false;
    document.querySelector("#start").focus({ preventScroll: true });
  });

  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { if (!exercise.hidden) layout(); });
  });
  window.addEventListener("blur", () => { cancelDemonstration(); releaseAllPointers(); });
  document.addEventListener("keydown",event => {
    if (event.key !== "Escape") return;
    if (!settingsPanel.hidden) { event.preventDefault(); closeSettings(); }
    else cancelDemonstration();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelDemonstration(); releaseAllPointers(); } });
  document.addEventListener("wheel",event => event.preventDefault(),{ passive: false });
  document.addEventListener("touchmove",event => event.preventDefault(),{ passive: false });
  document.addEventListener("gesturestart",event => event.preventDefault(),{ passive: false });
  document.addEventListener("contextmenu",event => event.preventDefault());
})();
