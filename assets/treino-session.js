(function(root){
  const positive = value => Number.isFinite(value) && value > 0;
  function totals(stages){
    if(!Array.isArray(stages) || !stages.length) return null;
    let reps=0, sets=0, volume=0;
    for(const stage of stages){
      if(!stage || !Number.isInteger(stage.sets) || stage.sets < 1 ||
        !Number.isInteger(stage.reps) || stage.reps < 1 || !positive(stage.weight)) return null;
      sets += stage.sets;
      reps += stage.sets * stage.reps;
      volume += stage.weight * stage.sets * stage.reps;
    }
    return {sets, reps, volume};
  }

  function defaults(steps, weight, settings){
    return steps.map(step=>{
      const kind = ['feeder','top','backoff'].includes(step.calc) ? step.calc : 'work';
      const pair = /^\s*(\d+)\s*[x×]\s*(\d+)\s*(?:\([^)]*\))?\s*$/.exec(step.sr || '');
      const setMatch = /^\s*(\d+)\s*[x×]/.exec(step.sr || '');
      const factor = kind === 'feeder' ? settings.feederPct/100 : kind === 'backoff' ? 1-settings.backoffPct/100 : 1;
      return {
        kind,
        name:kind === 'top' ? 'Top set' : kind === 'backoff' ? 'Back-off' : kind === 'feeder' ? 'Feeder' : step.etapa || 'Série válida',
        sets:kind === 'feeder' ? 2 : setMatch ? Number(setMatch[1]) : null,
        reps:pair ? Number(pair[2]) : null,
        weight:positive(weight) ? Math.round(weight * factor * 100)/100 : null,
        factor, enabled:true, manualWeight:false
      };
    });
  }

  function createEditor(steps, weight, settings){
    const element = document.createElement('div');
    element.className = 'session-editor';
    const rows = [];
    for(const stage of defaults(steps, weight, settings)){
      const row = document.createElement('div');
      row.className = `session-stage session-${stage.kind}`;
      const title = document.createElement('label');
      title.className = 'session-title';
      const enabled = document.createElement('input');
      enabled.type = 'checkbox'; enabled.checked = true;
      title.append(enabled, document.createTextNode(stage.name));
      row.appendChild(title);
      const fields = document.createElement('div');
      fields.className = 'session-fields';
      function field(label, value, step){
        const wrap = document.createElement('label');
        wrap.textContent = label;
        const input = document.createElement('input');
        input.type = 'number'; input.min = step === '1' ? '1' : '0.01'; input.step = step;
        input.inputMode = step === '1' ? 'numeric' : 'decimal';
        input.value = value ?? ''; input.placeholder = 'Informe';
        input.setAttribute('aria-label', `${stage.name}: ${label}`);
        wrap.appendChild(input); fields.appendChild(wrap);
        return input;
      }
      const sets = field('Séries', stage.sets, '1');
      const reps = field('Repetições por série', stage.reps, '1');
      const load = field('Carga por série (kg)', stage.weight, '0.01');
      load.addEventListener('input', ()=>{stage.manualWeight = true;});
      row.appendChild(fields);
      function chips(label, values, input){
        const group = document.createElement('div');
        group.className = 'session-chips';
        group.setAttribute('role','group');
        group.setAttribute('aria-label', `${stage.name}: ${label}`);
        const caption = document.createElement('span');
        caption.className = 'session-caption'; caption.textContent = label;
        group.appendChild(caption);
        const buttons = values.map(value=>{
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = value;
          button.onclick = ()=>{
            if(value === '<8'){
              input.value = ''; input.placeholder = '1 a 7'; input.max = '7'; input.focus();
            }else{
              input.removeAttribute('max'); input.placeholder = 'Informe'; input.value = value;
            }
            update();
          };
          group.appendChild(button);
          return {button,value};
        });
        function update(){
          for(const {button,value} of buttons){
            const selected = value === '<8' ? Number(input.value) > 0 && Number(input.value) < 8 : Number(input.value) === value;
            button.classList.toggle('sel',selected);
            button.setAttribute('aria-pressed',String(selected));
          }
        }
        input.addEventListener('input',update); update(); row.appendChild(group);
      }
      if(stage.kind === 'feeder') chips('Séries', [2,3], sets);
      chips('Repetições', stage.kind === 'backoff' ? ['<8',8,9,10,11,12,13,14,15] : Array.from({length:12},(_,i)=>i+4), reps);
      enabled.addEventListener('change', ()=>{
        row.classList.toggle('session-disabled',!enabled.checked);
        for(const input of [sets,reps,load]) input.disabled = !enabled.checked;
        row.querySelectorAll('button').forEach(button=>{button.disabled = !enabled.checked;});
      });
      rows.push({stage,enabled,sets,reps,load});
      element.appendChild(row);
    }
    const note = document.createElement('p');
    note.className = 'session-note';
    note.textContent = 'Ajuste cada etapa realizada. Os atalhos vão de 4 a 15; o campo aceita outros valores. Séries com repetições e cargas diferentes devem ser cadastradas como etapas separadas na edição do exercício.';
    element.appendChild(note);
    return {
      element,
      setWeight(value){
        for(const {stage,load} of rows){
          if(!stage.manualWeight) load.value = positive(value) ? Math.round(value * stage.factor * 100)/100 : '';
        }
      },
      read(){
        for(const row of rows){
          if(row.enabled.checked && [row.sets,row.reps,row.load].some(input=>!input.checkValidity())) return null;
        }
        const stages = rows.filter(row=>row.enabled.checked).map(({stage,sets,reps,load})=>({
          kind:stage.kind, name:stage.name, sets:Number(sets.value), reps:Number(reps.value), weight:Number(load.value)
        }));
        return totals(stages) ? stages : null;
      }
    };
  }

  function removeDate(storage, prefix, date){
    const changes = [];
    for(let i=0;i<storage.length;i++){
      const key = storage.key(i);
      if(!key || !key.startsWith(prefix+'hist:')) continue;
      const previous = storage.getItem(key);
      const entries = JSON.parse(previous);
      if(!Array.isArray(entries)) throw new Error('Histórico inválido');
      const remaining = entries.filter(entry=>entry?.date !== date);
      if(remaining.length !== entries.length) changes.push({key,previous,next:JSON.stringify(remaining)});
    }
    const written = [];
    try{
      for(const change of changes){ storage.setItem(change.key,change.next); written.push(change); }
    }catch(error){
      for(const change of written.reverse()) storage.setItem(change.key,change.previous);
      throw error;
    }
    return changes.length;
  }
  root.TrainingSession = {totals, defaults, createEditor, removeDate};
})(typeof window === 'undefined' ? globalThis : window);
