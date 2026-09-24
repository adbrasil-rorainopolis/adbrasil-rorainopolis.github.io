/* ============================================================================
   SGE Mobile — Missões
   Port do módulo desktop: core/sge_missoes.py
   Consolida exclusivamente as 4 contas de entradas missionárias:
   - Oferta da EBD Missionária
   - Oferta do Culto de Missões
   - Oferta Missionária
   - Oferta Missionária do Circulo de Oração
   Depende de: api(), sessao(), toast(), brl(), $, Chart.js, SGEG (gestao.js)
   ============================================================================ */
(function(){
'use strict';

/* ---------- Constantes (paridade com sge_missoes.py) ---------- */
const ORDEM_MESES_M = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SEMANAS_M = ['FECHAMENTO DO MÊS','1º. SEMANA','2º. SEMANA','3º. SEMANA','4º. SEMANA','5º. SEMANA'];
const CONTAS_MIS = [
  { chave: 'ebd_missionaria',   rotulo: 'EBD Missionária',   cor: '#fb923c', fundo: 'rgba(251,146,60,.16)' },
  { chave: 'culto_missoes',     rotulo: 'Culto de Missões',  cor: '#38bdf8', fundo: 'rgba(56,189,248,.16)' },
  { chave: 'oferta_missionaria',rotulo: 'Oferta Missionária',cor: '#a78bfa', fundo: 'rgba(167,139,250,.16)' },
  { chave: 'circulo_oracao_mis',rotulo: 'Círculo de Oração', cor: '#34d399', fundo: 'rgba(52,211,153,.16)' },
];
/* Mapa nome-da-conta (normalizado) -> chave interna */
const _norm = s => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const MAPA_CONTAS_MIS = {
  'oferta da ebd missionaria': 'ebd_missionaria',
  'oferta do culto de missoes': 'culto_missoes',
  'oferta missionaria': 'oferta_missionaria',
  'oferta missionaria do circulo de oracao': 'circulo_oracao_mis',
};

/* ---------- Helpers locais ---------- */
const $m = id => document.getElementById(id);
const numM = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const moedaM = v => brl(numM(v));
const escM = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idxMesM = nome => { const i = ORDEM_MESES_M.findIndex(m => _norm(m) === _norm(nome)); return i < 0 ? 1 : i + 1; };
const selM = (id, opts, val, onchange) => `<select id="${id}" ${onchange ? `onchange="${onchange}"` : ''} class="px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">${opts.map(([v, t]) => `<option value="${escM(v)}" ${String(v) === String(val) ? 'selected' : ''}>${escM(t)}</option>`).join('')}</select>`;
const cardM = (titulo, valor, cor, fundo) => `
  <div class="border rounded-xl p-3" style="background:${fundo || 'var(--bg-card)'};border-color:var(--border-color)">
    <p class="text-[9px] font-bold uppercase opacity-70 leading-tight">${titulo}</p>
    <p class="mt-1 text-sm font-black tabular-nums" style="color:${cor || 'var(--text-main)'}">${valor}</p>
  </div>`;

function extrairMissoesReg(reg){
  const det = reg.detalhes_entradas || {};
  const out = { ebd_missionaria: 0, culto_missoes: 0, oferta_missionaria: 0, circulo_oracao_mis: 0, total_missoes: 0 };
  for (const [conta, valor] of Object.entries(det)){
    const chave = MAPA_CONTAS_MIS[_norm(conta)];
    if (chave) out[chave] += numM(valor);
  }
  out.total_missoes = out.ebd_missionaria + out.culto_missoes + out.oferta_missionaria + out.circulo_oracao_mis;
  return out;
}
/* Extrai a aba desejada de um mês carregado (default: FECHAMENTO) */
function abaDoMes(dadosMes, semana){
  if (!dadosMes || !dadosMes.abas) return null;
  if (semana && dadosMes.abas[semana]) return dadosMes.abas[semana];
  if (semana){
    const alvo = Object.keys(dadosMes.abas).find(k => _norm(k) === _norm(semana));
    if (alvo) return dadosMes.abas[alvo];
  }
  const fech = Object.keys(dadosMes.abas).find(k => /fechamento/i.test(k));
  return dadosMes.abas[fech] || Object.values(dadosMes.abas)[0] || null;
}

/* ---------- Estado ---------- */
const M = {
  aba: 'arrecadacao',
  arrec: null,          // { ano, mes, semana, conselho }
  hist: null,           // { ano_ini, mes_ini, ano_fim, mes_fim, conselho, congregacao, anual }
  periodos: [],
  graf: null,
  dadosArrec: null, dadosHist: null,
};

/* ---------- Shell ---------- */
const ABAS_MIS = [
  ['arrecadacao', 'Arrecadação', 'fa-hand-holding-heart', '#fb923c'],
  ['historico',   'Histórico & Evolução', 'fa-chart-line', '#38bdf8'],
];

window.renderMissoes = function(){
  $m('dash-conteudo').innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center gap-3 pb-3 border-b" style="border-color:var(--border-color)">
        <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background:rgba(251,146,60,.14)"><i class="fa-solid fa-globe text-lg text-orange-400"></i></div>
        <div class="flex-1 min-w-0"><h2 class="font-bold text-sm">Missões</h2><p class="text-[10px] opacity-60">Arrecadação missionária do campo — EBD, Culto de Missões, Oferta Missionária e Círculo de Oração</p></div>
      </div>
      <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style="scrollbar-width:none">
        ${ABAS_MIS.filter(([id]) => sgeAbaPermitida('missoes', id)).map(([id, nome, ico, cor]) => `<button onclick="missoesAba('${id}')" id="mnav-${id}" class="mis-nav shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border cursor-pointer whitespace-nowrap" style="border-color:var(--border-color)"><i class="fa-solid ${ico}" style="color:${cor}"></i>${nome}</button>`).join('')}
      </div>
      <div id="missoes-corpo"><div class="flex items-center justify-center gap-2.5 py-16 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando módulo…</div></div>
    </div>`;
  missoesAba(M.aba);
};

window.missoesAba = async function(aba){
  if (!sgeAbaPermitida('missoes', aba)) {
    const primeira = (ABAS_MIS.find(([id]) => sgeAbaPermitida('missoes', id)) || [])[0];
    if (!primeira){ $m('missoes-corpo').innerHTML = '<p class="text-center text-xs py-10" style="color:var(--text-muted)">Nenhuma aba liberada para o seu perfil.</p>'; return; }
    aba = primeira;
  }
  M.aba = aba;
  document.querySelectorAll('.mis-nav').forEach(b => {
    const ativo = b.id === `mnav-${aba}`;
    b.style.background = ativo ? 'rgba(251,146,60,.14)' : 'var(--bg-card)';
    b.style.borderColor = ativo ? '#fb923c' : 'var(--border-color)';
  });
  if (!M.periodos.length) M.periodos = await SGEG.listarPeriodos();
  if (aba === 'arrecadacao') renderMisArrecadacao();
  else renderMisHistorico();
};

/* ============================================================================
   ABA 1 — Arrecadação do campo (mês único × semana × conselho)
   ============================================================================ */
function renderMisArrecadacao(){
  const corpo = $m('missoes-corpo');
  const ord = [...M.periodos].sort((a, b) => (+b.ano) - (+a.ano) || idxMesM(b.mes) - idxMesM(a.mes));
  const ult = ord[0] || { ano: String(new Date().getFullYear()), mes: ORDEM_MESES_M[new Date().getMonth()] };
  const anos = [...new Set(M.periodos.map(p => String(p.ano)))].sort().map(a => [a, a]);
  if (!anos.length) anos.push([ult.ano, ult.ano]);
  if (!M.arrec) M.arrec = { ano: ult.ano, mes: ult.mes, semana: 'FECHAMENTO DO MÊS', conselho: 'Todos' };
  const f = M.arrec;

  corpo.innerHTML = `
    <div class="border rounded-2xl p-3 space-y-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="grid grid-cols-2 gap-2">
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Ano</span>${selM('ma-ano', anos, f.ano, 'misArrecMudou()')}</div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Mês</span>${selM('ma-mes', ORDEM_MESES_M.map(m => [m, m]), f.mes, 'misArrecMudou()')}</div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Semana</span>${selM('ma-semana', SEMANAS_M.map(s => [s, s === 'FECHAMENTO DO MÊS' ? 'Fechamento do mês' : s]), f.semana, 'misArrecMudou()')}</div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Conselho</span><select id="ma-conselho" onchange="misArrecMudou()" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todos">Todos os conselhos</option></select></div>
      </div>
    </div>
    <div id="mis-arrec-kpis" class="grid grid-cols-2 gap-2"></div>
    <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <h3 class="font-bold text-xs mb-2 flex items-center gap-2"><i class="fa-solid fa-church text-orange-400"></i>Contribuições por congregação</h3>
      <div class="overflow-x-auto"><table class="w-full text-[11px] text-left">
        <thead><tr class="border-b" style="border-color:var(--border-color)">
          <th class="py-2 pr-2 opacity-60">Congregação</th>
          <th class="py-2 px-1 opacity-60 text-right">EBD Mis.</th>
          <th class="py-2 px-1 opacity-60 text-right">Culto Mis.</th>
          <th class="py-2 px-1 opacity-60 text-right">Oferta Mis.</th>
          <th class="py-2 px-1 opacity-60 text-right">C. Oração</th>
          <th class="py-2 pl-1 opacity-60 text-right">Total</th>
        </tr></thead>
        <tbody id="mis-arrec-tbody"></tbody>
      </table></div>
    </div>`;
  _popularConselhosMis('ma-conselho', f.conselho);
  carregarMisArrecadacao();
}
window.misArrecMudou = function(){
  const f = M.arrec;
  f.ano = $m('ma-ano')?.value ?? f.ano; f.mes = $m('ma-mes')?.value ?? f.mes;
  f.semana = $m('ma-semana')?.value ?? f.semana; f.conselho = $m('ma-conselho')?.value || 'Todos';
  carregarMisArrecadacao();
};
async function carregarMisArrecadacao(){
  const f = M.arrec;
  const kpis = $m('mis-arrec-kpis'), tbody = $m('mis-arrec-tbody');
  if (!kpis || !tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-xs" style="color:var(--text-muted)"><div class="spin inline-block mr-2"></div>Carregando…</td></tr>';
  const dadosMes = await SGEG.carregarMovimento(f.ano, f.mes);
  const aba = abaDoMes(dadosMes, f.semana);
  const regs = (aba?.registros || []).filter(r => f.conselho === 'Todos' || _norm(r.conselho) === _norm(f.conselho));
  const linhas = regs.map(r => ({ nome: r.congregacao, conselho: r.conselho, ...extrairMissoesReg(r) }))
    .filter(l => l.total_missoes > 0 || true)
    .sort((a, b) => b.total_missoes - a.total_missoes);
  const tot = linhas.reduce((a, l) => {
    CONTAS_MIS.forEach(c => a[c.chave] += l[c.chave]); a.total_missoes += l.total_missoes; return a;
  }, { ebd_missionaria: 0, culto_missoes: 0, oferta_missionaria: 0, circulo_oracao_mis: 0, total_missoes: 0 });
  M.dadosArrec = { linhas, tot };

  kpis.innerHTML =
    CONTAS_MIS.map(c => cardM(c.rotulo, moedaM(tot[c.chave]), c.cor, c.fundo)).join('') +
    cardM('Total Missões', moedaM(tot.total_missoes), '#fbbf24', 'rgba(251,191,36,.12)');

  tbody.innerHTML = linhas.length ? linhas.map(l => `
    <tr class="border-b" style="border-color:var(--border-color)">
      <td class="py-2 pr-2"><span class="font-semibold">${escM(l.nome)}</span><span class="block text-[9px] opacity-50">${escM(l.conselho)}</span></td>
      ${CONTAS_MIS.map(c => `<td class="py-2 px-1 text-right tabular-nums ${l[c.chave] ? '' : 'opacity-30'}">${l[c.chave] ? moedaM(l[c.chave]) : '-'}</td>`).join('')}
      <td class="py-2 pl-1 text-right tabular-nums font-bold text-orange-400">${moedaM(l.total_missoes)}</td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="py-8 text-center text-xs" style="color:var(--text-muted)">Sem lançamentos missionários neste período/filtro.</td></tr>';
}

/* ============================================================================
   ABA 2 — Histórico & Evolução (período mensal ≤12 meses ou comparativo anual)
   ============================================================================ */
function renderMisHistorico(){
  const corpo = $m('missoes-corpo');
  const ord = [...M.periodos].sort((a, b) => (+a.ano) - (+b.ano) || idxMesM(a.mes) - idxMesM(b.mes));
  const primeiro = ord[0] || { ano: '2023', mes: 'Janeiro' };
  const ult = ord[ord.length - 1] || { ano: String(new Date().getFullYear()), mes: ORDEM_MESES_M[new Date().getMonth()] };
  const anos = [...new Set(M.periodos.map(p => String(p.ano)))].sort().map(a => [a, a]);
  if (!anos.length) anos.push([ult.ano, ult.ano]);
  if (!M.hist) M.hist = { ano_ini: primeiro.ano, mes_ini: primeiro.mes, ano_fim: ult.ano, mes_fim: ult.mes, conselho: 'Todos', congregacao: 'Todas', anual: false };
  const f = M.hist;
  const mesesOpts = ORDEM_MESES_M.map(m => [m, m]);

  corpo.innerHTML = `
    <div class="border rounded-2xl p-3 space-y-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] font-bold uppercase opacity-60"><i class="fa-solid fa-filter text-orange-400 mr-1.5"></i>Filtros da evolução</span>
        <button onclick="misHistAnual()" id="mh-anual-btn" class="px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer" style="border-color:${f.anual ? '#fb923c' : 'var(--border-color)'};background:${f.anual ? 'rgba(251,146,60,.16)' : 'transparent'};color:${f.anual ? '#fb923c' : 'var(--text-main)'}"><i class="fa-solid fa-calendar-days mr-1"></i>Comparativo anual</button>
      </div>
      <p class="text-[10px] opacity-60" id="mh-resumo">${_resumoHist(f)}</p>
      <div class="grid grid-cols-2 gap-2">
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">De</span><div class="flex gap-1.5">${selM('mh-ano-ini', anos, f.ano_ini, "misHistMudou('ini')")}${f.anual ? '' : selM('mh-mes-ini', mesesOpts, f.mes_ini, "misHistMudou('ini')")}</div></div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Até</span><div class="flex gap-1.5">${selM('mh-ano-fim', anos, f.ano_fim, "misHistMudou('fim')")}${f.anual ? '' : selM('mh-mes-fim', mesesOpts, f.mes_fim, "misHistMudou('fim')")}</div></div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Conselho</span><select id="mh-conselho" onchange="misHistConselho()" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todos">Todos os conselhos</option></select></div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Congregação</span><select id="mh-congregacao" onchange="misHistMudou()" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todas">Todas</option></select></div>
      </div>
      ${f.anual ? '' : '<p class="text-[9px] opacity-50"><i class="fa-solid fa-lock mr-1"></i>Período mensal limitado a 12 meses — para mais, use o comparativo anual.</p>'}
      <button onclick="carregarMisHistorico(true)" class="w-full py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#c2410c,#fb923c)"><i class="fa-solid fa-chart-line mr-1.5"></i>Gerar evolução</button>
    </div>
    <div id="mis-hist-kpis" class="grid grid-cols-2 gap-2"></div>
    <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <h3 class="font-bold text-xs mb-2 flex items-center gap-2"><i class="fa-solid fa-chart-column text-orange-400"></i><span id="mis-hist-titulo-graf">Evolução missionária</span></h3>
      <div class="h-64"><canvas id="mis-grafico"></canvas></div>
    </div>
    <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <h3 class="font-bold text-xs mb-2 flex items-center gap-2"><i class="fa-solid fa-church text-sky-400"></i>Por congregação no período</h3>
      <div class="overflow-x-auto"><table class="w-full text-[11px] text-left">
        <thead><tr class="border-b" style="border-color:var(--border-color)">
          <th class="py-2 pr-2 opacity-60">Congregação</th>
          <th class="py-2 px-1 opacity-60 text-right">EBD Mis.</th>
          <th class="py-2 px-1 opacity-60 text-right">Culto Mis.</th>
          <th class="py-2 px-1 opacity-60 text-right">Oferta Mis.</th>
          <th class="py-2 px-1 opacity-60 text-right">C. Oração</th>
          <th class="py-2 pl-1 opacity-60 text-right">Total</th>
        </tr></thead>
        <tbody id="mis-hist-tbody"></tbody>
      </table></div>
    </div>`;
  _popularConselhosMis('mh-conselho', f.conselho).then(() => _popularCongsMis());
  carregarMisHistorico();
}
function _resumoHist(f){
  return f.anual
    ? `Anual · ${f.ano_ini} a ${f.ano_fim} • ${f.conselho}${f.congregacao !== 'Todas' ? ' • ' + f.congregacao : ''}`
    : `${f.mes_ini}/${f.ano_ini} a ${f.mes_fim}/${f.ano_fim} • ${f.conselho}${f.congregacao !== 'Todas' ? ' • ' + f.congregacao : ''}`;
}
window.misHistAnual = function(){
  M.hist.anual = !M.hist.anual;
  if (M.hist.anual) toast('Comparativo anual: cobre os anos inteiros entre o ano inicial e o final.');
  renderMisHistorico();
};
window.misHistConselho = async function(){
  M.hist.conselho = $m('mh-conselho')?.value || 'Todos';
  M.hist.congregacao = 'Todas';
  await _popularCongsMis();
};
window.misHistMudou = function(lado){
  const f = M.hist;
  f.ano_ini = $m('mh-ano-ini')?.value ?? f.ano_ini; f.ano_fim = $m('mh-ano-fim')?.value ?? f.ano_fim;
  f.conselho = $m('mh-conselho')?.value || f.conselho;
  f.congregacao = $m('mh-congregacao')?.value || f.congregacao;
  if (!f.anual){
    f.mes_ini = $m('mh-mes-ini')?.value ?? f.mes_ini; f.mes_fim = $m('mh-mes-fim')?.value ?? f.mes_fim;
    _clamp12(f, lado);
  }
  const r = $m('mh-resumo'); if (r) r.textContent = _resumoHist(f);
};
/* Trava de 12 meses — mesma regra do desktop */
function _clamp12(f, lado){
  const v = (a, m) => (+a) * 12 + idxMesM(m);
  let ini = v(f.ano_ini, f.mes_ini), fim = v(f.ano_fim, f.mes_fim);
  if (ini > fim) [ini, fim] = [fim, ini];
  if (fim - ini + 1 <= 12) { _gravarFaixa(f, ini, fim); return; }
  if (lado === 'ini') ini = fim - 11; else fim = ini + 11;
  _gravarFaixa(f, ini, fim);
  toast('Período mensal limitado a 12 meses. Para mais, use o Comparativo anual.');
}
function _gravarFaixa(f, ini, fim){
  const dI = ini - 1, dF = fim - 1;
  f.ano_ini = String(Math.floor(dI / 12)); f.mes_ini = ORDEM_MESES_M[dI % 12];
  f.ano_fim = String(Math.floor(dF / 12)); f.mes_fim = ORDEM_MESES_M[dF % 12];
  if ($m('mh-ano-ini')) $m('mh-ano-ini').value = f.ano_ini;
  if ($m('mh-mes-ini')) $m('mh-mes-ini').value = f.mes_ini;
  if ($m('mh-ano-fim')) $m('mh-ano-fim').value = f.ano_fim;
  if ($m('mh-mes-fim')) $m('mh-mes-fim').value = f.mes_fim;
}

async function _popularConselhosMis(idSel, valor){
  const sel = $m(idSel); if (!sel) return;
  /* Conselhos vistos nos dados (histórico por ano) + mapa atual */
  const { porConselho } = await SGEG.mapaConselhos();
  sel.innerHTML = '<option value="Todos">Todos os conselhos</option>' + Object.keys(porConselho).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(c => `<option value="${escM(c)}">${escM(c)}</option>`).join('');
  sel.value = valor || 'Todos';
}
async function _popularCongsMis(){
  const cong = $m('mh-congregacao'); if (!cong) return;
  const { porConselho } = await SGEG.mapaConselhos();
  const cons = $m('mh-conselho')?.value || 'Todos';
  const lista = cons === 'Todos' ? Object.values(porConselho).flat() : (porConselho[cons] || []);
  const unicas = [...new Set(lista)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  cong.innerHTML = '<option value="Todas">Todas</option>' + unicas.map(c => `<option value="${escM(c)}">${escM(c)}</option>`).join('');
  cong.value = M.hist.congregacao || 'Todas';
}

async function carregarMisHistorico(disparado){
  const f = M.hist;
  const tbody = $m('mis-hist-tbody'), kpis = $m('mis-hist-kpis');
  if (!tbody || !kpis) return;
  tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-xs" style="color:var(--text-muted)"><div class="spin inline-block mr-2"></div>Cruzando dados…</td></tr>';

  /* Universo de períodos */
  let pontos;
  if (f.anual){
    const aI = Math.min(+f.ano_ini, +f.ano_fim), aF = Math.max(+f.ano_ini, +f.ano_fim);
    pontos = [];
    for (let a = aI; a <= aF; a++) pontos.push({ tipo: 'ano', ano: a, rotulo: String(a) });
  } else {
    let ini = (+f.ano_ini) * 12 + idxMesM(f.mes_ini), fim = (+f.ano_fim) * 12 + idxMesM(f.mes_fim);
    if (ini > fim) [ini, fim] = [fim, ini];
    pontos = [];
    for (let v = ini; v <= fim; v++){
      const d = v - 1, ano = Math.floor(d / 12), mes = ORDEM_MESES_M[d % 12];
      pontos.push({ tipo: 'mes', ano, mes, rotulo: `${mes.slice(0, 3)}/${String(ano).slice(2)}` });
    }
  }

  /* Carrega meses necessários */
  const mesesNec = new Set();
  for (const p of pontos){
    if (p.tipo === 'mes') mesesNec.add(`${p.ano}_${p.mes}`);
    else for (const mm of ORDEM_MESES_M) mesesNec.add(`${p.ano}_${mm}`);
  }
  const cache = {};
  await Promise.all([...mesesNec].map(async k => {
    const [a, m] = k.split('_');
    cache[k] = await SGEG.carregarMovimento(a, m);
  }));

  /* Agrega por ponto (mês ou ano) — conselho lido do registro = conselho histórico daquele ano */
  const filtra = r =>
    (f.conselho === 'Todos' || _norm(r.conselho) === _norm(f.conselho)) &&
    (f.congregacao === 'Todas' || _norm(r.congregacao) === _norm(f.congregacao));
  const zera = () => ({ ebd_missionaria: 0, culto_missoes: 0, oferta_missionaria: 0, circulo_oracao_mis: 0, total_missoes: 0 });
  const porCong = {};

  const series = pontos.map(p => {
    const acc = zera();
    const mesesDoPonto = p.tipo === 'mes' ? [[p.ano, p.mes]] : ORDEM_MESES_M.map(m => [p.ano, m]);
    for (const [a, m] of mesesDoPonto){
      const aba = abaDoMes(cache[`${a}_${m}`], 'FECHAMENTO DO MÊS');
      for (const r of (aba?.registros || [])){
        if (!filtra(r)) continue;
        const v = extrairMissoesReg(r);
        CONTAS_MIS.forEach(c => acc[c.chave] += v[c.chave]);
        acc.total_missoes += v.total_missoes;
        const cn = r.congregacao || '-';
        const cg = porCong[cn] || (porCong[cn] = { nome: cn, conselho: r.conselho, ...zera() });
        CONTAS_MIS.forEach(c => cg[c.chave] += v[c.chave]);
        cg.total_missoes += v.total_missoes;
      }
    }
    return { rotulo: p.rotulo, ...acc };
  });

  const tot = series.reduce((a, s) => {
    CONTAS_MIS.forEach(c => a[c.chave] += s[c.chave]); a.total_missoes += s.total_missoes; return a;
  }, zera());
  M.dadosHist = { series, tot, porCong };

  /* KPIs */
  kpis.innerHTML =
    CONTAS_MIS.map(c => cardM(c.rotulo, moedaM(tot[c.chave]), c.cor, c.fundo)).join('') +
    cardM('Total no período', moedaM(tot.total_missoes), '#fbbf24', 'rgba(251,191,36,.12)');

  /* Gráfico — barras agrupadas das 4 contas por período */
  const tit = $m('mis-hist-titulo-graf');
  if (tit) tit.textContent = f.anual ? `Comparativo anual · ${Math.min(+f.ano_ini, +f.ano_fim)} a ${Math.max(+f.ano_ini, +f.ano_fim)}` : 'Evolução mensal missionária';
  if (M.graf){ try { M.graf.destroy(); } catch(e){} M.graf = null; }
  const cv = $m('mis-grafico');
  if (cv && window.Chart){
    M.graf = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: {
        labels: series.map(s => s.rotulo),
        datasets: CONTAS_MIS.map(c => ({
          label: c.rotulo, data: series.map(s => +s[c.chave].toFixed(2)),
          backgroundColor: c.cor, borderRadius: 3, maxBarThickness: 18,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${moedaM(ctx.parsed.y)}` } },
        },
        scales: {
          x: { ticks: { font: { size: 9 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { font: { size: 9 }, callback: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) } },
        },
      },
    });
  }

  /* Tabela por congregação */
  const linhas = Object.values(porCong).sort((a, b) => b.total_missoes - a.total_missoes);
  tbody.innerHTML = linhas.length ? linhas.map(l => `
    <tr class="border-b" style="border-color:var(--border-color)">
      <td class="py-2 pr-2"><span class="font-semibold">${escM(l.nome)}</span><span class="block text-[9px] opacity-50">${escM(l.conselho)}</span></td>
      ${CONTAS_MIS.map(c => `<td class="py-2 px-1 text-right tabular-nums ${l[c.chave] ? '' : 'opacity-30'}">${l[c.chave] ? moedaM(l[c.chave]) : '-'}</td>`).join('')}
      <td class="py-2 pl-1 text-right tabular-nums font-bold text-orange-400">${moedaM(l.total_missoes)}</td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="py-8 text-center text-xs" style="color:var(--text-muted)">Sem arrecadação missionária no período/filtro.</td></tr>';
  if (disparado) toast('Evolução missionária atualizada.');
}

/* API de depuração/testes */
window.SGEM = { extrairMissoesReg, abaDoMes, M };

})();
