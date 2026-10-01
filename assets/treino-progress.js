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
        column.title = `${day.date}: ${formatted}${value === null ? '' : ' ' + metric.unit} · ${day.count} registro(s), ${day.pairedCount} com repetições`;
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
    for(const panel of plots.children){
      const scroll = panel.children[1];
      scroll.scrollLeft = scroll.scrollWidth;
    }
  }
  root.TrainingProgress = {aggregate, render};
})(typeof window === 'undefined' ? globalThis : window);
