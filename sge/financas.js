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

const RC = { lancamentos: [], id: null, status: 'rascunho', congs: null, somenteLeitura: false, abaCentral: false };

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

async function rcCarregarCongregacoes(){
  if (RC.congs) return RC.congs;
  try {
    const res = await api('listar_congregacoes', null, sessao()?.token);
    RC.congs = (res?.dados || []).filter(c => c.ativo !== 0 && c.ativo !== false);
  } catch(e){ RC.congs = []; }
  return RC.congs;
}

function rcRenderTela(){
  const u = sessao()?.usuario || {};
  const congFixa = rcCongFixa();
  const hoje = new Date();
  const dataPadrao = String(hoje.getDate()).padStart(2,'0') + '/' + String(hoje.getMonth()+1).padStart(2,'0') + '/' + hoje.getFullYear();
  el('fin-sub').innerHTML = `
    <div class="space-y-3">
      ${RC.somenteLeitura ? `<div class="rounded-xl px-3 py-2 text-[11px] font-bold flex items-center gap-2" style="background:rgba(56,189,248,.12);color:#38bdf8;border:1px solid rgba(56,189,248,.3)"><i class="fa-solid fa-eye"></i>Visualizando relatório recebido — somente leitura</div>` : ''}
      <div class="border rounded-2xl p-3 space-y-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="grid grid-cols-2 gap-2">
          <div class="col-span-2"><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Congregação</span>
            <select id="rcm-congregacao" ${congFixa ? 'disabled' : ''} class="w-full px-2 py-2 rounded-lg border text-xs font-semibold" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></select>
            ${congFixa ? '<p class="text-[9px] opacity-50 mt-1"><i class="fa-solid fa-lock mr-1"></i>Congregação fixa do tesoureiro</p>' : ''}
          </div>
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Data</span>
            <input id="rcm-data" value="${esc(F.rcData || dataPadrao)}" placeholder="DD/MM/AAAA" maxlength="10" inputmode="numeric" oninput="rcmMascaraData(this)" class="w-full px-2 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"></div>
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Fechamento</span>
            ${selF('rcm-semana', [['1ª Semana','1ª Semana'],['2ª Semana','2ª Semana'],['3ª Semana','3ª Semana'],['4ª Semana','4ª Semana'],['5ª Semana','5ª Semana']], F.rcSemana || '2ª Semana', "F.rcSemana=this.value")}</div>
        </div>
      </div>
      ${!RC.somenteLeitura ? `
      <div class="border rounded-2xl p-3 space-y-2" style="background:var(--bg-card);border-color:var(--border-color)">
        <p class="text-[10px] font-bold uppercase opacity-60">Novo lançamento</p>
        ${selF('rcm-tipo', RC_TIPOS.map(t => [t, RC_TITULOS[t]]), null, "rcmToggleRecibo()")}
        <div class="grid grid-cols-2 gap-2">
          <input id="rcm-recibo" placeholder="Nº Recibo" inputmode="numeric" class="px-2 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
          <input id="rcm-valor" type="number" step="0.01" min="0" placeholder="Valor (R$)" inputmode="decimal" class="px-2 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
        </div>
        <input id="rcm-descricao" placeholder="Descrição / Histórico" class="w-full px-2 py-2 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
        <button onclick="rcmAdicionar()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#059669,#10b981)"><i class="fa-solid fa-plus mr-1.5"></i>Adicionar lançamento</button>
      </div>` : ''}
      <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
        <p class="text-[10px] font-bold uppercase opacity-60 mb-2">Movimento do caixa</p>
        <div id="rcm-lista"></div>
        <div id="rcm-totais" class="mt-2 pt-2 border-t text-xs space-y-1" style="border-color:var(--border-color)"></div>
      </div>
      ${!RC.somenteLeitura ? `
      <div class="grid grid-cols-3 gap-2">
        <button onclick="rcmSalvar(false)" class="py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#7c3aed,#8b5cf6)"><i class="fa-solid fa-floppy-disk mr-1"></i>Rascunho</button>
        <button onclick="rcmSalvar(true)" class="py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#0284c7,#38bdf8)"><i class="fa-solid fa-paper-plane mr-1"></i>Enviar</button>
        <button onclick="rcmNovo()" class="py-2.5 rounded-xl text-xs font-bold cursor-pointer border" style="border-color:var(--border-color);color:var(--text-muted)"><i class="fa-solid fa-file-circle-plus mr-1"></i>Novo</button>
      </div>` : `
      <button onclick="rcmVoltar()" class="w-full py-2.5 rounded-xl text-xs font-bold cursor-pointer border" style="border-color:var(--border-color)"><i class="fa-solid fa-arrow-left mr-1.5"></i>Voltar à central</button>`}
      <div class="border rounded-2xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[10px] font-bold uppercase opacity-60"><i class="fa-solid fa-inbox mr-1"></i>Central de relatórios</p>
          <button onclick="rcmCentral()" class="text-[10px] font-bold cursor-pointer opacity-70"><i class="fa-solid fa-rotate mr-1"></i>Atualizar</button>
        </div>
        <div id="rcm-central"><p class="text-[11px] opacity-50 py-3 text-center">Toque em Atualizar para listar.</p></div>
      </div>
    </div>`;
  rcPopularCongregacoes();
  rcmRenderLista();
  rcmCentral();
}

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
};

window.rcmRemover = function(i){
  if (RC.somenteLeitura) return;
  RC.lancamentos.splice(i, 1);
  rcmRenderLista();
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
  return {
    id: RC.id,
    congregacao: sel?.value || '',
    conselho: opt?.dataset?.conselho || '',
    data_relatorio: el('rcm-data')?.value || '',
    semana: el('rcm-semana')?.value || '',
    ano: String(hoje.getFullYear()),
    mes: MESES_ORD[hoje.getMonth()],
    lancamentos: RC.lancamentos.map(({tipo, recibo, descricao, valor}) => ({tipo, recibo, descricao, valor})),
  };
}

window.rcmSalvar = async function(enviar){
  const rel = rcmColetar();
  if (!rel.congregacao){ toast('Selecione a congregação do relatório.'); return; }
  if (!rel.data_relatorio){ toast('Informe a data do relatório.'); return; }
  const congFixa = rcCongFixa();
  if (congFixa && rel.congregacao !== congFixa){ toast(`Tesoureiro: relatório só pode ser da congregação ${congFixa}.`); return; }
  try {
    const res = await api('salvar_relatorio_caixa', { relatorio: rel, autor_nome: sessao()?.usuario?.nome || '' }, sessao()?.token);
    if (!res?.ok) { toast(res?.erro || 'Falha ao salvar.'); return; }
    RC.id = res.id || RC.id;
    if (enviar){
      const r2 = await api('enviar_relatorio_caixa', { id: RC.id }, sessao()?.token);
      if (!r2?.ok){ toast(r2?.erro || 'Salvo, mas falhou ao enviar à central.'); rcmCentral(); return; }
      RC.status = 'enviado';
      toast('Relatório enviado à central.');
    } else {
      RC.status = 'rascunho';
      toast('Rascunho salvo na nuvem.');
    }
    rcmCentral();
  } catch(e){ toast(e.message || 'Erro de conexão.'); }
};

window.rcmCentral = async function(){
  const box = el('rcm-central'); if (!box) return;
  box.innerHTML = '<div class="flex items-center justify-center gap-2 py-4 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando…</div>';
  try {
    const res = await api('listar_relatorios_caixa', null, sessao()?.token);
    const lista = res?.relatorios || [];
    if (!lista.length){ box.innerHTML = '<p class="text-[11px] opacity-50 py-3 text-center">Nenhum relatório na central.</p>'; return; }
    box.innerHTML = lista.map(r => `
      <div class="flex items-center gap-2 py-2 border-b" style="border-color:var(--border-color)">
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-bold truncate">${rcEsc(r.congregacao || '—')}</p>
          <p class="text-[9px] opacity-55">${rcEsc(r.data_relatorio || '')} • ${rcEsc(r.semana || '')} • ${rcEsc(r.autor_nome || '')}</p>
        </div>
        <span class="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full shrink-0" style="background:${r.status === 'enviado' ? 'rgba(56,189,248,.15);color:#38bdf8' : 'rgba(245,158,11,.15);color:#f59e0b'}">${rcEsc(r.status || 'rascunho')}</span>
        <button onclick="rcmAbrir('${r.id}')" class="w-7 h-7 rounded-lg text-[10px] cursor-pointer shrink-0" style="background:var(--bg-input)" title="Abrir"><i class="fa-solid fa-folder-open"></i></button>
      </div>`).join('');
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
    F.rcCongregacao = r.congregacao || '';
    F.rcData = r.data_relatorio || '';
    F.rcSemana = r.semana || '2ª Semana';
    // Tesoureiro edita os próprios rascunhos; relatório de terceiro/enviado abre somente leitura
    const meuCpf = String(sessao()?.usuario?.cpf || '').replace(/\D/g,'');
    const autorCpf = String(r.autor_cpf || '').replace(/\D/g,'');
    RC.somenteLeitura = (autorCpf && autorCpf !== meuCpf) || r.status === 'enviado';
    rcRenderTela();
  } catch(e){ toast(e.message || 'Erro ao abrir.'); }
};

window.rcmVoltar = function(){
  RC.somenteLeitura = false;
  rcRenderTela();
};

window.rcmNovo = function(){
  RC.lancamentos = []; RC.id = null; RC.status = 'rascunho'; RC.somenteLeitura = false;
  F.rcCongregacao = ''; F.rcData = '';
  rcRenderTela();
};

/* depuração/testes */
window.SGEDZ = { carregarMembros, listarMembrosDizimistas, obterHistoricoDizimos, obterHistoricoCongregacoes, carregarLancamentosAno, dadosFrequenciaBI, F, RC };

})();
