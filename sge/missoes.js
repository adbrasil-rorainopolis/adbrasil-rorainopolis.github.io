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
/* Chave canônica de congregação — réplica de _chave_nome_congregacao (sge_financeiro.py) */
const _chaveNome = s => {
  let t = String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  t = t.replace(/\bp\s*\.?\s*p\.?\b|\bponto\s*de\s*pregacao\b/g, '');
  t = t.replace(/[^a-z0-9]/g, '');
  return t.replace(/\d+/g, m => String(parseInt(m, 10)));
};
/* Aliases históricos (planilhas 2023–2025) -> nome canônico 2026 */
const ALIAS_CONGS = {
  'rosa de sharon': 'Rosa de Saron', 'park amazonia': 'Park das Orquídeas',
  'vicinal 25': 'P.P. Vicinal 25 - Videira', 'vicinal 44 -': 'Vicinal 44 - Atos 2',
  'vicinal 2 - boa esperança': 'Boa Esperança', 'anauá': 'P.P. - Vicinal 02 - Anauá',
  'p.p. - anauá': 'P.P. - Vicinal 02 - Anauá', 'p.p. - vicinal 05': 'P.P. - Vicinal 05 - Deus Forte',
  'p.p - vicinal 1 -': 'P.P - Vicinal 01 - Só o Senhor é Deus',
};
async function _canonMapaM(){
  if (M._canon) return M._canon;
  const { porConselho } = await SGEG.mapaConselhos();
  const mapa = {};
  for (const nomes of Object.values(porConselho || {})) for (const n of nomes) mapa[_chaveNome(n)] = n;
  for (const [alias, canon] of Object.entries(ALIAS_CONGS)) if (!mapa[_chaveNome(alias)]) mapa[_chaveNome(alias)] = canon;
  M._canon = mapa;
  return mapa;
}
function _canonNome(mapa, nome){
  const k = _chaveNome(nome);
  if (mapa[k]) return mapa[k];
  const cand = Object.keys(mapa).filter(ck => k && (k.includes(ck) || ck.includes(k)));
  return cand.length === 1 ? mapa[cand[0]] : String(nome || '').trim();
}
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
  hist: null,           // { ano_ini, mes_ini, ano_fim, mes_fim, conselho, congregacao, modo, mm, cmp }
  cats: null,           // chips das 4 categorias + total
  metas: undefined,     // undefined = ainda não carregado; null = API indisponível
  periodos: [],
  graf: null,
  dadosArrec: null, dadosHist: null,
  reqId: 0,
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
  else { if (M.metas === undefined) carregarMetasM(); renderMisHistorico(); }
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
  const [dadosMes, canon, conselhosMapa] = await Promise.all([SGEG.carregarMovimento(f.ano, f.mes), _canonMapaM(), SGEG.mapaConselhos()]);
  const mapaCons = conselhosMapa.mapa || {};
  const aba = abaDoMes(dadosMes, f.semana);
  /* Deduplica por nome canônico — grafias diferentes de anos distintos somam numa linha só */
  const linhasMap = {};
  for (const r of (aba?.registros || [])){
    if (f.conselho !== 'Todos' && _norm(r.conselho) !== _norm(f.conselho)) continue;
    const cn = _canonNome(canon, r.congregacao);
    const cur = linhasMap[cn] || (linhasMap[cn] = { nome: cn, conselho: mapaCons[cn] || r.conselho, ebd_missionaria: 0, culto_missoes: 0, oferta_missionaria: 0, circulo_oracao_mis: 0, total_missoes: 0 });
    const v = extrairMissoesReg(r);
    CONTAS_MIS.forEach(c => cur[c.chave] += v[c.chave]);
    cur.total_missoes += v.total_missoes;
  }
  const linhas = Object.values(linhasMap).sort((a, b) => ordemCongregacaoIdxG(a.nome, a.conselho) - ordemCongregacaoIdxG(b.nome, b.conselho));
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
   ABA 2 — Histórico & Evolução: evolução ≤12m, anual, comparar meses, tabela anual
   ============================================================================ */
const CATS_MIS = [...CONTAS_MIS, { chave: 'total_missoes', rotulo: 'Total Geral', cor: '#fbbf24' }];
const META_CHAVE = 'missoes_metas_anuais';
const parseMoedaM = s => { const t = String(s ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'); const n = parseFloat(t); return Number.isFinite(n) ? n : 0; };

function renderMisHistorico(){
  const corpo = $m('missoes-corpo');
  const ord = [...M.periodos].sort((a, b) => (+a.ano) - (+b.ano) || idxMesM(a.mes) - idxMesM(b.mes));
  const primeiro = ord[0] || { ano: '2023', mes: 'Janeiro' };
  const ult = ord[ord.length - 1] || { ano: String(new Date().getFullYear()), mes: ORDEM_MESES_M[new Date().getMonth()] };
  const anos = [...new Set(M.periodos.map(p => String(p.ano)))].sort().map(a => [a, a]);
  if (!anos.length) anos.push([ult.ano, ult.ano]);
  if (!M.hist) M.hist = { ano_ini: primeiro.ano, mes_ini: primeiro.mes, ano_fim: ult.ano, mes_fim: ult.mes, conselho: 'Todos', congregacao: 'Todas', modo: 'evolucao', mm: 3, cmp: [null, null] };
  if (!M.cats) M.cats = { ebd_missionaria: true, culto_missoes: true, oferta_missionaria: true, circulo_oracao_mis: true, total_missoes: true };
  const f = M.hist;
  const mesesOpts = ORDEM_MESES_M.map(m => [m, m]);
  const ehPeriodo = f.modo === 'evolucao', ehAnos = f.modo === 'anual' || f.modo === 'tabela', ehCmp = f.modo === 'comparar';

  corpo.innerHTML = `
    <div id="mis-metas-progresso" class="hidden grid-cols-2 gap-2"></div>
    <div class="border rounded-2xl p-3 space-y-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] font-bold uppercase opacity-60"><i class="fa-solid fa-filter text-orange-400 mr-1.5"></i>Filtros</span>
        <button onclick="abrirModalMetasM()" class="px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer" style="border-color:var(--border-color)"><i class="fa-solid fa-bullseye text-emerald-400 mr-1"></i>Metas anuais</button>
      </div>
      <div>
        <span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Modo de análise</span>
        ${selM('mh-modo', [['evolucao', 'Evolução mensal'], ['anual', 'Comparativo anual'], ['comparar', 'Comparar meses'], ['tabela', 'Tabela anual lado a lado']], f.modo, 'misModoMudou()')}
      </div>
      <p class="text-[10px] opacity-60" id="mh-resumo">${_resumoHist(f)}</p>
      <div class="grid grid-cols-2 gap-2">
        ${ehPeriodo ? `<div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">De</span><div class="flex gap-1.5">${selM('mh-ano-ini', anos, f.ano_ini, "misHistMudou('ini')")}${selM('mh-mes-ini', mesesOpts, f.mes_ini, "misHistMudou('ini')")}</div></div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Até</span><div class="flex gap-1.5">${selM('mh-ano-fim', anos, f.ano_fim, "misHistMudou('fim')")}${selM('mh-mes-fim', mesesOpts, f.mes_fim, "misHistMudou('fim')")}</div></div>` : ''}
        ${ehAnos ? `<div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Ano inicial</span>${selM('mh-ano-ini', anos, f.ano_ini, "misHistMudou()")}</div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Ano final</span>${selM('mh-ano-fim', anos, f.ano_fim, "misHistMudou()")}</div>` : ''}
        ${ehCmp ? `<div class="col-span-2"><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Meses a comparar (até 4)</span>
          <div id="mh-cmp-slots" class="flex flex-wrap gap-1.5"></div>
          <button onclick="misAddSlotM()" class="mt-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer" style="border-color:var(--border-color)"><i class="fa-solid fa-plus mr-1"></i>Mês</button></div>` : ''}
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Conselho</span><select id="mh-conselho" onchange="misHistConselho()" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todos">Todos os conselhos</option></select></div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Congregação</span><select id="mh-congregacao" onchange="misHistMudou()" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todas">Todas</option></select></div>
        ${(ehPeriodo || f.modo === 'anual') ? `<div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Média móvel</span>${selM('mh-mm', [['3', '3 meses'], ['6', '6 meses'], ['12', '12 meses']], String(f.mm), 'misMMMudou()')}</div>` : ''}
      </div>
      ${ehPeriodo ? '<p class="text-[9px] opacity-50"><i class="fa-solid fa-lock mr-1"></i>Período mensal limitado a 12 meses — para mais, use o comparativo anual.</p>' : ''}
      <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t" style="border-color:var(--border-color)">
        <span class="text-[9px] font-bold uppercase opacity-60 w-full">Categorias (toque para ligar/desligar):</span>
        ${CATS_MIS.map(c => `<button type="button" onclick="misToggleCatM('${c.chave}')" aria-pressed="${M.cats[c.chave]}" class="mis-chip px-2.5 py-1 rounded-full border text-[10px] font-bold cursor-pointer select-none" data-cat="${c.chave}" style="border-color:${M.cats[c.chave] ? c.cor : 'var(--border-color)'};opacity:${M.cats[c.chave] ? 1 : .45};color:${M.cats[c.chave] ? c.cor : 'var(--text-main)'}"><i class="fa-solid ${M.cats[c.chave] ? 'fa-check' : 'fa-xmark'} mr-1"></i>${c.rotulo}</button>`).join('')}
      </div>
      <button onclick="carregarMisHistorico(true)" class="w-full py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#c2410c,#fb923c)"><i class="fa-solid fa-chart-line mr-1.5"></i>Gerar</button>
    </div>
    <div id="mis-stats" class="grid grid-cols-2 gap-2"></div>
    <div id="mis-hist-kpis" class="grid grid-cols-2 gap-2"></div>
    <div id="mis-grafico-wrap" class="${f.modo === 'tabela' ? 'hidden ' : ''}border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <h3 class="font-bold text-xs mb-2 flex items-center gap-2"><i class="fa-solid fa-chart-column text-orange-400"></i><span id="mis-hist-titulo-graf">Evolução missionária</span></h3>
      <div class="h-64"><canvas id="mis-grafico"></canvas></div>
    </div>
    <div id="mis-tabela-wrap" class="${f.modo === 'tabela' ? '' : 'hidden '}border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <h3 class="font-bold text-xs mb-2 flex items-center gap-2"><i class="fa-solid fa-table-columns text-orange-400"></i>Visão anual — meses lado a lado</h3>
      <div class="overflow-x-auto"><table class="w-full text-[10px] text-left" id="mis-tabela-anual"></table></div>
    </div>
    <div id="mis-porcong-wrap" class="${f.modo === 'tabela' ? 'hidden ' : ''}border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
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
  if (ehCmp) _renderSlotsM();
  carregarMisHistorico();
}
function _resumoHist(f){
  const escopoTxt = `${f.conselho}${f.congregacao !== 'Todas' ? ' • ' + f.congregacao : ''}`;
  if (f.modo === 'anual' || f.modo === 'tabela') return `${f.modo === 'tabela' ? 'Tabela anual' : 'Anual'} · ${f.ano_ini} a ${f.ano_fim} • ${escopoTxt}`;
  if (f.modo === 'comparar') return `Comparativo livre entre meses • ${escopoTxt}`;
  return `${f.mes_ini}/${f.ano_ini} a ${f.mes_fim}/${f.ano_fim} • ${escopoTxt}`;
}
window.misModoMudou = function(){
  M.hist.modo = $m('mh-modo')?.value || 'evolucao';
  renderMisHistorico();
};
window.misMMMudou = function(){
  M.hist.mm = parseInt($m('mh-mm')?.value || '3', 10);
  _renderResultadosM();
};
window.misToggleCatM = function(chave){
  M.cats[chave] = !M.cats[chave];
  const on = M.cats[chave];
  const cor = CATS_MIS.find(c => c.chave === chave)?.cor || 'var(--border-color)';
  const chip = document.querySelector(`.mis-chip[data-cat="${chave}"]`);
  if (chip){
    chip.style.opacity = on ? '1' : '.45';
    chip.style.borderColor = on ? cor : 'var(--border-color)';
    chip.style.color = on ? cor : 'var(--text-main)';
    chip.setAttribute('aria-pressed', String(on));
    const i = chip.querySelector('i');
    if (i){ i.className = `fa-solid ${on ? 'fa-check' : 'fa-xmark'} mr-1`; }
  }
  _renderResultadosM();
};
window.misHistConselho = async function(){
  M.hist.conselho = $m('mh-conselho')?.value || 'Todos';
  M.hist.congregacao = 'Todas';
  await _popularCongsMis();
  const r = $m('mh-resumo'); if (r) r.textContent = _resumoHist(M.hist);
};
window.misHistMudou = function(lado){
  const f = M.hist;
  f.ano_ini = $m('mh-ano-ini')?.value ?? f.ano_ini; f.ano_fim = $m('mh-ano-fim')?.value ?? f.ano_fim;
  f.conselho = $m('mh-conselho')?.value || f.conselho;
  f.congregacao = $m('mh-congregacao')?.value || f.congregacao;
  if (f.modo === 'evolucao'){
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

/* Slots do modo "Comparar meses" */
function _renderSlotsM(){
  const wrap = $m('mh-cmp-slots'); if (!wrap) return;
  const agora = new Date();
  const anosOpts = [...new Set(M.periodos.map(p => String(p.ano)))].sort();
  wrap.innerHTML = M.hist.cmp.map((slot, i) => `
    <div class="flex items-center gap-1 border rounded-xl px-1.5 py-1" style="border-color:var(--border-color)">
      <select id="mh-cmp-ano-${i}" class="px-1.5 py-1 rounded-lg border text-[10px]" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">${anosOpts.map(a => `<option ${a === String(slot?.ano ?? (agora.getFullYear() - (M.hist.cmp.length - 1 - i))) ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <select id="mh-cmp-mes-${i}" class="px-1.5 py-1 rounded-lg border text-[10px]" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">${ORDEM_MESES_M.map(m => `<option ${m === (slot?.mes ?? ORDEM_MESES_M[agora.getMonth()]) ? 'selected' : ''}>${m}</option>`).join('')}</select>
      ${M.hist.cmp.length > 1 ? `<button onclick="misDelSlotM(${i})" class="opacity-50 text-red-400 cursor-pointer px-0.5"><i class="fa-solid fa-xmark"></i></button>` : ''}
    </div>`).join('');
}
function _capturarSlotsM(){
  M.hist.cmp = M.hist.cmp.map((slot, i) => ({
    ano: $m(`mh-cmp-ano-${i}`)?.value ?? slot?.ano,
    mes: $m(`mh-cmp-mes-${i}`)?.value ?? slot?.mes,
  }));
}
window.misAddSlotM = function(){
  if (M.hist.cmp.length >= 4){ toast('Máximo de 4 meses na comparação.'); return; }
  _capturarSlotsM();
  M.hist.cmp.push(null); _renderSlotsM();
};
window.misDelSlotM = function(i){ _capturarSlotsM(); M.hist.cmp.splice(i, 1); _renderSlotsM(); };

async function _popularConselhosMis(idSel, valor){
  const sel = $m(idSel); if (!sel) return;
  /* Conselhos vistos nos dados (histórico por ano) + mapa atual */
  const { porConselho } = await SGEG.mapaConselhos();
  sel.innerHTML = '<option value="Todos">Todos os conselhos</option>' + ordenarConselhosG(Object.keys(porConselho)).map(c => `<option value="${escM(c)}">${escM(c)}</option>`).join('');
  sel.value = valor || 'Todos';
}
async function _popularCongsMis(){
  const cong = $m('mh-congregacao'); if (!cong) return;
  const { porConselho } = await SGEG.mapaConselhos();
  const cons = $m('mh-conselho')?.value || 'Todos';
  const lista = cons === 'Todos' ? Object.values(porConselho).flat() : (porConselho[cons] || []);
  const unicas = ordenarCongregacoesG([...new Set(lista)]);
  cong.innerHTML = '<option value="Todas">Todas</option>' + unicas.map(c => `<option value="${escM(c)}">${escM(c)}</option>`).join('');
  cong.value = M.hist.congregacao || 'Todas';
}

const _zeraM = () => ({ ebd_missionaria: 0, culto_missoes: 0, oferta_missionaria: 0, circulo_oracao_mis: 0, total_missoes: 0 });
function _agregaMesM(cache, ano, mes, filtra, porCong, canon, mapaCons){
  const acc = _zeraM();
  const aba = abaDoMes(cache[`${ano}_${mes}`], 'FECHAMENTO DO MÊS');
  for (const r of (aba?.registros || [])){
    if (!filtra(r)) continue;
    const v = extrairMissoesReg(r);
    CONTAS_MIS.forEach(c => acc[c.chave] += v[c.chave]);
    acc.total_missoes += v.total_missoes;
    if (porCong){
      const cn = canon ? _canonNome(canon, r.congregacao) : (r.congregacao || '-');
      const cg = porCong[cn] || (porCong[cn] = { nome: cn, conselho: (mapaCons || {})[cn] || r.conselho, ..._zeraM() });
      CONTAS_MIS.forEach(c => cg[c.chave] += v[c.chave]);
      cg.total_missoes += v.total_missoes;
    }
  }
  return acc;
}

async function carregarMisHistorico(disparado){
  const f = M.hist;
  const reqId = ++M.reqId;
  const tbody = $m('mis-hist-tbody'), kpis = $m('mis-hist-kpis');
  if (!kpis) return;
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-xs" style="color:var(--text-muted)"><div class="spin inline-block mr-2"></div>Cruzando dados…</td></tr>';

  /* Universo de pontos conforme o modo */
  let pontos = [], pontosAnt = [], anosTabela = [];
  if (f.modo === 'anual'){
    const aI = Math.min(+f.ano_ini, +f.ano_fim), aF = Math.max(+f.ano_ini, +f.ano_fim);
    for (let a = aI; a <= aF; a++) pontos.push({ tipo: 'ano', ano: a, rotulo: String(a) });
  } else if (f.modo === 'comparar'){
    pontos = f.cmp.map((_, i) => {
      const ano = $m(`mh-cmp-ano-${i}`)?.value, mes = $m(`mh-cmp-mes-${i}`)?.value;
      return (ano && mes) ? { tipo: 'mes', ano: +ano, mes, rotulo: `${mes.slice(0, 3)}/${String(ano).slice(2)}` } : null;
    }).filter(Boolean);
    if (pontos.length < 2){ kpis.innerHTML = '<p class="text-[10px] opacity-60 col-span-2">Selecione ao menos 2 meses para comparar.</p>'; return; }
  } else if (f.modo === 'tabela'){
    const aI = Math.min(+f.ano_ini, +f.ano_fim), aF = Math.max(+f.ano_ini, +f.ano_fim);
    anosTabela = []; for (let a = aI; a <= aF; a++) anosTabela.push(a);
    if (anosTabela.length > 8){ anosTabela.length = 8; toast('Tabela limitada a 8 anos por vez.'); }
  } else {
    let ini = (+f.ano_ini) * 12 + idxMesM(f.mes_ini), fim = (+f.ano_fim) * 12 + idxMesM(f.mes_fim);
    if (ini > fim) [ini, fim] = [fim, ini];
    for (let v = ini; v <= fim; v++){
      const d = v - 1;
      pontos.push({ tipo: 'mes', ano: Math.floor(d / 12), mes: ORDEM_MESES_M[d % 12], rotulo: `${ORDEM_MESES_M[d % 12].slice(0, 3)}/${String(Math.floor(d / 12)).slice(2)}` });
    }
    /* YoY — mesma faixa no ano anterior */
    for (const p of pontos) pontosAnt.push({ tipo: 'mes', ano: p.ano - 1, mes: p.mes });
  }

  /* Meses necessários (deduplicados) */
  const mesesNec = new Set();
  for (const p of [...pontos, ...pontosAnt]){
    if (p.tipo === 'mes') mesesNec.add(`${p.ano}_${p.mes}`);
    else for (const mm of ORDEM_MESES_M) mesesNec.add(`${p.ano}_${mm}`);
  }
  for (const a of anosTabela) for (const mm of ORDEM_MESES_M) mesesNec.add(`${a}_${mm}`);
  const [canon, conselhosMapa] = await Promise.all([_canonMapaM(), SGEG.mapaConselhos()]);
  const mapaCons = conselhosMapa.mapa || {};
  const cache = {};
  await Promise.all([...mesesNec].map(async k => {
    const [a, m] = k.split('_');
    cache[k] = await SGEG.carregarMovimento(a, m);
  }));
  if (reqId !== M.reqId) return; // resposta atrasada — filtro já mudou

  const filtra = r =>
    (f.conselho === 'Todos' || _norm(r.conselho) === _norm(f.conselho)) &&
    (f.congregacao === 'Todas' || _canonNome(canon, r.congregacao) === f.congregacao);
  const porCong = {};

  const series = pontos.map(p => {
    const acc = _zeraM();
    const mesesDoPonto = p.tipo === 'mes' ? [[p.ano, p.mes]] : ORDEM_MESES_M.map(m => [p.ano, m]);
    for (const [a, m] of mesesDoPonto){
      const v = _agregaMesM(cache, a, m, filtra, porCong, canon, mapaCons);
      CONTAS_MIS.forEach(c => acc[c.chave] += v[c.chave]);
      acc.total_missoes += v.total_missoes;
    }
    return { rotulo: p.rotulo, ano: String(p.ano), ...acc };
  });

  const anterior = pontosAnt.map(p => ({ ..._agregaMesM(cache, p.ano, p.mes, filtra, null, canon, mapaCons) }));
  const tabela = f.modo === 'tabela' ? {
    anos: anosTabela.map(String),
    linhas: ORDEM_MESES_M.map(mes => ({
      mes,
      por_ano: Object.fromEntries(anosTabela.map(a => [String(a), _agregaMesM(cache, a, mes, filtra, porCong, canon, mapaCons)])),
    })),
  } : null;

  const tot = _zeraM();
  for (const s of series){ CONTAS_MIS.forEach(c => tot[c.chave] += s[c.chave]); tot.total_missoes += s.total_missoes; }
  if (tabela) for (const l of tabela.linhas) for (const a of tabela.anos){ const v = l.por_ano[a]; CONTAS_MIS.forEach(c => tot[c.chave] += v[c.chave]); tot.total_missoes += v.total_missoes; }
  M.dadosHist = { series, tot, porCong, anterior, tabela };
  _renderResultadosM();
  if (disparado) toast('Análise missionária atualizada.');
}
window.carregarMisHistorico = carregarMisHistorico;

/* ---------- Renderização (chips de categoria aplicados aqui, sem refetch) ---------- */
function _valorPontoM(s){
  let v = 0;
  for (const c of CONTAS_MIS) if (M.cats[c.chave]) v += numM(s?.[c.chave]);
  return v;
}
function _renderResultadosM(){
  const d = M.dadosHist; if (!d) return;
  const f = M.hist;
  const { series, tot, porCong, anterior, tabela } = d;

  /* KPIs respeitam os chips */
  const kpis = $m('mis-hist-kpis');
  if (kpis) kpis.innerHTML =
    CONTAS_MIS.filter(c => M.cats[c.chave]).map(c => cardM(c.rotulo, moedaM(tot[c.chave]), c.cor, c.fundo)).join('') +
    cardM(M.cats.total_missoes ? 'Total no período' : 'Total (marcadas)', moedaM(M.cats.total_missoes ? tot.total_missoes : _valorPontoM(tot)), '#fbbf24', 'rgba(251,191,36,.12)');

  _renderStatsM(d);
  _renderMetasM(d);
  if (f.modo === 'tabela'){ _renderTabelaM(tabela); return; }
  _renderGraficoM(series);
  const tbody = $m('mis-hist-tbody');
  if (tbody){
    const linhas = Object.values(porCong).sort((a, b) => ordemCongregacaoIdxG(a.nome, a.conselho) - ordemCongregacaoIdxG(b.nome, b.conselho));
    tbody.innerHTML = linhas.length ? linhas.map(l => `
      <tr class="border-b" style="border-color:var(--border-color)">
        <td class="py-2 pr-2"><span class="font-semibold">${escM(l.nome)}</span><span class="block text-[9px] opacity-50">${escM(l.conselho)}</span></td>
        ${CONTAS_MIS.map(c => `<td class="py-2 px-1 text-right tabular-nums ${l[c.chave] && M.cats[c.chave] ? '' : 'opacity-30'}">${l[c.chave] && M.cats[c.chave] ? moedaM(l[c.chave]) : '-'}</td>`).join('')}
        <td class="py-2 pl-1 text-right tabular-nums font-bold text-orange-400">${moedaM(_valorPontoM(l))}</td>
      </tr>`).join('')
      : '<tr><td colspan="6" class="py-8 text-center text-xs" style="color:var(--text-muted)">Sem arrecadação missionária no período/filtro.</td></tr>';
  }
}

function _renderGraficoM(series){
  const f = M.hist;
  const tit = $m('mis-hist-titulo-graf');
  if (tit) tit.textContent = { evolucao: 'Evolução mensal missionária', anual: `Comparativo anual · ${Math.min(+f.ano_ini, +f.ano_fim)} a ${Math.max(+f.ano_ini, +f.ano_fim)}`, comparar: 'Comparativo entre meses' }[f.modo] || 'Missões';
  if (M.graf){ try { M.graf.destroy(); } catch(e){} M.graf = null; }
  const cv = $m('mis-grafico');
  if (!cv || !window.Chart) return;
  M.graf = new Chart(cv.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map(s => s.rotulo),
      datasets: CATS_MIS.filter(c => M.cats[c.chave]).map(c => ({
        label: c.rotulo, data: series.map(s => +numM(s[c.chave]).toFixed(2)),
        backgroundColor: c.cor, borderRadius: 3, maxBarThickness: 18,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false, normalized: true,
      animation: series.length > 10 ? false : { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${moedaM(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { font: { size: 9 }, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { font: { size: 9 }, callback: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) } },
      },
    },
  });
}

function _renderStatsM(d){
  const box = $m('mis-stats'); if (!box) return;
  const f = M.hist;
  const series = d.series || [];
  if (f.modo === 'tabela' || !series.length){ box.innerHTML = ''; return; }
  const vals = series.map(_valorPontoM);
  const ult = vals[vals.length - 1], ant = vals.length > 1 ? vals[vals.length - 2] : null;
  const n = Math.max(1, f.mm || 3);
  const janela = vals.slice(-n);
  const mm = janela.length ? janela.reduce((a, b) => a + b, 0) / janela.length : 0;
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;
  let yoy = null;
  if (f.modo === 'evolucao' && d.anterior?.length){
    const somaAnt = d.anterior.reduce((a, s) => a + _valorPontoM(s), 0);
    const somaAtual = vals.reduce((a, b) => a + b, 0);
    if (somaAnt > 0.004) yoy = (somaAtual - somaAnt) / somaAnt * 100;
  } else if (f.modo === 'anual' && series.length > 1){
    const a = _valorPontoM(series[series.length - 2]), b = _valorPontoM(series[series.length - 1]);
    if (a > 0.004) yoy = (b - a) / a * 100;
  }
  const pct = v => (v === null || v === undefined || !isFinite(v)) ? '<span class="opacity-40">—</span>' : `<span class="${v >= 0 ? 'text-emerald-500' : 'text-red-500'}">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
  const stat = (rotulo, valor, det, ico, cor) => `
    <div class="border rounded-xl p-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
      <p class="text-[9px] font-bold uppercase opacity-60 flex items-center gap-1"><i class="fa-solid ${ico}" style="color:${cor}"></i>${rotulo}</p>
      <p class="mt-1 text-sm font-black tabular-nums">${valor}</p>
      <p class="text-[9px] opacity-50 mt-0.5">${det}</p>
    </div>`;
  box.innerHTML =
    stat('Crescimento vs anterior', pct(ant && Math.abs(ant) > 0.004 ? (ult - ant) / Math.abs(ant) * 100 : null), `${moedaM(ant || 0)} → ${moedaM(ult)}`, 'fa-arrow-trend-up', '#38bdf8') +
    stat(`Média móvel ${n} períodos`, moedaM(mm), pct(media > 0.004 ? (ult - media) / media * 100 : null) + ' vs média', 'fa-wave-square', '#a78bfa') +
    stat('Média do período', moedaM(media), ult >= media ? 'Último acima da média' : 'Último abaixo da média', 'fa-scale-balanced', '#f59e0b') +
    stat('Vs. ano anterior', pct(yoy), f.modo === 'evolucao' ? 'Mesma faixa, ano anterior' : 'Último ano vs penúltimo', 'fa-calendar-check', '#ec4899');
}

function _renderTabelaM(tabela){
  const tb = $m('mis-tabela-anual'); if (!tb || !tabela) return;
  const anos = tabela.anos || [];
  const cel = v => `<td class="py-1.5 px-1.5 text-right tabular-nums border-b" style="border-color:var(--border-color)">${v > 0.004 ? moedaM(v) : '<span class="opacity-25">—</span>'}</td>`;
  let html = `<thead><tr class="border-b" style="border-color:var(--border-color)"><th class="py-1.5 pr-1.5 opacity-60">Mês</th>${anos.map(a => `<th class="py-1.5 px-1.5 text-right opacity-60">${a}</th>`).join('')}${anos.length > 1 ? '<th class="py-1.5 pl-1.5 text-right opacity-60">Δ ano</th>' : ''}</tr></thead><tbody>`;
  const totVals = anos.map(() => 0);
  for (const l of tabela.linhas){
    const vals = anos.map(a => _valorPontoM(l.por_ano?.[a]));
    vals.forEach((v, i) => totVals[i] += v);
    const u = vals[vals.length - 1], p = vals.length > 1 ? vals[vals.length - 2] : null;
    const dl = (p !== null && p > 0.004) ? (u - p) / p * 100 : null;
    html += `<tr><td class="py-1.5 pr-1.5 font-semibold border-b" style="border-color:var(--border-color)">${escM(l.mes.slice(0, 3))}</td>${vals.map(cel).join('')}${anos.length > 1 ? `<td class="py-1.5 pl-1.5 text-right tabular-nums font-bold border-b ${dl === null ? 'opacity-30' : dl >= 0 ? 'text-emerald-500' : 'text-red-500'}" style="border-color:var(--border-color)">${dl === null ? '—' : (dl >= 0 ? '+' : '') + dl.toFixed(1) + '%'}</td>` : ''}</tr>`;
  }
  const tdl = (totVals.length > 1 && totVals[totVals.length - 2] > 0.004) ? (totVals[totVals.length - 1] - totVals[totVals.length - 2]) / totVals[totVals.length - 2] * 100 : null;
  html += `<tr class="font-bold" style="background:var(--bg-input)"><td class="py-1.5 pr-1.5">TOTAL</td>${totVals.map(v => `<td class="py-1.5 px-1.5 text-right tabular-nums text-orange-400">${moedaM(v)}</td>`).join('')}${anos.length > 1 ? `<td class="py-1.5 pl-1.5 text-right tabular-nums ${tdl === null ? 'opacity-30' : tdl >= 0 ? 'text-emerald-500' : 'text-red-500'}">${tdl === null ? '—' : (tdl >= 0 ? '+' : '') + tdl.toFixed(1) + '%'}</td>` : ''}</tr>`;
  tb.innerHTML = html + '</tbody>';
}

/* ---------- Metas anuais (app_config via sge-api) ---------- */
async function carregarMetasM(){
  try {
    const res = await api('obter_config_sge', { chave: META_CHAVE }, sessao()?.token);
    M.metas = res?.valor ? (JSON.parse(res.valor) || {}) : {};
  } catch(e){ M.metas = null; }
  if (M.aba === 'historico' && M.dadosHist) _renderMetasM(M.dadosHist);
}
function _metaAnoM(ano, chave){
  const m = (M.metas || {})[String(ano)] || {};
  if (chave === 'total_missoes'){
    const dir = numM(m.total_missoes);
    if (dir > 0) return dir;
    return CONTAS_MIS.reduce((a, c) => a + numM(m[c.chave]), 0);
  }
  return numM(m[chave]);
}
function _renderMetasM(d){
  const box = $m('mis-metas-progresso'); if (!box) return;
  if (!M.metas){ box.classList.add('hidden'); box.classList.remove('grid'); box.innerHTML = ''; return; }
  const realizado = {};
  for (const s of (d.series || [])){
    const a = String(s.ano || ''); if (!a) continue;
    realizado[a] = realizado[a] || _zeraM();
    for (const c of CATS_MIS) realizado[a][c.chave] += numM(s[c.chave]);
  }
  for (const l of (d.tabela?.linhas || [])) for (const a of (d.tabela.anos || [])){
    realizado[a] = realizado[a] || _zeraM();
    for (const c of CATS_MIS) realizado[a][c.chave] += numM(l.por_ano?.[a]?.[c.chave]);
  }
  const anosMeta = Object.keys(realizado).filter(a => _metaAnoM(a, 'total_missoes') > 0).sort();
  if (!anosMeta.length){ box.classList.add('hidden'); box.classList.remove('grid'); box.innerHTML = ''; return; }
  box.classList.remove('hidden'); box.classList.add('grid');
  box.innerHTML = anosMeta.map(ano => {
    const rA = realizado[ano] || {};
    const meta = _metaAnoM(ano, 'total_missoes');
    const pct = meta > 0 ? Math.min(999, numM(rA.total_missoes) / meta * 100) : 0;
    const cor = pct >= 100 ? '#10b981' : pct >= 60 ? '#fb923c' : '#38bdf8';
    return `<div class="border rounded-xl p-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex justify-between items-baseline"><span class="text-[9px] font-bold uppercase opacity-60"><i class="fa-solid fa-bullseye mr-1" style="color:${cor}"></i>Meta ${ano}</span><b class="text-[10px]" style="color:${cor}">${pct.toFixed(0)}%</b></div>
      <div class="h-1.5 rounded-full overflow-hidden mt-1.5" style="background:var(--bg-input)"><div class="h-full rounded-full" style="width:${Math.min(100, pct)}%;background:${cor}"></div></div>
      <p class="text-[9px] opacity-60 mt-1 tabular-nums">${moedaM(rA.total_missoes)} / ${moedaM(meta)}</p>
    </div>`;
  }).join('');
}
window.abrirModalMetasM = function(){
  if (M.metas === null){ toast('Metas ficam disponíveis após atualização do servidor.'); return; }
  const old = $m('modal-mis-metas'); if (old) old.remove();
  const anosOpts = [...new Set(M.periodos.map(p => String(p.ano)))].sort();
  const anoAtual = String(new Date().getFullYear());
  const m = (M.metas || {})[anoAtual] || {};
  const el = document.createElement('div');
  el.id = 'modal-mis-metas';
  el.className = 'fixed inset-0 z-[95] flex items-center justify-center p-4';
  el.style.cssText = 'background:rgba(2,6,23,.8);backdrop-filter:blur(6px)';
  el.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl p-4 border" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm"><i class="fa-solid fa-bullseye text-emerald-400 mr-1.5"></i>Metas anuais de Missões</h3>
        <button onclick="document.getElementById('modal-mis-metas').remove()" class="opacity-60 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <label class="block text-xs mb-2"><span class="font-bold opacity-70">Ano</span>
        <select id="meta-ano-m" class="w-full mt-1 px-2.5 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">${anosOpts.map(a => `<option ${a === anoAtual ? 'selected' : ''}>${a}</option>`).join('')}</select>
      </label>
      <div class="grid grid-cols-2 gap-2">
        ${CONTAS_MIS.map(c => `<label class="block text-xs"><span class="font-bold opacity-70 text-[10px]">${c.rotulo}</span><input id="meta-m-${c.chave}" inputmode="decimal" placeholder="0,00" class="w-full mt-1 px-2.5 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></label>`).join('')}
      </div>
      <label class="block text-xs mt-2"><span class="font-bold opacity-70 text-[10px]">Meta total do ano (vazio = soma das contas)</span><input id="meta-m-total" inputmode="decimal" placeholder="0,00" class="w-full mt-1 px-2.5 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></label>
      <div class="flex gap-2 mt-3">
        <button onclick="salvarMetasM()" class="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"><i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
        <button onclick="document.getElementById('modal-mis-metas').remove()" class="flex-1 py-2.5 rounded-xl bg-slate-600 text-white font-bold text-xs cursor-pointer">Fechar</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const selAno = el.querySelector('#meta-ano-m');
  const preenche = ano => {
    const mm = (M.metas || {})[String(ano)] || {};
    const fmt = v => numM(v) > 0 ? numM(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
    CONTAS_MIS.forEach(c => { const i = el.querySelector(`#meta-m-${c.chave}`); if (i) i.value = fmt(mm[c.chave]); });
    const t = el.querySelector('#meta-m-total'); if (t) t.value = fmt(mm.total_missoes);
  };
  selAno.onchange = () => preenche(selAno.value);
  preenche(anoAtual);
};
window.salvarMetasM = async function(){
  const el = $m('modal-mis-metas'); if (!el) return;
  const ano = el.querySelector('#meta-ano-m')?.value;
  const novo = { ...(M.metas || {}) };
  novo[String(ano)] = { total_missoes: parseMoedaM(el.querySelector('#meta-m-total')?.value) };
  CONTAS_MIS.forEach(c => novo[String(ano)][c.chave] = parseMoedaM(el.querySelector(`#meta-m-${c.chave}`)?.value));
  try {
    const res = await api('salvar_config_sge', { chave: META_CHAVE, valor: JSON.stringify(novo) }, sessao()?.token);
    if (res?.erro) { toast(res.erro); return; }
    M.metas = novo;
    el.remove();
    toast('Metas anuais salvas na nuvem.');
    if (M.dadosHist) _renderMetasM(M.dadosHist);
  } catch(e){ toast(e.message || 'Falha ao salvar metas.'); }
};

/* API de depuração/testes */
window.SGEM = { extrairMissoesReg, abaDoMes, M };

})();
