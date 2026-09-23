/* ============================================================
   COMUNIDADE — feed interno da igreja (piloto: só o CPF mestre)
   Somente leitura nesta versão: curtidas/comentários chegam depois.
   Depende de: api(), sessao(), toast(), esc() — globais do app.
   ============================================================ */
const COM_CPF_PILOTO = '04421351229';
function comPermitidoMobile() {
  const u = sessao()?.usuario || {};
  return String(u.cpf || u.Cpf || '').replace(/\D/g, '') === COM_CPF_PILOTO;
}

const COM_TEMPLATES = {
  aviso:       { emoji: '📢', cor: '#0ea5e9', tag: 'Aviso' },
  culto:       { emoji: '🙏', cor: '#16a34a', tag: 'Culto' },
  celebracao:  { emoji: '🎉', cor: '#f59e0b', tag: 'Celebração' },
  devocional:  { emoji: '📖', cor: '#64748b', tag: 'Devocional' },
  escala:      { emoji: '📋', cor: '#8b5cf6', tag: 'Escala' },
  missao:      { emoji: '🌍', cor: '#10b981', tag: 'Missões' },
  midia:       { emoji: '📸', cor: '#ec4899', tag: 'Mídia' },
  video:       { emoji: '🎥', cor: '#f97316', tag: 'Vídeo' },
  aniversario: { emoji: '🎂', cor: '#ef4444', tag: 'Aniversário' },
};
const COM_CARD_ICONES = { local: 'fa-location-dot', data: 'fa-calendar-day', hora: 'fa-clock', meta: 'fa-flag-checkered' };
const COM = { posts: [], filtro: 'todos', carregou: false };

const comEsc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function comTempoRelativo(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return 'agora';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString('pt-BR');
}

function comPostHtml(p) {
  const t = COM_TEMPLATES[p.template] || COM_TEMPLATES.aviso;
  const ex = p.extras || {};
  const nome = ex.remetente_nome || 'Secretaria do Campo';
  const avatar = ex.remetente_avatar || 'SC';
  const cor = ex.remetente_cor || '#0ea5e9';
  const alvo = ex.publico_label || 'Todo o campo';
  const direcionado = alvo !== 'Todo o campo';
  let h = '';
  if (p.fixado) h += `<div class="px-3 pt-2.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider" style="color:var(--color-primary)"><i class="fa-solid fa-thumbtack"></i>Fixado • ${t.tag}</div>`;
  h += `<div class="p-3"><div class="flex items-center gap-2.5 mb-2">
    <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold" style="background:linear-gradient(135deg,${cor},${cor}bb)">${comEsc(avatar)}</div>
    <div class="min-w-0"><p class="font-bold text-xs truncate">${comEsc(nome)} <i class="fa-solid fa-circle-check text-sky-500 text-[9px]"></i></p>
    <p class="text-[9px] opacity-60">${comTempoRelativo(p.criado_em)} • <span class="${direcionado ? 'font-bold text-amber-600' : ''}">${comEsc(alvo)}</span></p></div>
    ${!p.fixado ? `<span class="ml-auto text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0" style="background:${t.cor}22;color:${t.cor}">${t.tag}</span>` : ''}
  </div>`;
  if (p.titulo) h += `<p class="text-xs leading-relaxed font-bold">${t.emoji} ${comEsc(p.titulo)}</p>`;
  if (p.conteudo) h += `<p class="text-xs leading-relaxed mt-1 opacity-80">${comEsc(p.conteudo).replace(/\n/g, '<br>')}</p>`;

  if (p.template === 'devocional' && ex.texto_versiculo) {
    h += `<div class="rounded-xl p-3 text-xs leading-relaxed italic mt-2" style="background:var(--color-primary-light)">"${comEsc(ex.texto_versiculo)}"${ex.versiculo ? `<p class="text-[10px] font-bold not-italic mt-1.5" style="color:var(--color-primary)">— ${comEsc(ex.versiculo)}</p>` : ''}</div>`;
    if (ex.reflexao) h += `<p class="text-xs leading-relaxed mt-2 opacity-80">💡 <b>Reflexão:</b> ${comEsc(ex.reflexao)}</p>`;
  }
  if (p.template === 'escala' && ex.itens_escala) {
    const linhas = String(ex.itens_escala).split('\n').filter(l => l.trim());
    h += `<div class="mt-2.5 rounded-xl overflow-hidden border" style="border-color:var(--border-color)">` + linhas.map((l, i) => {
      const partes = l.split(/\s+-\s+/);
      return `<div class="flex justify-between items-center px-3 py-2 text-[11px] ${i ? 'border-t' : ''}" style="border-color:var(--border-color);${i % 2 === 0 ? 'background:var(--bg-input)' : ''}"><span class="font-bold">${comEsc(partes[0])}</span><span class="opacity-70">${comEsc(partes[1] || '')}</span></div>`;
    }).join('') + '</div>';
  }
  if (p.template === 'missao' && ex.meta && ex.arrecadado) {
    const num = v => parseFloat(String(v).replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    const pct = Math.round(num(ex.arrecadado) / (num(ex.meta) || 1) * 100);
    h += `<div class="mt-2.5 rounded-xl p-3 text-center" style="background:linear-gradient(135deg,rgba(16,185,129,.15),rgba(5,150,105,.08))">
      <div class="flex items-center justify-center gap-2 mb-2"><i class="fa-solid fa-trophy text-xl" style="color:var(--color-success)"></i><span class="text-lg font-bold" style="color:var(--color-success)">${pct}%</span></div>
      <div class="w-full rounded-full h-2 mb-1" style="background:rgba(127,127,127,.2)"><div class="h-2 rounded-full" style="width:${Math.min(pct, 100)}%;background:linear-gradient(90deg,#10b981,#059669)"></div></div>
      <p class="text-[10px] font-bold" style="color:var(--color-success)">R$ ${comEsc(ex.arrecadado)} de R$ ${comEsc(ex.meta)}</p>
      ${ex.meta_alcancada ? '<p class="text-[9px] font-bold mt-1" style="color:var(--color-success)">🎯 META ALCANÇADA!</p>' : ''}</div>`;
  }
  if (p.template === 'aniversario' && ex.aniversariantes) {
    h += `<p class="text-xs leading-relaxed mt-1 opacity-80">🎂 <b>Aniversariantes:</b> ${comEsc(ex.aniversariantes)}${ex.aniv_congs ? ` <span class="opacity-60">(${comEsc(ex.aniv_congs)})</span>` : ''}</p>`;
  }
  (ex.cards || []).forEach(c => {
    if (c.tipo === 'lista') {
      const linhas = String(c.valor).split('\n').filter(l => l.trim());
      h += `<div class="mt-2.5 rounded-xl overflow-hidden border" style="border-color:var(--border-color)">` + linhas.map((l, i) =>
        `<div class="px-3 py-2 text-[11px] ${i ? 'border-t' : ''}" style="border-color:var(--border-color);${i % 2 === 0 ? 'background:var(--bg-input)' : ''}">${comEsc(l)}</div>`).join('') + '</div>';
    } else {
      h += `<div class="mt-2.5 rounded-xl px-3 py-2 flex items-center gap-3 text-[11px]" style="background:var(--bg-input)"><i class="fa-solid ${COM_CARD_ICONES[c.tipo] || 'fa-circle-info'}" style="color:${c.tipo === 'meta' ? 'var(--color-success)' : 'var(--color-primary)'}"></i><span><b>${comEsc(c.valor)}</b></span></div>`;
    }
  });
  h += `<div class="flex items-center gap-1 mt-3 pt-2.5 border-t" style="border-color:var(--border-color)">
    <button onclick="comEmBreve()" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer" style="color:var(--text-muted)"><i class="fa-solid fa-heart"></i><span>${p.curtidas || 0}</span></button>
    <button onclick="comEmBreve()" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer" style="color:var(--text-muted)"><i class="fa-solid fa-comment"></i><span>${p.comentarios || 0}</span></button>
    <button onclick="comEmBreve()" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ml-auto" style="color:var(--text-muted)"><i class="fa-solid fa-share-nodes"></i>Compartilhar</button>
  </div></div>`;
  return `<div class="border rounded-2xl overflow-hidden mb-3" style="background:var(--bg-card);border-color:${p.fixado ? 'var(--color-primary)' : 'var(--border-color)'}">${h}</div>`;
}

window.comEmBreve = function(){ toast('Curtidas e comentários chegam na próxima etapa do piloto.'); };

window.comFiltro = function(f){ COM.filtro = f; comRenderFeed(); };

function comRenderFeed() {
  const box = document.getElementById('com-feed');
  if (!box) return;
  const remetentes = [...new Set(COM.posts.map(p => (p.extras || {}).remetente_nome || p.remetente))];
  const filtrados = COM.filtro === 'todos' ? COM.posts
    : COM.posts.filter(p => ((p.extras || {}).remetente_nome || p.remetente) === COM.filtro);
  const chips = ['todos', ...remetentes].map(f =>
    `<button onclick="comFiltro('${comEsc(f)}')" class="px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap cursor-pointer" style="${COM.filtro === f ? 'background:var(--color-primary);color:#fff' : 'background:var(--bg-input);color:var(--text-muted)'}">${f === 'todos' ? 'Todos' : comEsc(f)}</button>`).join('');
  box.innerHTML =
    `<div class="flex gap-2 overflow-x-auto pb-2 mb-1" style="scrollbar-width:none">${chips}</div>`
    + (filtrados.length
        ? filtrados.map(comPostHtml).join('')
        : `<div class="border-2 border-dashed rounded-2xl p-8 text-center" style="border-color:var(--border-color)"><i class="fa-solid fa-users text-2xl opacity-30 mb-2 block"></i><p class="text-xs font-bold opacity-60">Nenhum post${COM.filtro !== 'todos' ? ' deste remetente' : ''} ainda</p><p class="text-[10px] opacity-40 mt-1">Os avisos publicados no painel do desktop aparecem aqui.</p></div>`);
}

window.renderComunidade = async function() {
  const conteudo = $('dash-conteudo');
  if (!conteudo) return;
  if (!comPermitidoMobile()) {
    conteudo.innerHTML = `<div class="flex flex-col items-center justify-center text-center pt-16 gap-3"><i class="fa-solid fa-lock text-2xl opacity-30"></i><p class="text-xs opacity-50 max-w-[240px]">O módulo Comunidade está em piloto e ainda não está liberado para o seu usuário.</p></div>`;
    return;
  }
  conteudo.innerHTML = `
    <div class="flex items-center gap-3 pb-3 border-b mb-3" style="border-color:var(--border-color)">
      <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background:var(--color-primary-light)"><i class="fa-solid fa-users text-lg" style="color:var(--color-primary)"></i></div>
      <div class="flex-1 min-w-0"><h2 class="font-bold text-sm">Comunidade</h2><p class="text-[10px] opacity-60">Feed interno da igreja — avisos e vida comunitária</p></div>
      <button onclick="comRecarregar()" class="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer" style="color:var(--color-primary)"><i class="fa-solid fa-rotate"></i></button>
    </div>
    <div id="com-feed"><div class="flex items-center justify-center gap-2.5 py-14 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando o feed…</div></div>`;
  try {
    const r = await api('listar_posts_comunidade', null, sessao()?.token);
    COM.posts = r?.posts || [];
    COM.carregou = true;
    comRenderFeed();
  } catch (e) {
    const box = document.getElementById('com-feed');
    if (box) box.innerHTML = `<div class="text-center py-10 text-xs" style="color:var(--color-danger)">${comEsc(e.message || 'Falha ao carregar o feed.')}</div>`;
  }
};

window.comRecarregar = async function() {
  const box = document.getElementById('com-feed');
  if (box) box.innerHTML = '<div class="flex items-center justify-center gap-2.5 py-14 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Atualizando…</div>';
  try {
    const r = await api('listar_posts_comunidade', null, sessao()?.token);
    COM.posts = r?.posts || [];
    comRenderFeed();
  } catch (e) { toast(e.message || 'Falha ao atualizar.'); comRenderFeed(); }
};
