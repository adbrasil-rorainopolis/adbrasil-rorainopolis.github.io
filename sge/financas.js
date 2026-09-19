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
  histCongs: null,          // cache histórico congregações
  filtros: { conselho: 'Todos', congregacao: 'Todas', status: 'Todos', busca: '' },
  membroSel: null,
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
        <div class="flex-1 min-w-0"><h2 class="font-bold text-sm">Rol de Dizimistas</h2><p class="text-[10px] opacity-60">Consulta de membros e históricos — somente leitura</p></div>
      </div>
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
};

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

/* depuração/testes */
window.SGEDZ = { carregarMembros, listarMembrosDizimistas, obterHistoricoDizimos, obterHistoricoCongregacoes, carregarLancamentosAno, F };

})();
