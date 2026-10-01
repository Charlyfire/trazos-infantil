// Execute the production app with a simulated DOM; browser/PDI tests are separate.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const G = require('../tracing.js');
const T = require('../templates.js');
const sources = ['tracing.js','templates.js','app.js'].map(name => fs.readFileSync(path.join(root,name),'utf8'));
let checks = 0;
function check(condition,message) { assert.ok(condition,message); checks++; }

function setup(width=1280,height=720,options={}) {
  const ids = new Map(), viewport = { width,height };
  function node(tag='div') {
    const attrs=new Map(), listeners=new Map(), classes=new Set(), captures=new Set();
    return {
      tag,hidden:false,style:{},children:[],textContent:'',value:'',
      classList: { add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x) },
      addEventListener(name,fn) { listeners.set(name,fn); },
      dispatch(name,extra={}) {
        const event = { pointerId:1,pointerType:'mouse',isPrimary:true,button:0,preventDefault(){this.defaultPrevented=true;},...extra };
        listeners.get(name)?.(event); return event;
      },
      setAttribute(key,value){attrs.set(key,String(value));},getAttribute:key=>attrs.get(key),
      appendChild(child){this.children.push(child);return child;},replaceChildren(){this.children=[];},
      getBoundingClientRect:()=>({left:0,top:0,...viewport}),
      hasPointerCapture:id=>captures.has(id),setPointerCapture:id=>captures.add(id),
      releasePointerCapture(id){captures.delete(id);this.dispatch('lostpointercapture',{pointerId:id});},focus(){},click(){this.dispatch('click',{detail:0});},
    };
  }
  const el=id=>{if(!ids.has(id)){const item=node();item.hidden=['exercise','completed','settings-panel'].includes(id);ids.set(id,item);}return ids.get(id);};
  const document=el('document');document.querySelector=selector=>el(selector.slice(1));document.createElementNS=(_,tag)=>node(tag);document.createElement=node;
  const frames=new Map();let nextFrame=1;
  const window=el('window');
  window.matchMedia=()=>({matches:options.reducedMotion||false});
  const storage=new Map(options.saved? [['trazos.preferences.v2',JSON.stringify(options.saved)]]:[]);
  if(options.background)storage.set('trazos.background.v1',options.background);
  if(options.legacy)storage.set('trazos.preferences.v1',JSON.stringify(options.legacy));
  window.localStorage=options.storageDenied ? {getItem(){throw new Error('Storage unavailable');},setItem(){throw new Error('Storage unavailable');}}
    : {getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  class FileReader {readAsDataURL(file){this.result=file.data;this.onload?.();}}
  class Image {set src(value){if(options.imageFails)this.onerror?.();else this.onload?.();}}
  const context=vm.createContext({document,window,FileReader,Image,requestAnimationFrame:fn=>{const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
  el.frame=timestamp=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(timestamp));};
  el.pendingFrames=()=>frames.size;el.storage=storage;
  sources.forEach(source=>vm.runInContext(source,context));
  el('start').dispatch('click');el.viewport=viewport;return el;
}
const groups=el=>el('board').children.filter(node=>node.getAttribute('class')==='route');
const strokes=group=>group.children.filter(item=>item.getAttribute('class')==='stroke');
const child=(node,cls)=>node.children.find(item=>item.getAttribute('class')===cls);
const done=node=>node.getAttribute('data-finished')==='true';
const ink=stroke=>child(stroke,'ink').getAttribute('d');
function model(stroke) {
  const values=child(stroke,'track').getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
  const points=[];for(let i=0;i<values.length;i+=2)points.push({x:values[i],y:values[i+1]});
  return points.length===1 ? {points,segments:[],length:0} : G.createPath(points);
}
const scale=stroke=>Number(child(stroke,'track').getAttribute('stroke-width'))/100;
function send(el,name,point,id=1,type='mouse',extra={}) {
  return el('board').dispatch(name,{clientX:point.x,clientY:point.y,pointerId:id,pointerType:type,isPrimary:id===1,...extra});
}
function select(el,index){el('template').value=String(index);el('template').dispatch('change');}
function gesture(el,stroke,type='mouse',start=0,end=1,id=1) {
  const m=model(stroke);
  if(stroke.getAttribute('data-kind')==='dot'){const p=m.points[0],target=start>0 ? {x:p.x+120*scale(stroke),y:p.y} : p;send(el,'pointerdown',target,id,type);send(el,'pointerup',target,id,type);return;}
  send(el,'pointerdown',G.at(m,m.length*start),id,type);
  const count=Math.ceil(m.length*(end-start)/(3*scale(stroke)));
  for(let i=1;i<=count;i++)send(el,'pointermove',G.at(m,m.length*(start+(end-start)*i/count)),id,type);
  send(el,'pointerup',G.at(m,m.length*end),id,type);
}

if (!process.argv.includes('--features-only')) {
for(const dimensions of [[1280,720],[1920,1080],[375,667],[844,390],[320,320]]) {
  for(const difficulty of ['easy','hard'])for(const mode of ['demo','practice'])for(const type of ['mouse','touch','pen']) {
    const el=setup(...dimensions,{saved:{difficulty}});el(mode).dispatch('click');
    check(el('template').children.length===T.catalog.length,'Every catalog family is available');
    for(let index=0;index<T.catalog.length;index++) {
      select(el,index);const current=groups(el),template=T.catalog[index];
      const expected=mode==='demo'?1:Math.max(1,Math.min(template.copies,Math.floor((dimensions[0]-32)/(template.minWidth||220))));
      check(current.length===expected,`Correct copies: ${template.id}/${mode}/${dimensions}`);
      for(const group of current) {
        check(strokes(group).filter(s=>child(s,'origin').getAttribute('data-visible')==='true').length===1,'Only the next component displays a start');
        for(const stroke of strokes(group)) {
          const m=model(stroke),s=scale(stroke);
          for(const p of [m.points[0],m.points.at(-1)])check(p.y-68*s>=dimensions[1]*0.3-0.01,'Markers stay in the lower 70%');
          check(m.points.every(p=>p.y-53*s>=dimensions[1]*0.3-0.01),'Entire curve stays in the lower area');
          gesture(el,stroke,type,0.5);
          check(!done(stroke)&&ink(stroke)==='',`Cannot start in the middle: ${template.id}`);
          gesture(el,stroke,type);
          check(done(stroke),`Completes ${template.id}/${mode}/${type}/${dimensions}`);
          check(child(stroke,'origin').getAttribute('data-visible')==='false','Completed component hides its start');
          check(child(stroke,'destination').getAttribute('data-visible')==='true','Completed component keeps its star');
        }
        check(done(group),'Only all component strokes complete a figure');
      }
      check(el('exercise').getAttribute('data-all-finished')==='true','All figures show group completion');
      el('clear').dispatch('click');
      check(current.every(group=>!done(group)&&strokes(group).every(stroke=>!done(stroke)&&ink(stroke)==='')),'Repeat clears all figures');
    }
    el('advance').dispatch('click');check(el('template').value==='0','Last template cycles to first');
  }
}

// Leave a straight corridor, reenter ahead, return to its frontier.
for(const type of ['mouse','touch','pen']) {
  const el=setup(),stroke=strokes(groups(el)[0])[0],m=model(stroke);
  const point=(t,offset=0)=>{const p=G.at(m,m.length*t);return{x:p.x+offset,y:p.y};};
  send(el,'pointerdown',point(0),1,type);send(el,'pointermove',point(0.3),1,type);
  send(el,'pointermove',point(0.4,130),1,type);const before=ink(stroke);
  send(el,'pointermove',point(0.8,130),1,type);send(el,'pointermove',point(0.8),1,type);send(el,'pointermove',point(1),1,type);
  check(ink(stroke).startsWith(before)&&!done(stroke),'Easy can paint later sections without completing the untraced gap');
  send(el,'pointermove',point(0.28),1,type);for(let i=29;i<=100;i++)send(el,'pointermove',point(i/100),1,type);
  check(done(stroke),'Can reconnect behind the frontier');
  el('clear').dispatch('click');gesture(el,stroke,type,0,0.4);gesture(el,stroke,type,0.4,1);
  check(done(stroke),'Easy continues after lifting');
  el('clear').dispatch('click');
  send(el,'pointerdown',point(0),1,type);send(el,'pointermove',point(0.3),1,type);send(el,'pointercancel',point(0.3),1,type);send(el,'pointermove',point(1),1,type);
  check(!done(stroke),'Cancelled contact cannot finish');
}

// Closed loops must actually be walked around, even though start equals end.
for(const id of ['circle','oval','square','triangle','rectangle','circle-plus']) {
  const index=T.catalog.findIndex(t=>t.id===id),el=setup();select(el,index);
  const group=groups(el)[0],stroke=strokes(group)[0],m=model(stroke),p=m.points[0];
  send(el,'pointerdown',p);
  for(let i=0;i<50;i++)send(el,'pointermove',p);
  send(el,'pointerup',p);
  check(!done(stroke),'Touching a circle start/end cannot auto-complete');
  const opposite=G.at(m,m.length/2);send(el,'pointerdown',p);send(el,'pointermove',opposite);send(el,'pointermove',p);send(el,'pointerup',p);
  check(!done(stroke),'A circle diameter cannot shortcut a full lap');
  gesture(el,stroke,'mouse',0,0.8);
  check(!done(stroke)&&child(stroke,'origin').getAttribute('data-visible')==='true','A lifted incomplete circle restores its visible start');
  gesture(el,stroke);check(done(stroke),'A full lap completes the circle');
  if(strokes(group).length>1){check(!done(group),'Circle component alone cannot complete a multi-part figure');const second=strokes(group)[1];gesture(el,second,'mouse',0,0.35);gesture(el,second,'mouse',0.35,1);check(done(second)&&done(stroke),'Continuing a later component retains completed earlier strokes');}
}

// Curves require a traced curve, not a straight jump from endpoint to endpoint.
for(const id of ['wave','dot-wave']) {
  const el=setup();select(el,T.catalog.findIndex(t=>t.id===id));const stroke=strokes(groups(el)[0])[0],m=model(stroke);
  send(el,'pointerdown',m.points[0]);send(el,'pointermove',m.points.at(-1));send(el,'pointerup',m.points.at(-1));
  check(!done(stroke),'Straight shortcut cannot complete a wave');
  gesture(el,stroke);check(done(stroke),'Following a wave completes it');
}

// Three children remain independent, including on curves and multi-part figures.
for(let index=0;index<T.catalog.length;index++) {
  const el=setup(1920,1080);el('practice').dispatch('click');select(el,index);
  const current=groups(el),three=current.slice(0,3),active=three.map(g=>strokes(g)[0]),models=active.map(model);
  for(let i=0;i<3;i++)send(el,'pointerdown',models[i].points[0],i+1,'touch');
  for(let step=1;step<=20;step++)for(let i=0;i<3;i++)send(el,'pointermove',G.at(models[i],models[i].length*step/100),i+1,'touch');
  check(active.every(s=>ink(s).length>10),'Three non-primary contacts trace independently');
  const untouched=ink(active[1]);send(el,'pointerdown',models[1].points[0],4,'touch');send(el,'pointermove',models[1].points.at(-1),4,'touch');
  check(ink(active[1])===untouched,'Cannot steal another active figure');
  send(el,'pointercancel',G.at(models[1],models[1].length*0.2),2,'touch');
  check(el('board').hasPointerCapture(1)&&el('board').hasPointerCapture(3),'Cancelling one child does not cancel others');
  const third=ink(active[2]);gesture(el,active[1],'touch',0,1,2);
  check(ink(active[2])===third&&el('board').hasPointerCapture(3),'Restart/finish preserves the other active child');
  const firstCount=Math.ceil(models[0].length/(3*scale(active[0])));
  for(let step=Math.floor(firstCount*0.2);step<=firstCount;step++)send(el,'pointermove',G.at(models[0],models[0].length*step/firstCount),1,'touch');
  check(done(active[0])&&el('board').hasPointerCapture(3),'Finishing a component retains other pointer captures');
  send(el,'pointerup',models[0].points.at(-1),1,'touch');
  el('demo').dispatch('click');
  check(groups(el).length===1&&!el('board').hasPointerCapture(3),'Mode change releases all contacts');
}

const el=setup();
const m=model(strokes(groups(el)[0])[0]);
send(el,'pointerdown',m.points[0],1,'mouse',{button:2});send(el,'pointermove',m.points.at(-1));check(!done(groups(el)[0]),'Right button is ignored');
send(el,'pointerdown',m.points[0]);el.viewport.width=1920;el.viewport.height=1080;el('window').dispatch('resize');el.frame(0);check(!el('board').hasPointerCapture(1),'Resize releases pointers');
el('home-button').dispatch('click');check(!el('home').hidden&&el('exercise').hidden,'Home navigation');
for(const name of ['wheel','touchmove','gesturestart'])check(el('document').dispatch(name).defaultPrevented,`${name} prevented`);
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');check(css.includes('overflow: hidden')&&css.includes('touch-action: none')&&css.includes('overscroll-behavior: none'),'Scroll prevention');
}

// The visible ink must keep the child's real lateral displacement.
for(const type of ['mouse','touch','pen']) {
  const el=setup(1920,1080),stroke=strokes(groups(el)[0])[0],m=model(stroke);
  const offset=point=>({x:point.x+32,y:point.y});
  send(el,'pointerdown',offset(m.points[0]),1,type);
  for(let step=1;step<=40;step++)send(el,'pointermove',offset(G.at(m,m.length*step/100)),1,type);
  send(el,'pointerup',offset(G.at(m,m.length*0.4)),1,type);
  const positions=ink(stroke).match(/-?\d+(?:\.\d+)?/g).map(Number);
  check(positions.every((value,index)=>index%2!==0||Math.abs(value-m.points[0].x-32)<0.02),'Ink follows the actual finger, not the path centre');
  check(!done(stroke),'Real ink does not auto-complete the remainder');
}

function helpOn(el){el('settings-button').dispatch('click');el('help').dispatch('click');el('settings-close').dispatch('click');}
for(const type of ['mouse','touch','pen'])for(let index=0;index<T.catalog.length;index++) {
  const el=setup(1920,1080);helpOn(el);select(el,index);
  const group=groups(el)[0];
  for(const stroke of strokes(group)) {
    const fixedOrigin=child(stroke,'origin').getAttribute('transform'),fixedDirection=child(stroke,'origin').children.find(n=>n.getAttribute('class')==='direction').getAttribute('transform');
    if(stroke.getAttribute('data-kind')==='dot'){gesture(el,stroke,type,0.5);check(!done(stroke)&&ink(stroke)==='','Dot needs its own valid contact even with help');gesture(el,stroke,type);check(done(stroke),'A point is painted by a valid tap');continue;}
    gesture(el,stroke,type,0.5);
    check(!done(stroke)&&ink(stroke)==='','Help still requires the initial start');
    gesture(el,stroke,type,0,0.35);
    const before=ink(stroke),m=model(stroke);
    check(child(stroke,'origin').getAttribute('transform')===fixedOrigin&&child(child(stroke,'origin'),'direction').getAttribute('transform')===fixedDirection,'The start arrow stays fixed after lifting');
    send(el,'pointerdown',G.at(m,m.length*0.85),1,type);
    send(el,'pointermove',m.points.at(-1),1,type);
    send(el,'pointerup',m.points.at(-1),1,type);
    check(ink(stroke).startsWith(before)&&!done(stroke),'Easy can resume ahead but cannot complete unpainted gaps');
    gesture(el,stroke,type,0.35,1);
    check(done(stroke)&&ink(stroke).startsWith(before),`Help preserves and completes ${T.catalog[index].id}/${type}`);
    check((ink(stroke).match(/M/g)||[]).length>=2,'Separate contacts create separate ink subpaths');
  }
  check(done(group),'Every multi-part figure can complete with help');
}

// Device preferences persist, limits are bounded and height changes reset geometry.
{
 const el=setup(1920,1080);el('practice').dispatch('click');
 const y0=model(strokes(groups(el)[0])[0]).points[0].y;
 el('settings-button').dispatch('click');
 check(!el('settings-panel').hidden&&el('settings-button').getAttribute('aria-expanded')==='true','Teacher panel opens');
 for(let i=0;i<2;i++)el('height-down').dispatch('click');
 const y1=model(strokes(groups(el)[0])[0]).points[0].y;
 check(y1>y0,'Lowering the work area moves paths down');
 el('help').dispatch('click');el('settings-close').dispatch('click');
 const saved=JSON.parse(el.storage.get('trazos.preferences.v2'));
 check(saved.heightRatio===0.6&&saved.difficulty==='easy','Height and difficulty are saved on the device');
 const restored=setup(1920,1080,{saved});restored('practice').dispatch('click');
 check(Math.abs(model(strokes(groups(restored)[0])[0]).points[0].y-y1)<0.001,'Device height is restored');
 check(restored('help').getAttribute('aria-pressed')==='true','Device help mode is restored');
 restored('settings-button').dispatch('click');
 for(let i=0;i<20;i++)restored('height-down').dispatch('click');
 check(restored('height-down').disabled,'Cannot move below the lowest supported height');
 for(let i=0;i<20;i++)restored('height-up').dispatch('click');
 check(restored('height-up').disabled,'Cannot move above the lower 70%');
 restored('document').dispatch('keydown',{key:'Escape'});
 check(restored('settings-panel').hidden,'Escape closes teacher settings');
}

// Individual repetition works with secondary touch while a neighbour is active.
{
 const el=setup(1920,1080);el('practice').dispatch('click');
 const current=groups(el),a=strokes(current[0])[0],b=strokes(current[1])[0],m=model(a);
 send(el,'pointerdown',m.points[0],1,'touch');send(el,'pointermove',G.at(m,m.length*0.3),1,'touch');
 gesture(el,b,'touch',0,1,2);
 const before=ink(a),button=el('individual-controls').children[1];
 button.dispatch('pointerdown',{pointerId:3,pointerType:'touch',isPrimary:false,clientX:100,clientY:100});
 button.dispatch('pointerup',{pointerId:3,pointerType:'touch',isPrimary:false,clientX:100,clientY:100});
 check(!done(current[1])&&ink(b)==='','Secondary touch repeats only its own figure');
 check(ink(a)===before&&el('board').hasPointerCapture(1),'Individual repeat keeps neighbours ink and capture');
 gesture(el,b,'touch',0,0.2,2);const partial=ink(b);
 button.dispatch('click',{detail:1});
 check(ink(b)===partial,'Compatibility click cannot trigger a second reset');
 el('clear').dispatch('click');for(const group of current)for(const stroke of strokes(group))gesture(el,stroke);
 check(current.every(done)&&!el('individual-controls').hidden,'Individual repeat remains visible after everyone finishes');
 el('individual-controls').children[0].dispatch('click',{detail:0});
 check(!done(current[0])&&current.slice(1).every(done),'Keyboard repeat preserves all completed neighbours');
}

// Demonstration paints its own layer without completing or changing child ink.
{
 const el=setup(1920,1080),group=groups(el)[0],stroke=strokes(group)[0];
 const dot=el('board').children.find(node=>node.getAttribute('class')==='demo-point');
 const y0=Number(dot.getAttribute('cy'));
 check(el('exercise').getAttribute('data-demonstrating')==='true','Demo plays once on entering demonstration');
 el.frame(0);el.frame(2500);
 check(Number(dot.getAttribute('cy'))>y0,'The guide advances slowly along the path');
 check(child(stroke,'demo-ink').getAttribute('d').length>10&&ink(stroke)===''&&!done(group),'Animation paints only its preview layer, leaving the exercise pending');
 el.frame(13000);el.frame(15000);
 check(el.pendingFrames()===0&&dot.getAttribute('data-visible')==='false'&&child(stroke,'demo-ink').getAttribute('d').length>10,'Demo stops after one pass and retains the painted example');
 el('play-demo').dispatch('click');check(el.pendingFrames()===1,'Teacher can replay the demonstration');
 send(el,'pointerdown',model(stroke).points[0]);
 check(el.pendingFrames()===0&&child(stroke,'demo-ink').getAttribute('d')==='','A real contact cancels the guide and removes the example ink');
 send(el,'pointercancel',model(stroke).points[0]);
 select(el,T.catalog.findIndex(t=>t.id==='plus'));el.frame(0);el.frame(13000);el.frame(14000);
 const parts=strokes(groups(el)[0]);
 check(parts[1]&&child(parts[1],'origin').getAttribute('data-visible')==='true','Multi-part demo shows the next component start');
 check(parts.every(s=>ink(s)===''&&!done(s)),'Multi-part demonstration leaves all actual strokes pending');
 el('practice').dispatch('click');check(el.pendingFrames()===0,'Practice cancels demonstration frames');
 const reduced=setup(1920,1080,{reducedMotion:true});
 check(reduced.pendingFrames()===0&&reduced('play-demo').disabled,'Reduced-motion preference prevents automatic animation');
}

{
 const tooHigh=setup(1920,1080,{saved:{heightRatio:1}}),tooLow=setup(1920,1080,{saved:{heightRatio:0}});
 check(tooHigh('height-up').disabled,'Invalid stored height cannot exceed the supported upper boundary');
 check(tooLow('height-down').disabled,'Invalid stored height cannot exceed the supported lower boundary');
 const privateMode=setup(1920,1080,{storageDenied:true});
 const before=model(strokes(groups(privateMode)[0])[0]).points[0].y;
 privateMode('settings-button').dispatch('click');privateMode('height-down').dispatch('click');
 check(model(strokes(groups(privateMode)[0])[0]).points[0].y>before,'Settings still work when browser storage is unavailable');
 const el=setup(1920,1080);el('window').dispatch('blur');
 check(el.pendingFrames()===0,'Losing window focus cancels demonstration frames');
 el('play-demo').dispatch('click');el('document').hidden=true;el('document').dispatch('visibilitychange');
 check(el.pendingFrames()===0&&!done(groups(el)[0]),'Backgrounding stops the guide without completing a figure');
}
// The worksheet adds variants without replacing the existing directions.
const worksheetIds=['zigzag-tight','wave-tight','arches-up','arches-down','loops-down','loops-up','battlements','castle-alternating','loops-side'];
{
 const cell={x:0,y:0,w:620,h:600};
 check(new Set(T.catalog.map(t=>t.id)).size===T.catalog.length,'No duplicated selector entries');
 for(const id of worksheetIds) {
   const [stroke]=T.build(id,cell,1),p=stroke.points;
   check(p.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=cell.x&&p.x<=cell.w&&p.y>=cell.y&&p.y<=cell.h),`${id}: all coordinates fit the figure`);
   check(!stroke.closed&&p.at(-1).x>p[0].x,`${id}: an open path advances across the worksheet`);
 }
 const build=id=>T.build(id,cell,1)[0].points;
 for(const id of ['arches-up','loops-up'])check(build(id)[1].y<build(id)[0].y,`${id}: the first bend rises`);
 for(const id of ['arches-down','loops-down'])check(build(id)[1].y>build(id)[0].y,`${id}: the first bend descends`);
 const sideways=build('loops-side');check(sideways[1].x<sideways[0].x&&sideways[1].y>sideways[0].y,'Sideways loops first curve left and down, then travel horizontally');
 for(const id of ['battlements','castle-alternating'])check(build(id)[1].y<build(id)[0].y,'The new worksheet battlements start upwards');
 const tops=build('castle-alternating').filter((_,i)=>i%4===1).map(p=>p.y);
 check(tops[0]<tops[1]&&tops[0]===tops[2]&&tops[1]===tops[3],'The castle alternates tall and low towers');
}
for(const difficulty of ['easy','hard'])for(const id of worksheetIds) {
 const el=setup(1920,1080,{saved:{difficulty}});el('practice').dispatch('click');select(el,T.catalog.findIndex(t=>t.id===id));
 const stroke=strokes(groups(el)[0])[0],m=model(stroke);
 send(el,'pointerdown',m.points[0]);send(el,'pointermove',m.points.at(-1));send(el,'pointerup',m.points.at(-1));
 check(!done(stroke),`${id}/${difficulty}: a straight shortcut cannot complete the bends or loops`);
 gesture(el,stroke,'touch');check(done(stroke),`${id}/${difficulty}: tracing every bend completes the figure`);
}
for(const id of worksheetIds) {
 const el=setup(1920,1080);select(el,T.catalog.findIndex(t=>t.id===id));
 const stroke=strokes(groups(el)[0])[0],origin=child(stroke,'origin').getAttribute('transform');
 el.frame(0);el.frame(2000);
 check(child(stroke,'demo-ink').getAttribute('d').length>10,'Each new worksheet path is painted during the demonstration');
 el.frame(13000);
 check(!done(stroke)&&ink(stroke)===''&&child(stroke,'demo-ink').getAttribute('d').length>10,'The painted worksheet example remains without awarding child completion');
 check(child(stroke,'origin').getAttribute('transform')===origin,'The worksheet start stays fixed during the demonstration');
}

// Requested teaching directions and catalog removals are explicit contracts.
{
 const cell={x:0,y:0,w:620,h:600};
 const build=id=>T.build(id,cell,1);
 const deltas=stroke=>({x:stroke.points.at(-1).x-stroke.points[0].x,y:stroke.points.at(-1).y-stroke.points[0].y});
 check(T.catalog.length===29,'The catalog includes the nine new worksheet variants');
 check(['ovals','dots-line','double-circle'].every(id=>!T.catalog.some(t=>t.id===id)),'Removed families are absent from the selector');
 for(const [id,axis,sign] of [['vertical','y',1],['vertical-up','y',-1],['horizontal','x',1],['horizontal-left','x',-1]])check(deltas(build(id)[0])[axis]*sign>0,`Required direction: ${id}`);
 check(build('cross').length===2&&build('cross').every(s=>deltas(s).y>0),'Both X diagonals descend');
 for(const id of ['circle','oval','circle-plus']) {
   const p=build(id)[0].points;
   check(Math.abs(p[0].y-Math.min(...p.map(p=>p.y)))<0.001,`${id} starts at the top`);
   check(p[1].x<p[0].x,`${id} first moves towards the left`);
 }
 const castle=build('castle')[0].points;
 for(const [index,axis,sign] of [[0,'x',1],[1,'y',-1],[2,'x',1],[3,'y',1],[4,'x',1]])check((castle[index+1][axis]-castle[index][axis])*sign>0,`Castle direction ${index+1}`);
 for(const id of ['square','oval','triangle','rectangle']) {
   const s=build(id)[0];check(s.closed&&G.distance(s.points[0],s.points.at(-1))<0.001,`${id} is a complete closed contour`);
 }
 const el=setup();select(el,T.catalog.findIndex(t=>t.id==='vertical-up'));
 const origin=child(strokes(groups(el)[0])[0],'origin');
 check(child(origin,'direction').getAttribute('transform')==='rotate(-180)','Ascending start arrow points upwards');
}

// A dot is created by a separate real contact, never by finishing its neighbour.
for(const type of ['mouse','touch','pen']) {
 const el=setup(1920,1080);select(el,T.catalog.findIndex(t=>t.id==='bars-dots'));
 const group=groups(el)[0],[bar,dot]=strokes(group),point=model(dot).points[0];
 send(el,'pointerdown',point,1,type);send(el,'pointerup',point,1,type);
 check(ink(dot)===''&&!done(dot),'The dot cannot be marked before its bar');
 gesture(el,bar,type);
 check(done(bar)&&!done(group)&&!done(dot)&&ink(dot)==='','Finishing the bar leaves the dot empty');
 send(el,'pointermove',point,1,type);
 check(ink(dot)==='','Continuing the previous gesture cannot auto-paint the dot');
 const real={x:point.x+18,y:point.y+12};
 send(el,'pointerdown',real,1,type);send(el,'pointerup',real,1,type);
 check(done(dot)&&done(group)&&ink(dot).includes(`${real.x.toFixed(2)},${real.y.toFixed(2)}`),'A separate tap paints the child actual point and completes the figure');
 const goal=child(dot,'destination').getAttribute('transform').match(/-?\d+(?:\.\d+)?/g).map(Number);
 check(goal[1]-point.y >= (54+18+68)*scale(dot),'The goal halo cannot cover a point placed anywhere in the accepted tap area');
 el('individual-controls').children[0].dispatch('click');
 check(strokes(group).every(s=>!done(s)&&ink(s)===''),'Repeating clears the bar and its user-created dot');
}

// The painted demonstration includes the point but never awards either part.
{
 const el=setup(1920,1080);select(el,T.catalog.findIndex(t=>t.id==='bars-dots'));
 const group=groups(el)[0],[bar,dot]=strokes(group);
 el.frame(0);el.frame(13000);el.frame(14000);el.frame(14500);
 check(child(bar,'demo-ink').getAttribute('d').length>10&&child(dot,'demo-ink').getAttribute('d').length>10,'The demonstration paints both the bar and the point in order');
 check(strokes(group).every(s=>ink(s)===''&&!done(s)),'Demonstrated parts remain pending for the child');
 el.frame(15000);el.frame(16000);
 check(el.pendingFrames()===0&&strokes(group).every(s=>child(s,'demo-ink').getAttribute('d')!==''),'The full painted example remains after the demonstration');
 el('play-demo').dispatch('click');
 check(child(dot,'demo-ink').getAttribute('d')==='','Replaying clears the previous example point');
 el('practice').dispatch('click');
 check(groups(el).every(g=>strokes(g).every(s=>child(s,'demo-ink').getAttribute('d')==='')),'Practice starts without teacher preview ink');
}

// Nearby vertex sampling is allowed, but taking a straight shortcut is not.
for(const id of ['triangle','castle','zigzag','surf-wave']) {
 const el=setup(1920,1080);el('practice').dispatch('click');select(el,T.catalog.findIndex(t=>t.id===id));
 const stroke=strokes(groups(el)[0])[0],m=model(stroke);
 const shortcut=id==='surf-wave' ? {x:(m.points[0].x+m.points.at(-1).x)/2,y:m.points[0].y} : G.at(m,m.length*0.5);
 send(el,'pointerdown',m.points[0]);send(el,'pointermove',shortcut);send(el,'pointermove',m.points.at(-1));send(el,'pointerup',m.points.at(-1));
 check(!done(stroke),`${id}: crossing the interior cannot complete the path`);
 gesture(el,stroke);
 check(done(stroke),`${id}: following the corners completes the path`);
}
// Easy/hard behavior, stationary hints, and independent failure handling.
for(const type of ['mouse','touch','pen']) {
 const easy=setup(1920,1080);easy('practice').dispatch('click');
 check(easy('help').getAttribute('aria-pressed')==='true','Easy is the default difficulty');
 const group=groups(easy)[0],stroke=strokes(group)[0],m=model(stroke),origin=child(stroke,'origin'),direction=child(origin,'direction');
 const position=origin.getAttribute('transform'),angle=direction.getAttribute('transform');
 gesture(easy,stroke,type,0,0.25);
 const prefix=ink(stroke);
 gesture(easy,stroke,type,0.7,1);
 check(ink(stroke).startsWith(prefix)&&!done(stroke),'Easy permits a later contact while preserving the unpainted gap');
 check(origin.getAttribute('transform')===position&&direction.getAttribute('transform')===angle,'The hint never follows the finger or continuation point');
 gesture(easy,stroke,type,0.25,0.75);gesture(easy,stroke,type,0.9,1);
 check(done(stroke),'Filling the missing region and reaching the goal completes Easy');
 easy('clear').dispatch('click');
 send(easy,'pointerdown',m.points[0],1,type);send(easy,'pointermove',G.at(m,m.length*0.2),1,type);
 const before=ink(stroke);
 send(easy,'pointermove',{x:m.points[0].x+200,y:G.at(m,m.length*0.2).y},1,type);
 check(stroke.classList.contains('off-path'),'Easy highlights the border on exit');
 const outsideInk=ink(stroke);send(easy,'pointermove',{x:m.points[0].x+210,y:G.at(m,m.length*0.4).y},1,type);
 check(ink(stroke)===outsideInk&&ink(stroke).startsWith(before),'Moving outside adds no ink and keeps the previous drawing');
 stroke.dispatch('animationend',{animationName:'boundary-flash'});
 check(!stroke.classList.contains('off-path'),'The red border clears after its brief animation');
 send(easy,'pointercancel',m.points[0],1,type);
 const hard=setup(1920,1080,{saved:{difficulty:'hard'}});hard('practice').dispatch('click');
 const figures=groups(hard),a=strokes(figures[0])[0],b=strokes(figures[1])[0],pa=model(a),pb=model(b);
 send(hard,'pointerdown',pa.points[0],1,type);send(hard,'pointermove',G.at(pa,pa.length*0.2),1,type);
 send(hard,'pointerdown',pb.points[0],2,'touch');send(hard,'pointermove',G.at(pb,pb.length*0.2),2,'touch');
 const neighbour=ink(b);
 send(hard,'pointermove',{x:pa.points[0].x+200,y:G.at(pa,pa.length*0.25).y},1,type);
 check(ink(a)===''&&!done(a)&&!hard('board').hasPointerCapture(1),'Hard immediately resets the figure when leaving the corridor');
 check(ink(b)===neighbour&&hard('board').hasPointerCapture(2),'Hard failure preserves the other child ink and contact');
 gesture(hard,a,type,0.5,1);
 check(ink(a)===''&&!done(a),'After a Hard failure the next contact must start at the original hint');
 gesture(hard,a,type);
 check(done(a),'Hard can be completed by tracing from the beginning');
}

// Losing a later Hard component resets the full figure, not its neighbours.
{
 const el=setup(1920,1080,{saved:{difficulty:'hard'}});el('practice').dispatch('click');select(el,T.catalog.findIndex(t=>t.id==='cross'));
 const group=groups(el)[0],[a,b]=strokes(group);
 gesture(el,a);const p=model(b).points[0];send(el,'pointerdown',p);send(el,'pointermove',{x:p.x+200,y:p.y});
 check(strokes(group).every(s=>!done(s)&&ink(s)===''),'Hard restarts both lines of an unfinished X after an exit');
}

// Rendering masks confine the entire brush, not just the pointer centre.
{
 const el=setup(1920,1080);el('practice').dispatch('click');const ids=new Set();
 for(const group of groups(el))for(const stroke of strokes(group)) {
   const mask=stroke.children.find(n=>n.tag==='mask'),id=mask.getAttribute('id');
   check(!ids.has(id)&&child(stroke,'ink').getAttribute('mask')===`url(#${id})`&&child(stroke,'demo-ink').getAttribute('mask')===`url(#${id})`,'Each figure clips both ink layers to its own SVG mask');ids.add(id);
 }
}

// Real background loading is local, persistent, and optional when storage fails.
{
 const data='data:image/png;base64,AQ==',el=setup();
 const previous=child(strokes(groups(el)[0])[0],'track').getAttribute('d');
 el('background-file').files=[{type:'image/png',size:40,data}];el('background-file').dispatch('change');
 check(el('exercise').style.backgroundImage===`url("${data}")`&&el.storage.get('trazos.background.v1')===data,'A selected PNG becomes the background and is saved locally');
 check(child(strokes(groups(el)[0])[0],'track').getAttribute('d')===previous,'Applying a background does not reset or move the exercise');
 const restored=setup(1920,1080,{background:data});check(restored('exercise').style.backgroundImage===`url("${data}")`,'The saved background is restored');
 const denied=setup(1920,1080,{storageDenied:true});denied('background-file').files=[{type:'image/png',size:40,data}];denied('background-file').dispatch('change');
 check(denied('exercise').style.backgroundImage===`url("${data}")`&&denied('background-status').textContent==='Fondo para esta sesión','A background still works when storage is denied');
 const invalid=setup(1920,1080,{imageFails:true});invalid('background-file').files=[{type:'image/png',size:40,data}];invalid('background-file').dispatch('change');
 check(!invalid('exercise').style.backgroundImage,'An undecodable image cannot replace the background');
 el('background-file').files=[{type:'text/plain',size:40,data}];el('background-file').dispatch('change');
 check(el('exercise').style.backgroundImage===`url("${data}")`,'Non-image files preserve the current background');
 const legacy=setup(1920,1080,{legacy:{heightRatio:0.6,assisted:false}});
 check(legacy('help').getAttribute('aria-pressed')==='true','Old continuous-gesture preferences migrate to the new Easy default');
}
console.log(`${checks} checks passed: ${T.catalog.length} families, five classroom improvements and three simultaneous contacts (simulated DOM).`);
