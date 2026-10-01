(function(root){
  function aggregate(records){
    const days = new Map();
    for(const entry of records){
      if(!entry || entry.unit !== 'kg' || !Number.isFinite(entry.weight) || entry.weight <= 0) continue;
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(entry.date);
      if(!match) continue;
      const [, d, m, y] = match;
      const date = new Date(Number(y), Number(m)-1, Number(d));
      if(date.getFullYear() !== Number(y) || date.getMonth() !== Number(m)-1 || date.getDate() !== Number(d)) continue;
      const key = `${y}-${m}-${d}`;
      if(!days.has(key)) days.set(key, {key, date:entry.date, weight:0, reps:0, count:0, pairedCount:0});
      const day = days.get(key);
      day.weight += entry.weight;
      day.count++;
      if(Number.isInteger(entry.reps) && entry.reps > 0){
        day.reps += entry.reps;
        day.pairedCount++;
      }
    }
    return [...days.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(day=>({
      ...day,
      reps:day.pairedCount ? day.reps : null,
      averageReps:day.pairedCount ? day.reps / day.pairedCount : null,
      averageWeight:day.weight / day.count
    }));
  }

  function render(container, records){
    container.replaceChildren();
    const days = aggregate(records);
    if(!days.length){
      const empty = document.createElement('p');
      empty.className = 'progress-empty';
      empty.textContent = 'Salve a carga e as repetições dos exercícios para acompanhar sua evolução por dia.';
      container.appendChild(empty);
      return;
    }
    const scroll = document.createElement('div');
    scroll.className = 'progress-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', 'Gráficos diários. Role horizontalmente para comparar todas as datas.');
    const plots = document.createElement('div');
    plots.className = 'progress-plots';
    plots.style.minWidth = `${Math.max(280, days.length * 88)}px`;
    const metrics = [
      {key:'weight', label:'Peso total', unit:'kg', color:'#7dd3fc', digits:1},
      {key:'reps', label:'Repetições totais', unit:'rep', color:'#c4b5fd', digits:0},
      {key:'averageReps', label:'Média de repetições por registro', unit:'rep', color:'#86efac', digits:1},
      {key:'averageWeight', label:'Média de carga por registro', unit:'kg', color:'#fcd34d', digits:1}
    ];
    for(const metric of metrics){
      const panel = document.createElement('section');
      panel.className = 'progress-panel';
      const heading = document.createElement('h3');
      heading.textContent = `${metric.label} (${metric.unit})`;
      panel.appendChild(heading);
      const chart = document.createElement('div');
      chart.className = 'progress-bars';
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
      panel.appendChild(chart);
      plots.appendChild(panel);
    }
    scroll.appendChild(plots);
    container.appendChild(scroll);
    scroll.scrollLeft = scroll.scrollWidth;
  }
  root.TrainingProgress = {aggregate, render};
})(typeof window === 'undefined' ? globalThis : window);
