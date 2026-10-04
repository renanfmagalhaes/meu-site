(function(root){
  function aggregate(records){
    const days = new Map();
    for(const entry of records){
      if(!entry || entry.unit !== 'kg') continue;
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(entry.date);
      if(!match) continue;
      const [, d, m, y] = match;
      const date = new Date(Number(y), Number(m)-1, Number(d));
      if(date.getFullYear() !== Number(y) || date.getMonth() !== Number(m)-1 || date.getDate() !== Number(d)) continue;
      const key = `${y}-${m}-${d}`;
      if(!days.has(key)) days.set(key, {key, date:entry.date, weight:0, reps:0, sets:0, count:0, pairedCount:0, incomplete:0});
      const day = days.get(key);
      day.count++;
      const totals = root.TrainingSession.totals(entry.stages);
      if(totals){
        day.weight += totals.volume;
        day.reps += totals.reps;
        day.sets += totals.sets;
        day.pairedCount++;
      }else{
        day.incomplete++;
      }
    }
    return [...days.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(day=>({
      ...day,
      weight:day.pairedCount ? day.weight : null,
      reps:day.pairedCount ? day.reps : null,
      loadPerRep:day.pairedCount ? day.weight / day.reps : null
    }));
  }


  function muscleGroup(name){
    const text = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const rules = [
      ['Tríceps', /triceps|supino fechado/],
      ['Bíceps', /rosca/],
      ['Panturrilhas', /panturrilha/],
      ['Abdômen', /abdom/],
      ['Ombros', /elevacao lateral|elevacao frontal|desenvolvimento|face pull|voador inverso|crucifixo inverso|y raise/],
      ['Glúteos', /abdutora|elevacao de quadril|elevacao pelvica/],
      ['Posteriores de coxa', /flexora|stiff|terra/],
      ['Quadríceps', /extensora|agachamento|hack|leg|recuo/],
      ['Peito', /supino|voador|peck deck|cross over|crucifixo|flexao/],
      ['Costas', /remada|puxada|pulldown|barra fixa|graviton/]
    ];
    return rules.find(([,pattern])=>pattern.test(text))?.[0] || 'Outros / sem grupo';
  }

  function aggregateMuscles(records, dates){
    const groups = new Map();
    for(const entry of records){
      if(entry?.unit !== 'kg' || !dates.includes(entry.date)) continue;
      const totals = root.TrainingSession.totals(entry.stages);
      if(!totals) continue;
      const group = entry.muscleGroup || muscleGroup(entry.exerciseName);
      if(!groups.has(group)) groups.set(group,{name:group,volume:0,exercises:new Set()});
      const item = groups.get(group);
      item.volume += totals.volume;
      item.exercises.add(entry.date + ':' + (entry.exerciseId || entry.exerciseName || 'desconhecido'));
    }
    return [...groups.values()].map(item=>({name:item.name,volume:item.volume,count:item.exercises.size}));
  }

  function renderMuscles(container, records, days){
    const wrap = document.createElement('div');
    wrap.className = 'muscle-plots';
    const colors = ['#FF9F43','#7dd3fc','#86efac','#c4b5fd','#f472b6','#fcd34d','#2dd4bf','#fb7185','#a3e635','#818cf8','#94a3b8'];
    function panel(title, dates, chooseDate){
      const section = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = title;
      section.appendChild(heading);
      const controls = document.createElement('div'); controls.className = 'progress-actions';
      let selectedDates = dates;
      if(chooseDate){
        const label = document.createElement('label'); label.textContent = 'Data: ';
        const select = document.createElement('select');
        for(const day of [...days].reverse()){
          const option = document.createElement('option');option.value=day.date;option.textContent=day.date;select.appendChild(option);
        }
        select.value=dates[0];
        select.onchange=()=>{selectedDates=[select.value];draw();};
        label.appendChild(select);controls.appendChild(label);
      }else{
        const range = document.createElement('span');range.textContent=dates.join(' · ');controls.appendChild(range);
      }
      const label = document.createElement('label'); label.textContent = 'Fatias por: ';
      const metric = document.createElement('select');
      for(const [value,text] of [['volume','Volume de carga'],['count','Número de exercícios']]){
        const option=document.createElement('option');option.value=value;option.textContent=text;metric.appendChild(option);
      }
      metric.value='volume';metric.onchange=()=>draw();label.appendChild(metric);controls.appendChild(label);
      section.appendChild(controls);
      const body=document.createElement('div');body.className='muscle-chart-body';section.appendChild(body);
      function draw(){
        body.replaceChildren();
        const groups=aggregateMuscles(records,selectedDates).sort((a,b)=>b[metric.value]-a[metric.value]);
        const total=groups.reduce((sum,item)=>sum+item[metric.value],0);
        if(!total){const empty=document.createElement('p');empty.className='progress-empty';empty.textContent='Sem registros completos nessa data.';body.appendChild(empty);return;}
        const pie=document.createElement('div');pie.className='muscle-pie';pie.setAttribute('role','img');
        let start=0;
        pie.style.background='conic-gradient('+groups.map(item=>{
          const color=colors[Math.max(0,['Tríceps','Bíceps','Panturrilhas','Abdômen','Ombros','Glúteos','Posteriores de coxa','Quadríceps','Peito','Costas','Outros / sem grupo'].indexOf(item.name))];
          item.color=color;
          const end=start+item[metric.value]/total*100;const slice=color+' '+start+'% '+end+'%';start=end;return slice;
        }).join(',')+')';
        pie.setAttribute('aria-label',groups.map(item=>item.name+': '+(item[metric.value]/total*100).toFixed(1)+'%').join('; '));
        const legend=document.createElement('ul');legend.className='muscle-legend';
        for(const item of groups){
          const row=document.createElement('li');
          const swatch=document.createElement('span');swatch.className='muscle-swatch';swatch.style.backgroundColor=item.color;
          const text=document.createElement('span');
          text.textContent=item.name+' — '+(item[metric.value]/total*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'% · '+item.volume.toLocaleString('pt-BR',{maximumFractionDigits:1})+' kg de volume · '+item.count+' exercício(s)';
          row.append(swatch,text);legend.appendChild(row);
        }
        body.append(pie,legend);
      }
      draw();wrap.appendChild(section);
    }
    panel('Grupos musculares no dia',[days[days.length-1].date],true);
    panel('Grupos musculares nos últimos 4 dias de treino',days.slice(-4).map(day=>day.date),false);
    const note=document.createElement('p');note.className='progress-note';
    note.textContent='Grupo principal estimado pelo nome do exercício; músculos secundários não são divididos entre fatias. Volume = carga × séries × repetições. Cada exercício conta uma vez por data. Os últimos 4 dias são as datas de treino registradas mais recentes; registros sem detalhes e cardio ficam de fora.';
    container.append(wrap,note);
  }

  function render(container, records, onDeleteDate){
    container.replaceChildren();
    const days = aggregate(records);
    if(!days.length){
      const empty = document.createElement('p');
      empty.className = 'progress-empty';
      empty.textContent = 'Salve a carga e as repetições dos exercícios para acompanhar sua evolução por dia.';
      container.appendChild(empty);
      return;
    }
    if(onDeleteDate){
      const actions = document.createElement('div');
      actions.className = 'progress-actions';
      const label = document.createElement('label');
      label.textContent = 'Apagar uma data: ';
      const select = document.createElement('select');
      for(const day of [...days].reverse()){
        const option = document.createElement('option');
        option.value = day.date; option.textContent = day.date;
        select.appendChild(option);
      }
      label.appendChild(select);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'clear-hist-btn';
      button.textContent = 'Apagar dia';
      button.onclick = ()=>onDeleteDate(select.value);
      actions.append(label,button); container.appendChild(actions);
    }
    if(days.some(day=>day.incomplete)){
      const note = document.createElement('p');
      note.className = 'progress-note';
      note.textContent = 'Há registros antigos sem séries e cargas por etapa. Eles continuam no histórico, mas não entram nos totais abaixo. Dias com esses registros podem estar incompletos.';
      container.appendChild(note);
    }
    const plots = document.createElement('div');
    plots.className = 'progress-plots';
    const metrics = [
      {key:'weight', label:'Volume total (carga × repetições)', unit:'kg', color:'#7dd3fc', digits:1},
      {key:'reps', label:'Repetições totais', unit:'rep', color:'#c4b5fd', digits:0},
      {key:'loadPerRep', label:'Carga total ÷ repetições', unit:'kg/rep', color:'#86efac', digits:2}
    ];
    for(const metric of metrics){
      const panel = document.createElement('section');
      panel.className = 'progress-panel';
      const heading = document.createElement('h3');
      heading.textContent = `${metric.label} (${metric.unit})`;
      panel.appendChild(heading);
      const chart = document.createElement('div');
      chart.className = 'progress-bars';
      chart.style.minWidth = `${Math.max(240, days.length * 88)}px`;
      const scroll = document.createElement('div');
      scroll.className = 'progress-scroll';
      scroll.tabIndex = 0;
      scroll.setAttribute('role', 'region');
      scroll.setAttribute('aria-label', metric.label);
      const max = Math.max(...days.map(day=>day[metric.key] || 0), 0.001);
      for(const day of days){
        const value = day[metric.key];
        const formatted = value === null ? 'Sem dados' : value.toLocaleString('pt-BR', {maximumFractionDigits:metric.digits});
        const column = document.createElement('div');
        column.className = 'progress-column';
        column.title = `${day.date}: ${formatted}${value === null ? '' : ' ' + metric.unit} · ${day.sets} séries, ${day.pairedCount} registros completos, ${day.incomplete} sem detalhes`;
        const track = document.createElement('div');
        track.className = 'progress-track';
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        bar.style.height = `${value === null ? 0 : value / max * 100}%`;
        bar.style.backgroundColor = metric.color;
        bar.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'progress-value';
        label.textContent = formatted;
        track.append(bar, label);
        const date = document.createElement('span');
        date.className = 'progress-date';
        date.textContent = day.date;
        column.append(track, date);
        chart.appendChild(column);
      }
      scroll.appendChild(chart);
      panel.appendChild(scroll);
      plots.appendChild(panel);
    }
    container.appendChild(plots);
    renderMuscles(container, records, days);
    for(const panel of plots.children){
      const scroll = panel.children[1];
      scroll.scrollLeft = scroll.scrollWidth;
    }
  }
  root.TrainingProgress = {aggregate, render, muscleGroup, aggregateMuscles};
})(typeof window === 'undefined' ? globalThis : window);
