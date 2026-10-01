const {test} = require('node:test');
const assert = require('node:assert/strict');
require('../assets/treino-session.js');
const {totals,defaults,removeDate} = globalThis.TrainingSession;

test('Muscle Round counts six sets of 32 reps and their complete volume', ()=>{
  const stages=defaults([{etapa:'Muscle Round',sr:'6 x 32'}],20,{feederPct:70,backoffPct:25});
  assert.deepEqual(totals(stages),{sets:6,reps:192,volume:3840});
});
test('counts feeder, top set and back-off independently', ()=>{
  assert.deepEqual(totals([
    {sets:3,reps:10,weight:70}, {sets:1,reps:6,weight:100}, {sets:2,reps:8,weight:75}
  ]),{sets:6,reps:52,volume:3900});
  assert.equal(totals([{sets:1,reps:0,weight:10}]),null);
  assert.equal(totals([{sets:1.5,reps:8,weight:10}]),null);
  assert.equal(totals([{sets:1,reps:8,weight:-10}]),null);
});
test('ranges do not invent actual repetitions; feeder and back-off use configured loads', ()=>{
  const stages=defaults([
    {etapa:'Feeder',calc:'feeder',sr:'2-3 séries progressivas'},
    {etapa:'Top set',calc:'top',sr:'1 x 5-9'},
    {etapa:'Back-off',calc:'backoff',sr:'2 x 9-15'}
  ],100,{feederPct:70,backoffPct:25});
  assert.deepEqual(stages.map(s=>s.weight),[70,100,75]);
  assert.deepEqual(stages.map(s=>s.sets),[2,1,2]);
  assert.deepEqual(stages.map(s=>s.reps),[null,null,null]);
});
function storage(){
  const data=new Map([
    ['a:hist:seg:0',JSON.stringify([{date:'01/10/2026'},{date:'30/09/2026'}])],
    ['a:hist:qui:1',JSON.stringify([{date:'01/10/2026'}])],
    ['a:top:seg:0','100'],
    ['b:hist:seg:0',JSON.stringify([{date:'01/10/2026'}])]
  ]);
  return {data,get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
}
test('deleting a date removes only matching history in the current workout', ()=>{
  const store=storage();
  assert.equal(removeDate(store,'a:','01/10/2026'),2);
  assert.deepEqual(JSON.parse(store.getItem('a:hist:seg:0')),[{date:'30/09/2026'}]);
  assert.equal(store.getItem('a:hist:qui:1'),'[]');
  assert.equal(store.getItem('a:top:seg:0'),'100');
  assert.equal(JSON.parse(store.getItem('b:hist:seg:0')).length,1);
});
test('failed date deletion rolls back previous writes', ()=>{
  const store=storage(); const before=[...store.data];
  const write=store.setItem; let count=0;
  store.setItem=(k,v)=>{if(++count===2)throw Error('Storage failure');write(k,v);};
  assert.throws(()=>removeDate(store,'a:','01/10/2026'));
  assert.deepEqual([...store.data],before);
});

test('editor keeps stage selections independent and requires exact reps below eight', ()=>{
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.events={};this.classList={toggle(){}};}
    append(...children){this.children.push(...children);}
    appendChild(child){this.append(child);}
    setAttribute(key,value){this[key]=value;}
    removeAttribute(key){delete this[key];}
    addEventListener(event,callback){const previous=this.events[event];this.events[event]=()=>{if(previous)previous();callback();};}
    focus(){}
    reportValidity(){}
    checkValidity(){return this.value !== '' && Number(this.value)>=Number(this.min) && (!this.max || Number(this.value)<=Number(this.max));}
  }
  globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>({text})};
  try{
    const editor=globalThis.TrainingSession.createEditor([
      {etapa:'Feeder',calc:'feeder',sr:'2 x 10'},
      {etapa:'Top set',calc:'top',sr:'1 x 6'},
      {etapa:'Back-off',calc:'backoff',sr:'1 x 10'}
    ],100,{feederPct:70,backoffPct:25});
    const rows=editor.element.children.slice(0,3);
    for(const row of rows){assert.equal(row.tag,"details");assert(!row.open);assert.match(row.children[0].children[1].textContent,/Preenchida/);}
    const [feeder,top,backoff]=rows.map(row=>row.children[1]);
    feeder.children[2].children.find(button=>button.textContent===3).onclick();
    top.children[2].children.find(button=>button.textContent===9).onclick();
    backoff.children[2].children.find(button=>button.textContent==='<8').onclick();
    assert.equal(editor.read(),null);
    assert.equal(rows[2].open,true);
    assert.match(rows[2].children[0].children[1].textContent,/Pendente/);
    backoff.children[1].children[1].children[0].value='7';
    assert.deepEqual(editor.read().map(s=>[s.sets,s.reps]),[[3,10],[1,9],[1,7]]);
    const backoffLoad=backoff.children[1].children[2].children[0];
    backoffLoad.value='65'; backoffLoad.events.input();
    editor.setWeight(120);
    assert.deepEqual(editor.read().map(s=>Number(s.weight)),[84,120,65]);
  }finally{delete globalThis.document;}
});

test('exported HTML embeds the current session and chart modules with valid scripts', ()=>{
  const fs=require('node:fs'); const path=require('node:path'); const vm=require('node:vm');
  const html=fs.readFileSync(path.join(__dirname,'../exports/metodo-usa2x-outro-site.html'),'utf8');
  for(const file of ['treino-session.js','treino-progress.js']){
    const module=fs.readFileSync(path.join(__dirname,'../assets',file),'utf8');
    assert(html.includes(module));
  }
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
