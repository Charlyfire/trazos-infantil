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
      releasePointerCapture(id){captures.delete(id);this.dispatch('lostpointercapture',{pointerId:id});},focus(){},
    };
  }
  const el=id=>{if(!ids.has(id)){const item=node();item.hidden=['exercise','completed','settings-panel'].includes(id);ids.set(id,item);}return ids.get(id);};
  const document=el('document');document.querySelector=selector=>el(selector.slice(1));document.createElementNS=(_,tag)=>node(tag);document.createElement=node;
  const frames=new Map();let nextFrame=1;
  const window=el('window');
  window.matchMedia=()=>({matches:options.reducedMotion||false});
  const storage=new Map(options.saved? [['trazos.preferences.v1',JSON.stringify(options.saved)]]:[]);
  window.localStorage=options.storageDenied ? {getItem(){throw new Error('Storage unavailable');},setItem(){throw new Error('Storage unavailable');}}
    : {getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  const context=vm.createContext({document,window,requestAnimationFrame:fn=>{const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
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
  return G.createPath(points);
}
const scale=stroke=>Number(child(stroke,'track').getAttribute('stroke-width'))/100;
function send(el,name,point,id=1,type='mouse',extra={}) {
  return el('board').dispatch(name,{clientX:point.x,clientY:point.y,pointerId:id,pointerType:type,isPrimary:id===1,...extra});
}
function select(el,index){el('template').value=String(index);el('template').dispatch('change');}
function gesture(el,stroke,type='mouse',start=0,end=1,id=1) {
  const m=model(stroke);send(el,'pointerdown',G.at(m,m.length*start),id,type);
  const count=Math.ceil(m.length*(end-start)/(3*scale(stroke)));
  for(let i=1;i<=count;i++)send(el,'pointermove',G.at(m,m.length*(start+(end-start)*i/count)),id,type);
  send(el,'pointerup',G.at(m,m.length*end),id,type);
}

if (!process.argv.includes('--features-only')) {
for(const dimensions of [[1280,720],[1920,1080],[375,667],[844,390],[320,320]]) {
  for(const mode of ['demo','practice'])for(const type of ['mouse','touch','pen']) {
    const el=setup(...dimensions);el(mode).dispatch('click');
    check(el('template').children.length===14,'All 14 families are available');
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
  check(ink(stroke)===before&&!done(stroke),'Off-path movement cannot bridge an untraced gap');
  send(el,'pointermove',point(0.28),1,type);for(let i=29;i<=100;i++)send(el,'pointermove',point(i/100),1,type);
  check(done(stroke),'Can reconnect behind the frontier');
  el('clear').dispatch('click');gesture(el,stroke,type,0,0.4);gesture(el,stroke,type,0.4,1);
  check(!done(stroke),'Lifting forces a new start');
  send(el,'pointerdown',point(0),1,type);send(el,'pointermove',point(0.3),1,type);send(el,'pointercancel',point(0.3),1,type);send(el,'pointermove',point(1),1,type);
  check(!done(stroke),'Cancelled contact cannot finish');
}

// Closed loops must actually be walked around, even though start equals end.
for(const id of ['circle','double-circle','circle-plus']) {
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
  if(strokes(group).length>1){check(!done(group),'Circle component alone cannot complete a multi-part figure');const second=strokes(group)[1];gesture(el,second,'mouse',0,0.35);gesture(el,second,'mouse',0.35,1);check(!done(second)&&done(stroke),'Restarting a later component retains completed earlier strokes');}
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
    gesture(el,stroke,type,0.5);
    check(!done(stroke)&&ink(stroke)==='','Help still requires the initial start');
    gesture(el,stroke,type,0,0.35);
    const before=ink(stroke),m=model(stroke);
    check(child(stroke,'origin').getAttribute('data-resume')==='true','Help shows a continuation marker after lifting');
    send(el,'pointerdown',G.at(m,m.length*0.85),1,type);
    send(el,'pointermove',m.points.at(-1),1,type);
    send(el,'pointerup',m.points.at(-1),1,type);
    check(ink(stroke)===before&&!done(stroke),'Help cannot resume ahead or skip a gap');
    gesture(el,stroke,type,0.35,1);
    check(done(stroke)&&ink(stroke).startsWith(before),'Help preserves the previous trace and completes after resuming');
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
 const saved=JSON.parse(el.storage.get('trazos.preferences.v1'));
 check(saved.heightRatio===0.6&&saved.assisted===true,'Height and help are saved on the device');
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

// A slow demonstration only moves a guide, never paints or awards completion.
{
 const el=setup(1920,1080),group=groups(el)[0],stroke=strokes(group)[0];
 const dot=el('board').children.find(node=>node.getAttribute('class')==='demo-point');
 const y0=Number(dot.getAttribute('cy'));
 check(el('exercise').getAttribute('data-demonstrating')==='true','Demo plays once on entering demonstration');
 el.frame(0);el.frame(2500);
 check(Number(dot.getAttribute('cy'))>y0,'The guide advances slowly along the path');
 check(ink(stroke)===''&&!done(group),'Animation never paints a child trace or completes a figure');
 el.frame(13000);el.frame(15000);
 check(el.pendingFrames()===0&&dot.getAttribute('data-visible')==='false','Demo stops after its single pass');
 el('play-demo').dispatch('click');check(el.pendingFrames()===1,'Teacher can replay the demonstration');
 send(el,'pointerdown',model(stroke).points[0]);
 check(el.pendingFrames()===0,'A real contact cancels the animated guide');
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
console.log(`${checks} checks passed: 14 families, five classroom improvements and three simultaneous contacts (simulated DOM).`);
