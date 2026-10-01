/* Original geometric exercises adapted from the supplied two-page reference. */
(function (root) {
  "use strict";
  const catalog = [
    { id: "vertical", name: "Verticales", copies: 5 },
    { id: "horizontal", name: "Horizontales", copies: 3 },
    { id: "down", name: "Diagonales descendentes", copies: 3 },
    { id: "up", name: "Diagonales ascendentes", copies: 3 },
    { id: "plus", name: "Cruces +", copies: 3 },
    { id: "ovals", name: "Línea con óvalos", copies: 3 },
    { id: "wave", name: "Ondas", copies: 3 },
    { id: "bars-dots", name: "Palos y puntos", copies: 4 },
    { id: "circle-plus", name: "Círculo y cruz", copies: 3, minWidth: 340 },
    { id: "dot-wave", name: "Camino de puntos", copies: 3 },
    { id: "dots-line", name: "Línea entre puntos", copies: 3 },
    { id: "circle", name: "Círculos", copies: 3 },
    { id: "double-circle", name: "Círculos dobles", copies: 3 },
    { id: "cross", name: "Cruces X", copies: 3 },
  ];

  function build(id, cell, baseScale) {
    const padding = 68*baseScale;
    const bounds = { x: cell.x+padding, y: cell.y+padding, w: cell.w-2*padding, h: cell.h-2*padding };
    const point = (x,y) => ({ x: bounds.x+x*bounds.w, y: bounds.y+y*bounds.h });
    const line = (a,b) => ({ points: [a,b], scale: baseScale, closed: false, guides: [] });
    const horizontal = () => line(point(0,0.5),point(1,0.5));
    const vertical = () => line(point(0.5,0),point(0.5,1));
    function ring(center, radius, scale = Math.min(baseScale,radius/120)) {
      const samples = Math.max(96,Math.ceil(2*Math.PI*radius/4));
      const points = Array.from({ length: samples+1 }, (_,index) => {
        const angle = Math.PI+index/samples*2*Math.PI;
        return { x: center.x+radius*Math.cos(angle), y: center.y+radius*Math.sin(angle) };
      });
      points[points.length-1] = { ...points[0] };
      return { points, scale, closed: true, guides: [] };
    }
    function wave(amplitude, cycles) {
      const height = bounds.h*amplitude;
      const desiredScale = Math.min(baseScale,height/65);
      // Fewer, gentler bends in each child's column keep a wide path readable.
      cycles = Math.max(1,Math.min(cycles,Math.floor(bounds.w/(2*Math.PI*Math.sqrt(height*65*desiredScale)))));
      const bendRadius = Math.pow(bounds.w/(2*Math.PI*cycles),2)/height;
      const scale = Math.min(desiredScale,bendRadius/60);
      const samples = Math.max(160,Math.ceil(bounds.w/3));
      const points = Array.from({ length: samples+1 }, (_,index) => {
        const t = index/samples;
        return point(t,0.5-amplitude*Math.sin(t*cycles*2*Math.PI));
      });
      // The corridor must be narrower than a wave's height, otherwise a
      // horizontal finger movement could count as following all its bends.
      return { points, scale, tolerance: height*0.8, closed: false, guides: [] };
    }
    function dot(center, radius, ry = radius) {
      return { tag: "ellipse", cx: center.x, cy: center.y, rx: radius, ry };
    }
    const center = point(0.5,0.5);
    const radius = Math.min(bounds.w,bounds.h)/2;
    switch (id) {
      case "vertical": return [vertical()];
      case "horizontal": return [horizontal()];
      case "down": return [line(point(0,0),point(1,1))];
      case "up": return [line(point(0,1),point(1,0))];
      case "plus": return [vertical(),horizontal()];
      case "cross": return [line(point(0,0),point(1,1)),line(point(0,1),point(1,0))];
      case "ovals": {
        const stroke = horizontal();
        stroke.guides = Array.from({ length: 7 }, (_,i) => dot(point((i+1)/8,0.5), (i%2 ? 10 : 7)*baseScale, (i%2 ? 20 : 14)*baseScale));
        return [stroke];
      }
      case "wave": return [wave(0.2,2)];
      case "bars-dots": {
        const stroke = line(point(0.25,0),point(0.25,1));
        stroke.guides = [dot(point(0.8,0.5),14*baseScale)];
        return [stroke];
      }
      case "dot-wave": {
        const stroke = wave(0.16,2);
        stroke.guides = Array.from({ length: 9 }, (_,i) => dot(stroke.points[Math.round((i+1)/10*(stroke.points.length-1))],9*stroke.scale));
        return [stroke];
      }
      case "dots-line": {
        const stroke = horizontal();
        stroke.guides = Array.from({ length: 7 }, (_,i) => [-1,1].map(sign => dot({ x: point((i+1)/8,0.5).x, y: center.y+sign*62*baseScale },5*baseScale))).flat();
        return [stroke];
      }
      case "circle": return [ring(center,radius)];
      case "double-circle": {
        const innerRadius = radius*0.53;
        const scale = Math.min(baseScale,(radius-innerRadius)/120);
        return [ring(center,radius,scale),ring(center,innerRadius,scale)];
      }
      case "circle-plus": {
        // Keep the two symbols side by side, as in the reference worksheet.
        const r = Math.min(bounds.w*0.23,bounds.h/2);
        const scale = Math.min(baseScale,r/120);
        const circle = ring(point(0.24,0.5),r,scale);
        const c = point(0.78,0.5);
        const crossRadius = Math.min(bounds.w*0.2,bounds.h*0.4);
        const v = line({ x:c.x, y:c.y-crossRadius },{ x:c.x, y:c.y+crossRadius });
        const h = line({ x:c.x-crossRadius, y:c.y },{ x:c.x+crossRadius, y:c.y });
        v.scale = h.scale = scale;
        return [circle,v,h];
      }
      default: throw new Error(`Unknown template: ${id}`);
    }
  }
  const api = { catalog, build };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TraceTemplates = api;
})(globalThis);
