/* ============================================================================
   SGE Mobile — Financeiro & Tesouraria / Rol de Dizimistas (somente leitura)
   Replica core/sge_bridge.py: listar_membros_dizimistas,
   obter_historico_dizimos_membro, obter_historico_congregacoes_membro
   Depende de: api(), sessao(), toast(), brl(), MESES, SGEG (gestao.js)
   ============================================================================ */
(function(){
'use strict';

const MESES_ORD = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const moeda = v => brl(num(v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el = id => document.getElementById(id);
const cf = s => String(s ?? '').toLowerCase().trim();

const F = {
  membros: null,            // cache lista completa (nuvem)
  lancPorAno: {},           // cache lançamentos por ano
  lancTodos: null,          // cache lançamentos completos (frequência)
  histCongs: null,          // cache histórico congregações
  filtros: { conselho: 'Todos', congregacao: 'Todas', status: 'Todos', busca: '' },
  membroSel: null,
  aba: 'rol',
  fq: { ano: String(new Date().getFullYear()), mes: MESES_ORD[new Date().getMonth()], conselho: 'Todos', congregacao: 'Todas', perfil: 'Todos', faixa: null, dados: null },
};

/* ---------- parsing de moeda (paridade com _parse_valor_moeda) ---------- */
function parseValor(v){
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
const _numPeriodo = (ano, mes) => { const a = parseInt(ano, 10) || 0; const m = MESES_ORD.indexOf(mes) + 1 || 1; return a * 100 + m; };
const _idMatch = (campo, id) => {
  const c = String(campo ?? '').trim(), i = String(id ?? '').trim();
  const n = parseInt(i, 10);
  return c === i || (Number.isFinite(n) && c === String(n).padStart(6, '0'));
};

/* ---------- camada de dados ---------- */
async function carregarMembros(force = false){
  if (F.membros && !force) return F.membros;
  const res = await api('listar_membros', null, sessao()?.token);
  F.membros = res?.dados || res?.membros || res || [];
  if (!Array.isArray(F.membros)) F.membros = [];
  return F.membros;
}
async function carregarLancamentosAno(ano){
  const a = String(ano);
  if (!F.lancPorAno[a]) F.lancPorAno[a] = (async () => {
    const res = await api('listar_lancamentos', { ano: a }, sessao()?.token);
    return res?.dados || res || [];
  })();
  return F.lancPorAno[a];
}
async function carregarTodosLancamentos(){
  if (!F.lancTodos) F.lancTodos = (async () => {
    const res = await api('listar_lancamentos', null, sessao()?.token);
    return res?.dados || res || [];
  })();
  return F.lancTodos;
}
async function carregarHistoricoCongs(){
  if (!F.histCongs) F.histCongs = (async () => {
    const res = await api('listar_historico_congregacoes', null, sessao()?.token);
    return res?.dados || res || [];
  })();
  return F.histCongs;
}

/* ---------- listar_membros_dizimistas (paridade desktop) ---------- */
function listarMembrosDizimistas({ conselho = 'Todos', congregacao = 'Todas', busca = '', status = 'Todos' } = {}){
  const termo = cf(busca);
  const out = [];
  for (const m of (F.membros || [])){
    if (String(m.excluido_em ?? '').trim()) continue;
    const cons = m.conselho || 'Conselho 1';
    const cong = m.congregacao || 'Sede';
    const nome = m.nome || 'Membro Sem Nome';
    const tel = m.telefone || '-';
    const inativo = !!(String(m.data_inativacao ?? '').trim() && !String(m.data_reativacao ?? '').trim());
    if (!['Todos', 'Todas', '', null].includes(conselho) && cf(cons) !== cf(conselho)) continue;
    if (!['Todas', 'Todos', '', null].includes(congregacao) && cf(cong) !== cf(congregacao)) continue;
    const telLimpo = String(tel).replace(/\D/g, '');
    const temTel = tel && tel !== '-' && telLimpo.length >= 8;
    if (status === 'Ativos' && inativo) continue;
    if (status === 'Inativos' && !inativo) continue;
    if (status === 'Com Telefone' && !temTel) continue;
    if (status === 'Sem Telefone' && temTel) continue;
    if (termo && !cf(nome).includes(termo) && !cf(m.id).includes(termo) && !cf(tel).includes(termo)) continue;
    out.push({ id: m.id, nome, conselho: cons, congregacao: cong, telefone: tel,
      status: inativo ? 'Inativo' : 'Ativo', data_inativacao: m.data_inativacao || '' });
  }
  out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return out;
}

/* ---------- obter_historico_dizimos_membro (paridade desktop) ---------- */
async function obterHistoricoDizimos(idMembro, anoDe, mesDe, anoAte, mesAte){
  const mId = String(idMembro ?? '').trim();
  const mem = (F.membros || []).find(x => _idMatch(x.id, mId));
  const pIni = _numPeriodo(anoDe, mesDe), pFim = _numPeriodo(anoAte, mesAte);
  const anos = new Set();
  for (let a = parseInt(anoDe, 10); a <= parseInt(anoAte, 10); a++) anos.add(String(a));
  if (!anos.size) anos.add(String(anoDe || new Date().getFullYear()));
  const listas = await Promise.all([...anos].map(carregarLancamentosAno));
  const rows = listas.flat().filter(r => _idMatch(r.id, mId));

  const historico = []; let total = 0;
  for (const r of rows){
    const p = _numPeriodo(r.ano, r.mes);
    if (pIni && p < pIni) continue;
    if (pFim && p > pFim) continue;
    const v = parseValor(r.valor);
    let forma = 'Espécie';
    try {
      const parcelas = typeof r.detalhes_parcelas === 'string' ? JSON.parse(r.detalhes_parcelas || '[]') : (r.detalhes_parcelas || []);
      const e = (parcelas || []).reduce((a, i) => a + parseValor(i?.especie), 0);
      const x = (parcelas || []).reduce((a, i) => a + parseValor(i?.pix), 0);
      forma = e > 0 && x > 0 ? 'Misto' : x > 0 ? 'PIX / Transferência' : 'Espécie';
    } catch(_){}
    total += v;
    historico.push({ ano: String(r.ano ?? ''), mes: String(r.mes ?? ''), semana: String(r.semana ?? ''),
      valor: v, forma, data: String(r.data_envio || '-'), status: String(r.status || 'Enviado'),
      conselho: r.destino_conselho || mem?.conselho || 'Conselho 1',
      congregacao: r.destino_congregacao || mem?.congregacao || 'Sede' });
  }
  historico.sort((a, b) => (+b.ano) - (+a.ano) || MESES_ORD.indexOf(a.mes) - MESES_ORD.indexOf(b.mes) || a.semana.localeCompare(b.semana));
  return { sucesso: true,
    membro: { id: mId, nome: mem?.nome || mId, conselho: mem?.conselho || 'Conselho 1', congregacao: mem?.congregacao || 'Sede' },
    total_registros: historico.length, total_acumulado: total, historico };
}

/* ---------- obter_historico_congregacoes_membro (paridade desktop) ---------- */
async function obterHistoricoCongregacoes(idMembro){
  const mId = String(idMembro ?? '').trim();
  const mem = (F.membros || []).find(x => _idMatch(x.id, mId));
  const consM = mem?.conselho || 'Conselho 1', congM = mem?.congregacao || 'Sede';
  const todos = await carregarHistoricoCongs();
  const regs = (todos || [])
    .filter(r => _idMatch(r.id_membro, mId))
    .map(r => ({ conselho: r.conselho || consM, congregacao: r.congregacao || congM,
      data_inicio: r.data_inicio || '01/2026', data_fim: r.data_fim || 'Ativo',
      status: r.status || 'Ativo', data_efetivacao: r.data_efetivacao || '' }))
    .sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio)));
  if (!regs.length) regs.push({ conselho: consM, congregacao: congM, data_inicio: '01/2026', data_fim: 'Ativo', status: 'Ativo', data_efetivacao: '' });
  return { sucesso: true, membro: { id: mId, nome: mem?.nome || mId, conselho: consM, congregacao: congM }, historico: regs };
}

/* ===================== UI — Rol de Dizimistas ===================== */
const selF = (id, opts, val, onchange) => `<select id="${id}" ${onchange ? `onchange="${onchange}"` : ''} class="px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;

window.renderFinanceiro = function(){
  el('dash-conteudo').innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center gap-3 pb-3 border-b" style="border-color:var(--border-color)">
        <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background:rgba(139,92,246,.12)"><i class="fa-solid fa-hand-holding-dollar text-lg text-purple-400"></i></div>
        <div class="flex-1 min-w-0"><h2 class="font-bold text-sm">Financeiro & Tesouraria</h2><p class="text-[10px] opacity-60">Dizimistas — somente leitura</p></div>
      </div>
      <div class="flex gap-2" id="fin-tabs">
        ${['rol','frequencia'].map(t => `<button onclick="finAba('${t}')" data-aba="${t}" class="flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer fin-tab">${t === 'rol' ? '<i class="fa-solid fa-users-line mr-1"></i>Rol de Dizimistas' : '<i class="fa-solid fa-chart-line mr-1"></i>Frequência / Turnover'}</button>`).join('')}
        ${rcPodeVer() ? `<button onclick="finAba('relatorio')" data-aba="relatorio" class="flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer fin-tab"><i class="fa-solid fa-file-invoice-dollar mr-1"></i>Relatório de Caixa</button>` : ''}
      </div>
      <div id="fin-sub"></div>
    </div>
`;
  finAba(F.aba === 'relatorio' && !rcPodeVer() ? 'rol' : (F.aba || 'rol'));
};

window.finAba = function(aba){
  F.aba = aba;
  document.querySelectorAll('#fin-tabs .fin-tab').forEach(b => {
    const ativa = b.dataset.aba === aba;
    b.style.background = ativa ? 'linear-gradient(135deg,#7c3aed,#8b5cf6)' : 'var(--bg-card)';
    b.style.color = ativa ? '#fff' : 'var(--text-muted)';
    b.style.borderColor = ativa ? 'transparent' : 'var(--border-color)';
  });
  if (aba === 'relatorio') return rcRenderTela();
  if (aba === 'frequencia') return finRenderFrequencia();
  finRenderRol();
};

function finRenderRol(){
  el('fin-sub').innerHTML = `
    <div class="space-y-3">
      <div class="border rounded-2xl p-3 space-y-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="grid grid-cols-2 gap-2">
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Conselho</span><select id="dz-conselho" onchange="dzMudaConselho()" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todos">Todos</option></select></div>
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Congregação</span><select id="dz-congregacao" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todas">Todas</option></select></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Status</span>${selF('dz-status', [['Todos','Todos'],['Ativos','Ativos'],['Inativos','Inativos'],['Com Telefone','Com Telefone'],['Sem Telefone','Sem Telefone']], F.filtros.status)}</div>
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Busca</span><input id="dz-busca" value="${esc(F.filtros.busca)}" placeholder="Nome, ID ou telefone…" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></div>
        </div>
        <button onclick="dzCarregar()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#7c3aed,#8b5cf6)"><i class="fa-solid fa-magnifying-glass mr-1.5"></i>Filtrar dizimistas</button>
      </div>
      <p id="dz-total" class="text-[10px] font-bold uppercase opacity-60 px-1">Carregando…</p>
      <div id="dz-lista" class="space-y-2"><div class="flex items-center justify-center gap-2.5 py-14 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando membros…</div></div>
    </div>
`;
  _dzPopularConselhos();
  dzCarregar();
}

/* modal criado no <body> — fora de qualquer contexto de empilhamento/filtro */
function _dzModal(){
  let m = el('dz-modal');
  if (!m){
    const host = document.createElement('div');
    host.innerHTML = `<div id="dz-modal" class="hidden fixed inset-0 z-[80] flex items-center justify-center px-4" style="background:rgba(0,0,0,.55)">
      <div class="w-full max-w-lg max-h-[82vh] flex flex-col rounded-3xl border theme-transition" style="background:var(--bg-surface);border-color:var(--border-color)">
        <div class="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <div class="min-w-0"><h3 id="dz-modal-titulo" class="font-bold text-sm truncate"></h3><p id="dz-modal-sub" class="text-[10px] opacity-60"></p></div>
          <button onclick="dzFecharModal()" class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer" style="background:var(--bg-input)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="dz-modal-filtros" class="px-4 pb-2 shrink-0"></div>
        <div id="dz-modal-corpo" class="overflow-y-auto px-4 pb-6 space-y-2" style="-webkit-overflow-scrolling:touch"></div>
      </div>
    </div>`;
    document.body.appendChild(host.firstElementChild);
    m = el('dz-modal');
  }
  return m;
}

async function _dzPopularConselhos(){
  try {
    const { porConselho } = await SGEG.mapaConselhos();
    const sel = el('dz-conselho'); if (!sel) return;
    sel.innerHTML = '<option value="Todos">Todos</option>' + Object.keys(porConselho).sort().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    sel.value = F.filtros.conselho || 'Todos';
    await dzMudaConselho();
  } catch(e){}
}
window.dzMudaConselho = async function(){
  const sel = el('dz-conselho'), cong = el('dz-congregacao');
  if (!sel || !cong) return;
  const { porConselho } = await SGEG.mapaConselhos();
  const lista = sel.value === 'Todos' ? Object.values(porConselho).flat() : (porConselho[sel.value] || []);
  cong.innerHTML = '<option value="Todas">Todas</option>' + [...new Set(lista)].sort().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
};

window.dzCarregar = async function(){
  const f = F.filtros;
  f.conselho = el('dz-conselho')?.value || 'Todos';
  f.congregacao = el('dz-congregacao')?.value || 'Todas';
  f.status = el('dz-status')?.value || 'Todos';
  f.busca = el('dz-busca')?.value || '';
  const lista = el('dz-lista');
  lista.innerHTML = '<div class="flex items-center justify-center gap-2.5 py-14 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando membros…</div>';
  try {
    await carregarMembros();
    const membros = listarMembrosDizimistas(f);
    el('dz-total').textContent = `${membros.length} membro(s) cadastrados`;
    lista.innerHTML = membros.map(m => {
      const ativo = m.status === 'Ativo';
      return `<div class="border rounded-2xl p-3 flex items-center gap-3" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:rgba(139,92,246,.12)"><i class="fa-solid fa-user text-purple-400"></i></div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-xs truncate">${esc(m.nome)}</p>
          <p class="text-[10px] opacity-60 truncate">${esc(m.conselho)} • ${esc(m.congregacao)}</p>
          <p class="text-[10px] opacity-50 font-mono">${esc(m.telefone)}</p>
        </div>
        <div class="flex flex-col items-end gap-1.5 shrink-0">
          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold border ${ativo ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : 'text-red-500 border-red-500/30 bg-red-500/10'}">${m.status}</span>
          <div class="flex gap-1">
            <button onclick="dzHistDizimos('${esc(m.id)}')" class="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style="background:rgba(139,92,246,.15)" title="Histórico de Dízimos"><i class="fa-solid fa-sack-dollar text-[11px] text-purple-400"></i></button>
            <button onclick="dzHistCongs('${esc(m.id)}')" class="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style="background:rgba(245,158,11,.15)" title="Histórico de Congregações"><i class="fa-solid fa-building-columns text-[11px] text-amber-500"></i></button>
          </div>
        </div>
      </div>`;
    }).join('') || '<p class="text-center text-xs opacity-60 py-10">Nenhum membro localizado com os filtros selecionados.</p>';
  } catch(e){
    lista.innerHTML = `<p class="text-center text-xs text-red-500 py-10">${esc(e.message || 'Falha ao carregar membros.')}</p>`;
  }
};

/* ---------- modal: histórico de dízimos ---------- */
window.dzHistDizimos = async function(id){
  _dzModal();
  const mem = (F.membros || []).find(x => _idMatch(x.id, id)) || { id, nome: id };
  F.membroSel = id;
  el('dz-modal-titulo').textContent = `Histórico de Dízimos — ${mem.nome}`;
  el('dz-modal-sub').textContent = `ID do Membro: ${id} • ${mem.conselho || ''} • ${mem.congregacao || ''}`;
  const anosDisp = [...new Set((F.membros || []).length ? ['2025','2026','2027'] : ['2026'])];
  const mesesOpts = MESES_ORD.map(m => [m, m]);
  el('dz-modal-filtros').innerHTML = `
    <div class="flex items-end gap-2">
      <div><span class="text-[9px] font-bold uppercase opacity-60 block mb-0.5">De</span><div class="flex gap-1">${selF('dzh-ano-de', anosDisp.map(a => [a, a]), '2026')}${selF('dzh-mes-de', mesesOpts, 'Janeiro')}</div></div>
      <div><span class="text-[9px] font-bold uppercase opacity-60 block mb-0.5">Até</span><div class="flex gap-1">${selF('dzh-ano-ate', anosDisp.map(a => [a, a]), '2026')}${selF('dzh-mes-ate', mesesOpts, 'Dezembro')}</div></div>
      <button onclick="dzFiltrarHist()" class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white shrink-0 cursor-pointer" style="background:#7c3aed"><i class="fa-solid fa-filter"></i></button>
    </div>`;
  el('dz-modal').classList.remove('hidden');
  await dzFiltrarHist();
};

window.dzFiltrarHist = async function(){
  const corpo = el('dz-modal-corpo');
  corpo.innerHTML = '<div class="flex items-center justify-center gap-2.5 py-10 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando extrato…</div>';
  try {
    const r = await obterHistoricoDizimos(F.membroSel,
      el('dzh-ano-de').value, el('dzh-mes-de').value, el('dzh-ano-ate').value, el('dzh-mes-ate').value);
    if (!r.historico.length){
      corpo.innerHTML = '<p class="text-center text-xs opacity-60 py-8">Nenhum lançamento no período selecionado.</p>';
      return;
    }
    corpo.innerHTML = `
      <div class="border rounded-xl p-3 flex items-center justify-between" style="background:rgba(139,92,246,.08);border-color:var(--border-color)">
        <span class="text-[10px] font-bold uppercase opacity-70">Total acumulado • ${r.total_registros} lançamento(s)</span>
        <strong class="text-sm text-purple-400 tabular-nums">${moeda(r.total_acumulado)}</strong>
      </div>
      ${r.historico.map(h => `<div class="border rounded-xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-bold">${esc(h.mes)}/${esc(h.ano)} • ${esc(h.semana)}</p>
          <strong class="text-xs text-emerald-500 tabular-nums">${moeda(h.valor)}</strong>
        </div>
        <p class="text-[10px] opacity-60 mt-1">${esc(h.conselho)} • ${esc(h.congregacao)}</p>
        <div class="flex items-center gap-2 mt-1.5">
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold" style="background:var(--bg-input)">${esc(h.forma)}</span>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${/enviado|confirmado/i.test(h.status) ? 'text-emerald-500' : 'text-amber-500'}" style="background:var(--bg-input)">${esc(h.status)}</span>
          <span class="text-[9px] opacity-50 ml-auto">${esc(h.data)}</span>
        </div>
      </div>`).join('')}`;
  } catch(e){
    corpo.innerHTML = `<p class="text-center text-xs text-red-500 py-8">${esc(e.message || 'Falha ao carregar histórico.')}</p>`;
  }
};

/* ---------- modal: histórico de congregações ---------- */
window.dzHistCongs = async function(id){
  _dzModal();
  const mem = (F.membros || []).find(x => _idMatch(x.id, id)) || { id, nome: id };
  el('dz-modal-titulo').textContent = `Histórico de Congregações — ${mem.nome}`;
  el('dz-modal-sub').textContent = `ID do Membro: ${id} • atual: ${mem.conselho || ''} • ${mem.congregacao || ''}`;
  el('dz-modal-filtros').innerHTML = '';
  el('dz-modal').classList.remove('hidden');
  const corpo = el('dz-modal-corpo');
  corpo.innerHTML = '<div class="flex items-center justify-center gap-2.5 py-10 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando histórico…</div>';
  try {
    const r = await obterHistoricoCongregacoes(id);
    corpo.innerHTML = r.historico.map((h, i) => `<div class="border rounded-xl p-3 flex items-center gap-3" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:rgba(245,158,11,.12)"><i class="fa-solid fa-building-columns text-amber-500"></i></div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-xs truncate">${esc(h.congregacao)}</p>
          <p class="text-[10px] opacity-60">${esc(h.conselho)} • ${esc(h.data_inicio)} → ${esc(h.data_fim)}</p>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${/ativo/i.test(h.status) ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : 'text-sky-400 border-sky-500/30 bg-sky-500/10'}">${esc(h.status)}</span>
      </div>`).join('') || '<p class="text-center text-xs opacity-60 py-8">Sem histórico de congregações.</p>';
  } catch(e){
    corpo.innerHTML = `<p class="text-center text-xs text-red-500 py-8">${esc(e.message || 'Falha ao carregar histórico.')}</p>`;
  }
};

window.dzFecharModal = function(){ el('dz-modal').classList.add('hidden'); };


/* ===================== Frequência / Turnover BI =====================
   Port fiel de sge_bridge.obter_dados_frequencia_bi (somente leitura) */

const _normIdMembro = v => {
  let t = String(v ?? '').trim();
  if (!t || ['nan','none','null','-'].includes(t.toLowerCase())) return '';
  if (/^\d+\.0$/.test(t)) t = t.slice(0, -2);
  const d = t.replace(/\D/g, '');
  return d && parseInt(d, 10) > 0 ? String(parseInt(d, 10)).padStart(6, '0') : '';
};
const _nomeCongExib = nome => {
  const texto = String(nome ?? '').trim();
  if (!texto) return '';
  const exc = new Set(['pp','p.p','ad','umad']);
  const lig = new Set(['a','as','e','da','das','de','do','dos','em']);
  return texto.toLowerCase().split(/\s+/).map(p => {
    const limpo = p.replace(/[.,()-]/g, '');
    return exc.has(limpo) ? p.toUpperCase() : lig.has(limpo) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1);
  }).join(' ');
};
const _periodoIdx = (ano, mes) => {
  const i = MESES_ORD.findIndex(m => m.toLowerCase() === String(mes ?? '').trim().toLowerCase());
  const a = parseInt(ano, 10);
  return i < 0 || !Number.isFinite(a) ? null : a * 12 + i;
};
const _rotuloPeriodo = p => `${MESES_ORD[p % 12]}/${Math.floor(p / 12)}`;
const _numSemana = s => { const m = String(s ?? '').match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
const _formaContrib = parcelas => {
  try {
    const itens = typeof parcelas === 'string' ? JSON.parse(parcelas || '[]') : (parcelas || []);
    const e = (itens || []).reduce((a, i) => a + parseValor(i?.especie), 0);
    const x = (itens || []).reduce((a, i) => a + parseValor(i?.pix), 0);
    if (e > 0 && x > 0) return 'Misto';
    if (x > 0) return 'PIX / Transferência';
  } catch(_){}
  return 'Espécie';
};
const _classificarFreq = (periodos, ref) => {
  const hist = [...periodos].filter(p => p <= ref).sort((a, b) => a - b);
  if (!hist.length) return ['Ausente', null];
  const mesesAus = ref - hist[hist.length - 1];
  if (mesesAus > 0) return ['Ausente', mesesAus];
  if (hist[0] >= ref - 1 && hist.length <= 2) return ['Novo Dizimista', 0];
  for (let p = ref - 2; p <= ref; p++) if (!periodos.has(p)) return ['Irregular', 0];
  return ['Recorrente / Fiel', 0];
};
const FQ_CHAVES = { 'Recorrente / Fiel': 'recorrentes', 'Irregular': 'irregulares', 'Novo Dizimista': 'novos', 'Ausente': 'ausentes' };

async function dadosFrequenciaBI({ ano, mes, conselho = 'Todos', congregacao = 'Todas' }){
  await carregarMembros();
  const lancamentos = await carregarTodosLancamentos();
  const hoje = new Date();
  const referencia = _periodoIdx(ano, mes) ?? (hoje.getFullYear() * 12 + hoje.getMonth());

  const contribuicoes = {}, ultimos = {};
  for (const r of lancamentos){
    if (parseValor(r.valor) <= 0) continue;
    const per = _periodoIdx(r.ano, r.mes);
    if (per === null || per > referencia) continue;
    const chave = _normIdMembro(r.id);
    if (!chave) continue;
    (contribuicoes[chave] = contribuicoes[chave] || new Set()).add(per);
    const ordem = [per, _numSemana(r.semana)];
    if (!ultimos[chave] || ordem[0] > ultimos[chave][0][0] || (ordem[0] === ultimos[chave][0][0] && ordem[1] > ultimos[chave][0][1]))
      ultimos[chave] = [ordem, r.semana, r.valor, r.detalhes_parcelas];
  }

  const contagem = { recorrentes: 0, irregulares: 0, novos: 0, ausentes: 0, ativos: 0, inativos: 0 };
  const faixas = { '1': 0, '2': 0, '3': 0, '6': 0, nunca: 0 };
  const detalhes = [], membrosAtivos = [];
  const porConselho = {}, porCongregacao = {};

  for (const m of (F.membros || [])){
    if (String(m.excluido_em ?? '').trim()) continue;
    const consM = String(m.conselho || '').trim();
    const congM = _nomeCongExib(m.congregacao);
    if (!['', 'Todos', 'Todas'].includes(conselho ?? 'Todos') && consM.toLowerCase() !== String(conselho).toLowerCase()) continue;
    if (!['', 'Todos', 'Todas'].includes(congregacao ?? 'Todas') && congM.toLowerCase() !== String(congregacao).toLowerCase()) continue;

    const inativo = !!(String(m.data_inativacao ?? '').trim() && !String(m.data_reativacao ?? '').trim());
    if (inativo){ contagem.inativos++; continue; }
    const chave = _normIdMembro(m.id);
    const periodos = contribuicoes[chave] || new Set();
    const [perfil, mesesAus] = _classificarFreq(periodos, referencia);
    const ch = FQ_CHAVES[perfil];
    contagem[ch]++;
    membrosAtivos.push([consM, periodos]);
    for (const mapa of [porConselho, porCongregacao]){
      const nome = mapa === porConselho ? (consM || 'Sem conselho') : (congM || 'Sem congregação');
      (mapa[nome] = mapa[nome] || { recorrentes: 0, irregulares: 0, novos: 0, ausentes: 0 })[ch]++;
    }
    if (mesesAus === null) faixas.nunca++;
    else for (const lim of [1, 2, 3, 6]) if (mesesAus >= lim) faixas[String(lim)]++;

    const ult = ultimos[chave];
    detalhes.push({ id: String(m.id ?? ''), nome: String(m.nome ?? ''), conselho: consM, congregacao: congM,
      perfil, meses_ausente: mesesAus,
      ultima_contribuicao: ult ? `${_numSemana(ult[1])}ª Semana • ${_rotuloPeriodo(ult[0][0])}` : 'Nunca contribuiu',
      ultimo_valor: ult ? parseValor(ult[2]) : 0,
      ultima_forma: ult ? _formaContrib(ult[3]) : '-',
      meses_com_contribuicao: periodos.size });
  }
  detalhes.sort((a, b) => (-(a.meses_ausente ?? 9999) + (b.meses_ausente ?? 9999)) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const total = contagem.recorrentes + contagem.irregulares + contagem.novos + contagem.ausentes;
  contagem.ativos = total;
  const perc = {};
  for (const k of ['recorrentes', 'irregulares', 'novos', 'ausentes']) perc[k] = total ? contagem[k] / total * 100 : 0;

  const evolucao = [];
  for (let p = Math.max(0, referencia - 11); p <= referencia; p++){
    const linha = { periodo: _rotuloPeriodo(p), recorrentes: 0, irregulares: 0, novos: 0, ausentes: 0 };
    for (const [, periodos] of membrosAtivos) linha[FQ_CHAVES[_classificarFreq(periodos, p)[0]]]++;
    evolucao.push(linha);
  }
  return { sucesso: true, ...contagem, faixas_ausencia: faixas, percentuais: perc,
    evolucao_mensal: evolucao, por_conselho: porConselho, por_congregacao: porCongregacao,
    taxa_fidelidade: `${(total ? contagem.recorrentes / total * 100 : 0).toFixed(1)}%`,
    total_avaliados: total, data_referencia: _rotuloPeriodo(referencia), membros: detalhes };
}

/* ---------- UI frequência ---------- */
const FQ_CORES = { recorrentes: '#10b981', irregulares: '#f59e0b', novos: '#d946ef', ausentes: '#ef4444' };
let _fqChart = null;

function finRenderFrequencia(){
  const fq = F.fq;
  el('fin-sub').innerHTML = `
    <div class="space-y-3">
      <div class="border rounded-2xl p-3 space-y-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="grid grid-cols-2 gap-2">
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Ano</span>${selF('fq-ano', _fqAnos(), fq.ano)}</div>
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Mês de referência</span>${selF('fq-mes', MESES_ORD.map(m => [m, m]), fq.mes)}</div>
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Conselho</span><select id="fq-conselho" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todos">Todos</option></select></div>
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Congregação</span><select id="fq-congregacao" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todas">Todas</option></select></div>
        </div>
        <button onclick="fqCarregar()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#7c3aed,#8b5cf6)"><i class="fa-solid fa-chart-line mr-1.5"></i>Analisar frequência</button>
      </div>
      <div id="fq-corpo"><div class="flex items-center justify-center gap-2.5 py-14 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando frequência…</div></div>
    </div>`;
  _fqPopularFiltros();
  fqCarregar();
}

function _fqAnos(){
  const anos = new Set(['2024','2025','2026','2027', String(new Date().getFullYear())]);
  return [...anos].sort().map(a => [a, a]);
}
async function _fqPopularFiltros(){
  try {
    await carregarMembros();
    const cons = [...new Set((F.membros || []).map(m => String(m.conselho || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const congs = [...new Set((F.membros || []).map(m => _nomeCongExib(m.congregacao)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const sc = el('fq-conselho'), sg = el('fq-congregacao');
    if (sc) sc.innerHTML = '<option value="Todos">Todos</option>' + cons.map(c => `<option ${c === F.fq.conselho ? 'selected' : ''}>${esc(c)}</option>`).join('');
    if (sg) sg.innerHTML = '<option value="Todas">Todas</option>' + congs.map(c => `<option ${c === F.fq.congregacao ? 'selected' : ''}>${esc(c)}</option>`).join('');
  } catch(e){}
}

window.fqCarregar = async function(){
  const fq = F.fq;
  fq.ano = el('fq-ano')?.value || fq.ano;
  fq.mes = el('fq-mes')?.value || fq.mes;
  fq.conselho = el('fq-conselho')?.value || 'Todos';
  fq.congregacao = el('fq-congregacao')?.value || 'Todas';
  fq.faixa = null;
  const corpo = el('fq-corpo');
  corpo.innerHTML = '<div class="flex items-center justify-center gap-2.5 py-14 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Analisando frequência…</div>';
  try {
    fq.dados = await dadosFrequenciaBI(fq);
    _fqRenderCorpo();
  } catch(e){
    corpo.innerHTML = `<p class="text-center text-xs text-red-500 py-10">${esc(e.message || 'Falha ao carregar frequência.')}</p>`;
  }
};

function _fqRenderCorpo(){
  const d = F.fq.dados;
  if (!d || F.aba !== 'frequencia') return;
  const kpi = (rotulo, n, cor, pct) => `<div class="border rounded-xl p-3 min-w-0" style="background:var(--bg-card);border-color:var(--border-color)">
    <p class="text-[9px] font-bold uppercase opacity-60 truncate">${rotulo}</p>
    <p class="text-lg font-bold tabular-nums" style="color:${cor}">${n}</p>
    <p class="text-[9px] opacity-50">${pct}</p></div>`;
  el('fq-corpo').innerHTML = `
    <p class="text-[10px] font-bold uppercase opacity-60 px-1">Competência ${esc(d.data_referencia)} • ${d.total_avaliados} membros ativos avaliados • Taxa geral de fidelidade: <span class="text-emerald-500">${esc(d.taxa_fidelidade)}</span></p>
    <div class="grid grid-cols-2 gap-2">
      ${kpi('Recorrentes / Fiéis', d.recorrentes, FQ_CORES.recorrentes, d.percentuais.recorrentes.toFixed(1) + '%')}
      ${kpi('Irregulares', d.irregulares, FQ_CORES.irregulares, d.percentuais.irregulares.toFixed(1) + '%')}
      ${kpi('Novos Dizimistas', d.novos, FQ_CORES.novos, d.percentuais.novos.toFixed(1) + '%')}
      ${kpi('Ausentes', d.ausentes, FQ_CORES.ausentes, d.percentuais.ausentes.toFixed(1) + '%')}
    </div>
    <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <h3 class="font-bold text-xs mb-2">Faixas de ausência <span class="opacity-50 font-normal">(toque para filtrar)</span></h3>
      <div class="flex flex-wrap gap-1.5">
        ${[['1','1+ mês'],['2','2+ meses'],['3','3+ meses'],['6','6+ meses'],['nunca','Nunca contribuiu']].map(([k, t]) =>
          `<button onclick="fqFaixa('${k}')" class="px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${F.fq.faixa === k ? 'text-white' : ''}" style="border-color:var(--border-color);${F.fq.faixa === k ? 'background:#ef4444;border-color:transparent;' : 'background:var(--bg-input)'}">${t}: <b>${d.faixas_ausencia[k] || 0}</b></button>`).join('')}
        ${F.fq.faixa ? `<button onclick="fqFaixa(null)" class="px-2.5 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer opacity-70" style="border-color:var(--border-color)">Limpar</button>` : ''}
      </div>
    </div>
    <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <h3 class="font-bold text-xs mb-2">Evolução mensal dos perfis</h3>
      <div class="relative h-52"><canvas id="fq-grafico"></canvas></div>
    </div>
    <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex items-center justify-between gap-2 mb-2">
        <h3 class="font-bold text-xs">Distribuição territorial</h3>
        ${selF('fq-visao', [['conselho','Por conselho'],['congregacao','Por congregação']], 'conselho', 'fqRenderTerritorios()')}
      </div>
      <div id="fq-territorios" class="space-y-2"></div>
    </div>
    <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex items-center justify-between gap-2 mb-2">
        <h3 class="font-bold text-xs">Acompanhamento <span id="fq-lista-n" class="opacity-50 font-normal"></span></h3>
        ${selF('fq-perfil', [['Todos','Todos os perfis'],['Recorrente / Fiel','Recorrente / Fiel'],['Irregular','Irregular'],['Novo Dizimista','Novo Dizimista'],['Ausente','Ausente']], F.fq.perfil, 'fqRenderLista()')}
      </div>
      <div id="fq-lista" class="space-y-2"></div>
    </div>`;
  fqRenderTerritorios();
  fqRenderLista();
  _fqGrafico();
}

window.fqFaixa = function(k){ F.fq.faixa = F.fq.faixa === k ? null : k; _fqRenderCorpo(); };

window.fqRenderTerritorios = function(){
  const d = F.fq.dados; if (!d) return;
  const dados = el('fq-visao')?.value === 'congregacao' ? d.por_congregacao : d.por_conselho;
  el('fq-territorios').innerHTML = Object.entries(dados || {}).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([nome, p]) => {
    const total = (p.recorrentes || 0) + (p.irregulares || 0) + (p.novos || 0) + (p.ausentes || 0);
    return `<div class="border rounded-lg p-2.5" style="border-color:var(--border-color)">
      <div class="flex justify-between gap-2"><span class="font-bold text-xs truncate">${esc(nome)}</span><span class="text-[10px] opacity-60 shrink-0">${total} ativos</span></div>
      <div class="grid grid-cols-4 gap-1.5 mt-2 text-[10px]">
        <span class="text-emerald-500">Fiéis <b>${p.recorrentes || 0}</b></span>
        <span class="text-amber-500">Irreg. <b>${p.irregulares || 0}</b></span>
        <span class="text-fuchsia-400">Novos <b>${p.novos || 0}</b></span>
        <span class="text-red-400">Aus. <b>${p.ausentes || 0}</b></span>
      </div></div>`;
  }).join('') || '<p class="text-xs opacity-60 text-center py-6">Sem dados para os filtros selecionados.</p>';
};

window.fqRenderLista = function(){
  const d = F.fq.dados; if (!d) return;
  F.fq.perfil = el('fq-perfil')?.value || 'Todos';
  const faixa = F.fq.faixa;
  const linhas = (d.membros || []).filter(m => {
    if (F.fq.perfil !== 'Todos' && m.perfil !== F.fq.perfil) return false;
    if (faixa === 'nunca') return m.meses_ausente === null;
    if (faixa) return m.meses_ausente !== null && m.meses_ausente >= Number(faixa);
    return true;
  });
  el('fq-lista-n').textContent = `• ${linhas.length} membro(s)`;
  el('fq-lista').innerHTML = linhas.map(m => {
    const aus = m.meses_ausente === null ? 'Nunca contribuiu' : m.meses_ausente === 0 ? 'Em dia' : `${m.meses_ausente} ${m.meses_ausente === 1 ? 'mês' : 'meses'} sem dizimar`;
    const corAus = m.meses_ausente === null || m.meses_ausente >= 3 ? 'text-red-500' : m.meses_ausente >= 1 ? 'text-amber-500' : 'text-emerald-500';
    const corPerfil = { 'Recorrente / Fiel': 'text-emerald-500', 'Irregular': 'text-amber-500', 'Novo Dizimista': 'text-fuchsia-400', 'Ausente': 'text-red-400' }[m.perfil] || '';
    return `<div class="border rounded-xl p-3" style="background:var(--bg-input);border-color:var(--border-color)">
      <div class="flex items-center justify-between gap-2">
        <p class="font-bold text-xs truncate min-w-0">${esc(m.nome)}</p>
        <span class="text-[9px] font-bold ${corPerfil} shrink-0">${esc(m.perfil)}</span>
      </div>
      <p class="text-[10px] opacity-60 truncate">${esc(m.conselho)} • ${esc(m.congregacao)}</p>
      <div class="flex items-center justify-between gap-2 mt-1.5">
        <button onclick="dzHistDizimos('${esc(m.id)}')" class="text-[10px] text-sky-400 font-bold cursor-pointer text-left truncate" title="Histórico de dízimos"><i class="fa-solid fa-clock-rotate-left mr-1"></i>${esc(m.ultima_contribuicao)}</button>
        <div class="text-right shrink-0">
          <p class="text-[11px] font-bold tabular-nums">${moeda(m.ultimo_valor)}</p>
          <p class="text-[9px] opacity-50">${esc(m.ultima_forma)} • <b class="${corAus}">${aus}</b></p>
        </div>
      </div>
    </div>`;
  }).join('') || '<p class="text-xs opacity-60 text-center py-6">Nenhum membro nesta classificação.</p>';
};

function _fqGrafico(){
  const canvas = el('fq-grafico');
  if (!canvas || typeof Chart === 'undefined') return;
  const series = F.fq.dados?.evolucao_mensal || [];
  if (_fqChart) _fqChart.destroy();
  const ds = (rotulo, chave, cor) => ({ label: rotulo, data: series.map(i => i[chave]), borderColor: cor, backgroundColor: cor, tension: .3 });
  _fqChart = new Chart(canvas, { type: 'line',
    data: { labels: series.map(i => i.periodo), datasets: [
      ds('Fiel', 'recorrentes', FQ_CORES.recorrentes), ds('Irregular', 'irregulares', FQ_CORES.irregulares),
      ds('Novo', 'novos', FQ_CORES.novos), ds('Ausente', 'ausentes', FQ_CORES.ausentes)] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 10 } } },
      scales: { x: { ticks: { color: '#94a3b8', maxRotation: 45 }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 }, grid: { color: 'rgba(148,163,184,.12)' } } } } });
}

/* ===================== Relatório de Caixa (Tesouraria) ===================== */
/* Porta mobile do relatório — mesma estrutura de dados do desktop:
   lancamentos: [{tipo, recibo, descricao, valor}] gravados via sge-api. */

const RC_TIPOS = [
  'OFERTA ORDINARIA', 'OFERTA ORDINARIA - TB',
  'OFERTA MISSIONARIA', 'OFERTA MISSIONARIA - TB',
  'DIZIMOS', 'DIZIMOS - TB',
  'SAIDAS', 'SAIDAS - TB',
];
const RC_TITULOS = {
  'OFERTA ORDINARIA': 'OFERTAS', 'OFERTA ORDINARIA - TB': 'OFERTA PIX',
  'OFERTA MISSIONARIA': 'OFERTA MISSIONÁRIA', 'OFERTA MISSIONARIA - TB': 'OFERTA MISSIONÁRIA PIX',
  'DIZIMOS': 'DÍZIMOS', 'DIZIMOS - TB': 'DÍZIMOS PIX',
  'SAIDAS': 'SAÍDAS', 'SAIDAS - TB': 'SAÍDAS PIX',
};
const RC_SECOES = RC_TIPOS.map(t => ({ tipo: t, titulo: RC_TITULOS[t] }));
const RC_VERIFICA_URL = 'https://cdaniel09917-design.github.io/sge/verificar.html';
const RCM_CSS = `<style>
.rcm-doc{font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#000;background:#fff;border:1px solid #000;min-width:540px;margin:0 auto;box-shadow:0 10px 30px rgba(0,0,0,.35);border-radius:8px;overflow:hidden;position:relative}
.rcm-doc table{border-collapse:collapse;width:100%}
.rcm-doc th,.rcm-doc td{border:1px solid #000;padding:2px 4px}
.rcm-doc .rcm-head{border:1px solid #000;padding:0;background:#fff}
.rcm-doc .rcm-timbrado{display:block;margin:0 auto;max-width:100%;max-height:78px;object-fit:contain;padding:4px 8px 3px;background:#fff}
.rcm-doc .rcm-head-flex{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:3px 6px;border-bottom:1px solid #000}
.rcm-doc .rcm-title{font-size:13px;font-weight:bold;letter-spacing:1.2px;border:1px solid #000;padding:3px 10px;background:#e6e6e6;color:#000;white-space:nowrap}
.rcm-doc .rcm-meta-box{display:flex;border:1px solid #000}
.rcm-doc .rcm-meta-item{padding:3px 8px;text-align:center;border-right:1px solid #000;background:#fff;display:flex;flex-direction:column;justify-content:center}
.rcm-doc .rcm-meta-item:last-child{border-right:none}
.rcm-doc .rcm-meta-label{font-size:6.5px;font-weight:bold;letter-spacing:.5px;color:#333}
.rcm-doc .rcm-meta-val{font-size:9.5px;font-weight:bold;text-align:center;white-space:nowrap}
.rcm-doc .rcm-cong{text-align:center;padding:3px;background:#e6e6e6;font-weight:bold;font-size:10px;letter-spacing:.8px;color:#000}
.rcm-doc .rcm-cols th{background:#e6e6e6;color:#000;font-size:8px;letter-spacing:.5px;padding:3px}
.rcm-doc td{height:14px;font-size:9px}
.rcm-doc .rcm-sec{background:#ececec;font-weight:bold;text-align:center;letter-spacing:1px;font-size:8px}
.rcm-doc .rcm-sub{background:#f2f2f2;font-weight:bold;text-align:right;font-size:8px}
.rcm-doc .rcm-subt th{background:#e6e6e6;color:#000;font-size:8px;letter-spacing:.5px;padding:3px 4px}
.rcm-doc .rcm-subt td{font-size:8px}
.rcm-doc .rcm-totais{display:flex;justify-content:space-between;gap:4%;padding:7px;border:1px solid #000;border-top:none}
.rcm-doc .rcm-saldo{background:#e6e6e6!important;color:#000!important;font-weight:bold}
.rcm-doc .rcm-visto{display:flex;flex-direction:column;height:64px;border:1px solid #000;margin-top:7px}
.rcm-doc .rcm-visto>div{padding:3px 5px;font-weight:bold;font-size:7px;letter-spacing:.5px;position:relative;flex:1}
.rcm-doc .rcm-visto-caixa{border-bottom:1px solid #000}
.rcm-doc .rcm-visto>div::after{content:'';position:absolute;left:6px;right:6px;bottom:5px;border-bottom:1px solid #000}
.rcm-doc .rcm-verifica{display:flex;align-items:center;gap:8px;border:1px solid #000;border-top:none;padding:5px 8px;background:#fff}
.rcm-doc .rcm-verifica canvas,.rcm-doc .rcm-verifica img{width:56px!important;height:56px!important}
.rcm-doc .rcm-hash{font-size:6.5px;letter-spacing:.4px;color:#333;line-height:1.5;word-break:break-all}
.rcm-doc .rcm-hash b{font-size:7px}
.rcm-doc .rcm-rodape{padding:4px 8px;border:1px solid #000;border-top:none;text-align:center;font-size:6.5px;letter-spacing:1px;color:#555;background:#f7f7f7}
.rcm-doc .rcm-marca{position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none;z-index:5;overflow:hidden}
.rcm-doc .rcm-marca span{font-size:44px;font-weight:bold;letter-spacing:6px;transform:rotate(-28deg);white-space:nowrap}
.rcm-doc .rcm-marca.rcm-m-rascunho{display:flex}
.rcm-doc .rcm-marca.rcm-m-rascunho span{color:rgba(120,120,120,.10)}
.rcm-doc .rcm-marca.rcm-m-enviado{display:flex}
.rcm-doc .rcm-marca.rcm-m-enviado span{color:rgba(16,110,60,.12)}
</style>`;

const RC = { lancamentos: [], id: null, status: 'rascunho', congs: null, somenteLeitura: false, podeEditar: true, modo: 'editar', autor: '', gravadoEm: '', meta: { congregacao: '', conselho: '', data: '', semana: '2ª Semana' } };

function rcDadosUsuario(){
  const u = sessao()?.usuario || {};
  const ac = u.acessos || {};
  return {
    admin: String(u.perfil || '').toLowerCase() === 'administrador',
    tesoureiro: !!(u.tesoureiro ?? ac.tesoureiro),
    congFixa: String(u.congregacao_tesoureiro ?? ac.congregacao_tesoureiro ?? '').trim(),
  };
}
function rcPodeVer(){ const d = rcDadosUsuario(); return d.admin || d.tesoureiro; }
function rcEhAdmin(){ return rcDadosUsuario().admin; }
function rcCongFixa(){ const d = rcDadosUsuario(); return (d.tesoureiro && !d.admin) ? d.congFixa : ''; }
const rcMoeda = v => moeda(v);
const rcEsc = esc;

/* djb2 — mesmo fallback do verificador (verificar.html) */
function rcmHashSync(texto){
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h.toString(16).toUpperCase().padStart(8, '0');
}
async function rcmHashVerificacao(texto){
  try {
    if (crypto?.subtle){
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16).toUpperCase();
    }
  } catch(e){}
  return rcmHashSync(texto);
}

function rcmTotais(){
  const t = { ent: 0, sai: 0, entDin: 0, entTB: 0, saiDin: 0, saiTB: 0, saldo: 0 };
  RC.lancamentos.forEach(l => {
    const sai = l.tipo.includes('SAIDAS'), tb = l.tipo.includes('TB');
    if (sai){ t.sai += l.valor; tb ? t.saiTB += l.valor : t.saiDin += l.valor; }
    else { t.ent += l.valor; tb ? t.entTB += l.valor : t.entDin += l.valor; }
  });
  t.saldo = t.ent - t.sai;
  return t;
}

async function rcCarregarCongregacoes(){
  if (RC.congs) return RC.congs;
  try {
    const res = await api('listar_congregacoes', null, sessao()?.token);
    RC.congs = (res?.dados || []).filter(c => c.ativo !== 0 && c.ativo !== false);
  } catch(e){ RC.congs = []; }
  return RC.congs;
}

function rcRenderTela(){
  const congFixa = rcCongFixa();
  const hoje = new Date();
  const dataPadrao = String(hoje.getDate()).padStart(2,'0') + '/' + String(hoje.getMonth()+1).padStart(2,'0') + '/' + hoje.getFullYear();
  const semEdicao = RC.somenteLeitura && !RC.podeEditar;
  const badge = RC.status === 'enviado'
    ? '<span class="text-[8px] font-extrabold uppercase px-2 py-1 rounded-full shrink-0" style="background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.35)"><i class="fa-solid fa-circle-check mr-0.5"></i>Enviado</span>'
    : '<span class="text-[8px] font-extrabold uppercase px-2 py-1 rounded-full shrink-0" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.35)"><i class="fa-solid fa-circle-exclamation mr-0.5"></i>Rascunho</span>';
  el('fin-sub').innerHTML = `
    <div class="space-y-3">
      ${RC.somenteLeitura ? `<div class="rounded-xl px-3 py-2 text-[11px] font-bold flex items-center gap-2" style="background:rgba(56,189,248,.12);color:#38bdf8;border:1px solid rgba(56,189,248,.3)"><i class="fa-solid fa-eye"></i>Visualizando relatório ${RC.status === 'enviado' ? 'enviado' : 'recebido'} — somente leitura${RC.podeEditar ? ' • toque em CORRIGIR para retificar' : ''}</div>` : ''}
      ${!RC.somenteLeitura && RC.status === 'enviado' && RC.id ? `<div class="rounded-xl px-3 py-2 text-[11px] font-bold flex items-center gap-2" style="background:rgba(234,88,12,.12);color:#fb923c;border:1px solid rgba(234,88,12,.3)"><i class="fa-solid fa-screwdriver-wrench"></i>Retificação — o relatório segue enviado; GRAVAR salva a nova versão</div>` : ''}
      <div class="flex items-center gap-2">
        <div class="flex-1 grid grid-cols-2 gap-1 p-1 rounded-2xl border" style="background:var(--bg-input);border-color:var(--border-color)">
          <button id="rcm-tab-editar" onclick="rcmModo('editar')" ${semEdicao ? 'disabled' : ''} class="py-2 rounded-xl text-[11px] font-extrabold cursor-pointer" style="color:${semEdicao ? 'var(--text-muted);opacity:.35;cursor:not-allowed' : 'var(--text-muted)'}"><i class="fa-solid fa-pen-to-square mr-1"></i>Editar</button>
          <button id="rcm-tab-previa" onclick="rcmModo('previa')" class="py-2 rounded-xl text-[11px] font-extrabold cursor-pointer" style="color:var(--text-muted)"><i class="fa-solid fa-file-lines mr-1"></i>Prévia</button>
        </div>
        ${badge}
      </div>
      <div class="grid grid-cols-3 gap-2">${rcmAcoesHtml()}</div>
      ${!RC.somenteLeitura && RC.id && RC.status === 'rascunho' ? `<div class="rounded-xl px-3 py-2 text-[10px] font-bold flex items-center gap-2" style="background:rgba(245,158,11,.10);color:#f59e0b;border:1px solid rgba(245,158,11,.25)"><i class="fa-solid fa-circle-exclamation"></i>Gravado como rascunho — resta ENVIAR para a central receber</div>` : ''}
      <div id="rcm-view-editar" class="space-y-3">
        <div class="border rounded-2xl p-3 space-y-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
          <div class="grid grid-cols-2 gap-2">
            <div class="col-span-2"><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Congregação</span>
              <select id="rcm-congregacao" ${congFixa ? 'disabled' : ''} onchange="rcmRenderDoc();rcmAvisoSemana()" class="w-full px-2 py-2 rounded-lg border text-xs font-semibold" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></select>
              ${congFixa ? '<p class="text-[9px] opacity-50 mt-1"><i class="fa-solid fa-lock mr-1"></i>Congregação fixa do tesoureiro</p>' : ''}
            </div>
            <div id="rcm-aviso-semana" class="col-span-2"></div>
            <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Data</span>
              <input id="rcm-data" value="${esc(F.rcData || dataPadrao)}" placeholder="DD/MM/AAAA" maxlength="10" inputmode="numeric" oninput="rcmMascaraData(this)" class="w-full px-2 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></div>
            <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Fechamento</span>
              ${selF('rcm-semana', [['1ª Semana','1ª Semana'],['2ª Semana','2ª Semana'],['3ª Semana','3ª Semana'],['4ª Semana','4ª Semana'],['5ª Semana','5ª Semana']], F.rcSemana || '2ª Semana', "F.rcSemana=this.value;rcmRenderDoc();rcmAvisoSemana()")}</div>
          </div>
        </div>
        <div class="border rounded-2xl p-3 space-y-2" style="background:var(--bg-card);border-color:var(--border-color)">
          <p class="text-[10px] font-bold uppercase opacity-60">Novo lançamento</p>
          ${selF('rcm-tipo', RC_TIPOS.map(t => [t, RC_TITULOS[t]]), null, "rcmToggleRecibo()")}
          <div class="grid grid-cols-2 gap-2">
            <input id="rcm-recibo" placeholder="Nº Recibo" inputmode="numeric" class="px-2 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
            <input id="rcm-valor" type="number" step="0.01" min="0" placeholder="Valor (R$)" inputmode="decimal" class="px-2 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
          </div>
          <input id="rcm-descricao" placeholder="Descrição / Histórico" class="w-full px-2 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
          <button onclick="rcmAdicionar()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#059669,#10b981)"><i class="fa-solid fa-plus mr-1.5"></i>Adicionar lançamento</button>
        </div>
        <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
          <p class="text-[10px] font-bold uppercase opacity-60 mb-2">Movimento do caixa</p>
          <div id="rcm-lista"></div>
          <div id="rcm-totais" class="mt-2 pt-2 border-t text-xs space-y-1" style="border-color:var(--border-color)"></div>
        </div>
      </div>
      <div id="rcm-view-previa" class="hidden space-y-1.5">
        <div class="border rounded-2xl p-2" style="background:var(--bg-card);border-color:var(--border-color);overflow-x:auto;-webkit-overflow-scrolling:touch">
          <div id="rcm-doc"></div>
        </div>
        <p class="text-[9px] opacity-40 text-center">Documento em tamanho de papel — deslize para o lado para conferir tudo</p>
      </div>
      <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[10px] font-bold uppercase opacity-60"><i class="fa-solid fa-inbox mr-1"></i>Central de relatórios</p>
          <button onclick="rcmCentral()" class="text-[10px] font-bold cursor-pointer opacity-70"><i class="fa-solid fa-rotate mr-1"></i>Atualizar</button>
        </div>
        <div id="rcm-central"><p class="text-[11px] opacity-50 py-3 text-center">Toque em Atualizar para listar.</p></div>
      </div>
    </div>${RCM_CSS}`;
  rcPopularCongregacoes();
  rcmRenderLista();
  rcmAplicarModo();
  rcmCentral();
  rcmAvisoSemana();
}

function rcmAcoesHtml(){
  const B = (fn, icone, rotulo, cor) =>
    `<button onclick="${fn}" class="py-2.5 rounded-xl text-[10px] font-extrabold text-white cursor-pointer flex flex-col items-center justify-center gap-1" style="background:${cor}"><i class="fa-solid ${icone} text-sm"></i><span>${rotulo}</span></button>`;
  if (RC.somenteLeitura) return `
    ${RC.podeEditar ? B('rcmCorrigir()', 'fa-screwdriver-wrench', 'CORRIGIR', 'linear-gradient(135deg,#c2410c,#ea580c)') : ''}
    ${B('rcmPdf()', 'fa-file-pdf', 'PDF', 'linear-gradient(135deg,#0369a1,#38bdf8)')}
    ${B('rcmVoltar()', 'fa-arrow-rotate-left', 'VOLTAR', 'linear-gradient(135deg,#334155,#475569)')}`;
  return `
    ${B('rcmSalvar(false)', 'fa-floppy-disk', 'GRAVAR', 'linear-gradient(135deg,#047857,#10b981)')}
    ${B('rcmSalvar(true)', 'fa-paper-plane', 'ENVIAR', 'linear-gradient(135deg,#6d28d9,#8b5cf6)')}
    ${B('rcmVisualizar()', 'fa-eye', 'VISUALIZAR', 'linear-gradient(135deg,#b45309,#f59e0b)')}
    ${B('rcmPdf()', 'fa-file-pdf', 'PDF', 'linear-gradient(135deg,#0369a1,#38bdf8)')}
    ${B('rcmNovo()', 'fa-file-circle-plus', 'NOVO', 'linear-gradient(135deg,#334155,#475569)')}`;
}

window.rcmModo = function(m){
  if (m === 'editar' && RC.somenteLeitura){
    if (RC.podeEditar) return rcmCorrigir();
    return;
  }
  RC.modo = m;
  rcmAplicarModo();
};

function rcmAplicarModo(){
  const ed = el('rcm-view-editar'), pv = el('rcm-view-previa');
  if (!ed || !pv) return;
  const previa = RC.modo === 'previa' || RC.somenteLeitura;
  ed.classList.toggle('hidden', previa);
  pv.classList.toggle('hidden', !previa);
  const te = el('rcm-tab-editar'), tp = el('rcm-tab-previa');
  const ativo = 'linear-gradient(135deg,#b45309,#f59e0b)';
  if (te){ te.style.background = !previa ? ativo : 'transparent'; te.style.color = !previa ? '#fff' : 'var(--text-muted)'; }
  if (tp){ tp.style.background = previa ? ativo : 'transparent'; tp.style.color = previa ? '#fff' : 'var(--text-muted)'; }
  if (previa) rcmRenderDoc();
}

window.rcmVisualizar = function(){ rcmModo('previa'); };

/* Relatório enviado: reabre edição — salvar_relatorio_caixa permite ao
   autor/admin gravar nova versão mantendo o status 'enviado' (retificação). */
window.rcmCorrigir = function(){
  if (!RC.podeEditar){ toast('Somente o autor ou um administrador pode corrigir este relatório.'); return; }
  RC.somenteLeitura = false;
  RC.modo = 'editar';
  toast('Retificação: ajuste os lançamentos e toque em GRAVAR.');
  rcRenderTela();
};

async function rcPopularCongregacoes(){
  const sel = el('rcm-congregacao');
  if (!sel) return;
  const congs = await rcCarregarCongregacoes();
  const congFixa = rcCongFixa();
  sel.innerHTML = '<option value="">— Selecione —</option>' +
    congs.map(c => `<option value="${rcEsc(c.nome)}" data-conselho="${rcEsc(c.conselho || '')}">${rcEsc(c.nome)}</option>`).join('');
  if (congFixa){
    if (![...sel.options].some(o => o.value === congFixa)){
      const o = document.createElement('option'); o.value = congFixa; o.textContent = congFixa; sel.appendChild(o);
    }
    sel.value = congFixa;
  } else if (F.rcCongregacao){
    sel.value = F.rcCongregacao;
  }
}

window.rcmMascaraData = function(inp){
  let v = inp.value.replace(/\D/g,'').substring(0,8);
  if (v.length >= 5) inp.value = v.substring(0,2)+'/'+v.substring(2,4)+'/'+v.substring(4,8);
  else if (v.length >= 3) inp.value = v.substring(0,2)+'/'+v.substring(2,4);
  else inp.value = v;
  F.rcData = inp.value;
  rcmRenderDoc();
  rcmAvisoSemana();
};

window.rcmToggleRecibo = function(){
  const saida = el('rcm-tipo').value.includes('SAIDAS');
  const r = el('rcm-recibo');
  if (r){ r.disabled = saida; r.value = saida ? '' : r.value; r.placeholder = saida ? 'N/A (Saída)' : 'Nº Recibo'; }
};

window.rcmAdicionar = function(){
  const tipo = el('rcm-tipo').value;
  const recibo = el('rcm-recibo').value.trim();
  const descricao = el('rcm-descricao').value.trim();
  const valor = parseFloat(el('rcm-valor').value);
  const isSaida = tipo.includes('SAIDAS');
  if (!isSaida){
    if (!recibo){ toast('Informe o número do recibo.'); return; }
    if (RC.lancamentos.some(l => l.recibo === recibo)){ toast(`O recibo "${recibo}" já foi lançado.`); return; }
  }
  if (!descricao || isNaN(valor) || valor <= 0){ toast('Preencha a descrição e um valor válido.'); return; }
  RC.lancamentos.push({ tipo, recibo: isSaida ? '' : recibo, descricao, valor });
  el('rcm-descricao').value = ''; el('rcm-valor').value = ''; el('rcm-recibo').value = '';
  rcmRenderLista();
  rcmRenderDoc();
};

window.rcmRemover = function(i){
  if (RC.somenteLeitura) return;
  RC.lancamentos.splice(i, 1);
  rcmRenderLista();
  rcmRenderDoc();
};

function rcmRenderLista(){
  const lista = el('rcm-lista'); if (!lista) return;
  let somaEnt = 0, somaSai = 0;
  let html = '';
  RC_TIPOS.forEach(tipo => {
    const itens = RC.lancamentos.map((l,i) => ({...l, _i:i})).filter(l => l.tipo === tipo)
      .sort((a,b) => (parseInt(a.recibo)||0) - (parseInt(b.recibo)||0));
    if (!itens.length) return;
    const isSai = tipo.includes('SAIDAS');
    let sub = 0;
    html += `<p class="text-[9px] font-extrabold uppercase tracking-wider mt-2.5 mb-1" style="color:${isSai ? '#f87171' : '#34d399'}">${RC_TITULOS[tipo]}</p>`;
    itens.forEach(it => {
      sub += it.valor;
      isSai ? somaSai += it.valor : somaEnt += it.valor;
      html += `<div class="flex items-center gap-2 py-1.5 border-b" style="border-color:var(--border-color)">
        ${it.recibo ? `<span class="text-[9px] font-mono opacity-50 w-9 shrink-0">${rcEsc(it.recibo)}</span>` : ''}
        <span class="flex-1 text-[11px] truncate">${rcEsc(it.descricao)}</span>
        <span class="text-[11px] font-bold shrink-0" style="color:${isSai ? '#f87171' : '#34d399'}">${rcMoeda(it.valor)}</span>
        ${RC.somenteLeitura ? '' : `<button onclick="rcmRemover(${it._i})" class="w-6 h-6 rounded-lg text-[10px] cursor-pointer shrink-0" style="background:var(--bg-input)"><i class="fa-solid fa-xmark"></i></button>`}
      </div>`;
    });
    html += `<div class="flex justify-between text-[10px] font-bold py-1 opacity-70"><span>Subtotal ${RC_TITULOS[tipo]}</span><span>${rcMoeda(sub)}</span></div>`;
  });
  lista.innerHTML = html || '<p class="text-[11px] opacity-50 italic py-3 text-center">Nenhum lançamento efetuado.</p>';
  el('rcm-totais').innerHTML = `
    <div class="flex justify-between"><span class="opacity-70">Total entradas</span><b style="color:#34d399">${rcMoeda(somaEnt)}</b></div>
    <div class="flex justify-between"><span class="opacity-70">Total saídas</span><b style="color:#f87171">${rcMoeda(somaSai)}</b></div>
    <div class="flex justify-between text-sm pt-1 border-t" style="border-color:var(--border-color)"><span class="font-bold">Saldo</span><b>${rcMoeda(somaEnt - somaSai)}</b></div>`;
}

function rcmColetar(){
  const sel = el('rcm-congregacao');
  const opt = sel?.options?.[sel.selectedIndex];
  const hoje = new Date();
  const rel = {
    id: RC.id,
    congregacao: sel ? sel.value : RC.meta.congregacao,
    conselho: sel ? (opt?.dataset?.conselho || '') : RC.meta.conselho,
    data_relatorio: el('rcm-data')?.value || RC.meta.data,
    semana: el('rcm-semana')?.value || RC.meta.semana,
    ano: String(hoje.getFullYear()),
    mes: MESES_ORD[hoje.getMonth()],
    lancamentos: RC.lancamentos.map(({tipo, recibo, descricao, valor}) => ({tipo, recibo, descricao, valor})),
  };
  RC.meta = { congregacao: rel.congregacao, conselho: rel.conselho, data: rel.data_relatorio, semana: rel.semana };
  F.rcCongregacao = rel.congregacao; F.rcData = rel.data_relatorio; F.rcSemana = rel.semana;
  return rel;
}

/* Período de fechamento: mês/ano da data do relatório (ou campos mes/ano gravados).
   Normaliza para MM/AAAA — mes pode vir como nome ("Setembro") ou número. */
function rcmPeriodoChave(o){
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(o.data_relatorio || '').trim());
  if (m) return m[2] + '/' + m[3];
  const mi = MESES_ORD.findIndex(x => String(x).toLowerCase() === String(o.mes || '').toLowerCase());
  const mm = mi >= 0 ? String(mi + 1).padStart(2, '0') : String(o.mes || '').padStart(2, '0');
  return mm + '/' + String(o.ano || new Date().getFullYear());
}

/* Já existe relatório da mesma congregação + semana + período? (exceto o carregado) */
async function rcmExisteSemana(rel){
  try {
    const res = await api('listar_relatorios_caixa', null, sessao()?.token);
    const chave = rcmPeriodoChave(rel);
    return (res?.relatorios || []).find(r =>
      String(r.id) !== String(rel.id || '') &&
      String(r.congregacao || '').trim().toLowerCase() === String(rel.congregacao || '').trim().toLowerCase() &&
      String(r.semana || '') === String(rel.semana || '') &&
      rcmPeriodoChave(r) === chave
    ) || null;
  } catch(e){ return null; }
}

/* Aviso ao vivo: semana já tem rascunho/enviado? */
let _rcmAvisoSeq = 0;
window.rcmAvisoSemana = async function(){
  const seq = ++_rcmAvisoSeq;
  const box = el('rcm-aviso-semana');
  if (!box) return;
  const hoje = new Date();
  const rel = {
    id: RC.id,
    congregacao: el('rcm-congregacao')?.value || '',
    semana: el('rcm-semana')?.value || '',
    data_relatorio: el('rcm-data')?.value || '',
    mes: MESES_ORD[hoje.getMonth()], ano: String(hoje.getFullYear()),
  };
  if (!rel.congregacao || !rel.semana || (rel.data_relatorio && rel.data_relatorio.length < 10)){ box.innerHTML = ''; return; }
  const ex = await rcmExisteSemana(rel);
  if (seq !== _rcmAvisoSeq) return;
  const b2 = el('rcm-aviso-semana');
  if (!b2) return;
  if (!ex){ b2.innerHTML = ''; return; }
  const env = ex.status === 'enviado';
  b2.innerHTML = `<button onclick="rcmAbrir('${rcEsc(ex.id)}')" class="w-full rounded-xl px-3 py-2.5 text-[10px] font-bold flex items-center gap-2 cursor-pointer text-left" style="background:${env ? 'rgba(16,185,129,.10)' : 'rgba(245,158,11,.10)'};color:${env ? '#10b981' : '#f59e0b'};border:1px solid ${env ? 'rgba(16,185,129,.35)' : 'rgba(245,158,11,.35)'}"><i class="fa-solid ${env ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span class="flex-1">${env
    ? 'Esta semana já foi ENVIADA à central — toque para visualizar ou retificar'
    : 'Já existe um RASCUNHO desta semana — toque para revisar'}</span><i class="fa-solid fa-eye"></i></button>`;
};

/* Marca o relatório carregado como enviado na central. */
async function rcmEnviarAtual(){
  const r2 = await api('enviar_relatorio_caixa', { id: RC.id }, sessao()?.token);
  if (!r2?.ok){ toast(r2?.erro || 'Salvo, mas falhou ao enviar à central.'); return false; }
  RC.status = 'enviado';
  RC.gravadoEm = new Date().toISOString();
  return true;
}

window.rcmSalvar = async function(enviar){
  const rel = rcmColetar();
  if (!rel.congregacao){ toast('Selecione a congregação do relatório.'); return; }
  if (!rel.data_relatorio){ toast('Informe a data do relatório.'); return; }
  const congFixa = rcCongFixa();
  if (congFixa && rel.congregacao !== congFixa){ toast(`Tesoureiro: relatório só pode ser da congregação ${congFixa}.`); return; }
  /* Trava anti-duplicata: mesma congregação + semana + período já tem relatório? */
  const existente = await rcmExisteSemana(rel);
  if (existente){
    if (existente.status === 'enviado'){
      if (confirm(`A ${rel.semana} de "${rel.congregacao}" já foi ENVIADA à central.\n\nOK = abrir para retificar\nCancelar = voltar e escolher outra semana`)){
        await rcmAbrir(existente.id);
        if (RC.podeEditar) rcmCorrigir();
      }
    } else if (confirm(`Já existe um RASCUNHO da ${rel.semana} de "${rel.congregacao}" (${existente.data_relatorio || 'sem data'}).\n\nOK = abrir para revisar\nCancelar = voltar e escolher outra semana`)){
      await rcmAbrir(existente.id);
    }
    return;
  }
  try {
    const res = await api('salvar_relatorio_caixa', { relatorio: rel, autor_nome: sessao()?.usuario?.nome || '' }, sessao()?.token);
    if (!res?.ok) { toast(res?.erro || 'Falha ao salvar.'); return; }
    RC.id = res.id || RC.id;
    RC.status = res.status || RC.status;
    RC.autor = sessao()?.usuario?.nome || RC.autor;
    RC.gravadoEm = new Date().toISOString();
    if (enviar){
      if (await rcmEnviarAtual()) toast('Relatório enviado à central.');
    } else if (RC.status === 'enviado'){
      toast('Retificação gravada — relatório permanece enviado.');
    } else if (confirm('Rascunho gravado na nuvem.\n\nDeseja enviar para a central agora?')){
      if (await rcmEnviarAtual()) toast('Relatório enviado à central.');
    } else {
      toast('Rascunho salvo na nuvem.');
    }
    rcRenderTela();
  } catch(e){ toast(e.message || 'Erro de conexão.'); }
};

/* ---- prévia em formato de documento (mesmo padrão "MOVIMENTO CAIXA" do desktop) ---- */
function rcmDocHtml(){
  const rel = rcmColetar();
  const t = rcmTotais();
  const marca = RC.status === 'enviado' ? 'rcm-m-enviado' : 'rcm-m-rascunho';
  const marcaTxt = RC.status === 'enviado' ? 'ENVIADO' : 'RASCUNHO';
  let rows = '';
  RC_SECOES.forEach(sec => {
    const itens = RC.lancamentos.filter(l => l.tipo === sec.tipo)
      .sort((a,b) => (parseInt(a.recibo)||0) - (parseInt(b.recibo)||0));
    if (!itens.length) return;
    const isSaiSec = sec.tipo.includes('SAIDAS');
    let sub = 0;
    rows += `<tr><td></td><td colspan="7" class="rcm-sec">${sec.titulo}</td><td></td><td></td></tr>`;
    itens.forEach(it => {
      const isSai = it.tipo.includes('SAIDAS');
      sub += it.valor;
      rows += `<tr><td style="text-align:center">${rcEsc(it.recibo)}</td><td>${rcEsc(it.descricao)}</td><td></td><td></td><td></td><td></td><td></td><td></td><td style="text-align:right">${isSai ? '' : rcMoeda(it.valor)}</td><td style="text-align:right">${isSai ? rcMoeda(it.valor) : ''}</td></tr>`;
    });
    rows += `<tr><td></td><td colspan="7" class="rcm-sub">SUBTOTAL ${sec.titulo}:</td><td style="text-align:right;font-weight:bold">${isSaiSec ? '' : rcMoeda(sub)}</td><td style="text-align:right;font-weight:bold">${isSaiSec ? rcMoeda(sub) : ''}</td></tr>`;
  });
  if (!RC.lancamentos.length){
    rows = `<tr><td></td><td colspan="7" style="text-align:center;color:#777;font-style:italic">Nenhum lançamento efetuado para este movimento.</td><td style="text-align:right">R$ 0,00</td><td style="text-align:right">R$ 0,00</td></tr>`;
  }
  const congTxt = rel.congregacao ? ('CONGREGAÇÃO ' + rel.congregacao).toUpperCase() : 'CONGREGAÇÃO';
  return `<div class="rcm-doc">
    <div class="rcm-marca ${marca}"><span>${marcaTxt}</span></div>
    <table class="rcm-main"><thead>
      <tr><th colspan="10" class="rcm-head">
        <img class="rcm-timbrado" src="icons/cabecalho_ad_brasil.png" alt="">
        <div class="rcm-head-flex">
          <div class="rcm-title">MOVIMENTO CAIXA</div>
          <div class="rcm-meta-box">
            <div class="rcm-meta-item"><div class="rcm-meta-label">DATA</div><div class="rcm-meta-val">${rcEsc(rel.data_relatorio) || '—'}</div></div>
            <div class="rcm-meta-item"><div class="rcm-meta-label">FECHAMENTO</div><div class="rcm-meta-val">${rcEsc(rel.semana)}</div></div>
          </div>
        </div>
        <div class="rcm-cong">${rcEsc(congTxt)}</div>
      </th></tr>
      <tr class="rcm-cols"><th style="width:32px">Nº</th><th style="text-align:left">HISTÓRICO</th><th style="width:10px"></th><th style="width:10px"></th><th style="width:10px"></th><th style="width:10px"></th><th style="width:10px"></th><th style="width:10px"></th><th style="width:82px">ENTRADAS</th><th style="width:82px">SAÍDAS</th></tr>
    </thead><tbody>${rows}</tbody></table>
    <div class="rcm-totais">
      <div style="width:48%">
        <table class="rcm-subt" style="margin-bottom:8px"><tr><th colspan="2">DETALHES DO SALDO (BRUTO)</th></tr>
          <tr><td>TRANSF. BANCÁRIA - TB (PIX)</td><td style="text-align:right;width:70px">${rcMoeda(t.entTB)}</td></tr>
          <tr><td>DINHEIRO</td><td style="text-align:right">${rcMoeda(t.entDin)}</td></tr></table>
        <table class="rcm-subt"><tr><th colspan="2">REPASSE PARA O CAMPO (LÍQUIDO)</th></tr>
          <tr><td style="text-align:center;font-size:7px">DINHEIRO</td><td style="text-align:center;font-size:7px">TRANSFERÊNCIAS</td></tr>
          <tr><td style="text-align:right">${rcMoeda(t.entDin - t.saiDin)}</td><td style="text-align:right">${rcMoeda(t.entTB - t.saiTB)}</td></tr></table>
      </div>
      <div style="width:48%">
        <table class="rcm-subt"><tr><th style="width:50%">TOTAIS</th><td style="text-align:right;width:25%">${rcMoeda(t.ent)}</td><td style="text-align:right;width:25%">${rcMoeda(t.sai)}</td></tr>
          <tr><td colspan="3" class="rcm-saldo">SALDO ATUAL<span style="float:right">${rcMoeda(t.saldo)}</span></td></tr></table>
        <div class="rcm-visto"><div class="rcm-visto-caixa">CAIXA</div><div>VISTO</div></div>
      </div>
    </div>
    <div class="rcm-verifica">
      <div id="rcm-qr" title="QR de autenticidade"></div>
      <div class="rcm-hash"><b>VERIFICAÇÃO DE AUTENTICIDADE</b><br><span id="rcm-hash">—</span><br><span style="opacity:.7">Aponte a câmera para conferir a integridade deste documento.</span></div>
    </div>
    <div class="rcm-rodape">SGE • AD BRASIL — RELATÓRIO DE PRESTAÇÃO DE CONTAS GERADO ELETRONICAMENTE</div>
  </div>`;
}

window.rcmRenderDoc = async function(){
  const box = el('rcm-doc');
  if (!box) return;
  const pv = el('rcm-view-previa');
  if (pv && pv.classList.contains('hidden')) return;
  box.innerHTML = rcmDocHtml();
  const rel = rcmColetar();
  const t = rcmTotais();
  const saldoStr = t.saldo.toFixed(2);
  const base = `SGE-CAIXA|${rel.congregacao}|${rel.data_relatorio}|${rel.semana}|${RC.lancamentos.length}|${saldoStr}`;
  const hash = await rcmHashVerificacao(base);
  const hashEl = el('rcm-hash');
  if (hashEl) hashEl.textContent = 'SGE-CX-' + hash;
  const qrEl = el('rcm-qr');
  if (!qrEl) return;
  try {
    if (typeof QRCode !== 'undefined'){
      const params = new URLSearchParams({
        c: rel.congregacao || '', d: rel.data_relatorio || '', s: rel.semana || '',
        a: RC.autor || sessao()?.usuario?.nome || '', g: RC.gravadoEm || '',
        n: String(RC.lancamentos.length), v: saldoStr, h: hash
      });
      qrEl.innerHTML = '';
      new QRCode(qrEl, { text: `${RC_VERIFICA_URL}?${params.toString()}`, width: 64, height: 64, correctLevel: QRCode.CorrectLevel.M });
    } else {
      qrEl.innerHTML = '<div style="font-size:6px;color:#555;max-width:56px;text-align:center;line-height:1.3">QR indisponível offline</div>';
    }
  } catch(e){ /* QR opcional */ }
};

function rcmImgData(src){
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        res({ data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch(e){ res(null); }
    };
    img.onerror = () => res(null);
    img.src = src;
  });
}

function rcmQrDataUrl(texto, tam){
  try {
    if (typeof QRCode === 'undefined') return null;
    const div = document.createElement('div');
    new QRCode(div, { text: texto, width: tam || 128, height: tam || 128, correctLevel: QRCode.CorrectLevel.M });
    const cv = div.querySelector('canvas');
    if (cv) return cv.toDataURL('image/png');
    const img = div.querySelector('img');
    return img && String(img.src).startsWith('data:') ? img.src : null;
  } catch(e){ return null; }
}

window.rcmPdf = async function(){
  const JsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!JsPDF){ toast('Biblioteca de PDF não carregada — verifique a conexão.'); return; }
  const rel = rcmColetar();
  const t = rcmTotais();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const ML = 12, CW = 186, CX = ML + CW;
  let y = 10;
  const fitY = need => { if (y + need > 284){ doc.addPage(); y = 12; } };

  // timbrado
  const img = await rcmImgData('icons/cabecalho_ad_brasil.png');
  if (img){
    const h = Math.min(30, img.h * (CW / img.w));
    try { doc.addImage(img.data, 'PNG', ML, y, CW, h); y += h + 1; } catch(e){}
  }

  // cabeçalho do documento: caixa "MOVIMENTO CAIXA" + caixas DATA/FECHAMENTO (modelo desktop)
  const headH = 11, titleW = 82, metaW = 58;
  doc.setDrawColor(0); doc.setLineWidth(.3); doc.setTextColor(0);
  doc.rect(ML, y, CW, headH);
  doc.setFillColor(230,230,230);
  doc.rect(ML, y, titleW, headH, 'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('MOVIMENTO CAIXA', ML + titleW/2, y + headH/2 + 1.7, { align:'center' });
  const mx = CX - metaW, mw = metaW/2;
  doc.rect(mx, y, metaW, headH);
  doc.line(mx + mw, y, mx + mw, y + headH);
  [['DATA', rel.data_relatorio || '—'], ['FECHAMENTO', rel.semana || '—']].forEach((it, i) => {
    const cx = mx + mw*i + mw/2;
    doc.setFontSize(5); doc.setTextColor(70);
    doc.text(it[0], cx, y + 3, { align:'center' });
    doc.setFontSize(9); doc.setTextColor(0);
    doc.text(String(it[1]).toUpperCase(), cx, y + headH - 2.6, { align:'center' });
  });
  y += headH;

  // faixa CONGREGAÇÃO
  doc.setFillColor(230,230,230);
  doc.rect(ML, y, CW, 7, 'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(0);
  doc.text(rel.congregacao ? ('CONGREGAÇÃO ' + rel.congregacao).toUpperCase() : 'CONGREGAÇÃO', 105, y + 4.9, { align:'center' });
  y += 7;

  // tabela de lançamentos (10 colunas: Nº + HISTÓRICO + 6 colunas finas + ENTRADAS + SAÍDAS)
  const body = [];
  RC_SECOES.forEach(sec => {
    const itens = RC.lancamentos.filter(l => l.tipo === sec.tipo)
      .sort((a,b) => (parseInt(a.recibo)||0) - (parseInt(b.recibo)||0));
    if (!itens.length) return;
    const isSaiSec = sec.tipo.includes('SAIDAS');
    let sub = 0;
    body.push([{ content: '', styles: { fillColor: [236,236,236] } },
      { content: sec.titulo, colSpan: 7, styles: { halign: 'center', fontStyle: 'bold', fillColor: [236,236,236] } },
      { content: '', styles: { fillColor: [236,236,236] } }, { content: '', styles: { fillColor: [236,236,236] } }]);
    itens.forEach(it => {
      const isSai = it.tipo.includes('SAIDAS');
      sub += it.valor;
      body.push([it.recibo || '', it.descricao || '', '', '', '', '', '', '',
        isSai ? '' : rcMoeda(it.valor), isSai ? rcMoeda(it.valor) : '']);
    });
    body.push([{ content: '', styles: { fillColor: [242,242,242] } },
      { content: 'SUBTOTAL ' + sec.titulo + ':', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fillColor: [242,242,242] } },
      { content: isSaiSec ? '' : rcMoeda(sub), styles: { halign: 'right', fontStyle: 'bold', fillColor: [242,242,242] } },
      { content: isSaiSec ? rcMoeda(sub) : '', styles: { halign: 'right', fontStyle: 'bold', fillColor: [242,242,242] } }]);
  });
  if (!body.length) body.push([{ content: 'Nenhum lançamento efetuado para este movimento.', colSpan: 10, styles: { halign: 'center', fontStyle: 'italic', textColor: [120,120,120] } }]);
  doc.autoTable({
    startY: y,
    head: [['Nº', 'HISTÓRICO', '', '', '', '', '', '', 'ENTRADAS', 'SAÍDAS']],
    body, theme: 'grid',
    headStyles: { fillColor: [230,230,230], textColor: 0, fontSize: 7.5, halign: 'center', fontStyle: 'bold', cellPadding: 1.5 },
    styles: { fontSize: 8, textColor: 0, lineColor: 0, lineWidth: .25, cellPadding: { top: 1.4, bottom: 1.4, left: 1.6, right: 1.6 }, minCellHeight: 5 },
    columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 4 }, 3: { cellWidth: 4 }, 4: { cellWidth: 4 }, 5: { cellWidth: 4 }, 6: { cellWidth: 4 }, 7: { cellWidth: 4 }, 8: { cellWidth: 26, halign: 'right' }, 9: { cellWidth: 26, halign: 'right' } },
    margin: { left: ML, right: ML },
  });
  y = doc.lastAutoTable.finalY;

  // bloco de totais em duas colunas + caixas de visto (modelo desktop)
  fitY(50);
  const yTot = y + 2.5, colW = (CW - 8)/2, colRX = ML + colW + 8;
  doc.autoTable({
    startY: yTot, theme: 'grid', tableWidth: colW,
    head: [[{ content: 'DETALHES DO SALDO (BRUTO)', colSpan: 2, styles: { halign: 'center' } }]],
    body: [['TRANSF. BANCÁRIA - TB (PIX)', rcMoeda(t.entTB)], ['DINHEIRO', rcMoeda(t.entDin)]],
    headStyles: { fillColor: [230,230,230], textColor: 0, fontSize: 7.5, fontStyle: 'bold' },
    styles: { fontSize: 7.5, textColor: 0, lineColor: 0, lineWidth: .25, cellPadding: 1.4 },
    columnStyles: { 1: { halign: 'right', cellWidth: 24 } },
    margin: { left: ML },
  });
  const yDet = doc.lastAutoTable.finalY;
  doc.autoTable({
    startY: yDet + 2.5, theme: 'grid', tableWidth: colW,
    head: [[{ content: 'REPASSE PARA O CAMPO (LÍQUIDO)', colSpan: 2, styles: { halign: 'center' } }]],
    body: [[{ content: 'DINHEIRO', styles: { halign: 'center', fontSize: 6.5 } }, { content: 'TRANSFERÊNCIAS', styles: { halign: 'center', fontSize: 6.5 } }],
           [rcMoeda(t.entDin - t.saiDin), rcMoeda(t.entTB - t.saiTB)]],
    headStyles: { fillColor: [230,230,230], textColor: 0, fontSize: 7.5, fontStyle: 'bold' },
    styles: { fontSize: 7.5, textColor: 0, lineColor: 0, lineWidth: .25, halign: 'right', cellPadding: 1.4 },
    margin: { left: ML },
  });
  const yRep = doc.lastAutoTable.finalY;
  doc.autoTable({
    startY: yTot, theme: 'grid', tableWidth: colW,
    body: [[{ content: 'TOTAIS', styles: { fontStyle: 'bold', fillColor: [230,230,230], halign: 'center' } },
            { content: rcMoeda(t.ent), styles: { halign: 'right' } },
            { content: rcMoeda(t.sai), styles: { halign: 'right' } }],
           [{ content: 'SALDO ATUAL', styles: { fontStyle: 'bold', fillColor: [230,230,230] } },
            { content: rcMoeda(t.saldo), colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230,230,230] } }]],
    styles: { fontSize: 7.5, textColor: 0, lineColor: 0, lineWidth: .25, cellPadding: 1.4 },
    columnStyles: { 0: { cellWidth: colW*0.5 }, 1: { cellWidth: colW*0.25 }, 2: { cellWidth: colW*0.25 } },
    margin: { left: colRX },
  });
  const yTotR = doc.lastAutoTable.finalY;

  // caixas de assinatura CAIXA/VISTO — caixas com borda, não linhas soltas
  const sigH = 13, sigY = yTotR + 2.5;
  doc.setDrawColor(0); doc.setLineWidth(.3);
  doc.rect(colRX, sigY, colW, sigH*2);
  doc.line(colRX, sigY + sigH, colRX + colW, sigY + sigH);
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(0);
  doc.text('CAIXA', colRX + 2, sigY + 3);
  doc.text('VISTO', colRX + 2, sigY + sigH + 3);
  doc.setLineWidth(.2);
  doc.line(colRX + 3, sigY + sigH - 2.5, colRX + colW - 3, sigY + sigH - 2.5);
  doc.line(colRX + 3, sigY + sigH*2 - 2.5, colRX + colW - 3, sigY + sigH*2 - 2.5);
  y = Math.max(yRep, sigY + sigH*2) + 3;
  doc.setLineWidth(.3);
  doc.rect(ML, yTot - 2, CW, y - yTot - 1);

  // verificação de autenticidade: QR + hash dentro de caixa (modelo desktop)
  fitY(28);
  const saldoStr = t.saldo.toFixed(2);
  const base = `SGE-CAIXA|${rel.congregacao}|${rel.data_relatorio}|${rel.semana}|${RC.lancamentos.length}|${saldoStr}`;
  const hash = await rcmHashVerificacao(base);
  let qrSrc = null;
  try {
    const params = new URLSearchParams({
      c: rel.congregacao || '', d: rel.data_relatorio || '', s: rel.semana || '',
      a: RC.autor || sessao()?.usuario?.nome || '', g: RC.gravadoEm || '',
      n: String(RC.lancamentos.length), v: saldoStr, h: hash
    });
    qrSrc = rcmQrDataUrl(`${RC_VERIFICA_URL}?${params.toString()}`, 128);
  } catch(e){}
  const vH = 24;
  doc.setDrawColor(0); doc.setLineWidth(.3);
  doc.rect(ML, y, CW, vH);
  if (qrSrc){ try { doc.addImage(qrSrc, 'PNG', ML + 3, y + 2.5, 19, 19); } catch(e){} }
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(40);
  doc.text('VERIFICAÇÃO DE AUTENTICIDADE', ML + 26, y + 7);
  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(60);
  doc.text('SGE-CX-' + hash, ML + 26, y + 12);
  doc.setFontSize(5.5); doc.setTextColor(110);
  doc.text('Aponte a câmera para conferir a integridade deste documento.', ML + 26, y + 16.5);
  y += vH;

  // rodapé
  fitY(8);
  doc.setFillColor(247,247,247); doc.setDrawColor(0); doc.setLineWidth(.3);
  doc.rect(ML, y, CW, 6, 'FD');
  doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(85);
  doc.text('SGE • AD BRASIL — RELATÓRIO DE PRESTAÇÃO DE CONTAS GERADO ELETRONICAMENTE', 105, y + 4.1, { align:'center' });

  // marca d'água do status em todas as páginas
  try {
    const marcaTxt = RC.status === 'enviado' ? 'ENVIADO' : 'RASCUNHO';
    const gs = new doc.GState({ opacity: 0.10 });
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++){
      doc.setPage(p);
      doc.saveGraphicsState();
      doc.setGState(gs);
      if (RC.status === 'enviado') doc.setTextColor(16,110,60); else doc.setTextColor(120,120,120);
      doc.setFont('helvetica','bold'); doc.setFontSize(58);
      doc.text(marcaTxt, 105, 165, { align:'center', angle: -28 });
      doc.restoreGraphicsState();
    }
    doc.setPage(total);
  } catch(e){}

  const nome = [rel.congregacao, rel.semana, rel.data_relatorio].filter(Boolean).join('_').replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, '_');
  doc.save('MOVIMENTO_CAIXA' + (nome ? '_' + nome : '') + '.pdf');
};

window.rcmCentral = async function(){
  const box = el('rcm-central'); if (!box) return;
  box.innerHTML = '<div class="flex items-center justify-center gap-2 py-4 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando…</div>';
  try {
    const res = await api('listar_relatorios_caixa', null, sessao()?.token);
    const lista = res?.relatorios || [];
    if (!lista.length){ box.innerHTML = '<p class="text-[11px] opacity-50 py-3 text-center">Nenhum relatório na central.</p>'; return; }
    const meuCpf = String(sessao()?.usuario?.cpf || '').replace(/\D/g,'');
    const admin = rcEhAdmin();
    box.innerHTML = lista.map(r => {
      const pode = String(r.autor_cpf || '').replace(/\D/g,'') === meuCpf || admin;
      const enviado = r.status === 'enviado';
      const badgeItem = enviado
        ? '<span class="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full shrink-0" style="background:rgba(16,185,129,.15);color:#10b981"><i class="fa-solid fa-circle-check mr-0.5"></i>enviado</span>'
        : '<span class="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full shrink-0" style="background:rgba(245,158,11,.15);color:#f59e0b"><i class="fa-solid fa-circle-exclamation mr-0.5"></i>rascunho</span>';
      return `
      <div class="flex items-center gap-2 py-2 border-b" style="border-color:var(--border-color)">
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-bold truncate">${rcEsc(r.congregacao || '—')}</p>
          <p class="text-[9px] opacity-55">${rcEsc(r.data_relatorio || '')} • ${rcEsc(r.semana || '')} • ${rcEsc(r.autor_nome || '')}</p>
        </div>
        ${badgeItem}
        ${pode && !enviado ? `<button onclick="rcmEnviarItem('${r.id}')" class="w-7 h-7 rounded-lg text-[10px] cursor-pointer shrink-0" style="background:var(--bg-input);color:#8b5cf6" title="Enviar à central"><i class="fa-solid fa-paper-plane"></i></button>` : ''}
        <button onclick="rcmAbrir('${r.id}')" class="w-7 h-7 rounded-lg text-[10px] cursor-pointer shrink-0" style="background:var(--bg-input)" title="Abrir"><i class="fa-solid fa-folder-open"></i></button>
        ${pode ? `<button onclick="rcmExcluir('${r.id}')" class="w-7 h-7 rounded-lg text-[10px] cursor-pointer shrink-0" style="background:var(--bg-input);color:#f87171" title="Excluir"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>`;
    }).join('');
  } catch(e){ box.innerHTML = `<p class="text-[11px] py-3 text-center" style="color:#f87171">${rcEsc(e.message || 'Falha ao carregar.')}</p>`; }
};

window.rcmAbrir = async function(id){
  try {
    const res = await api('listar_relatorios_caixa', null, sessao()?.token);
    const r = (res?.relatorios || []).find(x => String(x.id) === String(id));
    if (!r){ toast('Relatório não encontrado.'); return; }
    RC.id = r.id;
    RC.lancamentos = Array.isArray(r.lancamentos) ? r.lancamentos : [];
    RC.status = r.status || 'rascunho';
    RC.autor = r.autor_nome || '';
    RC.gravadoEm = r.enviado_em || r.atualizado_em || '';
    RC.meta = { congregacao: r.congregacao || '', conselho: r.conselho || '', data: r.data_relatorio || '', semana: r.semana || '2ª Semana' };
    F.rcCongregacao = r.congregacao || '';
    F.rcData = r.data_relatorio || '';
    F.rcSemana = r.semana || '2ª Semana';
    // Autor ou admin pode corrigir; relatório de terceiro (não-admin) é sempre somente leitura
    const meuCpf = String(sessao()?.usuario?.cpf || '').replace(/\D/g,'');
    const autorCpf = String(r.autor_cpf || '').replace(/\D/g,'');
    RC.podeEditar = (autorCpf && autorCpf === meuCpf) || rcEhAdmin();
    RC.somenteLeitura = !RC.podeEditar || RC.status === 'enviado';
    RC.modo = RC.somenteLeitura ? 'previa' : 'editar';
    rcRenderTela();
  } catch(e){ toast(e.message || 'Erro ao abrir.'); }
};

/* Envio rápido de rascunho direto da central. */
window.rcmEnviarItem = async function(id){
  if (!confirm('Enviar este relatório para a central?')) return;
  try {
    const res = await api('enviar_relatorio_caixa', { id }, sessao()?.token);
    if (!res?.ok){ toast(res?.erro || 'Falha ao enviar.'); return; }
    toast('Relatório enviado à central.');
    if (String(RC.id) === String(id)){ RC.status = 'enviado'; rcRenderTela(); }
    else rcmCentral();
  } catch(e){ toast(e.message || 'Erro de conexão.'); }
};

window.rcmExcluir = async function(id){
  if (!confirm('Excluir este relatório definitivamente?')) return;
  try {
    const res = await api('excluir_relatorio_caixa', { id }, sessao()?.token);
    if (!res?.ok){ toast(res?.erro || 'Falha ao excluir.'); return; }
    if (String(RC.id) === String(id)) rcmNovo(); else rcmCentral();
    toast('Relatório excluído.');
  } catch(e){ toast(e.message || 'Erro de conexão.'); }
};

window.rcmVoltar = function(){ rcmNovo(); };

window.rcmNovo = function(){
  RC.lancamentos = []; RC.id = null; RC.status = 'rascunho';
  RC.somenteLeitura = false; RC.podeEditar = true; RC.modo = 'editar';
  RC.autor = ''; RC.gravadoEm = '';
  RC.meta = { congregacao: '', conselho: '', data: '', semana: '2ª Semana' };
  F.rcCongregacao = ''; F.rcData = ''; F.rcSemana = '2ª Semana';
  rcRenderTela();
};

/* depuração/testes */
window.SGEDZ = { carregarMembros, listarMembrosDizimistas, obterHistoricoDizimos, obterHistoricoCongregacoes, carregarLancamentosAno, dadosFrequenciaBI, F, RC };

})();
