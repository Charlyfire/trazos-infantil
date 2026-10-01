/* Classroom paths: point order defines the direction of each gesture. */
(function (root) {
  "use strict";
  const catalog = [
    { id: "vertical", name: "Verticales · hacia abajo", copies: 5 },
    { id: "vertical-up", name: "Verticales · hacia arriba", copies: 5 },
    { id: "horizontal", name: "Horizontales · hacia la derecha", copies: 3 },
    { id: "horizontal-left", name: "Horizontales · hacia la izquierda", copies: 3 },
    { id: "down", name: "Diagonales descendentes", copies: 3 },
    { id: "up", name: "Diagonales ascendentes", copies: 3 },
    { id: "plus", name: "Cruces +", copies: 3 },
    { id: "cross", name: "Cruces X", copies: 3 },
    { id: "circle", name: "Círculos", copies: 3 },
    { id: "square", name: "Cuadrados", copies: 3 },
    { id: "oval", name: "Óvalos", copies: 3 },
    { id: "triangle", name: "Triángulos", copies: 3 },
    { id: "rectangle", name: "Rectángulos", copies: 3 },
    { id: "wave", name: "Ondas", copies: 3 },
    { id: "surf-wave", name: "Olas", copies: 3 },
    { id: "castle", name: "Castillos", copies: 3, minWidth: 420 },
    { id: "zigzag", name: "Zig-zag", copies: 3 },
    { id: "bars-dots", name: "Palos y puntos", copies: 4 },
    { id: "circle-plus", name: "Círculo y cruz", copies: 3, minWidth: 340 },
    { id: "dot-wave", name: "Camino de puntos", copies: 3 },
  ];

  function build(id, cell, baseScale) {
    const padding = 68*baseScale;
    const bounds = { x: cell.x+padding, y: cell.y+padding, w: cell.w-2*padding, h: cell.h-2*padding };
    const point = (x,y) => ({ x: bounds.x+x*bounds.w, y: bounds.y+y*bounds.h });
    const path = (points, scale = baseScale, closed = false) => ({ points, scale, closed, guides: [] });
    const line = (a,b) => path([a,b]);
    const horizontal = () => line(point(0,0.5),point(1,0.5));
    const vertical = () => line(point(0.5,0),point(0.5,1));
    function ellipse(center, rx, ry = rx, scale = Math.min(baseScale,Math.min(rx,ry)/120)) {
      const samples = Math.max(96,Math.ceil(2*Math.PI*Math.max(rx,ry)/4));
      const points = Array.from({ length: samples+1 }, (_,index) => {
        // Top -> left -> bottom -> right -> top, in screen coordinates.
        const angle = -Math.PI/2-index/samples*2*Math.PI;
        return { x: center.x+rx*Math.cos(angle), y: center.y+ry*Math.sin(angle) };
      });
      points[points.length-1] = { ...points[0] };
      return path(points,scale,true);
    }
    function polygon(points, scale) {
      return path([...points,{...points[0]}],scale,true);
    }
    function wave(amplitude, cycles, arches = false) {
      const height = bounds.h*amplitude;
      const desiredScale = Math.min(baseScale,height/65);
      const frequency = arches ? Math.PI : 2*Math.PI;
      cycles = Math.max(1,Math.min(cycles,Math.floor(bounds.w/(frequency*Math.sqrt(height*65*desiredScale)))));
      const bendRadius = Math.pow(bounds.w/(frequency*cycles),2)/height;
      const scale = Math.min(desiredScale,bendRadius/60);
      const samples = Math.max(160,Math.ceil(bounds.w/3));
      const points = Array.from({ length: samples+1 }, (_,index) => {
        const t = index/samples;
        const curve = arches ? Math.abs(Math.sin(t*cycles*Math.PI)) : Math.sin(t*cycles*2*Math.PI);
        return point(t,(arches ? 0.7 : 0.5)-amplitude*curve);
      });
      return { ...path(points,scale), tolerance: height*0.8 };
    }
    const center = point(0.5,0.5);
    const radius = Math.min(bounds.w,bounds.h)/2;
    switch (id) {
      case "vertical": return [vertical()];
      case "vertical-up": return [line(point(0.5,1),point(0.5,0))];
      case "horizontal": return [horizontal()];
      case "horizontal-left": return [line(point(1,0.5),point(0,0.5))];
      case "down": return [line(point(0,0),point(1,1))];
      case "up": return [line(point(0,1),point(1,0))];
      case "plus": return [vertical(),horizontal()];
      case "cross": return [line(point(0,0),point(1,1)),line(point(1,0),point(0,1))];
      case "circle": return [ellipse(center,radius)];
      case "oval": return [ellipse(center,bounds.w/2,Math.min(bounds.h/2,bounds.w*0.3))];
      case "square": {
        const side = Math.min(bounds.w,bounds.h);
        const corner = (x,y) => ({ x:center.x+(x-0.5)*side,y:center.y+(y-0.5)*side });
        return [polygon([corner(0,0),corner(0,1),corner(1,1),corner(1,0)],Math.min(baseScale,side/240))];
      }
      case "rectangle": {
        const height = Math.min(bounds.h,bounds.w*0.55);
        const corner = (x,y) => ({ x:bounds.x+x*bounds.w,y:center.y+(y-0.5)*height });
        return [polygon([corner(0,0),corner(0,1),corner(1,1),corner(1,0)],Math.min(baseScale,height/240))];
      }
      case "triangle": {
        const width = Math.min(bounds.w,bounds.h*2/Math.sqrt(3));
        const height = width*Math.sqrt(3)/2;
        const vertex = (x,y) => ({ x:center.x+(x-0.5)*width,y:center.y+(y-0.5)*height });
        return [polygon([vertex(0.5,0),vertex(0,1),vertex(1,1)],Math.min(baseScale,width/240))];
      }
      case "wave": return [wave(0.2,2)];
      case "surf-wave": return [wave(0.35,3,true)];
      case "castle": {
        const height = Math.min(bounds.h*0.5,bounds.w*0.16);
        const points = [[0,0.75],[0.08,0.75],[0.08,0.25],[0.24,0.25],[0.24,0.75],[0.4,0.75],[0.4,0.25],[0.56,0.25],[0.56,0.75],[0.72,0.75],[0.72,0.25],[0.88,0.25],[0.88,0.75],[1,0.75]].map(([x,y])=>({x:point(x,0.5).x,y:center.y+(y-0.5)*height*2}));
        const scale = Math.min(baseScale,bounds.w/850,height/150);
        return [{ ...path(points,scale), tolerance: Math.min(80*scale,bounds.w*0.08,bounds.h*0.2) }];
      }
      case "zigzag": {
        const points = [[0,0.75],[0.25,0.25],[0.5,0.75],[0.75,0.25],[1,0.75]].map(([x,y])=>point(x,y));
        const scale = Math.min(baseScale,bounds.w/500,bounds.h/300);
        return [{ ...path(points,scale), tolerance: Math.min(80*scale,bounds.h*0.2) }];
      }
      case "bars-dots": return [
        line(point(0.25,0),point(0.25,1)),
        { kind: "dot", points: [point(0.8,0.1)], scale: baseScale, closed: false, guides: [] },
      ];
      case "dot-wave": {
        const stroke = wave(0.16,2);
        stroke.guides = Array.from({ length: 9 }, (_,i) => {
          const center = stroke.points[Math.round((i+1)/10*(stroke.points.length-1))];
          return { tag:"ellipse",cx:center.x,cy:center.y,rx:9*stroke.scale,ry:9*stroke.scale };
        });
        return [stroke];
      }
      case "circle-plus": {
        const r = Math.min(bounds.w*0.23,bounds.h/2);
        const scale = Math.min(baseScale,r/120);
        const circle = ellipse(point(0.24,0.5),r,r,scale);
        const c = point(0.78,0.5);
        const crossRadius = Math.min(bounds.w*0.2,bounds.h*0.4);
        const v = line({ x:c.x,y:c.y-crossRadius },{ x:c.x,y:c.y+crossRadius });
        const h = line({ x:c.x-crossRadius,y:c.y },{ x:c.x+crossRadius,y:c.y });
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
