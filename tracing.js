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
    const state = { progress: 0, along: 0, connected: false, raw: null, lastAccepted: null, done: false, outside:false, exited:false };
    function reset() {
      Object.assign(state, { progress: 0, along: 0, connected: false, raw: null, lastAccepted: null, done: false, outside:false, exited:false });
    }
    function start(point) {
      reset();
      // A closed circle's start and finish coincide. Only its initial arc may
      // be selected by a first contact; the last arc can never count as a start.
      const projected = project(path, point, 0, 0, Math.min(options.startRadius, path.length));
      state.progress = state.along = projected.along;
      state.connected = true;
      state.raw = point;
      state.lastAccepted = point;
      return [{ point, newSegment: true }, { point, newSegment: false }];
    }
    function pause() {
      state.raw = null;
      state.connected = false;
    }
    function resumeCandidate(point) {
      if (state.done || !state.lastAccepted || !options.contains(point)
        || distance(point,state.lastAccepted) > options.startRadius) return null;
      const projected = project(path,point,state.along);
      const joinRadius = options.joinRadius || 0;
      if (projected.distance > options.tolerance || projected.along > state.progress+joinRadius+0.001
        || Math.abs(projected.along-state.along) > options.startRadius*1.6+joinRadius) return null;
      return projected;
    }
    function canResume(point) { return resumeCandidate(point) !== null; }
    function resume(point) {
      const projected = resumeCandidate(point);
      if (!projected) return null;
      state.along = projected.along;
      state.progress = Math.max(state.progress,projected.along);
      state.connected = true;
      state.raw = state.lastAccepted = point;
      // A lift starts a new ink subpath: never draw a bridge through the air.
      return [{ point, newSegment: true }, { point, newSegment: false }];
    }
    function straddlesCorner(projected, previous, sample) {
      // Browser samples may straddle a sharp vertex: arc travel is then longer
      // than their straight chord. Only permit the immediately adjacent edge,
      // within one sampling step of that vertex on both sides.
      const from = path.segments.findIndex(segment=>segment.start+segment.length >= state.along-0.001);
      const to = path.segments.findIndex(segment=>segment.start+segment.length >= projected.along-0.001);
      if (Math.abs(from-to) !== 1 || Math.abs(projected.along-state.along) > options.sampleStep*2+0.5) return false;
      const vertex = path.segments[Math.min(from,to)].b;
      return distance(previous,vertex) <= options.sampleStep+0.5 && distance(sample,vertex) <= options.sampleStep+0.5;
    }
    function move(point) {
      const marks = [];
      state.outside = state.exited = false;
      if (!state.raw || state.done) return marks;
      const origin = state.raw;
      const travel = distance(origin, point);
      const count = Math.max(1, Math.ceil(travel / options.sampleStep));
      let previousRaw = origin;
      for (let index = 1; index <= count; index++) {
        const sample = { x: origin.x+(point.x-origin.x)*index/count, y: origin.y+(point.y-origin.y)*index/count };
        const previous = previousRaw;
        const step = distance(previous, sample);
        previousRaw = sample;
        if (step < 0.000001) continue;
        const projected = project(path, sample, state.along);
        if (!options.contains(sample) || projected.distance > options.tolerance) {
          state.connected = false;
          state.outside = state.exited = true;
          break;
        }
        let newSegment = false;
        // Arc travel must fit the actual finger movement. This rejects jumps
        // across a loop or between neighbouring waves, even inside tolerance.
        if (state.connected && Math.abs(projected.along-state.along) > step*1.6 + 0.5
          && !straddlesCorner(projected,previous,sample)) state.connected = false;
        if (!state.connected) {
          if (projected.along > state.progress + 0.001) continue;
          state.connected = true;
          newSegment = true;
        }
        state.along = projected.along;
        state.progress = Math.max(state.progress, projected.along);
        state.lastAccepted = sample;
        // Validation follows the template; visible ink follows the real finger.
        marks.push({ point: sample, newSegment });
        if (state.progress >= path.length-options.endRadius && distance(sample, path.points.at(-1)) <= options.endRadius) {
          state.done = true;
          break;
        }
      }
      state.raw = point;
      return marks;
    }
    return { state, reset, start, pause, canResume, resume, move };
  }

  function createEasyTracker(path, options) {
    const state = { progress:0,along:0,connected:false,raw:null,lastAccepted:null,done:false,outside:false,exited:false };
    let intervals = [], offPath = false, endReached = false;
    function reset() {
      Object.assign(state,{progress:0,along:0,connected:false,raw:null,lastAccepted:null,done:false,outside:false,exited:false});
      intervals = []; offPath = false; endReached = false;
    }
    function candidate(point, initial = false) {
      if (!options.contains(point)) return null;
      const p = project(path,point,state.along,0,initial ? Math.min(options.startRadius,path.length) : path.length);
      return p.distance <= options.tolerance ? p : null;
    }
    function cover(along) {
      const radius = options.joinRadius;
      intervals.push([Math.max(0,along-radius),Math.min(path.length,along+radius)]);
      intervals.sort((a,b)=>a[0]-b[0]);
      const merged = [];
      for (const interval of intervals) {
        const last = merged.at(-1);
        if (last && interval[0] <= last[1]+0.001) last[1] = Math.max(last[1],interval[1]);
        else merged.push(interval);
      }
      intervals = merged;
      // Only the connected painted region from the start can complete a path.
      // Drawing later sections never fills the holes between separate contacts.
      state.progress = intervals[0][0] <= options.startRadius ? intervals[0][1] : 0;
    }
    function accept(point, projected, newSegment) {
      state.along = projected.along;
      state.lastAccepted = point;
      state.connected = true; offPath = false;
      cover(projected.along);
      if (projected.along >= path.length-options.endRadius && distance(point,path.points.at(-1)) <= options.endRadius) endReached = true;
      state.done = state.progress >= path.length-options.endRadius && endReached;
      return {point,newSegment};
    }
    function start(point) {
      reset();
      const p = candidate(point,true);
      if (!p) return [];
      state.raw = point;
      const mark = accept(point,p,true);
      return [mark,{point,newSegment:false}];
    }
    function pause() { state.raw = null; state.connected = false; }
    function canResume(point) { return !state.done && state.lastAccepted !== null && candidate(point) !== null; }
    function resume(point) {
      if (!canResume(point)) return null;
      state.raw = point;
      const mark = accept(point,candidate(point),true);
      return [mark,{point,newSegment:false}];
    }
    function move(point) {
      const marks = [];
      state.outside = state.exited = false;
      if (!state.raw || state.done) return marks;
      const origin = state.raw;
      const count = Math.max(1,Math.ceil(distance(origin,point)/options.sampleStep));
      for (let index=1;index<=count;index++) {
        const sample = {x:origin.x+(point.x-origin.x)*index/count,y:origin.y+(point.y-origin.y)*index/count};
        const p = candidate(sample);
        if (!p) {
          state.outside = true;
          if (!offPath) state.exited = true;
          offPath = true; state.connected = false;
          continue;
        }
        marks.push(accept(sample,p,!state.connected));
        if (state.done) break;
      }
      state.raw = point;
      return marks;
    }
    return {state,reset,start,pause,canResume,resume,move};
  }

  // A point is a separate contact, not a tiny line or a pre-drawn decoration.
  function createDotTracker(center, options) {
    const state = { progress: 0, along: 0, connected: false, raw: null, lastAccepted: null, done: false };
    function reset() {
      Object.assign(state,{ progress: 0, along: 0, connected: false, raw: null, lastAccepted: null, done: false });
    }
    function start(point) {
      reset();
      if (!options.contains(point) || distance(point,center) > options.startRadius) return [];
      state.done = true;
      state.lastAccepted = point;
      return [{point,newSegment:true},{point,newSegment:false}];
    }
    return { state,reset,start,pause() {},canResume() { return false; },resume() { return null; },move() { return []; } };
  }

  const api = { createPath, at, project, createTracker, createEasyTracker, createDotTracker, distance };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TraceGeometry = api;
})(globalThis);
