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
      const blocks = /^\s*(\d+)\s*séries de\s*(\d+)\s*x\s*(\d+)\s*$/.exec(step.sr || '');
      const factor = kind === 'feeder' ? settings.feederPct/100 : kind === 'backoff' ? 1-settings.backoffPct/100 : 1;
      return {
        kind,
        name:kind === 'top' ? 'Top set' : kind === 'backoff' ? 'Back-off' : kind === 'feeder' ? 'Feeder' : step.etapa || 'Série válida',
        sets:step.etapa === 'DC Style Rest-Pause' ? 1 : blocks ? Number(blocks[1]) : kind === 'feeder' ? 2 : setMatch ? Number(setMatch[1]) : null,
        reps:blocks ? Number(blocks[2]) * Number(blocks[3]) : pair ? Number(pair[2]) : null,
        weight:positive(weight) ? Math.round(weight * factor * 100)/100 : null,
        factor, enabled:true, manualWeight:false
      };
    });
  }

  function createEditor(steps, weight, settings){
    const element = document.createElement('div');
    element.className = 'session-editor';
    const mobileButtons = document.createElement('div');
    mobileButtons.className = 'session-mobile-buttons';
    element.appendChild(mobileButtons);
    const rows = [];
    for(const stage of defaults(steps, weight, settings)){
      const row = document.createElement('details');
      row.className = `session-stage session-${stage.kind}`;
      const toggle = document.createElement('summary');
      toggle.className = 'session-toggle';
      const name = document.createElement('span');
      name.textContent = stage.name;
      const status = document.createElement('span');
      status.className = 'session-status';
      const mobileButton = document.createElement('button');
      mobileButton.type = 'button';
      mobileButton.className = `session-mobile-button session-${stage.kind}`;
      const mobileName = document.createElement('span');
      mobileName.textContent = stage.name;
      const mobileStatus = document.createElement('span');
      mobileStatus.className = 'session-status';
      mobileButton.append(mobileName, mobileStatus);
      mobileButton.setAttribute('aria-expanded', 'false');
      mobileButton.onclick = ()=>{
        const open = !row.open;
        for(const item of rows) item.row.open = false;
        row.open = open;
      };
      row.addEventListener('toggle', ()=>{
        if(row.open && root.matchMedia?.('(max-width:760px)').matches){
          for(const item of rows) if(item.row !== row) item.row.open = false;
        }
        mobileButton.setAttribute('aria-expanded', String(row.open));
      });
      mobileButtons.appendChild(mobileButton);
      toggle.append(name,status);
      row.appendChild(toggle);
      const content = document.createElement('div');
      content.className = 'session-content';
      row.appendChild(content);
      const title = document.createElement('label');
      title.className = 'session-title';
      const enabled = document.createElement('input');
      enabled.type = 'checkbox'; enabled.checked = true;
      title.append(enabled, document.createTextNode('Incluir esta etapa'));
      content.appendChild(title);
      const fields = document.createElement('div');
      fields.className = 'session-fields';
      function field(label, value, step){
        const wrap = document.createElement('label');
        wrap.textContent = label;
        const input = document.createElement('input');
        input.type = 'number'; input.min = step === '1' ? '1' : '0.01'; input.step = step;
        input.inputMode = step === '1' ? 'numeric' : 'decimal';
        input.value = value ?? ''; input.placeholder = 'Informe'; input.required = true;
        input.setAttribute('aria-label', `${stage.name}: ${label}`);
        wrap.appendChild(input); fields.appendChild(wrap);
        return input;
      }
      const sets = field('Séries', stage.sets, '1');
      const reps = field('Repetições por série', stage.reps, '1');
      const load = field('Carga por série (kg)', stage.weight, '0.01');
      load.addEventListener('input', ()=>{stage.manualWeight = true;});
      content.appendChild(fields);
      function updateStatus(){
        const complete = [sets,reps,load].every(input=>input.checkValidity()) && totals([
          {sets:Number(sets.value),reps:Number(reps.value),weight:Number(load.value)}
        ]);
        status.textContent = !enabled.checked ? '— Desativada' : complete ? '✓ Preenchida' : '○ Pendente';
        mobileStatus.textContent = status.textContent;
        row.classList.toggle('session-complete',Boolean(complete && enabled.checked));
      }
      for(const input of [sets,reps,load]) input.addEventListener('input',updateStatus);
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
            updateStatus();
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
        input.addEventListener('input',update); update(); content.appendChild(group);
      }
      if(stage.kind === 'feeder') chips('Séries', [2,3], sets);
      chips('Repetições', [...(stage.kind === 'backoff' ? ['<8'] : []), ...Array.from({length:22},(_,i)=>i+4)], reps);
      enabled.addEventListener('change', ()=>{
        row.classList.toggle('session-disabled',!enabled.checked);
        for(const input of [sets,reps,load]) input.disabled = !enabled.checked;
        row.querySelectorAll('button').forEach(button=>{button.disabled = !enabled.checked;});
        updateStatus();
      });
      updateStatus();
      rows.push({stage,enabled,sets,reps,load,row,updateStatus});
      element.appendChild(row);
    }
    const note = document.createElement('p');
    note.className = 'session-note';
    note.textContent = 'Ajuste cada etapa realizada. Os atalhos vão de 4 a 25; o campo aceita outros valores. Séries com repetições e cargas diferentes devem ser cadastradas como etapas separadas na edição do exercício.';
    element.appendChild(note);
    return {
      element,
      setWeight(value){
        for(const {stage,load,updateStatus} of rows){
          if(!stage.manualWeight) load.value = positive(value) ? Math.round(value * stage.factor * 100)/100 : '';
          updateStatus();
        }
      },
      read(){
        for(const row of rows){
          if(row.enabled.checked){
            const invalid = [row.sets,row.reps,row.load].find(input=>!input.checkValidity());
            if(invalid){ row.row.open = true; invalid.reportValidity(); return null; }
          }
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
  function renderHistory(el, hist, describe, actions){
    el.replaceChildren();
    function button(text, handler, parent){
      const btn=document.createElement('button');
      btn.type='button'; btn.className='history-action'; btn.textContent=text; btn.onclick=handler;
      parent.appendChild(btn); return btn;
    }
    if(!hist?.length){
      const empty=document.createElement('div'); empty.className='hist-empty'; empty.textContent='Sem histórico ainda — salve a primeira sessão.';
      el.appendChild(empty); return;
    }
    const dates=[...new Set(hist.map(entry=>entry.date))].sort((a,b)=>b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
    async function commit(next){
      if(!await actions.save(next)){actions.toast('Não foi possível salvar a alteração. Tente novamente.');return false;}
      renderHistory(el,next,describe,actions); actions.refresh(); return true;
    }
    async function deleteDay(date){
      if(!confirm(`Apagar os registros de ${date} somente deste exercício?`)) return;
      const current=await actions.load();
      if(await commit(current.filter(entry=>entry.date!==date))) actions.toast('Dia apagado deste exercício');
    }
    for(const date of dates.slice(0,4)){
      const group=document.createElement('div'); group.className='history-day';
      const head=document.createElement('div'); head.className='history-day-head';
      const label=document.createElement('span'); label.textContent=date; head.appendChild(label);
      button('Apagar este dia',()=>deleteDay(date),head); group.appendChild(head);
      hist.forEach((entry,index)=>{
        if(entry.date!==date) return;
        const row=document.createElement('div'); row.className='history-record';
        const text=document.createElement('span'); text.textContent=describe(entry); row.appendChild(text);
        const editor=document.createElement('div'); editor.className='history-date-editor'; editor.hidden=true;
        const dateLabel=document.createElement('label'); dateLabel.textContent='Data do registro: ';
        const input=document.createElement('input'); input.type='date'; input.required=true;
        input.value=date.split('/').reverse().join('-'); dateLabel.appendChild(input); editor.appendChild(dateLabel);
        button('Salvar data',async()=>{
          if(!input.checkValidity()){input.reportValidity();return;}
          const newDate=input.value.split('-').reverse().join('/');
          const current=await actions.load();
          if(JSON.stringify(current[index])!==JSON.stringify(entry)){
            renderHistory(el,current,describe,actions);actions.toast('O histórico mudou. Edite o registro novamente.');return;
          }
          current[index]={...current[index],date:newDate};
          if(await commit(current)) actions.toast('Data atualizada');
        },editor);
        button('Cancelar',()=>{editor.hidden=true;},editor);
        button('Editar data',()=>{editor.hidden=!editor.hidden;if(!editor.hidden)input.focus();},row);
        row.appendChild(editor);group.appendChild(row);
      });
      el.appendChild(group);
    }
    const tools=document.createElement('div');tools.className='history-tools';
    const label=document.createElement('label');label.textContent='Apagar um dia deste exercício: ';
    const select=document.createElement('select');
    for(const date of dates){const option=document.createElement('option');option.value=date;option.textContent=date;select.appendChild(option);}
    label.appendChild(select);tools.appendChild(label);
    button('Apagar dia',()=>deleteDay(select.value),tools);
    button('Apagar todo o histórico deste exercício',async()=>{
      if(confirm('Apagar todo o histórico somente deste exercício?') && await commit([])) actions.toast('Histórico do exercício apagado');
    },tools);
    el.appendChild(tools);
  }
  root.TrainingSession = {totals, defaults, createEditor, removeDate, renderHistory};
})(typeof window === 'undefined' ? globalThis : window);
