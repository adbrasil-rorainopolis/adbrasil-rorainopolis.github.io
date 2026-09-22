/* ============================================================
   SGE Mobile — Secretaria & Espiritual
   Relatório Espiritual mensal do campo: dashboard + lançamento.
   ============================================================ */
(function(){
'use strict';

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
  ['cultos', 'Cultos (total)', r => _som(r, ['cultos_doutrina','cultos_publico','cultos_ar_livre','cultos_em_lares','cultos_ebd'])],
  ['pentecostal', 'Mov. Pentecostal', r => _som(r, ['pent_tarde_avivamento','pent_consagracao_geral','pent_campanhas_oracao','pent_vigilias','pent_milagres','pent_curas_divinas','pent_renovacoes'])],
  ['decisoes', 'Decisões', r => _som(r, ['dec_senhores','dec_senhoras','dec_adolescentes','dec_jovens','dec_criancas'])],
  ['reconciliacoes', 'Reconciliações', r => _som(r, ['rec_senhores','rec_senhoras','rec_adolescentes','rec_jovens','rec_criancas'])],
  ['bat_es', 'Batismo Esp. Santo', r => _som(r, ['bes_senhores','bes_senhoras','bes_adolescentes','bes_jovens','bes_criancas'])],
  ['bat_aguas', 'Batismo nas Águas', r => _som(r, ['bag_senhores','bag_senhoras','bag_adolescentes','bag_jovens'])],
  ['visitas', 'Evangelismo · Visitas', r => _som(r, ['ev_hospitais','ev_casa_em_casa','ev_presidios','ev_desviados'])],
  ['ev_outros', 'Evangelismo · Alcance', r => _som(r, ['ev_abordadas','ev_folhetos','ev_pontos_pregacao','ev_cruzadas'])],
  ['jovens', 'Jovens', r => _som(r, ['jovens_masc','jovens_fem'])],
  ['adolescentes', 'Adolescentes', r => _som(r, ['adol_masc','adol_fem'])],
  ['cerimonias', 'Cerimônias', r => _som(r, ['cer_bodas','cer_anivers15','cer_noivados','cer_casamentos','cer_apres_criancas','cer_obitos'])],
  ['doacoes', 'Doações', r => _som(r, ['doa_cestas','doa_roupas','doa_reformas','doa_casas'])],
];
const ESP = { meses: [], formato: 'bar', grafico: null, carregou: false };

function espPodeEditar(){
  if (sgeEhAdmin()) return true;
  const ac = sgeAcessos();
  if (!ac.configurado) return String(sessao()?.usuario?.perfil || '').toLowerCase() !== 'consultor';
  return (ac.permissoes || []).some(p => p.modulo === 'secretaria'
    && (p.aba === '*' || p.aba === 'espiritual') && (p.acao === '*' || p.acao === 'operar'));
}

window.renderSecretaria = function(){
  const D = $('dash-conteudo');
  const espiritualOk = sgeAbaPermitida('secretaria', 'espiritual');
  D.innerHTML = `
    <div class="flex items-center gap-3 pb-4 border-b mb-4" style="border-color:var(--border-color)">
      <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background:rgba(244,114,182,.12)"><i class="fa-solid fa-dove text-lg text-pink-400"></i></div>
      <div class="flex-1"><h2 class="font-cinzel font-bold text-base">Secretaria & Espiritual</h2>
        <p class="text-[10px]" style="color:var(--text-muted)">Relatório espiritual mensal do campo</p></div>
    </div>
    ${espiritualOk ? `
    <div class="flex flex-wrap items-end gap-2 mb-3">
      <label class="space-y-1"><span class="block text-[9px] font-bold uppercase opacity-60">De</span>
        <select id="espm-de" onchange="espRender()" class="px-2 py-1.5 rounded-lg border text-[11px]" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></select></label>
      <label class="space-y-1"><span class="block text-[9px] font-bold uppercase opacity-60">Até</span>
        <select id="espm-ate" onchange="espRender()" class="px-2 py-1.5 rounded-lg border text-[11px]" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></select></label>
      <button onclick="espCarregar(true)" class="px-2.5 py-1.5 rounded-lg border cursor-pointer text-[11px]" style="border-color:var(--border-color);color:var(--text-muted)"><i class="fa-solid fa-rotate"></i></button>
      ${espPodeEditar() ? `<button onclick="espAbrirForm()" class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer" style="background:var(--color-primary)"><i class="fa-solid fa-plus mr-1"></i>Novo mês</button>` : ''}
    </div>
    <div id="espm-kpis" class="grid grid-cols-3 gap-1.5 mb-3"></div>
    <div class="rounded-2xl border p-3 mb-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex items-center justify-between gap-2 mb-2">
        <select id="espm-indicador" onchange="espRender()" class="flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-semibold" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
          ${ESP_METRICAS.map(([id, rot]) => `<option value="${id}">${rot}</option>`).join('')}
        </select>
        <div class="flex rounded-lg border overflow-hidden shrink-0" style="border-color:var(--border-color)">
          <button id="espm-fmt-bar" onclick="espFormato('bar')" class="px-2.5 py-1.5 cursor-pointer" style="background:var(--color-primary);color:#fff"><i class="fa-solid fa-chart-column"></i></button>
          <button id="espm-fmt-line" onclick="espFormato('line')" class="px-2.5 py-1.5 cursor-pointer" style="background:var(--bg-input);color:var(--text-main)"><i class="fa-solid fa-chart-line"></i></button>
        </div>
      </div>
      <div class="relative h-56"><canvas id="espm-grafico"></canvas></div>
    </div>
    <div class="rounded-2xl border p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <p class="text-[9px] font-extrabold uppercase tracking-wide opacity-60 mb-2">Meses lançados</p>
      <div id="espm-tabela" class="space-y-1.5"></div>
    </div>` : `
    <div class="rounded-2xl border p-8 text-center" style="background:var(--bg-card);border-color:var(--border-color)">
      <i class="fa-solid fa-lock text-2xl opacity-30 mb-3 block"></i>
      <p class="text-xs" style="color:var(--text-muted)">A aba Espiritual não está liberada para o seu perfil.</p>
    </div>`}`;
  if (espiritualOk) espCarregar();
};

window.espCarregar = async function(forcar){
  if (ESP.carregou && !forcar) { espRender(); return; }
  try {
    const r = await api('listar_relatorio_espiritual', {}, sessao()?.token);
    if (!r?.ok) { toast(r?.erro || 'Falha ao carregar.'); return; }
    ESP.meses = (r.meses || []).slice().sort((a, b) => (a.ano + String(a.mes_num).padStart(2, '0')).localeCompare(b.ano + String(b.mes_num).padStart(2, '0')));
    ESP.carregou = true;
    const opts = ESP.meses.map(m => `<option value="${m.ano}-${String(m.mes_num).padStart(2, '0')}">${m.mes.slice(0, 3)}/${m.ano}</option>`).join('');
    const selDe = el('espm-de'), selAte = el('espm-ate');
    if (selDe) { selDe.innerHTML = opts; selDe.selectedIndex = 0; }
    if (selAte) { selAte.innerHTML = opts; selAte.selectedIndex = Math.max(0, ESP.meses.length - 1); }
    espRender();
  } catch(e) { toast(e.message || 'Falha ao carregar.'); }
};

function _espFiltrados(){
  const de = el('espm-de')?.value || '', ate = el('espm-ate')?.value || '';
  return ESP.meses.filter(m => {
    const k = m.ano + '-' + String(m.mes_num).padStart(2, '0');
    return (!de || k >= de) && (!ate || k <= ate);
  });
}

window.espFormato = function(f){
  ESP.formato = f;
  const b = el('espm-fmt-bar'), l = el('espm-fmt-line');
  if (b) { b.style.background = f === 'bar' ? 'var(--color-primary)' : 'var(--bg-input)'; b.style.color = f === 'bar' ? '#fff' : 'var(--text-main)'; }
  if (l) { l.style.background = f === 'line' ? 'var(--color-primary)' : 'var(--bg-input)'; l.style.color = f === 'line' ? '#fff' : 'var(--text-main)'; }
  espRender();
};

window.espRender = function(){
  const filtrados = _espFiltrados();
  const met = ESP_METRICAS.find(m => m[0] === (el('espm-indicador')?.value || 'cultos')) || ESP_METRICAS[0];
  const kpis = [
    ['Cultos', ESP_METRICAS[0][2], '#38bdf8'], ['Decisões', ESP_METRICAS[2][2], '#f472b6'],
    ['Reconcil.', ESP_METRICAS[3][2], '#34d399'],
    ['Batismos', r => ESP_METRICAS[4][2](r) + ESP_METRICAS[5][2](r), '#818cf8'],
    ['Evangel.', r => ESP_METRICAS[6][2](r) + ESP_METRICAS[7][2](r), '#fbbf24'],
    ['Doações', ESP_METRICAS[11][2], '#f97316'],
  ];
  const kb = el('espm-kpis');
  if (kb) kb.innerHTML = kpis.map(([rot, fn, cor]) => {
    const v = filtrados.reduce((t, r) => t + fn(r), 0);
    return `<div class="rounded-xl border p-2 text-center" style="background:var(--bg-card);border-color:var(--border-color)">
      <p class="text-[8px] font-extrabold uppercase tracking-wide" style="color:${cor}">${rot}</p>
      <p class="text-base font-extrabold">${v.toLocaleString('pt-BR')}</p></div>`;
  }).join('');
  const ctx = el('espm-grafico')?.getContext('2d');
  if (ctx && typeof Chart !== 'undefined') {
    if (ESP.grafico) ESP.grafico.destroy();
    ESP.grafico = new Chart(ctx, {
      type: ESP.formato,
      data: { labels: filtrados.map(m => m.mes.slice(0, 3)),
        datasets: [{ label: met[1], data: filtrados.map(m => met[2](m)),
          backgroundColor: ESP.formato === 'bar' ? 'rgba(244,114,182,.7)' : 'rgba(244,114,182,.15)',
          borderColor: '#f472b6', borderWidth: 2, fill: ESP.formato === 'line', tension: .35, pointRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }
  const tb = el('espm-tabela');
  if (tb) tb.innerHTML = filtrados.length ? filtrados.map(m => {
    const dec = ESP_METRICAS[2][2](m), rec = ESP_METRICAS[3][2](m), bt = ESP_METRICAS[4][2](m) + ESP_METRICAS[5][2](m);
    return `<div class="flex items-center gap-2 rounded-xl border px-2.5 py-2" style="border-color:var(--border-color)">
      <div class="flex-1 min-w-0"><p class="text-[11px] font-bold">${m.mes}/${m.ano}</p>
        <p class="text-[9px]" style="color:var(--text-muted)">${ESP_METRICAS[0][2](m)} cultos · ${dec} decisões · ${rec} reconcil. · ${bt} batismos</p></div>
      ${espPodeEditar() ? `<button onclick="espAbrirForm('${m.id}')" class="w-7 h-7 rounded-lg border text-[10px] cursor-pointer shrink-0" style="border-color:var(--border-color)"><i class="fa-solid fa-pen"></i></button>` : ''}
    </div>`;
  }).join('') : '<p class="text-[11px] text-center py-4 opacity-50">Nenhum mês lançado no período.</p>';
};

window.espAbrirForm = function(id){
  el('esp-sheet')?.remove();
  const reg = id ? ESP.meses.find(m => m.id === id) : null;
  const hoje = new Date();
  document.body.insertAdjacentHTML('beforeend', `
    <div id="esp-sheet" class="fixed inset-0 z-[99] flex items-end justify-center" style="background:rgba(0,0,0,.6);backdrop-filter:blur(3px)">
      <div class="w-full max-w-md rounded-t-3xl max-h-[92vh] flex flex-col" style="background:var(--bg-card);border:1px solid var(--border-color)">
        <div class="flex items-center justify-between p-4 border-b shrink-0" style="border-color:var(--border-color)">
          <p class="text-[13px] font-extrabold">${reg ? 'Editar ' + reg.mes + '/' + reg.ano : 'Lançar relatório do mês'}</p>
          <button onclick="document.getElementById('esp-sheet').remove()" class="w-8 h-8 rounded-xl border text-xs cursor-pointer" style="border-color:var(--border-color)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="flex gap-2 px-4 pt-3 shrink-0">
          <select id="esp-f-mes" class="flex-1 px-2 py-2 rounded-lg border text-xs font-semibold" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
            ${ESP_MESES.map((m, i) => `<option value="${i + 1}" ${reg && reg.mes_num === i + 1 ? 'selected' : (!reg && hoje.getMonth() === i ? 'selected' : '')}>${m}</option>`).join('')}
          </select>
          <select id="esp-f-ano" class="px-2 py-2 rounded-lg border text-xs font-semibold" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
            ${[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map(y => `<option ${String(reg ? +reg.ano : hoje.getFullYear()) === String(y) ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
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
