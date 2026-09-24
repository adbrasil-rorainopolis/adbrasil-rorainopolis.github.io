/* ============================================================
   MODO MEMBRO — visão pessoal do app (piloto: só o CPF mestre).
   Abas: Início, Minha Congregação, Comunidade, Estudos, Financeiro.
   O admin alterna Membro ⇄ Gestão pelo botão flutuante ⇄.
   Depende de: api(), sessao(), toast(), esc()/comEsc(), comPermitidoMobile().
   ============================================================ */
const MEMBRO_MODS = ['membro_inicio', 'membro_congregacao', 'comunidade', 'membro_estudos', 'membro_financeiro'];
const MEMBRO_NAV = [
  { mod: 'membro_inicio',       icone: 'fa-house',              cor: 'var(--color-primary)', label: 'Início' },
  { mod: 'membro_congregacao',  icone: 'fa-house-chimney',      cor: '#06b6d4',              label: 'Minha Congr.' },
  { mod: 'comunidade',          icone: 'fa-users',              cor: '#e11d48',              label: 'Comunid.' },
  { mod: 'membro_estudos',      icone: 'fa-book-open',          cor: '#8b5cf6',              label: 'Estudos' },
  { mod: 'membro_financeiro',   icone: 'fa-hand-holding-heart', cor: '#10b981',              label: 'Financeiro' },
];
const memEsc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

window.sgeModoAtual = function() {
  if (typeof comPermitidoMobile !== 'function' || !comPermitidoMobile()) return 'gestao';
  return localStorage.getItem('sge_modo') === 'membro' ? 'membro' : 'gestao';
};
window.sgeModoPodeAlternar = function() {
  return typeof comPermitidoMobile === 'function' && comPermitidoMobile();
};

/* ---------- troca de modo ---------- */
let navGestaoHtml = null; // snapshot da nav de gestão pra restaurar

window.sgeAlternarModo = function() {
  const novo = sgeModoAtual() === 'membro' ? 'gestao' : 'membro';
  localStorage.setItem('sge_modo', novo);
  sgeAplicarModoNav();
  mudarVisao(novo === 'membro' ? 'membro_inicio' : 'dashboard');
  toast(novo === 'membro' ? 'Modo Membro ativado — sua visão pessoal.' : 'Modo Gestão ativado — administração do campo.');
};

/* ---------- nav ---------- */
function sgeNavBox() { return document.querySelector('.app-nav .flex'); }

window.sgeAplicarModoNav = function() {
  const box = sgeNavBox();
  if (!box) return;
  if (!navGestaoHtml) navGestaoHtml = box.innerHTML; // guarda a nav original
  if (sgeModoAtual() === 'membro') {
    box.innerHTML = MEMBRO_NAV.map(n =>
      `<button onclick="mudarVisao('${n.mod}')" data-mod="${n.mod}" class="sidebar-nav-btn flex-1 flex flex-col items-center gap-1 py-2.5" title="${n.label}">
        <span class="nav-ind h-0.5 w-8 rounded-full"></span>
        <i class="fa-solid ${n.icone} text-base" style="color:${n.cor}"></i><span class="text-[9px] font-bold">${n.label}</span>
      </button>`).join('');
  } else {
    box.innerHTML = navGestaoHtml;
    if (typeof aplicarPermissoesNav === 'function') aplicarPermissoesNav();
  }
  document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.toggle('ativa', b.dataset.mod === moduloAtual));
  sgeRenderBotaoModo();
};

/* ---------- botão flutuante ⇄ (só piloto) ---------- */
function sgeRenderBotaoModo() {
  let b = document.getElementById('btn-modo');
  if (!sgeModoPodeAlternar()) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('button');
    b.id = 'btn-modo';
    b.onclick = sgeAlternarModo;
    b.className = 'fixed z-40 flex items-center gap-1.5 rounded-full px-3 py-2 shadow-lg cursor-pointer';
    b.style.cssText = 'right:12px;bottom:74px;color:#fff;font-size:10px;font-weight:800';
    document.body.appendChild(b);
  }
  const membro = sgeModoAtual() === 'membro';
  b.style.background = membro ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : 'linear-gradient(135deg,#b45309,#92400e)';
  b.innerHTML = `<i class="fa-solid fa-repeat text-[11px]"></i>${membro ? 'Gestão' : 'Membro'}`;
  b.title = membro ? 'Alternar para Modo Gestão' : 'Alternar para Modo Membro';
}

/* ---------- header padrão das telas membro ---------- */
function memHeader(icone, cor, titulo, subtitulo) {
  return `<div class="flex items-center gap-3 pb-3 border-b mb-3" style="border-color:var(--border-color)">
    <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background:${cor}1a"><i class="fa-solid ${icone} text-lg" style="color:${cor}"></i></div>
    <div class="flex-1 min-w-0"><h2 class="font-bold text-sm">${titulo}</h2><p class="text-[10px] opacity-60">${subtitulo}</p></div>
    <span class="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-full text-white" style="background:linear-gradient(135deg,#0ea5e9,#6366f1)">Membro</span>
  </div>`;
}
const memCard = inner => `<div class="border rounded-2xl p-3.5 mb-3" style="background:var(--bg-card);border-color:var(--border-color)">${inner}</div>`;
const memEmBreve = (icone, cor, titulo, desc) => memCard(
  `<div class="flex flex-col items-center text-center py-6 gap-2">
    <i class="fa-solid ${icone} text-2xl" style="color:${cor};opacity:.5"></i>
    <p class="text-xs font-bold">${titulo}</p>
    <p class="text-[10px] opacity-50 max-w-[240px] leading-relaxed">${desc}</p>
    <span class="text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style="background:var(--color-primary-light);color:var(--color-primary)">Em breve</span>
  </div>`);

/* ---------- INÍCIO — panorama pessoal ---------- */
window.renderMembroInicio = function() {
  const c = $('dash-conteudo');
  if (!c) return;
  const u = sessao()?.usuario || {};
  const nome = (u.nome || 'Membro').split(' ').slice(0, 2).join(' ');
  const vers = (typeof VERSICULOS_DASH !== 'undefined' && VERSICULOS_DASH.length)
    ? VERSICULOS_DASH[new Date().getDate() % VERSICULOS_DASH.length] : ['Buscai primeiro o Reino de Deus.', 'Mateus 6:33'];
  c.innerHTML = `
    ${memHeader('fa-house', 'var(--color-primary)', `Olá, ${memEsc(nome)} 👋`, 'Seu panorama pessoal')}
    <div class="border rounded-2xl p-4 mb-3" style="background:linear-gradient(135deg,var(--color-primary-light),var(--bg-card));border-color:var(--border-color)">
      <p class="text-[9px] font-bold uppercase tracking-wider mb-1" style="color:var(--color-primary)">📖 Palavra do dia</p>
      <p class="text-xs leading-relaxed italic">"${memEsc(vers[0])}"</p>
      <p class="text-[10px] font-bold mt-1.5" style="color:var(--color-primary)">— ${memEsc(vers[1])}</p>
    </div>
    ${memCard(`<p class="text-[9px] font-bold uppercase tracking-wider mb-2 opacity-60">Novidades pra você</p>
      <div class="flex items-center gap-2.5 mb-2"><i class="fa-solid fa-users text-sm w-5 text-center" style="color:#e11d48"></i><p class="text-[11px] flex-1">Feed da <b>Comunidade</b> — toque na aba para ver os posts</p></div>
      <div class="flex items-center gap-2.5"><i class="fa-solid fa-book-open text-sm w-5 text-center" style="color:#8b5cf6"></i><p class="text-[11px] flex-1"><b>Estudos</b> — devocionais e lições da EBD</p></div>`)}
    ${memEmBreve('fa-calendar-week', '#d97706', 'Sua semana', 'Em breve: seus cultos, escalas e eventos da sua congregação reunidos aqui.')}`;
};

/* ---------- MINHA CONGREGAÇÃO ---------- */
window.renderMembroCongregacao = function() {
  const c = $('dash-conteudo');
  if (!c) return;
  const u = sessao()?.usuario || {};
  const cong = u.congregacao || u.congregacao_nome || u.congregacao_tesoureiro || '';
  c.innerHTML = `
    ${memHeader('fa-house-chimney', '#06b6d4', 'Minha Congregação', cong ? memEsc(cong) : 'Sua congregação no SGE')}
    ${cong ? memCard(`<div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style="background:linear-gradient(135deg,#06b6d4,#0e7490)">${memEsc(cong.slice(0,2).toUpperCase())}</div>
      <div><p class="font-bold text-xs">${memEsc(cong)}</p><p class="text-[9px] opacity-60">Sua congregação de vínculo</p></div></div>`) : ''}
    ${memEmBreve('fa-clipboard-list', '#06b6d4', 'Escalas e avisos', 'Em breve: suas escalas de louvor/culto, avisos direcionados e agenda da congregação — puxados dos posts da Comunidade.')}`;
};

/* ---------- ESTUDOS ---------- */
window.renderMembroEstudos = function() {
  const c = $('dash-conteudo');
  if (!c) return;
  c.innerHTML = `
    ${memHeader('fa-book-open', '#8b5cf6', 'Estudos', 'Devocionais, EBD e leitura bíblica')}
    ${memCard(`<p class="text-[9px] font-bold uppercase tracking-wider mb-1" style="color:#8b5cf6">📖 Devocional</p>
      <p class="text-xs opacity-70 leading-relaxed">Os devocionais publicados na Comunidade aparecem aqui em formato de leitura.</p>`)}
    ${memEmBreve('fa-book', '#16a34a', 'Escola Bíblica Dominical', 'Em breve: lições da sua classe, plano de leitura semanal e materiais da EBD.')}`;
};

/* ---------- MEU FINANCEIRO ---------- */
const _memNumSemana = s => { const m = String(s || '').match(/\d+/); return m ? +m[0] : 99; };
const _memParseValor = v => { if (typeof v === 'number') return v; let s = String(v ?? '0').replace(/[^\d.,-]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return parseFloat(s) || 0; };
const _memFormaPagto = det => {
  try {
    const ps = typeof det === 'string' ? JSON.parse(det || '[]') : (det || []);
    const e = ps.reduce((a, i) => a + _memParseValor(i?.especie), 0);
    const x = ps.reduce((a, i) => a + _memParseValor(i?.pix), 0);
    return e > 0 && x > 0 ? 'Misto' : x > 0 ? 'PIX / Transf.' : 'Espécie';
  } catch { return 'Espécie'; }
};
const _memStatusBadge = st => {
  const s = String(st || '').toLowerCase();
  const [rot, cor] = s === 'conferido' ? ['Conferido', '#10b981'] : s === 'enviado' ? ['Registrado', '#0ea5e9'] : ['Em registro', '#f59e0b'];
  return `<span class="text-[8px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0" style="background:${cor}22;color:${cor}">${rot}</span>`;
};
const _memKpi = (titulo, valor, cor) => `<div class="border rounded-xl p-2.5 flex-1 min-w-0" style="background:var(--bg-card);border-color:var(--border-color)"><p class="text-[8px] font-bold uppercase opacity-60 truncate">${titulo}</p><p class="mt-0.5 text-sm font-bold truncate" style="color:${cor}">${valor}</p></div>`;
let _memFinCache = null;

window.renderMembroFinanceiro = async function(anoSel) {
  const c = $('dash-conteudo');
  if (!c) return;
  c.innerHTML = `
    ${memHeader('fa-hand-holding-heart', '#10b981', 'Meu Financeiro', 'Seus dízimos e ofertas — só você vê')}
    ${memCard(`<p class="text-[11px] opacity-50 text-center py-8"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Carregando suas contribuições…</p>`)}`;
  if (!_memFinCache) {
    try {
      _memFinCache = await api('meu_financeiro', {}, sessao()?.token);
    } catch (e) {
      c.innerHTML = `${memHeader('fa-hand-holding-heart', '#10b981', 'Meu Financeiro', 'Seus dízimos e ofertas — só você vê')}
        ${memCard(`<p class="text-[11px] opacity-60 text-center py-8">${memEsc(e?.data?.erro || e?.message || 'Falha ao carregar seu financeiro.')}</p>`)}`;
      return;
    }
  }
  const r = _memFinCache;
  if (!r?.vinculado || !r.membro) {
    c.innerHTML = `${memHeader('fa-hand-holding-heart', '#10b981', 'Meu Financeiro', 'Seus dízimos e ofertas — só você vê')}
      ${memCard(`<div class="flex flex-col items-center text-center py-6 gap-2">
        <i class="fa-solid fa-link-slash text-2xl" style="color:#f59e0b;opacity:.6"></i>
        <p class="text-xs font-bold">Cadastro de membro não localizado</p>
        <p class="text-[10px] opacity-50 max-w-[250px] leading-relaxed">Seu usuário ainda não está vinculado a um cadastro de membro (telefone ou nome idênticos). Procure a secretaria da tesouraria.</p></div>`)}`;
    return;
  }
  const m = r.membro;
  const lancs = (r.lancamentos || []).map(l => ({ ...l, _v: _memParseValor(l.valor), _p: (+l.ano || 0) * 100 + (typeof MESES_ORD !== 'undefined' ? MESES_ORD.indexOf(l.mes) : 0), _s: _memNumSemana(l.semana) }))
    .sort((a, b) => (b._p - a._p) || (b._s - a._s));
  const anos = [...new Set(lancs.map(l => String(l.ano)))].sort((a, b) => +b - +a);
  const ano = String(anoSel || anos[0] || new Date().getFullYear());
  const doAno = lancs.filter(l => String(l.ano) === ano);
  const totalAno = doAno.reduce((t, l) => t + l._v, 0);
  const totalGeral = lancs.reduce((t, l) => t + l._v, 0);
  const mesesGrp = {};
  doAno.forEach(l => { (mesesGrp[l.mes] = mesesGrp[l.mes] || []).push(l); });
  const mesesOrd = Object.keys(mesesGrp).sort((a, b) => (typeof MESES_ORD !== 'undefined' ? MESES_ORD.indexOf(b) - MESES_ORD.indexOf(a) : 0));
  c.innerHTML = `
    ${memHeader('fa-hand-holding-heart', '#10b981', 'Meu Financeiro', `${memEsc(m.nome)} · ${memEsc(m.congregacao || '')}`)}
    <div class="flex gap-2 mb-3">
      ${_memKpi(`Total ${ano}`, brl(totalAno), '#10b981')}
      ${_memKpi('Contribuições', doAno.length, '#0ea5e9')}
      ${_memKpi('Acumulado geral', brl(totalGeral), '#f59e0b')}
    </div>
    ${anos.length > 1 ? `<div class="flex flex-wrap gap-1.5 mb-3">${anos.map(a => `<button onclick="renderMembroFinanceiro('${a}')" class="px-3 py-1.5 rounded-xl border text-[11px] font-bold" style="border-color:var(--border-color);${a === ano ? 'background:var(--color-primary);color:#fff' : 'color:var(--text-muted)'}">${a}</button>`).join('')}</div>` : ''}
    ${doAno.length ? mesesOrd.map(mes => memCard(`
      <div class="flex items-center justify-between mb-2"><p class="text-[9px] font-bold uppercase tracking-wider" style="color:#10b981">${mes} ${ano}</p><p class="text-[10px] font-bold opacity-60">${brl(mesesGrp[mes].reduce((t, l) => t + l._v, 0))}</p></div>
      <div class="divide-y" style="border-color:var(--border-color)">${mesesGrp[mes].map(l => `
        <div class="flex items-center gap-2.5 py-2.5">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:#10b98115"><i class="fa-solid fa-hand-holding-heart text-[10px]" style="color:#10b981"></i></div>
          <div class="flex-1 min-w-0"><p class="text-[11px] font-bold">${memEsc(l.semana)}</p><p class="text-[9px] opacity-50">${_memFormaPagto(l.detalhes_parcelas)}${l.data_envio ? ' · ' + memEsc(l.data_envio) : ''}</p></div>
          <p class="text-[11px] font-bold shrink-0" style="color:#10b981">${brl(l._v)}</p>
          ${_memStatusBadge(l.status)}
        </div>`).join('')}</div>`)).join('')
      : memEmBreve('fa-receipt', '#10b981', 'Nenhuma contribuição em ' + ano, 'Quando a tesouraria registrar seus dízimos e ofertas em Lançamentos Semanais, eles aparecem aqui automaticamente.')}`;
};
