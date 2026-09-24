/* ============================================================
   MODO MEMBRO — visão pessoal do app (piloto: só o CPF mestre).
   Abas: Início, Minha Congregação, Comunidade, Estudos, Financeiro.
   O admin alterna Membro ⇄ Gestão pelo botão flutuante ⇄.
   Depende de: api(), sessao(), toast(), esc()/comEsc(), comPermitidoMobile().
   ============================================================ */
const MEMBRO_MODS = ['membro_inicio', 'membro_congregacao', 'membro_comunidade', 'membro_estudos', 'membro_financeiro'];
const MEMBRO_NAV = [
  { mod: 'membro_inicio',       icone: 'fa-house',              cor: 'var(--color-primary)', label: 'Início' },
  { mod: 'membro_congregacao',  icone: 'fa-house-chimney',      cor: '#06b6d4',              label: 'Minha Congr.' },
  { mod: 'membro_comunidade',   icone: 'fa-users',              cor: '#e11d48',              label: 'Comunid.' },
  { mod: 'membro_estudos',      icone: 'fa-book-open',          cor: '#8b5cf6',              label: 'Estudos' },
  { mod: 'membro_financeiro',   icone: 'fa-hand-holding-heart', cor: '#10b981',              label: 'Financeiro' },
];
/* Todos os módulos aparecem na nav de todos os membros. Os inacabados
   mostram 'Em breve' (usuário comum) ou 'Beta' (piloto). */
const _memEhPiloto = () => {
  const dig = v => String(v || '').replace(/\D/g, '');
  const pilotos = (typeof COM_CPFS_PILOTO !== 'undefined') ? COM_CPFS_PILOTO : ['04421351229'];
  const u = sessao()?.usuario || {};
  return [u.cpf, u.Cpf, sessao()?.cpf].some(c => pilotos.includes(dig(c)));
};
const memEsc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

window.sgeModoAtual = function() {
  // Membro puro (sem acesso à gestão) vive sempre no modo membro.
  if (!sgeModoPodeAlternar()) return 'membro';
  return localStorage.getItem('sge_modo') === 'membro' ? 'membro' : 'gestao';
};
window.sgeModoPodeAlternar = function() {
  // ⇄ Gestão só aparece para perfis administrativos/operacionais.
  return typeof comPodeGestao === 'function' && comPodeGestao();
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

/* ---------- alternância ⇄ dentro da engrenagem (só quem tem gestão) ---------- */
function sgeRenderBotaoModo() {
  const antigo = document.getElementById('btn-modo');
  if (antigo) antigo.remove(); // remove o flutuante das versões anteriores
  const mi = document.getElementById('mi-modo-gestao');
  if (!mi) return;
  if (!sgeModoPodeAlternar()) { mi.classList.add('hidden'); return; }
  mi.classList.remove('hidden');
  const membro = sgeModoAtual() === 'membro';
  mi.innerHTML = `<i class="fa-solid fa-repeat text-[12px]" style="color:${membro ? '#b45309' : '#0ea5e9'}"></i>
    <span>${membro ? 'Modo Gestão' : 'Modo Membro'}</span>
    <span class="ml-auto text-[8px] font-bold uppercase tracking-wider" style="color:var(--text-muted)">${membro ? 'Administração' : 'Visão pessoal'}</span>`;
  mi.title = membro ? 'Alternar para a administração do campo' : 'Alternar para a sua visão de membro';
}

/* ---------- header padrão das telas membro ---------- */
function memHeader(icone, cor, titulo, subtitulo) {
  return `<div class="flex items-center gap-3 pb-3 border-b mb-3" style="border-color:var(--border-color)">
    <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background:${cor}1a"><i class="fa-solid ${icone} text-lg" style="color:${cor}"></i></div>
    <div class="flex-1 min-w-0"><h2 class="font-bold text-sm">${titulo}</h2><p class="text-[10px] opacity-60">${subtitulo}</p></div>
    <div class="flex flex-col items-end gap-1 shrink-0">
      <span class="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-full text-white" style="background:linear-gradient(135deg,#0ea5e9,#6366f1)">Membro</span>
      ${_memEhPiloto() ? `<span class="text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style="background:#f59e0b22;color:#f59e0b" title="Versão em avaliação — dados ilustrativos">Beta · em avaliação</span>` : ''}
    </div>
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
const memEmConstrucao = (titulo, desc) => {
  const beta = _memEhPiloto();
  return memCard(
    `<div class="flex flex-col items-center text-center py-8 gap-2.5">
      <i class="fa-solid fa-helmet-safety text-3xl" style="color:#f59e0b;opacity:.55"></i>
      <p class="text-xs font-bold">${titulo}</p>
      <p class="text-[10px] opacity-50 max-w-[250px] leading-relaxed">${desc}</p>
      <span class="text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-full" style="background:${beta ? '#f59e0b22' : 'var(--color-primary-light)'};color:${beta ? '#f59e0b' : 'var(--color-primary)'}">${beta ? 'Versão Beta' : 'Em breve'}</span>
    </div>`);
};

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
      <div class="flex items-center gap-2.5 mb-2 cursor-pointer" onclick="mudarVisao('membro_financeiro')"><i class="fa-solid fa-hand-holding-heart text-sm w-5 text-center" style="color:#10b981"></i><p class="text-[11px] flex-1"><b>Meu Financeiro</b> — suas contribuições registradas pela tesouraria</p><i class="fa-solid fa-chevron-right text-[9px] opacity-40"></i></div>
      ${_memEhPiloto()
        ? `<div class="flex items-center gap-2.5 mb-2 cursor-pointer" onclick="mudarVisao('membro_comunidade')"><i class="fa-solid fa-users text-sm w-5 text-center" style="color:#e11d48"></i><p class="text-[11px] flex-1"><b>Comunidade</b> — feed interno já disponível pra você</p><i class="fa-solid fa-chevron-right text-[9px] opacity-40"></i></div>
           <div class="flex items-center gap-2.5 cursor-pointer" onclick="mudarVisao('membro_estudos')"><i class="fa-solid fa-book-open text-sm w-5 text-center" style="color:#8b5cf6"></i><p class="text-[11px] flex-1"><b>Estudos</b> — palavra do dia, leitura anual e devocionais</p><i class="fa-solid fa-chevron-right text-[9px] opacity-40"></i></div>`
        : `<div class="flex items-center gap-2.5"><i class="fa-solid fa-helmet-safety text-sm w-5 text-center" style="color:#f59e0b"></i><p class="text-[11px] flex-1 opacity-60">Novos módulos em construção — em breve pra você</p></div>`}`)}
    ${memEmBreve('fa-calendar-week', '#d97706', 'Sua semana', 'Em breve: seus cultos, escalas e eventos da sua congregação reunidos aqui.')}`;
};

/* ---------- MINHA CONGREGAÇÃO (em construção — só piloto vê na nav) ---------- */
window.renderMembroCongregacao = function() {
  const c = $('dash-conteudo');
  if (!c) return;
  c.innerHTML = `
    ${memHeader('fa-house-chimney', '#06b6d4', 'Minha Congregação', 'Módulo em construção')}
    ${memEmConstrucao('Minha Congregação', 'Em construção: suas escalas de louvor/culto, avisos direcionados e agenda da congregação.')}`;
};

/* ---------- COMUNIDADE do membro ----------
   Piloto (CPF mestre): feed real — mesmo módulo da gestão (stories, reações).
   Demais membros: placeholder "Em breve". */
window.renderMembroComunidade = function() {
  const c = $('dash-conteudo');
  if (!c) return;
  if (_memEhPiloto() && typeof renderComunidade === 'function') { renderComunidade(); return; }
  c.innerHTML = `
    ${memHeader('fa-users', '#e11d48', 'Comunidade', 'Módulo em construção')}
    ${memEmConstrucao('Comunidade', 'Em construção: feed de avisos, cultos e posts do campo direcionados a você.')}`;
};

/* ---------- ESTUDOS ----------
   Piloto: Palavra do dia + plano de leitura anual + devocionais publicados
   na Comunidade (template 'devocional'). Demais membros: "Em breve". */
const EST_LIVROS = [
  ['Gn',50],['Êx',40],['Lv',27],['Nm',36],['Dt',34],['Js',24],['Jz',21],['Rt',4],
  ['1Sm',31],['2Sm',24],['1Rs',22],['2Rs',25],['1Cr',29],['2Cr',36],['Ed',10],['Ne',13],
  ['Et',10],['Jó',42],['Sl',150],['Pv',31],['Ec',12],['Ct',8],['Is',66],['Jr',52],
  ['Lm',5],['Ez',48],['Dn',12],['Os',14],['Jl',3],['Am',9],['Ob',1],['Jn',4],
  ['Mq',7],['Na',3],['Hc',3],['Sf',3],['Ag',2],['Zc',14],['Ml',4],['Mt',28],
  ['Mc',16],['Lc',24],['Jo',21],['At',28],['Rm',16],['1Co',16],['2Co',13],['Gl',6],
  ['Ef',6],['Fp',4],['Cl',4],['1Ts',5],['2Ts',3],['1Tm',6],['2Tm',4],['Tt',3],['Fm',1],
  ['Hb',13],['Tg',5],['1Pe',5],['2Pe',3],['1Jo',5],['2Jo',1],['3Jo',1],['Jd',1],['Ap',22],
];
const EST_TOTAL_CAPS = EST_LIVROS.reduce((a, l) => a + l[1], 0); // 1189
function estLeituraHoje() {
  const ano = new Date().getFullYear();
  const dia = Math.floor((Date.now() - new Date(ano, 0, 0).getTime()) / 864e5); // 1..365
  const ini = Math.floor((dia - 1) * EST_TOTAL_CAPS / 365), fim = Math.floor(dia * EST_TOTAL_CAPS / 365);
  const refs = [];
  let acc = 0;
  for (const [nome, caps] of EST_LIVROS) {
    for (let cap = 1; cap <= caps; cap++) {
      const idx = acc + cap - 1;
      if (idx >= ini && idx < fim) refs.push(`${nome} ${cap}`);
    }
    acc += caps;
  }
  return { refs, dia };
}

window.renderMembroEstudos = async function() {
  const c = $('dash-conteudo');
  if (!c) return;
  if (!_memEhPiloto()) {
    c.innerHTML = `
      ${memHeader('fa-book-open', '#8b5cf6', 'Estudos', 'Módulo em construção')}
      ${memEmConstrucao('Estudos', 'Em construção: devocionais, lições da EBD e plano de leitura semanal.')}`;
    return;
  }
  const vers = (typeof VERSICULOS_DASH !== 'undefined' && VERSICULOS_DASH.length)
    ? VERSICULOS_DASH[new Date().getDate() % VERSICULOS_DASH.length] : ['Buscai primeiro o Reino de Deus.', 'Mateus 6:33'];
  const { refs, dia } = estLeituraHoje();
  c.innerHTML = `
    ${memHeader('fa-book-open', '#8b5cf6', 'Estudos', 'Versão Beta — em avaliação')}
    <div class="border rounded-2xl p-4 mb-3" style="background:linear-gradient(135deg,#8b5cf61a,var(--bg-card));border-color:var(--border-color)">
      <p class="text-[9px] font-bold uppercase tracking-wider mb-1" style="color:#8b5cf6">📖 Palavra do dia</p>
      <p class="text-xs leading-relaxed italic">"${memEsc(vers[0])}"</p>
      <p class="text-[10px] font-bold mt-1.5" style="color:#8b5cf6">— ${memEsc(vers[1])}</p>
    </div>
    ${memCard(`<div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background:#8b5cf61a"><i class="fa-solid fa-calendar-day" style="color:#8b5cf6"></i></div>
      <div class="flex-1 min-w-0"><p class="text-[9px] font-bold uppercase tracking-wider opacity-60">Plano de leitura anual — dia ${dia}/365</p>
      <p class="text-xs font-bold mt-0.5">${memEsc(refs.join('  ·  '))}</p></div></div>`)}
    <p class="text-[9px] font-bold uppercase tracking-wider mb-2 mt-1 opacity-60"><i class="fa-solid fa-hands-praying mr-1"></i>Devocionais publicados</p>
    <div id="est-devocionais"><div class="flex items-center justify-center gap-2.5 py-8 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando…</div></div>`;
  try {
    const r = await api('listar_posts_comunidade', null, sessao()?.token);
    const devos = (r?.posts || []).filter(p => p.template === 'devocional');
    const box = document.getElementById('est-devocionais');
    if (box) box.innerHTML = devos.length
      ? devos.map(p => comPostHtml(p)).join('')
      : `<div class="border-2 border-dashed rounded-2xl p-6 text-center" style="border-color:var(--border-color)"><i class="fa-solid fa-book-open text-xl opacity-30 mb-2 block"></i><p class="text-xs font-bold opacity-60">Nenhum devocional publicado ainda</p><p class="text-[10px] opacity-40 mt-1">Quando a secretaria publicar devocionais na Comunidade, eles aparecem aqui.</p></div>`;
  } catch (e) {
    const box = document.getElementById('est-devocionais');
    if (box) box.innerHTML = `<div class="text-center py-6 text-xs" style="color:var(--color-danger)">${memEsc(e?.data?.erro || e?.message || 'Falha ao carregar devocionais.')}</div>`;
  }
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
let _memFinDoAno = [], _memFinAno = '', _memFinMembro = null;

/* ---------- PDF: extrato anual e recibo por lançamento ----------
   Gera só a partir dos dados do _memFinCache (escopo do próprio membro,
   devolvido pela API) — nunca aceita id de membro arbitrário. */
const _memStatusRot = st => {
  const s = String(st || '').toLowerCase();
  return s === 'conferido' ? 'Conferido' : s === 'enviado' ? 'Registrado' : 'Em registro';
};
const _memPdfCab = (doc, titulo, sub) => {
  const larg = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 122, 77); doc.rect(0, 0, larg, 22, 'F');
  doc.setTextColor(190, 235, 210); doc.setFontSize(8); doc.setFont(undefined, 'bold');
  doc.text('SGE AD BRASIL — PORTAL DO MEMBRO', larg / 2, 7, { align: 'center' });
  doc.setTextColor(255, 255, 255); doc.setFontSize(13);
  doc.text(titulo, larg / 2, 14, { align: 'center' });
  if (sub) { doc.setFontSize(8.5); doc.setFont(undefined, 'normal'); doc.setTextColor(215, 240, 227); doc.text(sub, larg / 2, 19.5, { align: 'center' }); }
};
const _memPdfRodape = (doc) => {
  const larg = doc.internal.pageSize.getWidth(), alt = doc.internal.pageSize.getHeight();
  doc.setFontSize(7); doc.setTextColor(120, 130, 145);
  doc.text(`Documento gerado pelo Portal do Membro em ${new Date().toLocaleString('pt-BR')} — confere com os registros da tesouraria.`, larg / 2, alt - 6, { align: 'center' });
};

window.memFinPdfExtrato = function(){
  const m = _memFinMembro, ano = _memFinAno, lista = _memFinDoAno;
  if (!m) { toast('Financeiro não carregado.'); return; }
  if (!lista.length) { toast('Sem contribuições para exportar.'); return; }
  if (typeof window.jspdf === 'undefined') { toast('Biblioteca de PDF não carregou.'); return; }
  const doc = new window.jspdf.jsPDF();
  const larg = doc.internal.pageSize.getWidth();
  _memPdfCab(doc, `Extrato de Contribuições — ${ano}`, `${m.nome}  ·  ${m.congregacao || ''}  ·  ${m.conselho || ''}`);
  const corpo = [...lista].sort((a, b) => (a._p - b._p) || (a._s - b._s))
    .map(l => [l.mes, l.semana, _memFormaPagto(l.detalhes_parcelas), _memStatusRot(l.status), l.data_envio || '-', brl(l._v)]);
  doc.autoTable({
    startY: 27,
    head: [['Mês', 'Semana', 'Forma', 'Status', 'Registrado em', 'Valor']],
    body: corpo,
    styles: { fontSize: 8.5 }, headStyles: { fillColor: [15, 122, 77] },
    alternateRowStyles: { fillColor: [232, 244, 238] },
    columnStyles: { 1: { halign: 'center', cellWidth: 26 }, 2: { halign: 'center', cellWidth: 27 }, 3: { halign: 'center', cellWidth: 24 }, 5: { halign: 'right', cellWidth: 26 } },
  });
  const total = lista.reduce((t, l) => t + l._v, 0);
  let y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(15, 122, 77);
  doc.text(`TOTAL ${ano}: ${brl(total)}   ·   ${lista.length} contribuição(ões)`, larg - 14, y, { align: 'right' });
  _memPdfRodape(doc);
  doc.save(`extrato-contribuicoes-${ano}-${String(m.id || 'membro')}.pdf`);
};

window.memFinPdfRecibo = function(idx){
  const m = _memFinMembro, l = _memFinDoAno[idx];
  if (!m || !l) { toast('Lançamento não encontrado.'); return; }
  if (typeof window.jspdf === 'undefined') { toast('Biblioteca de PDF não carregou.'); return; }
  const doc = new window.jspdf.jsPDF();
  const larg = doc.internal.pageSize.getWidth();
  _memPdfCab(doc, 'Comprovante de Contribuição', `${m.nome}  ·  ${m.congregacao || ''}  ·  ${m.conselho || ''}`);
  let y = 34;
  doc.setTextColor(95, 107, 122); doc.setFontSize(9); doc.setFont(undefined, 'normal');
  doc.text(`Referência: ${l.semana} — ${l.mes}/${l.ano}`, larg / 2, y, { align: 'center' }); y += 10;
  doc.setFillColor(232, 244, 238); doc.roundedRect(larg / 2 - 45, y, 90, 22, 3, 3, 'F');
  doc.setTextColor(15, 122, 77); doc.setFontSize(17); doc.setFont(undefined, 'bold');
  doc.text(brl(l._v), larg / 2, y + 14, { align: 'center' }); y += 32;
  doc.autoTable({
    startY: y,
    body: [
      ['Membro', String(m.nome || '-')],
      ['Congregação', `${m.congregacao || '-'}  ·  ${m.conselho || '-'}`],
      ['Período', `${l.semana} — ${l.mes}/${l.ano}`],
      ['Forma', _memFormaPagto(l.detalhes_parcelas)],
      ['Status', _memStatusRot(l.status)],
      ['Registrado em', l.data_envio || '-'],
    ],
    styles: { fontSize: 9 }, theme: 'plain',
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40, textColor: [95, 107, 122] } },
  });
  _memPdfRodape(doc);
  doc.save(`comprovante-${l.mes}-${l.ano}-${_memNumSemana(l.semana)}sem.pdf`);
};

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
        <p class="text-[10px] opacity-50 max-w-[250px] leading-relaxed">Seu usuário ainda não foi vinculado a um cadastro de membro. Peça à secretaria da tesouraria para fazer o vínculo no Rol de Dizimistas.</p></div>`)}`;
    return;
  }
  const m = r.membro;
  const lancs = (r.lancamentos || []).map(l => ({ ...l, _v: _memParseValor(l.valor), _p: (+l.ano || 0) * 100 + (typeof MESES_ORD !== 'undefined' ? MESES_ORD.indexOf(l.mes) : 0), _s: _memNumSemana(l.semana) }))
    .filter(l => l._v > 0)
    .sort((a, b) => (b._p - a._p) || (b._s - a._s));
  const anos = [...new Set(lancs.map(l => String(l.ano)))].sort((a, b) => +b - +a);
  const ano = String(anoSel || anos[0] || new Date().getFullYear());
  const doAno = lancs.filter(l => String(l.ano) === ano);
  doAno.forEach((l, i) => { l._i = i; });
  _memFinDoAno = doAno; _memFinAno = ano; _memFinMembro = m;
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
    <div class="flex flex-wrap items-center gap-1.5 mb-3">
      ${anos.length > 1 ? anos.map(a => `<button onclick="renderMembroFinanceiro('${a}')" class="px-3 py-1.5 rounded-xl border text-[11px] font-bold" style="border-color:var(--border-color);${a === ano ? 'background:var(--color-primary);color:#fff' : 'color:var(--text-muted)'}">${a}</button>`).join('') : ''}
      ${doAno.length ? `<button onclick="memFinPdfExtrato()" class="ml-auto px-3 py-1.5 rounded-xl text-[11px] font-bold text-white" style="background:linear-gradient(135deg,#10b981,#059669)"><i class="fa-solid fa-file-pdf mr-1"></i>Extrato ${ano}</button>` : ''}
    </div>
    ${doAno.length ? mesesOrd.map(mes => memCard(`
      <div class="flex items-center justify-between mb-2"><p class="text-[9px] font-bold uppercase tracking-wider" style="color:#10b981">${mes} ${ano}</p><p class="text-[10px] font-bold opacity-60">${brl(mesesGrp[mes].reduce((t, l) => t + l._v, 0))}</p></div>
      <div class="divide-y" style="border-color:var(--border-color)">${mesesGrp[mes].map(l => `
        <div class="flex items-center gap-2.5 py-2.5">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background:#10b98115"><i class="fa-solid fa-hand-holding-heart text-[10px]" style="color:#10b981"></i></div>
          <div class="flex-1 min-w-0"><p class="text-[11px] font-bold">${memEsc(l.semana)}</p><p class="text-[9px] opacity-50">${_memFormaPagto(l.detalhes_parcelas)}${l.data_envio ? ' · ' + memEsc(l.data_envio) : ''}</p></div>
          <p class="text-[11px] font-bold shrink-0" style="color:#10b981">${brl(l._v)}</p>
          ${_memStatusBadge(l.status)}
          <button onclick="memFinPdfRecibo(${l._i})" class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="background:#10b98115" title="Comprovante PDF"><i class="fa-solid fa-file-pdf text-[10px]" style="color:#10b981"></i></button>
        </div>`).join('')}</div>`)).join('')
      : memEmBreve('fa-receipt', '#10b981', 'Nenhuma contribuição em ' + ano, 'Quando a tesouraria registrar seus dízimos e ofertas em Lançamentos Semanais, eles aparecem aqui automaticamente.')}`;
};
