// script.js - Lógica educativa, métricas y gráficos

function q(id){ return document.getElementById(id); }
function round2(v){ return Math.round(v * 100) / 100; }

// === INTERACCIÓN "LEER MÁS" ===
document.querySelectorAll('.toggle-more').forEach(btn => {
  btn.addEventListener('click', e => {
    const card = e.target.closest('.info-card, .card');
    card.classList.toggle('open');
    e.target.textContent = card.classList.contains('open') ? 'Mostrar menos' : 'Leer más';
    const more = card.querySelector('.more');
    if (more) {
      if (card.classList.contains('open')) more.style.maxHeight = more.scrollHeight + 'px';
      else more.style.maxHeight = 0;
    }
  });
});

// === ELEMENTOS CLAVE ===
const resultadoTexto = q('resultadoTexto');
const interpretacion = q('interpretacion');
const recomendacionesDiv = q('recomendaciones');
const recomendacionCard = q('recomendacionCard');
const lastEval = q('lastEval');
const btnExport = q('btnExport');
const btnClear = q('btnClear');
const btnLoadLast = q('btnLoadLast');

let chartBar = null;
let chartRadar = null;

// === NORMALIZACIONES ===
function normDefectos(v){
  if (isNaN(v) || v < 0) return 0;
  const max = 10;
  const score = Math.max(0, 5 * (1 - (v / max)));
  return round2(Math.min(5, score));
}
function normCobertura(v){
  if (isNaN(v) || v < 0) return 0;
  return round2(Math.min(5, (v / 100) * 5));
}
function normComplejidad(v){
  if (isNaN(v) || v < 0) return 0;
  const clamp = Math.min(v, 40);
  const score = Math.max(0, 5 - ((clamp - 1) / 19) * 5);
  return round2(Math.min(5, score));
}
function normMantenibilidad(v){
  if (isNaN(v) || v < 0) return 0;
  return round2(Math.min(5, (v / 100) * 5));
}

// === RECOMENDACIONES ===
function recomPorCriterio(name, score){
  if(score >= 4.5) return `<strong>${name}:</strong> Excelente — mantener las prácticas actuales.`;
  if(score >= 3.5) return `<strong>${name}:</strong> Bueno — realizar revisiones periódicas para mejora continua.`;
  if(score >= 2.5) return `<strong>${name}:</strong> Aceptable — revisar métricas, ampliar cobertura o simplificar código.`;
  return `<strong>${name}:</strong> Crítico — plan urgente de refactorización y aumento de pruebas.`;
}

function interpretacionGeneral(score){
  if(score >= 4.5) return { label: "Excelente", desc: "El software presenta una calidad sobresaliente. Se recomienda mantener las prácticas actuales y continuar midiendo para sostener la excelencia.", color:'#1f7a0b' };
  if(score >= 3.5) return { label: "Buena", desc: "Calidad estable con margen de mejora. Incrementar pruebas automatizadas y reducir la complejidad puede elevar la puntuación.", color:'#7bb72f' };
  if(score >= 2.5) return { label: "Aceptable", desc: "El software cumple parcialmente los objetivos de calidad. Se sugiere revisar procesos de aseguramiento de calidad y mantenimiento.", color:'#f59e0b' };
  return { label: "Crítica", desc: "La calidad es baja y se requieren acciones urgentes: depuración, refactorización y fortalecimiento de pruebas.", color:'#d9534f' };
}

// === CÁLCULO PRINCIPAL ===
function calcularCalificacion(){
  const defectos = parseFloat(q('defectos').value) || 0;
  const cobertura = parseFloat(q('cobertura').value) || 0;
  const complejidad = parseFloat(q('complejidad').value) || 1;
  const mantenibilidad = parseFloat(q('mantenibilidad').value) || 0;

  const sDef = normDefectos(defectos);
  const sCob = normCobertura(cobertura);
  const sCom = normComplejidad(complejidad);
  const sMan = normMantenibilidad(mantenibilidad);

  const weights = { defectos: 0.25, cobertura: 0.30, complejidad: 0.20, mantenibilidad: 0.25 };
  const weighted = (sDef * weights.defectos) + (sCob * weights.cobertura) + (sCom * weights.complejidad) + (sMan * weights.mantenibilidad);
  const finalScore = round2(weighted);

  resultadoTexto.textContent = `${finalScore} / 5`;
  const interpret = interpretacionGeneral(finalScore);
  interpretacion.innerHTML = `<strong style="color:${interpret.color}">${interpret.label}</strong> — ${interpret.desc}`;

  // Recomendaciones
  recomendacionesDiv.innerHTML = `
    <ul>
      <li>${recomPorCriterio('Densidad de defectos', sDef)}</li>
      <li>${recomPorCriterio('Cobertura de pruebas', sCob)}</li>
      <li>${recomPorCriterio('Complejidad ciclomática', sCom)}</li>
      <li>${recomPorCriterio('Mantenibilidad', sMan)}</li>
    </ul>
    <hr>
    <p><strong>Conclusión automática:</strong> ${
      finalScore >= 3.5
        ? "El software muestra buena calidad general. Se recomienda mantener una cultura de medición continua."
        : "El software necesita mejoras estructurales y aumento en cobertura de pruebas. Revisar procesos de calidad."
    }</p>
  `;
  recomendacionCard.classList.remove('hidden');

  renderCharts([sDef, sCob, sCom, sMan], finalScore);

  // Guardar en localStorage
  const payload = {
    date: new Date().toISOString(),
    inputs: { defectos, cobertura, complejidad, mantenibilidad },
    scores: { sDef, sCob, sCom, sMan },
    finalScore
  };
  localStorage.setItem('ultimaEvaluacion', JSON.stringify(payload));
  showLastEval(payload);
}

// === GRÁFICOS (Chart.js) ===
function renderCharts(values){
  const labels = ['Defectos', 'Cobertura', 'Complejidad', 'Mantenibilidad'];
  const ctxBar = q('chartBar').getContext('2d');
  const ctxRadar = q('chartRadar').getContext('2d');
  if(chartBar) chartBar.destroy();
  if(chartRadar) chartRadar.destroy();

  chartBar = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Puntaje (0-5)',
        data: values,
        backgroundColor: values.map(v => v < 3 ? 'rgba(217,70,70,0.85)' : 'rgba(62,154,18,0.85)'),
        borderRadius: 6
      }]
    },
    options: {
      animation: { duration: 700 },
      scales: { y: { beginAtZero: true, max: 5, ticks: { stepSize: 1 } } },
      plugins: { legend: { display: false } }
    }
  });

  chartRadar = new Chart(ctxRadar, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Perfil de calidad (0-5)',
        data: values,
        fill: true,
        backgroundColor: 'rgba(62,154,18,0.12)',
        borderColor: 'rgba(62,154,18,0.95)',
        pointBackgroundColor: 'rgba(62,154,18,0.95)'
      }]
    },
    options: {
      scales: { r: { min: 0, max: 5, ticks: { stepSize: 1 } } },
      animation: { duration: 700 }
    }
  });
}

// === EXPORTAR JSON ===
btnExport.addEventListener('click', () => {
  const raw = localStorage.getItem('ultimaEvaluacion');
  if(!raw){ alert('No hay evaluación para exportar.'); return; }
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `evaluacion_calidad_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// === LIMPIAR ===
btnClear.addEventListener('click', () => {
  ['defectos','cobertura','complejidad','mantenibilidad'].forEach(id => q(id).value = '');
  resultadoTexto.textContent = '— / 5';
  interpretacion.textContent = 'Introduce métricas y calcula para ver la interpretación.';
  recomendacionesDiv.innerHTML = '';
  recomendacionCard.classList.add('hidden');
  if(chartBar) chartBar.destroy();
  if(chartRadar) chartRadar.destroy();
});

// === ÚLTIMA EVALUACIÓN ===
function showLastEval(payload){
  if(!payload){ lastEval.innerHTML = '<p>No hay evaluaciones guardadas.</p>'; return; }
  lastEval.innerHTML = `
    <div>
      <strong>${payload.finalScore} / 5</strong>
      <div style="font-size:13px;color:#475569;margin-top:6px">${new Date(payload.date).toLocaleString()}</div>
      <div style="margin-top:8px;">
        <button id="btnApplyLast" class="btn">Aplicar</button>
      </div>
    </div>
  `;
  const b = document.getElementById('btnApplyLast');
  if(b) b.addEventListener('click', ()=> applyPayload(payload));
}

function applyPayload(payload){
  q('defectos').value = payload.inputs.defectos;
  q('cobertura').value = payload.inputs.cobertura;
  q('complejidad').value = payload.inputs.complejidad;
  q('mantenibilidad').value = payload.inputs.mantenibilidad;
  calcularCalificacion();
}

btnLoadLast.addEventListener('click', () => {
  const raw = localStorage.getItem('ultimaEvaluacion');
  if(!raw) { alert('No hay evaluaciones guardadas.'); return; }
  const payload = JSON.parse(raw);
  showLastEval(payload);
});

// === AL CARGAR PÁGINA ===
window.addEventListener('load', () => {
  const raw = localStorage.getItem('ultimaEvaluacion');
  if(raw){
    const payload = JSON.parse(raw);
    showLastEval(payload);
  }
});

