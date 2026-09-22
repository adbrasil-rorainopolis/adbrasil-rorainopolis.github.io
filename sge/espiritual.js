/* ============================================================
   SGE Mobile — Secretaria & Espiritual
   Relatório Espiritual mensal do campo: dashboard + lançamento.
   ============================================================ */
(function(){
'use strict';
const el = id => document.getElementById(id);

const ESP_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ESP_GRUPOS = [
  { t: 'Cultos', i: 'fa-church', c: [['cultos_doutrina','Doutrina'],['cultos_publico','Público'],['cultos_ar_livre','Ar Livre'],['cultos_em_lares','Em Lares'],['cultos_ebd','E.B.D.']] },
  { t: 'Mov. Pentecostal', i: 'fa-fire', c: [['pent_tarde_avivamento','Tarde Avivamento'],['pent_consagracao_geral','Consagração Geral'],['pent_campanhas_oracao','Campanhas Oração'],['pent_vigilias','Vigílias'],['pent_milagres','Milagres'],['pent_curas_divinas','Curas Divinas'],['pent_renovacoes','Renovações']] },
  { t: 'Decisões', i: 'fa-heart', c: [['dec_senhores','Senhores'],['dec_senhoras','Senhoras'],['dec_adolescentes','Adolescentes'],['dec_jovens','Jovens'],['dec_criancas','Crianças']] },
  { t: 'Reconciliações', i: 'fa-handshake-angle', c: [['rec_senhores','Senhores'],['rec_senhoras','Senhoras'],['rec_adolescentes','Adolescentes'],['rec_jovens','Jovens'],['rec_criancas','Crianças']] },
  { t: 'Batismo Esp. Santo', i: 'fa-dove', c: [['bes_senhores','Senhores'],['bes_senhoras','Senhoras'],['bes_adolescentes','Adolescentes'],['bes_jovens','Jovens'],['bes_criancas','Crianças']] },
  { t: 'Batismo nas Águas', i: 'fa-water', c: [['bag_senhores','Senhores'],['bag_senhoras','Senhoras'],['bag_adolescentes','Adolescentes'],['bag_jovens','Jovens']] },
  { t: 'Evangelismo · Visitas', i: 'fa-person-walking', c: [['ev_hospitais','Hospitais/Pessoas'],['ev_casa_em_casa','Casa em Casa'],['ev_presidios','Presídios'],['ev_desviados','Desviados']] },
  { t: 'Evangelismo · Outros', i: 'fa-bullhorn', c: [['ev_abordadas','Pessoas Abordadas'],['ev_folhetos','Folhetos'],['ev_pontos_pregacao','Pontos Pregação'],['ev_cruzadas','Cruzadas']] },
  { t: 'Jovens e Adolescentes', i: 'fa-users', c: [['jovens_masc','Jovens Masc.'],['jovens_fem','Jovens Fem.'],['adol_masc','Adol. Masc.'],['adol_fem','Adol. Fem.']] },
  { t: 'Cerimônias', i: 'fa-ring', c: [['cer_bodas','Bodas Ouro/Prata'],['cer_anivers15','Anivers. 15 Anos'],['cer_noivados','Noivados'],['cer_casamentos','Casamentos'],['cer_apres_criancas','Apres. Crianças'],['cer_obitos','Óbitos/Fúnebre']] },
  { t: 'Doações', i: 'fa-gift', c: [['doa_cestas','Cestas Básicas'],['doa_roupas','Peças de Roupas'],['doa_reformas','Reformas de Casas'],['doa_casas','Casas Construídas']] },
];
const _som = (r, ks) => ks.reduce((t, k) => t + (+r[k] || 0), 0);
const ESP_METRICAS = [
  ['cultos', 'Cultos', 'fa-church', '#38bdf8', r => _som(r, ['cultos_doutrina','cultos_publico','cultos_ar_livre','cultos_em_lares','cultos_ebd'])],
  ['pentecostal', 'Pentecostal', 'fa-fire', '#fb923c', r => _som(r, ['pent_tarde_avivamento','pent_consagracao_geral','pent_campanhas_oracao','pent_vigilias','pent_milagres','pent_curas_divinas','pent_renovacoes'])],
  ['decisoes', 'Decisões', 'fa-heart', '#f472b6', r => _som(r, ['dec_senhores','dec_senhoras','dec_adolescentes','dec_jovens','dec_criancas'])],
  ['reconciliacoes', 'Reconciliações', 'fa-handshake-angle', '#34d399', r => _som(r, ['rec_senhores','rec_senhoras','rec_adolescentes','rec_jovens','rec_criancas'])],
  ['bat_es', 'Bat. Esp. Santo', 'fa-dove', '#a78bfa', r => _som(r, ['bes_senhores','bes_senhoras','bes_adolescentes','bes_jovens','bes_criancas'])],
  ['bat_aguas', 'Bat. nas Águas', 'fa-water', '#818cf8', r => _som(r, ['bag_senhores','bag_senhoras','bag_adolescentes','bag_jovens'])],
  ['visitas', 'Visitas', 'fa-person-walking', '#fbbf24', r => _som(r, ['ev_hospitais','ev_casa_em_casa','ev_presidios','ev_desviados'])],
  ['ev_outros', 'Alcance Evang.', 'fa-bullhorn', '#f59e0b', r => _som(r, ['ev_abordadas','ev_folhetos','ev_pontos_pregacao','ev_cruzadas'])],
  ['jovens', 'Jovens', 'fa-users', '#22d3ee', r => _som(r, ['jovens_masc','jovens_fem'])],
  ['adolescentes', 'Adolescentes', 'fa-user-group', '#2dd4bf', r => _som(r, ['adol_masc','adol_fem'])],
  ['cerimonias', 'Cerimônias', 'fa-ring', '#e879f9', r => _som(r, ['cer_bodas','cer_anivers15','cer_noivados','cer_casamentos','cer_apres_criancas','cer_obitos'])],
  ['doacoes', 'Doações', 'fa-gift', '#f97316', r => _som(r, ['doa_cestas','doa_roupas','doa_reformas','doa_casas'])],
];
const ESP = { meses: [], selMes: 'todos', selInd: 'cultos', formato: 'bar', grafico: null, carregou: false, carregando: false };

function espPodeEditar(){
  if (sgeEhAdmin()) return true;
  const ac = sgeAcessos();
  if (!ac.configurado) return String(sessao()?.usuario?.perfil || '').toLowerCase() !== 'consultor';
  return (ac.permissoes || []).some(p => p.modulo === 'secretaria'
    && (p.aba === '*' || p.aba === 'espiritual') && (p.acao === '*' || p.acao === 'operar'));
}

window.renderSecretaria = function(){
  const D = $('dash-conteudo');
  if (!sgeAbaPermitida('secretaria', 'espiritual')){
    D.innerHTML = `
      <div class="flex items-center gap-3 pb-4 border-b mb-4" style="border-color:var(--border-color)">
        <button onclick="mudarVisao('dashboard')" class="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer shrink-0" style="border-color:var(--border-color);color:var(--text-muted)"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="flex-1"><h2 class="font-cinzel font-bold text-base">Secretaria & Espiritual</h2></div>
      </div>
      <div class="rounded-2xl border p-8 text-center" style="background:var(--bg-card);border-color:var(--border-color)">
        <i class="fa-solid fa-lock text-2xl opacity-30 mb-3 block"></i>
        <p class="text-xs" style="color:var(--text-muted)">A aba Espiritual não está liberada para o seu perfil.</p>
      </div>`;
    return;
  }
  D.innerHTML = `
    <div class="flex items-center gap-3 pb-4 border-b mb-4" style="border-color:var(--border-color)">
      <button onclick="mudarVisao('dashboard')" class="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer shrink-0" style="border-color:var(--border-color);color:var(--text-muted)"><i class="fa-solid fa-arrow-left"></i></button>
      <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background:rgba(244,114,182,.12)"><i class="fa-solid fa-dove text-lg text-pink-400"></i></div>
      <div class="flex-1 min-w-0"><h2 class="font-cinzel font-bold text-base leading-tight">Relatório Espiritual</h2>
        <p class="text-[10px]" style="color:var(--text-muted)">Movimento mensal do campo · Setor 14</p></div>
      <button onclick="espCarregar(true)" class="w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer shrink-0" style="border-color:var(--border-color);color:var(--text-muted)" title="Atualizar"><i class="fa-solid fa-rotate"></i></button>
      ${espPodeEditar() ? `<button onclick="espAbrirForm()" class="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer shrink-0 text-white" style="background:var(--color-primary)" title="Lançar mês"><i class="fa-solid fa-plus"></i></button>` : ''}
    </div>
    <div id="espm-meses" class="flex gap-1.5 overflow-x-auto pb-1 mb-3" style="scrollbar-width:none"></div>
    <div id="espm-kpis" class="grid grid-cols-3 gap-1.5 mb-3"></div>
    <div class="rounded-2xl border p-3 mb-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <div id="espm-inds" class="flex gap-1.5 overflow-x-auto pb-1 mb-2" style="scrollbar-width:none"></div>
      <div class="flex items-center justify-between mb-2">
        <p id="espm-graf-titulo" class="text-[10px] font-extrabold uppercase tracking-wide opacity-60"></p>
        <div class="flex rounded-lg border overflow-hidden shrink-0" style="border-color:var(--border-color)">
          <button id="espm-fmt-bar" onclick="espFormato('bar')" class="px-2.5 py-1.5 cursor-pointer text-[10px]" style="background:var(--color-primary);color:#fff"><i class="fa-solid fa-chart-column"></i></button>
          <button id="espm-fmt-line" onclick="espFormato('line')" class="px-2.5 py-1.5 cursor-pointer text-[10px]" style="background:var(--bg-input);color:var(--text-main)"><i class="fa-solid fa-chart-line"></i></button>
        </div>
      </div>
      <div class="relative h-52"><canvas id="espm-grafico"></canvas>
        <p id="espm-graf-vazio" class="hidden absolute inset-0 flex items-center justify-center text-[11px] opacity-50 text-center px-4">Sem dados no período selecionado.</p>
      </div>
    </div>
    <div class="rounded-2xl border p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <p class="text-[9px] font-extrabold uppercase tracking-wide opacity-60 mb-2">Meses lançados</p>
      <div id="espm-tabela" class="space-y-1.5"></div>
    </div>`;
  espCarregar();
};

window.espCarregar = async function(forcar){
  if (ESP.carregando) return;
  if (ESP.carregou && !forcar) { espRender(); return; }
  ESP.carregando = true;
  const kb = el('espm-kpis');
  if (kb && !ESP.meses.length) kb.innerHTML = `<div class="col-span-3 rounded-xl border p-6 text-center" style="border-color:var(--border-color)">
    <i class="fa-solid fa-circle-notch fa-spin text-lg opacity-40 mb-2 block"></i>
    <p class="text-[10px] opacity-50">Carregando relatório espiritual…</p></div>`;
  try {
    const r = await api('listar_relatorio_espiritual', {}, sessao()?.token);
    if (!r?.ok) { toast(r?.erro || 'Falha ao carregar.'); if (kb) kb.innerHTML = `<div class="col-span-3 rounded-xl border p-6 text-center" style="border-color:var(--border-color)"><p class="text-[11px] opacity-60">${r?.erro || 'Falha ao carregar.'}</p></div>`; return; }
    ESP.meses = (r.meses || []).slice().sort((a, b) => (a.ano + String(a.mes_num).padStart(2, '0')).localeCompare(b.ano + String(b.mes_num).padStart(2, '0')));
    ESP.carregou = true;
    espRender();
  } catch(e) {
    toast(e.message || 'Falha ao carregar.');
    if (kb) kb.innerHTML = `<div class="col-span-3 rounded-xl border p-6 text-center" style="border-color:var(--border-color)"><p class="text-[11px] opacity-60">${e.message || 'Sem conexão com a nuvem.'}</p></div>`;
  } finally { ESP.carregando = false; }
};

function _espFiltrados(){
  if (ESP.selMes === 'todos') return ESP.meses;
  return ESP.meses.filter(m => m.id === ESP.selMes);
}

window.espSelMes = function(id){ ESP.selMes = id; espRender(); };
window.espSelInd = function(id){ ESP.selInd = id; espRender(); };

window.espFormato = function(f){
  ESP.formato = f;
  const b = el('espm-fmt-bar'), l = el('espm-fmt-line');
  if (b) { b.style.background = f === 'bar' ? 'var(--color-primary)' : 'var(--bg-input)'; b.style.color = f === 'bar' ? '#fff' : 'var(--text-main)'; }
  if (l) { l.style.background = f === 'line' ? 'var(--color-primary)' : 'var(--bg-input)'; l.style.color = f === 'line' ? '#fff' : 'var(--text-main)'; }
  espRender();
};

const _chip = (id, rotulo, sel, fn, cor) => `
  <button onclick="${fn}('${id}')" class="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold cursor-pointer border transition"
    style="${sel ? `background:${cor || 'var(--color-primary)'};color:#fff;border-color:transparent` : 'background:var(--bg-input);color:var(--text-muted);border-color:var(--border-color)'}">${rotulo}</button>`;

window.espRender = function(){
  // Filtro de mês: chips tocáveis
  const mb = el('espm-meses');
  if (mb) mb.innerHTML =
    _chip('todos', 'Todos os meses', ESP.selMes === 'todos', 'espSelMes') +
    ESP.meses.map(m => _chip(m.id, m.mes.slice(0, 3) + '/' + m.ano.slice(2), ESP.selMes === m.id, 'espSelMes')).join('');
  const filtrados = _espFiltrados();

  // KPIs
  const kpis = [
    ['Cultos', ESP_METRICAS[0][4], 'fa-church', '#38bdf8'], ['Decisões', ESP_METRICAS[2][4], 'fa-heart', '#f472b6'],
    ['Reconcil.', ESP_METRICAS[3][4], 'fa-handshake-angle', '#34d399'],
    ['Batismos', r => ESP_METRICAS[4][4](r) + ESP_METRICAS[5][4](r), 'fa-water', '#818cf8'],
    ['Evangel.', r => ESP_METRICAS[6][4](r) + ESP_METRICAS[7][4](r), 'fa-bullhorn', '#fbbf24'],
    ['Doações', ESP_METRICAS[11][4], 'fa-gift', '#f97316'],
  ];
  const kb = el('espm-kpis');
  if (kb) kb.innerHTML = kpis.map(([rot, fn, ico, cor]) => {
    const v = filtrados.reduce((t, r) => t + fn(r), 0);
    return `<div class="rounded-xl border p-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex items-center gap-1"><i class="fa-solid ${ico} text-[8px]" style="color:${cor}"></i>
        <span class="text-[8px] font-extrabold uppercase tracking-wide" style="color:${cor}">${rot}</span></div>
      <p class="text-lg font-extrabold mt-0.5">${v.toLocaleString('pt-BR')}</p></div>`;
  }).join('');

  // Chips de indicador
  const ib = el('espm-inds');
  if (ib) ib.innerHTML = ESP_METRICAS.map(([id, rot, , cor]) => _chip(id, rot, ESP.selInd === id, 'espSelInd', cor)).join('');
  const met = ESP_METRICAS.find(m => m[0] === ESP.selInd) || ESP_METRICAS[0];
  const gt = el('espm-graf-titulo'); if (gt) gt.textContent = met[1];

  // Gráfico
  const ctx = el('espm-grafico')?.getContext('2d');
  const vazio = el('espm-graf-vazio');
  if (ctx && typeof Chart !== 'undefined') {
    if (ESP.grafico) ESP.grafico.destroy();
    ESP.grafico = null;
    const dados = filtrados.map(m => met[4](m));
    if (vazio) vazio.classList.toggle('hidden', filtrados.length > 0);
    if (filtrados.length) ESP.grafico = new Chart(ctx, {
      type: ESP.formato,
      data: { labels: filtrados.map(m => m.mes.slice(0, 3)),
        datasets: [{ label: met[1], data: dados,
          backgroundColor: ESP.formato === 'bar' ? 'rgba(244,114,182,.7)' : 'rgba(244,114,182,.15)',
          borderColor: '#f472b6', borderWidth: 2, fill: ESP.formato === 'line', tension: .35, pointRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  // Cards dos meses
  const tb = el('espm-tabela');
  if (tb) tb.innerHTML = filtrados.length ? filtrados.map(m => {
    const dec = ESP_METRICAS[2][4](m), rec = ESP_METRICAS[3][4](m), bt = ESP_METRICAS[4][4](m) + ESP_METRICAS[5][4](m);
    const ev = ESP_METRICAS[6][4](m) + ESP_METRICAS[7][4](m);
    return `<div class="rounded-xl border px-3 py-2.5" style="border-color:var(--border-color)">
      <div class="flex items-center gap-2">
        <p class="flex-1 text-[12px] font-extrabold">${m.mes} <span class="opacity-50 font-semibold">${m.ano}</span></p>
        ${espPodeEditar() ? `<button onclick="espAbrirForm('${m.id}')" class="w-7 h-7 rounded-lg border text-[10px] cursor-pointer shrink-0" style="border-color:var(--border-color);color:var(--text-muted)"><i class="fa-solid fa-pen"></i></button>` : ''}
      </div>
      <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[9px]" style="color:var(--text-muted)">
        <span><b style="color:#38bdf8">${ESP_METRICAS[0][4](m)}</b> cultos</span>
        <span><b style="color:#f472b6">${dec}</b> decisões</span>
        <span><b style="color:#34d399">${rec}</b> reconcil.</span>
        <span><b style="color:#818cf8">${bt}</b> batismos</span>
        <span><b style="color:#fbbf24">${ev}</b> evangelismo</span>
      </div>
    </div>`;
  }).join('') : `<div class="rounded-xl border border-dashed p-6 text-center" style="border-color:var(--border-color)">
      <i class="fa-solid fa-inbox text-xl opacity-30 mb-2 block"></i>
      <p class="text-[11px] opacity-50">Nenhum mês lançado neste período.</p>
      ${espPodeEditar() ? `<button onclick="espAbrirForm()" class="mt-3 px-4 py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer" style="background:var(--color-primary)">Lançar agora</button>` : ''}
    </div>`;
};

window.espAbrirForm = function(id){
  el('esp-sheet')?.remove();
  const reg = id ? ESP.meses.find(m => m.id === id) : null;
  const hoje = new Date();
  document.body.insertAdjacentHTML('beforeend', `
    <div id="esp-sheet" class="fixed inset-0 z-[99] flex items-end justify-center" style="background:rgba(0,0,0,.6);backdrop-filter:blur(3px)">
      <div class="w-full max-w-md rounded-t-3xl max-h-[92vh] flex flex-col" style="background:var(--bg-card);border:1px solid var(--border-color)">
        <div class="flex items-center gap-2.5 p-4 border-b shrink-0" style="border-color:var(--border-color)">
          <button onclick="document.getElementById('esp-sheet').remove()" class="w-8 h-8 rounded-xl border text-xs cursor-pointer shrink-0" style="border-color:var(--border-color)"><i class="fa-solid fa-arrow-left"></i></button>
          <p class="flex-1 text-[13px] font-extrabold">${reg ? 'Editar ' + reg.mes + '/' + reg.ano : 'Lançar relatório do mês'}</p>
          <button onclick="document.getElementById('esp-sheet').remove()" class="w-8 h-8 rounded-xl border text-xs cursor-pointer shrink-0" style="border-color:var(--border-color)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="px-4 pt-3 shrink-0">
          <p class="text-[9px] font-extrabold uppercase tracking-wide opacity-60 mb-1.5">Mês do relatório</p>
          <div class="flex gap-1.5 overflow-x-auto pb-1" style="scrollbar-width:none" id="esp-f-meses">
            ${ESP_MESES.map((m, i) => {
              const mm = i + 1, sel = reg ? reg.mes_num === mm : hoje.getMonth() === i;
              return `<button data-mes="${mm}" onclick="espSelMesForm(${mm})" class="esp-mes-chip shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold cursor-pointer border"
                style="${sel ? 'background:var(--color-primary);color:#fff;border-color:transparent' : 'background:var(--bg-input);color:var(--text-muted);border-color:var(--border-color)'}">${m.slice(0, 3)}</button>`;
            }).join('')}
          </div>
          <input type="hidden" id="esp-f-mes" value="${reg ? reg.mes_num : hoje.getMonth() + 1}">
          <div class="flex gap-1.5 mt-2" id="esp-f-anos">
            ${[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map(y => {
              const sel = String(reg ? +reg.ano : hoje.getFullYear()) === String(y);
              return `<button data-ano="${y}" onclick="espSelAnoForm(${y})" class="esp-ano-chip flex-1 px-3 py-1.5 rounded-full text-[10px] font-bold cursor-pointer border"
                style="${sel ? 'background:var(--color-primary);color:#fff;border-color:transparent' : 'background:var(--bg-input);color:var(--text-muted);border-color:var(--border-color)'}">${y}</button>`;
            }).join('')}
          </div>
          <input type="hidden" id="esp-f-ano" value="${reg ? reg.ano : hoje.getFullYear()}">
        </div>
        <div class="overflow-y-auto p-4 space-y-3">
          ${ESP_GRUPOS.map(g => `
            <div class="rounded-xl border p-3" style="border-color:var(--border-color)">
              <p class="text-[10px] font-extrabold uppercase tracking-wide mb-2" style="color:var(--color-primary)"><i class="fa-solid ${g.i} mr-1"></i>${g.t}</p>
              <div class="grid grid-cols-3 gap-1.5">
                ${g.c.map(([k, rot]) => `<label class="space-y-0.5"><span class="block text-[8px] font-bold uppercase opacity-60 truncate">${rot}</span>
                  <input data-esp="${k}" type="number" min="0" inputmode="numeric" value="${reg ? (+reg[k] || 0) : 0}"
                    class="w-full px-1.5 py-2 rounded-lg border text-xs text-center font-bold" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></label>`).join('')}
              </div>
            </div>`).join('')}
        </div>
        <div class="p-4 border-t shrink-0" style="border-color:var(--border-color)">
          <button onclick="espSalvar()" class="w-full py-3 rounded-xl text-[12px] font-extrabold text-white cursor-pointer" style="background:var(--color-primary)"><i class="fa-solid fa-floppy-disk mr-1"></i>Salvar relatório</button>
        </div>
      </div>
    </div>`);
  el('esp-sheet').addEventListener('click', e => { if (e.target.id === 'esp-sheet') el('esp-sheet').remove(); });
};

window.espSelMesForm = function(mm){
  el('esp-f-mes').value = mm;
  document.querySelectorAll('#esp-f-meses .esp-mes-chip').forEach(c => {
    const sel = +c.dataset.mes === mm;
    c.style.background = sel ? 'var(--color-primary)' : 'var(--bg-input)';
    c.style.color = sel ? '#fff' : 'var(--text-muted)';
    c.style.borderColor = sel ? 'transparent' : 'var(--border-color)';
  });
};
window.espSelAnoForm = function(y){
  el('esp-f-ano').value = y;
  document.querySelectorAll('#esp-f-anos .esp-ano-chip').forEach(c => {
    const sel = +c.dataset.ano === y;
    c.style.background = sel ? 'var(--color-primary)' : 'var(--bg-input)';
    c.style.color = sel ? '#fff' : 'var(--text-muted)';
    c.style.borderColor = sel ? 'transparent' : 'var(--border-color)';
  });
};

window.espSalvar = async function(){
  const mesNum = +el('esp-f-mes')?.value || 0, ano = el('esp-f-ano')?.value || '';
  if (!mesNum || !ano) { toast('Informe mês e ano.'); return; }
  const dados = {};
  document.querySelectorAll('#esp-sheet [data-esp]').forEach(i => { dados[i.dataset.esp] = Math.max(0, Math.trunc(+i.value) || 0); });
  try {
    const r = await api('salvar_relatorio_espiritual', { ano, mes_num: mesNum, dados }, sessao()?.token);
    if (!r?.ok) { toast(r?.erro || 'Falha ao salvar.'); return; }
    toast('Relatório de ' + ESP_MESES[mesNum - 1] + '/' + ano + ' salvo.');
    el('esp-sheet')?.remove();
    ESP.carregou = false;
    await espCarregar(true);
  } catch(e) { toast(e.message || 'Falha ao salvar.'); }
};

})();
