/* Polyline tracking shared by straight paths, waves and closed circles. */
(function (root) {
  "use strict";
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function createPath(points) {
    let length = 0;
    const segments = [];
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1], b = points[index];
      const size = distance(a, b);
      if (size < 0.000001) continue;
      segments.push({ a, b, start: length, length: size, ux: (b.x-a.x)/size, uy: (b.y-a.y)/size });
      length += size;
    }
    if (!segments.length) throw new Error("A path must contain at least two distinct points.");
    return { points, segments, length };
  }

  function at(path, along) {
    const clamped = Math.max(0, Math.min(path.length, along));
    const segment = path.segments.find(item => item.start + item.length >= clamped) || path.segments.at(-1);
    const delta = clamped - segment.start;
    return { x: segment.a.x + segment.ux*delta, y: segment.a.y + segment.uy*delta };
  }

  function project(path, point, reference = 0, minAlong = 0, maxAlong = path.length) {
    let best = null;
    for (const segment of path.segments) {
      const low = Math.max(0, minAlong - segment.start);
      const high = Math.min(segment.length, maxAlong - segment.start);
      if (high < low) continue;
      const delta = Math.max(low, Math.min(high, (point.x-segment.a.x)*segment.ux + (point.y-segment.a.y)*segment.uy));
      const position = { x: segment.a.x + segment.ux*delta, y: segment.a.y + segment.uy*delta };
      const gap = distance(point, position);
      const along = segment.start + delta;
      if (!best || gap < best.distance - 0.001 || (Math.abs(gap-best.distance) <= 0.001 && Math.abs(along-reference) < Math.abs(best.along-reference))) {
        best = { point: position, distance: gap, along };
      }
    }
    return best;
  }

  function createTracker(path, options) {
    const state = { progress: 0, along: 0, connected: false, raw: null, done: false };
    function reset() {
      Object.assign(state, { progress: 0, along: 0, connected: false, raw: null, done: false });
    }
    function start(point) {
      reset();
      // A closed circle's start and finish coincide. Only its initial arc may
      // be selected by a first contact; the last arc can never count as a start.
      const projected = project(path, point, 0, 0, Math.min(options.startRadius, path.length));
      state.progress = state.along = projected.along;
      state.connected = true;
      state.raw = point;
      return [{ point: projected.point, newSegment: true }, { point: projected.point, newSegment: false }];
    }
    function move(point) {
      const marks = [];
      if (!state.raw || state.done) return marks;
      const origin = state.raw;
      const travel = distance(origin, point);
      const count = Math.max(1, Math.ceil(travel / options.sampleStep));
      let previousRaw = origin;
      for (let index = 1; index <= count; index++) {
        const sample = { x: origin.x+(point.x-origin.x)*index/count, y: origin.y+(point.y-origin.y)*index/count };
        const step = distance(previousRaw, sample);
        previousRaw = sample;
        if (step < 0.000001) continue;
        const projected = project(path, sample, state.along);
        if (!options.contains(sample) || projected.distance > options.tolerance) {
          state.connected = false;
          continue;
        }
        let newSegment = false;
        // Arc travel must fit the actual finger movement. This rejects jumps
        // across a loop or between neighbouring waves, even inside tolerance.
        if (state.connected && Math.abs(projected.along-state.along) > step*1.6 + 0.5) state.connected = false;
        if (!state.connected) {
          if (projected.along > state.progress + 0.001) continue;
          state.connected = true;
          newSegment = true;
        }
        state.along = projected.along;
        state.progress = Math.max(state.progress, projected.along);
        marks.push({ point: projected.point, newSegment });
        if (state.progress >= path.length-options.endRadius && distance(sample, path.points.at(-1)) <= options.endRadius) {
          state.done = true;
          break;
        }
      }
      state.raw = point;
      return marks;
    }
    return { state, reset, start, move };
  }

  const api = { createPath, at, project, createTracker, distance };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TraceGeometry = api;
})(globalThis);
