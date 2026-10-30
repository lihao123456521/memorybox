import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';

// CPU-only checks of the actual source functions and floor plans. No browser,
// mocked renderer, clock mutation or generated production files are involved.
const scenes=resolve(dirname(fileURLToPath(import.meta.url)),'../src/scenes');
const read=async name=>readFile(resolve(scenes,name),'utf8');
const ast=source=>ts.createSourceFile('source.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
async function moduleFrom(source){
  const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
  return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));
}
function declaration(source,name){
  const file=ast(source);
  const statement=file.statements.find(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===name));
  assert(statement,`Missing production declaration ${name}`);
  const text=statement.getText(file);return /^export\b/.test(text)?text:'export '+text;
}
const actionsSource=await read('StoryActions.tsx'),actionsFile=ast(actionsSource);
const actions=await moduleFrom(actionsFile.statements.filter(s=>!ts.isImportDeclaration(s)&&!(ts.isFunctionDeclaration(s)&&s.name?.text==='StoryCompanion')).map(s=>s.getText(actionsFile)).join('\n'));
const nav=await moduleFrom(await read('navigation.ts'));
const prelude=`const COMPANION_ORIGINS=${JSON.stringify(actions.COMPANION_ORIGINS)};const companionFootprint=${actions.companionFootprint.toString()};`;
const homeSource=await read('Room.tsx'),classSource=await read('Classroom.tsx'),stationSource=await read('Station.tsx');
const home=await moduleFrom(prelude+['SCENE_ZONES','WALK_COLLIDERS'].map(name=>declaration(homeSource,name)).join('\n'));
const classroom=await moduleFrom(prelude+['desks','CLASSROOM_LAYOUT'].map(name=>declaration(classSource,name)).join('\n'));
const station=await moduleFrom(prelude+['COACH_BAYS','COACH_ROWS','STATION_LAYOUT'].map(name=>declaration(stationSource,name)).join('\n'));
const layouts={
  'old-home':{zones:home.SCENE_ZONES,colliders:home.WALK_COLLIDERS,start:[0,1.64,2.5]},
  classroom:classroom.CLASSROOM_LAYOUT,station:station.STATION_LAYOUT,
};
const branchProps=branch=>({phase:`${branch}-branch`,branch,realDeparture:true});
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
let actionSamples=0;
for(const [template,layout]of Object.entries(layouts)){
  const origin=actions.COMPANION_ORIGINS[template],footprint=actions.companionFootprint(template);
  assert.deepEqual(layout.colliders.at(-1),footprint,`${template}: NPC footprint must match the actual exploration actor`);
  assert(!nav.canStand(origin[0],origin[2],layout.colliders,layout),`${template}: player can stand inside companion`);
  assert(nav.canStand(origin[0]+.6,origin[2],layout.colliders,layout),`${template}: companion blocks its clear side lane`);
  // The last collider is the standing actor itself, not scenery to collide with
  // while that same actor follows a story route under locked navigation.
  const scenery=layout.colliders.slice(0,-1);
  for(const branch of ['real','imagined']){
    const props=branchProps(branch);let previous=actions.companionAction(template,props,0).position;
    for(let t=0;t<=24;t+=.05){
      const action=actions.companionAction(template,props,t),[x,,z]=action.position;actionSamples++;
      assert(action.position.every(Number.isFinite),`${template}: non-finite actor position`);
      assert(distance(previous,action.position)<.13,`${template}/${branch}: actor teleported at ${t.toFixed(2)}s`);
      for(const c of scenery){
        const cx=Math.max(c.xMin,Math.min(x,c.xMax)),cz=Math.max(c.zMin,Math.min(z,c.zMax));
        assert(Math.hypot(x-cx,z-cz)>=.27,`${template}/${branch}: actor intersects scenery at ${t.toFixed(2)}s`);
      }
      previous=action.position;
    }
  }
  const neutral={phase:'real-branch',branch:'real',realDeparture:false};
  for(let t=0;t<=24;t+=.1){const action=actions.companionAction(template,neutral,t);assert.deepEqual(action.position,origin,`${template}: unconfirmed departure`);assert(!['walk','wave'].includes(action.motion),`${template}: invented physical goodbye`);}
}
assert(!nav.canStand(-2.35,-1.6,layouts['old-home'].colliders,layouts['old-home']),'The original side-table collider was removed');

for(const branch of ['real','imagined']){
  let previous=0;let signalObserved=false;let movementObserved=false;
  for(let t=0;t<=24;t+=.05){
    const action=actions.trainAction(branchProps(branch),t);
    signalObserved||=action.signal;
    if(action.offset<-.001){movementObserved=true;assert(signalObserved,'Train moved before the departure signal');assert(action.door>.99,'Train departed with an open boarding door');}
    assert(action.offset<=previous+.00001,'Train unexpectedly reversed or jumped back');
    assert(Math.abs(action.offset-previous)<.5,'Train displacement is discontinuous');previous=action.offset;
    assert.equal(actions.trainAction({phase:'exploration',branch,realDeparture:true},t).offset,0,'Train moved during exploration');
    assert.equal(actions.trainAction({phase:'real-branch',branch:'real',realDeparture:false},t).offset,0,'Custom neutral route invented a train departure');
  }
  assert(movementObserved,`${branch}: train never departed`);
}
const actualStart=Array.from({length:480},(_,i)=>i*.05).find(t=>actions.trainAction(branchProps('real'),t).offset<-.01);
const imaginedStart=Array.from({length:480},(_,i)=>i*.05).find(t=>actions.trainAction(branchProps('imagined'),t).offset<-.01);
assert(imaginedStart>actualStart+2,'Imagined goodbye did not preserve additional waiting time');
const pausedClock={current:{time:4.2,playing:false,revision:1}};
assert.equal(actions.readStoryTime({storyClock:pausedClock,storyTime:99}),4.2,'Actors must use the shared clock, not a stale React time');
assert.equal(actions.readStoryPlaying({storyClock:pausedClock,storyPlaying:true}),false,'Playback pause must use the shared clock');

const targets={'old-home':[[-1.5,-4],[5.4,0],[-5.3,-2.65],[-4.5,-4.5]],classroom:[[0,-4.9],[.8,-1.6],[6.5,3.9]],station:[[6.9,0],[0,-15],[-3.4,7]]};
let reachableTargets=0;
for(const [template,layout]of Object.entries(layouts)){
  const step=.15,minX=Math.min(...layout.zones.map(z=>z.xMin)),minZ=Math.min(...layout.zones.map(z=>z.zMin));
  const width=Math.ceil((Math.max(...layout.zones.map(z=>z.xMax))-minX)/step)+1,depth=Math.ceil((Math.max(...layout.zones.map(z=>z.zMax))-minZ)/step)+1;
  const cell=(x,z)=>[Math.round((x-minX)/step),Math.round((z-minZ)/step)];
  const start=cell(layout.start[0],layout.start[2]),queue=[start],seen=new Set([start.join(',')]);
  for(let q=0;q<queue.length;q++){
    const [ix,iz]=queue[q];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=ix+dx,nz=iz+dz,key=`${nx},${nz}`;
      if(nx<0||nz<0||nx>=width||nz>=depth||seen.has(key))continue;
      if(!nav.canStand(minX+nx*step,minZ+nz*step,layout.colliders,layout))continue;
      seen.add(key);queue.push([nx,nz]);
    }
  }
  for(const target of targets[template]){assert(seen.has(cell(...target).join(',')),`${template}: exploration route blocked to ${target}`);reachableTargets++;}
}

// Read the actual note group's declared placement and ensure a physical desk
// supports it. This catches the earlier extra paper above the central aisle.
let notePosition;
const classFile=ast(classSource);
const numeric=node=>ts.isNumericLiteral(node)?Number(node.text):ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.MinusToken?-numeric(node.operand):NaN;
function visit(node){
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
    const attributes=node.attributes.properties.filter(ts.isJsxAttribute);
    if(attributes.some(a=>a.name.getText(classFile)==='name'&&a.initializer&&ts.isStringLiteral(a.initializer)&&a.initializer.text==='graduation-thankyou-note')){
      const value=attributes.find(a=>a.name.getText(classFile)==='position')?.initializer;
      if(value&&ts.isJsxExpression(value)&&value.expression&&ts.isArrayLiteralExpression(value.expression))notePosition=value.expression.elements.map(numeric);
    }
  }
  ts.forEachChild(node,visit);
}visit(classFile);
assert(notePosition?.every(Number.isFinite),'Missing actual on-desk note placement');
assert(classroom.desks.some(({x,z})=>Math.abs(x-notePosition[0])<.3&&Math.abs(z-notePosition[2])<.2),'Note is floating over an aisle instead of a desk');
assert(notePosition[1]>.76&&notePosition[1]<.84,'Note is not resting near its physical desktop');
console.log(JSON.stringify({passed:true,actionSamples,reachableTargets,checks:['continuous collision-free actor paths','neutral confirmed routes','occupied companion floor areas','ordered and continuous train departure','station exploration stays parked','shared pause clock','connected exploration lanes','physical desk supports note']},null,2));
