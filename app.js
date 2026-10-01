"use strict";

(() => {
  // All distances are CSS pixels, independent of the display's pixel density.
  const SETTINGS = {
    pathWidth: 100,
    inkWidth: 72,
    tolerance: 80, // Maximum distance from the centre of the path, on each side.
    startRadius: 54,
    endRadius: 50,
  };

  // Coordinates are fractions of the usable exercise area, in travel order.
  const EXERCISES = [
    { name: "Línea vertical de arriba hacia abajo", start: [0.5, 0], end: [0.5, 1] },
    { name: "Línea horizontal de izquierda a derecha", start: [0, 0.5], end: [1, 0.5] },
    { name: "Línea diagonal descendente", start: [0, 0], end: [1, 1] },
    { name: "Línea diagonal ascendente", start: [0, 1], end: [1, 0] },
  ];

  const home = document.querySelector("#home");
  const exercise = document.querySelector("#exercise");
  const board = document.querySelector("#board");
  const track = document.querySelector("#track");
  const trackBorder = document.querySelector("#track-border");
  const ink = document.querySelector("#ink");
  const origin = document.querySelector("#origin");
  const destination = document.querySelector("#destination");
  const completed = document.querySelector("#completed");
  const repeat = document.querySelector("#repeat");

  let exerciseIndex = 0;
  let route;
  let pointerId = null;
  let previous = null;
  let progress = 0;
  let finished = false;
  let inkPath = "";
  let audioContext;
  let resizeFrame;

  track.style.strokeWidth = SETTINGS.pathWidth;
  trackBorder.style.strokeWidth = SETTINGS.pathWidth + 6;
  ink.style.strokeWidth = SETTINGS.inkWidth;
  document.querySelector("#start-disc").setAttribute("r", SETTINGS.startRadius);

  function releasePointer() {
    const captured = pointerId;
    pointerId = null;
    previous = null;
    if (captured !== null && board.hasPointerCapture(captured)) {
      board.releasePointerCapture(captured);
    }
  }

  function reset() {
    releasePointer();
    progress = 0;
    inkPath = "";
    finished = false;
    ink.setAttribute("d", "");
    completed.hidden = true;
    exercise.classList.remove("celebrating");
  }

  function layout() {
    reset();
    const { width, height } = board.getBoundingClientRect();
    board.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // Leave space for the home button and the completion controls.
    const marginX = Math.min(140, width * 0.21);
    const top = Math.min(135, height * 0.25);
    const bottom = Math.min(185, height * 0.34);
    const area = { x: marginX, y: top, w: width - marginX * 2, h: height - top - bottom };
    const current = EXERCISES[exerciseIndex];
    const point = ([x, y]) => ({ x: area.x + x * area.w, y: area.y + y * area.h });
    const start = point(current.start);
    const end = point(current.end);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    route = { start, end, length, ux: (end.x - start.x) / length, uy: (end.y - start.y) / length };
    track.setAttribute("d", `M${start.x},${start.y} L${end.x},${end.y}`);
    trackBorder.setAttribute("d", track.getAttribute("d"));
    origin.setAttribute("transform", `translate(${start.x} ${start.y})`);
    destination.setAttribute("transform", `translate(${end.x} ${end.y})`);
    const angle = Math.atan2(route.uy, route.ux) * 180 / Math.PI - 90;
    document.querySelector("#direction").setAttribute("transform", `rotate(${angle})`);
    board.setAttribute("aria-label", `${current.name}. Empieza en el círculo y sigue el camino hasta la estrella.`);
  }

  function showExercise(index) {
    exerciseIndex = index;
    home.hidden = true;
    exercise.hidden = false;
    layout();
  }

  function coordinates(event) {
    const rect = board.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function project(point) {
    const dx = point.x - route.start.x;
    const dy = point.y - route.start.y;
    return { along: dx * route.ux + dy * route.uy, across: Math.abs(dx * route.uy - dy * route.ux) };
  }

  function onPath(point, projected) {
    // A capsule: a wide corridor with rounded ends.
    const along = Math.max(0, Math.min(route.length, projected.along));
    const x = route.start.x + route.ux * along;
    const y = route.start.y + route.uy * along;
    return Math.hypot(point.x - x, point.y - y) <= SETTINGS.tolerance;
  }

  function drawTo(along, newSegment = false) {
    const distance = Math.max(0, Math.min(route.length, along));
    const x = route.start.x + route.ux * distance;
    const y = route.start.y + route.uy * distance;
    inkPath += `${newSegment ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)} `;
    ink.setAttribute("d", inkPath);
  }

  function prepareAudio() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext ||= new Audio();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    } catch { /* Audio is optional; drawing still works. */ }
  }

  function playPositiveSound() {
    if (!audioContext || audioContext.state !== "running") return;
    try {
      const now = audioContext.currentTime;
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
    } catch { /* No negative feedback if sound is unavailable. */ }
  }

  function finish() {
    finished = true;
    releasePointer();
    exercise.classList.add("celebrating");
    completed.hidden = false;
    playPositiveSound();
  }

  function advance(event) {
    const point = coordinates(event);
    const projected = project(point);
    if (!onPath(point, projected)) {
      previous = null;
      return;
    }

    const along = Math.max(0, Math.min(route.length, projected.along));
    if (previous === null) {
      // Rejoin at or behind the last reached point. Never bridge an untraced gap.
      if (along > progress) return;
      previous = along;
      drawTo(along, true);
      return;
    }

    drawTo(along);
    progress = Math.max(progress, along);
    previous = along;
    if (progress >= route.length - SETTINGS.endRadius && Math.hypot(point.x - route.end.x, point.y - route.end.y) <= SETTINGS.endRadius) {
      finish();
    }
  }

  board.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (finished || pointerId !== null || !event.isPrimary || event.button !== 0) return;
    const point = coordinates(event);
    if (Math.hypot(point.x - route.start.x, point.y - route.start.y) > SETTINGS.startRadius) return;
    reset();
    prepareAudio();
    pointerId = event.pointerId;
    board.setPointerCapture(pointerId);
    // The start disc covers the initial contact area; ink begins at the contact,
    // not at an invented segment between the disc's centre and the finger.
    previous = Math.max(0, Math.min(route.length, project(point).along));
    progress = previous;
    drawTo(previous, true);
    drawTo(previous);
  });

  board.addEventListener("pointermove", (event) => {
    event.preventDefault();
    if (event.pointerId !== pointerId || finished) return;
    const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    for (const sample of samples.length ? samples : [event]) {
      advance(sample);
      if (finished) break;
    }
  });

  board.addEventListener("pointerup", (event) => {
    event.preventDefault();
    if (event.pointerId !== pointerId) return;
    // Include the final position; a release never resumes a previous gesture.
    advance(event);
    releasePointer();
  });
  for (const name of ["pointercancel", "lostpointercapture"]) {
    board.addEventListener(name, (event) => {
      if (event.pointerId === pointerId) releasePointer();
    });
  }

  document.querySelector("#start").addEventListener("click", () => { prepareAudio(); showExercise(0); });
  repeat.addEventListener("click", reset);
  document.querySelector("#next").addEventListener("click", () => showExercise((exerciseIndex + 1) % EXERCISES.length));
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
  window.addEventListener("blur", releasePointer);
  document.addEventListener("visibilitychange", () => { if (document.hidden) releasePointer(); });
  // Block wheel/trackpad scrolling and gesture zoom, including on the controls.
  document.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
})();
