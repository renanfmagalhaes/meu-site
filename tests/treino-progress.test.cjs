const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../assets/treino-progress.js');
const {aggregate, render} = globalThis.TrainingProgress;

test('groups dates chronologically and calculates separate averages', ()=>{
  const days = aggregate([
    {date:'01/10/2026', weight:100, reps:9, unit:'kg'},
    {date:'30/09/2026', weight:40, reps:4, unit:'kg'},
    {date:'30/09/2026', weight:80, reps:8, unit:'kg'},
    {date:'30/09/2026', weight:30, dor:5, unit:'kg'},
    {date:'30/09/2026', weight:20, reps:5, unit:'min'}
  ]);
  assert.deepEqual(days.map(d=>d.date), ['30/09/2026','01/10/2026']);
  assert.equal(days[0].weight, 150);
  assert.equal(days[0].reps, 12);
  assert.equal(days[0].averageReps, 6);
  assert.equal(days[0].averageWeight, 50);
});

test('missing reps remain unknown and invalid data is ignored', ()=>{
  const days = aggregate([
    {date:'30/09/2026', weight:40, reps:null, unit:'kg'},
    {date:'31/02/2026', weight:40, reps:5, unit:'kg'},
    {date:'30/09/2026', weight:-40, reps:5, unit:'kg'},
    null
  ]);
  assert.equal(days.length, 1);
  assert.equal(days[0].reps, null);
  assert.equal(days[0].averageReps, null);
  assert.equal(days[0].averageWeight, 40);
});

test('renders empty state and four bar panels with one bar per day', ()=>{
  class Element {
    constructor(){ this.children=[]; this.style={}; }
    append(...items){ this.children.push(...items); }
    appendChild(item){ this.append(item); }
    replaceChildren(){ this.children=[]; }
    setAttribute(){}
  }
  globalThis.document = {createElement:()=>new Element()};
  const container = new Element();
  render(container, []);
  assert.equal(container.children[0].className, 'progress-empty');
  render(container, [
    {date:'30/09/2026', weight:40, reps:4, unit:'kg'},
    {date:'01/10/2026', weight:80, reps:8, unit:'kg'}
  ]);
  const panels = container.children[0].children[0].children;
  assert.equal(panels.length, 4);
  for(const panel of panels) assert.equal(panel.children[1].children.length, 2);
  delete globalThis.document;
});

for(const file of ['hipertrofia-avancado.html','metodo-usa2x.html']){
  test(`${file}: persistent history, cardio exclusion and exercise deletion`, async ()=>{
    const html = fs.readFileSync(path.join(__dirname,'../treinos',file),'utf8');
    for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
    const data = new Map();
    let chartRecords;
    const context = {
      LS_PREFIX:'test:',
      DAYS:{seg:{exercises:[{tier:'composto'}, {tier:'cardio'}]}},
      localStorage:{get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k)},
      lsGet:k=>data.get('test:'+k),
      lsSet:(k,v)=>{data.set('test:'+k,v);return true;},
      document:{getElementById:()=>({})},
      TrainingProgress:{render:(_,records)=>{chartRecords=records;}},
      console
    };
    vm.createContext(context);
    for(const name of ['histKey','customKey','addedKey','loadHist','pushHist','renderProgress']){
      const match = html.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
      // The key helpers are single-line functions.
      const source = name.endsWith('Key') ? html.match(new RegExp(`function ${name}[^\\n]+`))[0] : match[0];
      vm.runInContext(source,context);
    }
    for(let i=1;i<=9;i++) await context.pushHist('seg','0',{date:`0${i}/09/2026`,weight:40,reps:6});
    assert.equal((await context.loadHist('seg','0')).length,9);
    await context.pushHist('seg','1',{date:'09/09/2026',weight:30,reps:4});
    context.renderProgress();
    assert.equal(aggregate(chartRecords).length,9);
    assert.equal(aggregate(chartRecords)[8].weight,40);
    context.lsSet('hist:seg:0','[]');
    context.renderProgress();
    assert.equal(aggregate(chartRecords).length,0);
    assert.equal((await context.loadHist('seg','1')).length,1);
  });
}
