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
