/* ============================================================================
   SGE Mobile — Gestão Unificada
   Port fiel do engine desktop: core/sge_bi.py + core/sge_fluxo_caixa.py
   Depende de: api(), sessao(), toast(), brl(), $, MESES, Chart.js, jspdf
   ============================================================================ */
(function(){
'use strict';

/* ---------- Constantes (paridade com sge_bi.py / sge_fluxo_caixa.py) ---------- */
const ORDEM_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SEMANAS_CANONICAS = ['1ª SEMANA','2ª SEMANA','3ª SEMANA','4ª SEMANA','5ª SEMANA'];

const CONTAS_ENTRADAS_BI = [
  'Dízimos','Oferta Extra Ordinária',
  'Oferta Ordinária do Culto de Assembleia Geral - 2º. Feira',
  'Oferta Ordinária - 3ª. Feira',
  'Oferta Ordinária - Assembleia Geral - Culto de Milagres - 4º. Feira',
  'Oferta Ordinária - 5º Feira','Oferta Ordinária - 6º Feira','Oferta Ordinária - Sabado',
  'Oferta da EBD','Oferta da EBD Missionária','Oferta do Culto de Missões',
  'Oferta Missionária','Oferta Missionária do Circulo de Oração',
  'Oferta do Circulo de Oração - 6º Feira','Oferta do Circulo de Oração - Sábado',
  'Oferta do Culto do Circulo de Oração','Oferta do Culto da UMAD',
  'Oferta Ordinária do Culto de Domingo Noite - Outros Departamentos',
];
const CONTAS_SAIDAS_BI = [
  'Despesas Convencionais','Repasse da Oferta de Missões','S.O.S Baixo Rio Branco 1%',
  'Auxílio lideres de Congregação','Caixa da Oferta do Circulo de Oração',
  'Materiais de Bens Duráveis ou Utensílios','Energia','Telefone e Internet',
  'Alimentação para Eventos','Água e Esgoto','INSS, Taxas e Impostos Diversos',
  'Divulgação de Eventos, Propaganda e Rádio','Locação de Imóveis','Manutenção de Veículo',
  'Frete ou Aluguel de Veiculo','Combustivel e Lubrificantes','Passagens','Presentes',
  'Medicação','Construção, Reforma ou Ampliação','Material de Som','Material de Expediente',
  'Material de Limpeza','Atendimento Social','Aquisição de Imoveis','Hospedagem',
  'Vestuário ou Ornamentação','Lanche EBD ou Santa Ceia',
];
const CONTAS_AGRUPADAS_BI = {
  'Despesas Convencionais': ['Fundo Convencional','Auxílio Presidencial 5%','Prebenda','Prebenda pastores auxiliares'],
};
const CONTAS_MISSOES = new Set(['oferta da ebd missionária','oferta do culto de missões','oferta missionária','oferta missionária do circulo de oração']);
const CATEGORIAS_DESPESAS = ['Administrativo','Operacional','Encargos','Manutenção'];
const FATOR_RETENCAO_CAIXA = 0.54;
const LIMIAR_SEMAFORO_AMARELO = 0.15;
const EPS = 0.004;
/* Mobile = viewer: nenhum dado é gravado (despesas, quitação, ciclo). */
const SOMENTE_LEITURA = true;
const _bloqueado = () => ({ sucesso: false, mensagem: 'Aplicativo em modo somente leitura.' });

/* ---------- Helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const moeda = v => brl(num(v));
const cf = s => String(s ?? '').toLowerCase();
function perfilConsultor(){ return String(sessao()?.usuario?.perfil || '').trim().toLowerCase() === 'consultor'; }
function perfilAdmin(){ return String(sessao()?.usuario?.perfil || '').trim().toLowerCase() === 'administrador'; }
function variacaoPct(atual, base){ if (base === null || base === undefined || Math.abs(num(base)) < EPS) return null; return +(((num(atual) - num(base)) / Math.abs(num(base))) * 100).toFixed(1); }
function mediaArr(vals){ return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0; }
/* np.polyfit(x, y, 1) equivalente: retorna [slope, intercept] */
function polyfit1(xs, ys){
  const n = xs.length; if (!n) return [0, 0];
  const mx = mediaArr(xs), my = mediaArr(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++){ sxy += (xs[i]-mx)*(ys[i]-my); sxx += (xs[i]-mx)**2; }
  const slope = sxx ? sxy/sxx : 0;
  return [slope, my - slope*mx];
}
function tituloSemana(s){ const t = String(s||'').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); }

function indiceMes(nome){
  const s = String(nome ?? '').trim();
  if (/^\d{1,2}$/.test(s)){ const n = parseInt(s, 10); if (n >= 1 && n <= 12) return n; }
  const i = ORDEM_MESES.findIndex(m => cf(m) === cf(s));
  return i < 0 ? 1 : i + 1;
}
function nomeMes(v){
  const s = String(v ?? '').trim();
  if (/^\d{1,2}$/.test(s)){ const n = parseInt(s, 10); if (n >= 1 && n <= 12) return ORDEM_MESES[n - 1]; }
  const i = ORDEM_MESES.findIndex(m => cf(m) === cf(s));
  return i < 0 ? s : ORDEM_MESES[i];
}
function gerarListaPeriodos(anoIni, mesIni, anoFim, mesFim){
  let vIni = (+anoIni) * 12 + indiceMes(mesIni), vFim = (+anoFim) * 12 + indiceMes(mesFim);
  if (vIni > vFim) [vIni, vFim] = [vFim, vIni];
  const out = [];
  for (let v = vIni; v <= vFim; v++){ const d = v - 1; out.push([Math.floor(d / 12), ORDEM_MESES[d % 12]]); }
  return out;
}
function normalizarFiltroSemanas(semanas){
  if (!semanas || !semanas.length) return ['FECHAMENTO DO MÊS'];
  const limpas = [];
  for (const s of semanas){
    const up = String(s).trim().toUpperCase();
    if (up.includes('TODAS') || up.includes('CONSOLIDADO') || up.includes('FECHAMENTO')) return ['FECHAMENTO DO MÊS'];
    for (const n of ['1','2','3','4','5']) if (up.includes(n)){ const aba = `${n}º. SEMANA`; if (!limpas.includes(aba)) limpas.push(aba); break; }
  }
  return limpas.length ? limpas : ['FECHAMENTO DO MÊS'];
}
function valorContaAnalitica(nome, contas, dizimos, ofertas){
  const nn = cf(nome);
  if (nn === 'dízimos' || nn === 'dizimos') return num(dizimos);
  if (nn === 'ofertas' || nn === 'oferta') return num(ofertas);
  const comps = new Set((CONTAS_AGRUPADAS_BI[nome] || [nome]).map(cf));
  let soma = 0;
  for (const [k, v] of Object.entries(contas || {})) if (comps.has(cf(k))) soma += num(v);
  return soma;
}

/* ---------- Camada de dados ---------- */
const _cacheMov = {};       // `${ano}_${mes}` -> Promise<dados|null>
let _cachePeriodos = null, _cacheMapaConselhos = null;

async function carregarMovimento(ano, mes){
  const chave = `${ano}_${String(mes).toLowerCase()}`;
  if (!_cacheMov[chave]) _cacheMov[chave] = (async () => {
    try {
      const res = await api('carregar_movimento_financeiro', { ano: String(ano), mes: String(mes) }, sessao()?.token);
      const movs = res.movimentos || [], tots = res.totais || [];
      if (!movs.length) return null;
      const mapaTotais = {}; let arquivo = 'Supabase Nuvem';
      for (const t of tots){
        arquivo = t.arquivo_origem || arquivo;
        mapaTotais[t.aba || ''] = {
          dizimos: num(t.dizimos), ofertas: num(t.ofertas), total_entradas: num(t.total_entradas),
          total_despesas: num(t.total_despesas), saldo_mes_anterior: num(t.saldo_mes_anterior), saldo_campo: num(t.saldo_campo),
          entradas_detalhadas: t.entradas_detalhadas || {}, saidas_repasses_detalhadas: t.saidas_repasses_detalhadas || {},
          despesas_operacionais_detalhadas: t.despesas_operacionais_detalhadas || {},
        };
      }
      const abas = {};
      for (const m of movs){
        const aba = m.aba || '';
        arquivo = m.arquivo_origem || arquivo;
        if (!abas[aba]) abas[aba] = { registros: [], totais: mapaTotais[aba] || {}, colunas_entradas: [], colunas_saidas_1: [], colunas_saidas_2: [] };
        abas[aba].registros.push({
          numero: String(m.numero_item ?? ''), conselho: String(m.conselho ?? ''), congregacao: String(m.congregacao ?? ''),
          dizimos: num(m.dizimos), ofertas: num(m.ofertas), total_entradas: num(m.total_entradas), total_despesas: num(m.total_despesas),
          saldo_mes_anterior: num(m.saldo_mes_anterior), saldo_do_campo: num(m.saldo_campo),
          detalhes_entradas: m.detalhes_entradas || {}, detalhes_saidas_repasses: m.detalhes_saidas_repasses || {},
          detalhes_despesas_operacionais: m.detalhes_despesas_operacionais || {},
        });
      }
      return { ano: String(ano), mes: String(mes), arquivo_origem: arquivo, abas };
    } catch(e){ return null; }
  })();
  return _cacheMov[chave];
}
async function listarPeriodos(){
  if (!_cachePeriodos) _cachePeriodos = api('listar_periodos_financeiros', null, sessao()?.token)
    .then(r => (r.periodos || r.dados || []).map(p => ({ ano: String(p.ano), mes: nomeMes(p.mes) }))).catch(() => []);
  return _cachePeriodos;
}
async function mapaConselhos(){
  if (!_cacheMapaConselhos) _cacheMapaConselhos = api('listar_congregacoes', null, sessao()?.token).then(res => {
    const mapa = {}, porConselho = {};
    for (const c of (res.dados || [])){
      const nome = String(c.nome || '').trim(), conselho = String(c.conselho || '').trim();
      if (nome && conselho){ mapa[nome] = conselho; (porConselho[conselho] = porConselho[conselho] || []).push(nome); }
    }
    return { mapa, porConselho };
  }).catch(() => ({ mapa: {}, porConselho: {} }));
  return _cacheMapaConselhos;
}
function chaveNormalizada(v){
  let t = String(v || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  t = t.replace(/\b(p\.?p\.?|ponto\s*de\s*pregacao)\b/g, '').replace(/[^a-z0-9]/g, '');
  return t.replace(/\d+/g, m => String(parseInt(m, 10)));
}
async function identificarConselho(nomeCong, numOrdem){
  const n = parseInt(String(numOrdem ?? '').trim(), 10);
  if (Number.isFinite(n)){
    if (n >= 1 && n <= 2) return 'Assembleia Geral';
    if (n <= 10) return 'Conselho 1'; if (n <= 18) return 'Conselho 2';
    if (n <= 26) return 'Conselho 3'; if (n <= 35) return 'Conselho 4'; if (n <= 43) return 'Conselho 5';
  }
  const { mapa } = await mapaConselhos();
  const alvo = chaveNormalizada(nomeCong);
  for (const [nome, conselho] of Object.entries(mapa)) if (chaveNormalizada(nome) === alvo) return conselho;
  return 'Conselho Geral';
}
/* Escopo do usuário: a API não expõe `acessos`; aplica-se a máscara de Consultor
   e trata-se o restante como irrestrito (limitação documentada). */
const filtrosEscopo = () => [null, null];

/* ---------- Ciclo financeiro (localStorage — paridade com JSON por estação) ---------- */
const CHAVE_CICLO = 'sge_ciclo_config';
function _cicloMapa(){ try { return JSON.parse(localStorage.getItem(CHAVE_CICLO) || '{}'); } catch { return {}; } }
function obterCiclo(ano, mes){
  const cfg = _cicloMapa()[`${ano}_${mes}`] || {};
  const total = parseInt(cfg.total_semanas, 10) === 5 ? 5 : 4;
  const fech = Math.max(1, Math.min(total, parseInt(cfg.semana_fechamento ?? total, 10) || total));
  return { total_semanas: total, semana_fechamento: fech };
}
function salvarCiclo(ano, mes, totalSemanas, semanaFech){
  if (SOMENTE_LEITURA) return _bloqueado();
  const total = parseInt(totalSemanas, 10) === 5 ? 5 : 4;
  const fech = Math.max(1, Math.min(total, parseInt(semanaFech ?? total, 10) || total));
  const dados = _cicloMapa(); dados[`${ano}_${mes}`] = { total_semanas: total, semana_fechamento: fech };
  localStorage.setItem(CHAVE_CICLO, JSON.stringify(dados));
  return dados[`${ano}_${mes}`];
}

/* ---------- Despesas fixas (localStorage — paridade com SQLite por estação) ---------- */
const CHAVE_DESP = 'sge_despesas_fixas';
const _agoraStr = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
function _despLer(){ try { return JSON.parse(localStorage.getItem(CHAVE_DESP) || '[]'); } catch { return []; } }
function _despGravar(l){ localStorage.setItem(CHAVE_DESP, JSON.stringify(l)); }
const _quitada = d => Object.values(d.quitacao || {}).some(Boolean);
function listarDespesas(ano, mes){
  return _despLer().filter(d => String(d.ano) === String(ano) && cf(d.mes) === cf(mes))
    .sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)) || String(a.descricao).localeCompare(String(b.descricao)));
}
function adicionarDespesa(ano, mes, descricao, categoria, valor){
  if (SOMENTE_LEITURA) return _bloqueado();
  descricao = String(descricao || '').trim();
  if (!descricao) return { sucesso: false, mensagem: 'Informe a descrição da despesa.' };
  if (!CATEGORIAS_DESPESAS.includes(categoria)) categoria = 'Operacional';
  const v = num(valor);
  if (v < 0) return { sucesso: false, mensagem: 'Valor previsto não pode ser negativo.' };
  const l = _despLer(); const id = crypto.randomUUID().replace(/-/g, '');
  l.push({ id, ano: String(ano), mes: String(mes), descricao, categoria, valor_previsto: v, quitacao: {}, criado_em: _agoraStr(), atualizado_em: _agoraStr() });
  _despGravar(l); return { sucesso: true, id, mensagem: 'Despesa fixa adicionada.' };
}
function atualizarDespesa(id, descricao, categoria, valor){
  if (SOMENTE_LEITURA) return _bloqueado();
  descricao = String(descricao || '').trim();
  if (!descricao) return { sucesso: false, mensagem: 'Informe a descrição da despesa.' };
  if (!CATEGORIAS_DESPESAS.includes(categoria)) categoria = 'Operacional';
  const l = _despLer(); const d = l.find(x => x.id === id);
  if (!d) return { sucesso: false, mensagem: 'Despesa não encontrada.' };
  d.descricao = descricao; d.categoria = categoria; d.valor_previsto = num(valor); d.atualizado_em = _agoraStr();
  _despGravar(l); return { sucesso: true, mensagem: 'Despesa atualizada.' };
}
function removerDespesa(id){
  if (SOMENTE_LEITURA) return _bloqueado();
  const l = _despLer(); const i = l.findIndex(x => x.id === id);
  if (i < 0) return { sucesso: false, mensagem: 'Despesa não encontrada.' };
  l.splice(i, 1); _despGravar(l); return { sucesso: true, mensagem: 'Despesa removida.' };
}
function alternarQuitacao(id, semana, marcado){
  if (SOMENTE_LEITURA) return _bloqueado();
  const s = parseInt(semana, 10);
  if (!(s >= 1 && s <= 5)) return { sucesso: false, mensagem: 'Semana fora do intervalo (1 a 5).' };
  const l = _despLer(); const d = l.find(x => x.id === id);
  if (!d) return { sucesso: false, mensagem: 'Despesa não encontrada.' };
  if (marcado) d.quitacao[String(s)] = true; else delete d.quitacao[String(s)];
  d.atualizado_em = _agoraStr(); _despGravar(l);
  return { sucesso: true, quitacao: d.quitacao, quitada: _quitada(d) };
}

/* ============================================================================
   ENGINE — _resumo_mes_bi
   ============================================================================ */
async function resumoMes(ano, mesNome, conselhoF, congF){
  const dados = await carregarMovimento(ano, mesNome);
  if (!dados || !dados.abas) return null;
  const conselhosAlvo = new Set((Array.isArray(conselhoF) ? conselhoF : [conselhoF]).filter(c => c && !['Todos','Todas','Todos os Conselhos','Selecione...'].includes(String(c).trim())).map(cf));
  const congsAlvo = new Set((Array.isArray(congF) ? congF : [congF]).filter(c => c && !['Todas','Todos','Todas as Congregações','Selecione...'].includes(String(c).trim())).map(cf));
  const temEscopo = conselhosAlvo.size > 0 || congsAlvo.size > 0;

  const semanas = [], porCongregacao = {}, porConselho = {};
  let totEnt = 0, totDiz = 0, totOf = 0, totDesp = 0, saldoCampo = 0, saldoAnt = 0;

  for (let n = 1; n <= 5; n++){
    let aba = null;
    for (const [k, v] of Object.entries(dados.abas)){
      const nm = String(k).trim().toUpperCase();
      if (nm.startsWith(`${n}º`) || nm.startsWith(`${n}ª`)){ aba = v; break; }
    }
    const tot = (aba || {}).totais || {}, regs = (aba || {}).registros || [];
    let regsProcessar = regs, ent, diz, ofe, desp;
    if (temEscopo && regs.length){
      const filtrados = [];
      for (const r of regs){
        const nomeC = String(r.congregacao || 'Não informada').trim() || 'Não informada';
        const cons = String(r.conselho || '').trim() || await identificarConselho(nomeC, r.numero);
        if (conselhosAlvo.size && !conselhosAlvo.has(cf(cons))) continue;
        if (congsAlvo.size && !congsAlvo.has(cf(nomeC))) continue;
        filtrados.push(r);
      }
      ent = filtrados.reduce((a, r) => a + num(r.total_entradas), 0);
      diz = filtrados.reduce((a, r) => a + num(r.dizimos), 0);
      ofe = filtrados.reduce((a, r) => a + num(r.ofertas), 0);
      desp = filtrados.reduce((a, r) => a + num(r.total_despesas), 0);
      regsProcessar = filtrados;
    } else {
      ent = num(tot.total_entradas); diz = num(tot.dizimos); ofe = num(tot.ofertas); desp = num(tot.total_despesas);
      if (!Object.keys(tot).length && regs.length){
        ent = regs.reduce((a, r) => a + num(r.total_entradas), 0);
        diz = regs.reduce((a, r) => a + num(r.dizimos), 0);
        ofe = regs.reduce((a, r) => a + num(r.ofertas), 0);
        desp = regs.reduce((a, r) => a + num(r.total_despesas), 0);
      }
    }
    if (num(tot.saldo_campo)) saldoCampo = num(tot.saldo_campo);
    if (num(tot.saldo_mes_anterior)) saldoAnt = num(tot.saldo_mes_anterior);
    const temDados = regsProcessar.some(r => Math.abs(num(r.total_entradas)) > EPS || Math.abs(num(r.total_despesas)) > EPS) || Math.abs(ent) > EPS || Math.abs(desp) > EPS;
    semanas.push({ semana: SEMANAS_CANONICAS[n-1], entradas: ent, dizimos: diz, ofertas: ofe, despesas: desp, saldo: ent - desp, saldo_mes_anterior: num(tot.saldo_mes_anterior), saldo_campo: num(tot.saldo_campo), tem_dados: temDados });
    for (const r of regsProcessar){
      const nomeC = String(r.congregacao || 'Não informada').trim() || 'Não informada';
      const cons = String(r.conselho || '').trim() || await identificarConselho(nomeC, r.numero);
      for (const [mapa, chave] of [[porCongregacao, nomeC], [porConselho, cons || 'Não informado']]){
        const acc = mapa[chave] = mapa[chave] || { entradas: 0, dizimos: 0, ofertas: 0, despesas: 0 };
        acc.entradas += num(r.total_entradas); acc.dizimos += num(r.dizimos); acc.ofertas += num(r.ofertas); acc.despesas += num(r.total_despesas);
      }
    }
    totEnt += ent; totDiz += diz; totOf += ofe; totDesp += desp;
  }
  if (!temEscopo){
    const totFech = (dados.abas['FECHAMENTO DO MÊS'] || {}).totais || {};
    if (Object.keys(totFech).length){
      totEnt = num(totFech.total_entradas) || totEnt; totDiz = num(totFech.dizimos) || totDiz;
      totOf = num(totFech.ofertas) || totOf; totDesp = num(totFech.total_despesas) || totDesp;
      if (num(totFech.saldo_campo)) saldoCampo = num(totFech.saldo_campo);
      if (num(totFech.saldo_mes_anterior)) saldoAnt = num(totFech.saldo_mes_anterior);
    }
  }
  const semanasComDados = semanas.filter(s => s.tem_dados).length;
  let saldoInicialMes = (semanas.find(s => s.tem_dados && Math.abs(s.saldo_mes_anterior) > EPS) || {}).saldo_mes_anterior || 0;
  if (Math.abs(saldoCampo) > EPS){
    const resultado = totEnt - totDesp;
    if (Math.abs(saldoInicialMes + resultado - saldoCampo) > 0.5) saldoInicialMes = saldoCampo - resultado;
  }
  return {
    ano: String(ano), mes: mesNome, entradas: totEnt, dizimos: totDiz, ofertas: totOf,
    despesas: totDesp, saldo_liquido: totEnt - totDesp, saldo_campo: saldoCampo,
    saldo_mes_anterior: saldoAnt, saldo_inicial_mes: saldoInicialMes,
    semanas, semanas_com_dados: semanasComDados,
    media_semanal_entradas: semanasComDados ? totEnt / semanasComDados : 0,
    media_semanal_despesas: semanasComDados ? totDesp / semanasComDados : 0,
    por_congregacao: porCongregacao, por_conselho: porConselho, tem_dados: semanasComDados > 0,
  };
}

/* ============================================================================
   ENGINE — consultar_cruzamento_dados
   ============================================================================ */
async function consultarCruzamento(anoIni, mesIni, anoFim, mesFim, { conselho = 'Todos', congregacao = 'Todas', contas = null, semanas = null } = {}){
  const periodos = gerarListaPeriodos(anoIni, mesIni, anoFim, mesFim);
  const semanasAlvo = normalizarFiltroSemanas(semanas);
  const filtroSemanas = semanasAlvo[0] !== 'FECHAMENTO DO MÊS';
  const contasAlvo = (contas || []).map(c => String(c).trim()).filter(c => c && !c.startsWith('['));
  const temContas = contasAlvo.length > 0;
  const listaCons = Array.isArray(conselho) ? conselho : [conselho];
  const conselhosAlvo = new Set(listaCons.map(c => String(c).trim()).filter(c => !['', 'Todos', 'Todas', 'Selecione...'].includes(c)).map(cf));
  const filtraCong = !['Todas', 'Todos', 'Selecione...', ''].includes(congregacao);

  const series = [], linhas = [];
  const totais = { entradas: 0, dizimos: 0, ofertas: 0, despesas: 0, saldo_liquido: 0, conta_selecionada_total: 0,
    contas_detalhe: {}, contas_detalhe_entradas: {}, contas_detalhe_despesas: {}, por_conselho: {}, por_congregacao: {},
    contas_individuais: Object.fromEntries(contasAlvo.map(c => [c, 0])) };
  const visaoSemanal = periodos.length === 1;
  const dadosMeses = await Promise.all(periodos.map(([a, m]) => carregarMovimento(a, m)));

  for (let pi = 0; pi < periodos.length; pi++){
    const [ano, mes] = periodos[pi], dadosMes = dadosMeses[pi];
    if (!dadosMes || !dadosMes.abas) continue;
    const abas = dadosMes.abas;
    const matchAba = semChave => {
      for (const [k, v] of Object.entries(abas))
        if (k.toUpperCase().includes(semChave.toUpperCase()) || k.toUpperCase().includes(semChave.replace('º.', 'ª').toUpperCase())) return v;
      return null;
    };

    const processarReg = async (reg, acc) => {
      const cCons = reg.conselho || await identificarConselho(reg.congregacao, reg.numero);
      const cNome = reg.congregacao;
      if (conselhosAlvo.size && !conselhosAlvo.has(cf(cCons))) return null;
      if (filtraCong && cf(congregacao) !== cf(cNome)) return null;
      const entR = num(reg.total_entradas), dizR = num(reg.dizimos), ofR = num(reg.ofertas), despR = num(reg.total_despesas);
      const detE = reg.detalhes_entradas || {}, detS1 = reg.detalhes_saidas_repasses || {}, detS2 = reg.detalhes_despesas_operacionais || {};
      const todas = { ...detE, ...detS1, ...detS2 };
      let valConta = 0; const indiv = {};
      if (temContas) for (const cAlvo of contasAlvo){
        const v = valorContaAnalitica(cAlvo, todas, dizR, ofR);
        valConta += v; indiv[cAlvo] = v;
        acc.indiv[cAlvo] = (acc.indiv[cAlvo] || 0) + v;
        totais.contas_individuais[cAlvo] = (totais.contas_individuais[cAlvo] || 0) + v;
      }
      for (const [k, v] of Object.entries(detE)){ totais.contas_detalhe_entradas[k] = (totais.contas_detalhe_entradas[k] || 0) + num(v); totais.contas_detalhe[k] = (totais.contas_detalhe[k] || 0) + num(v); }
      for (const [k, v] of Object.entries({ ...detS1, ...detS2 })){ totais.contas_detalhe_despesas[k] = (totais.contas_detalhe_despesas[k] || 0) + num(v); totais.contas_detalhe[k] = (totais.contas_detalhe[k] || 0) + num(v); }
      for (const [k, v] of Object.entries(todas)) acc.contas[k] = (acc.contas[k] || 0) + num(v);
      const valCons = temContas ? valConta : entR;
      totais.por_conselho[cCons] = (totais.por_conselho[cCons] || 0) + valCons;
      totais.por_congregacao[cNome] = (totais.por_congregacao[cNome] || 0) + valCons;
      return { cCons, cNome, entR, dizR, ofR, despR, valConta, todas, indiv };
    };

    if (visaoSemanal){
      const iterar = filtroSemanas ? semanasAlvo : ['1º. SEMANA','2º. SEMANA','3º. SEMANA','4º. SEMANA','5º. SEMANA'];
      for (const semChave of iterar){
        const abaC = matchAba(semChave); if (!abaC) continue;
        const acc = { ent: 0, diz: 0, of: 0, desp: 0, conta: 0, contas: {}, indiv: Object.fromEntries(contasAlvo.map(c => [c, 0])) };
        const rotulo = semChave.replace('º.', 'ª');
        for (const reg of (abaC.registros || [])){
          const r = await processarReg(reg, acc); if (!r) continue;
          acc.ent += r.entR; acc.diz += r.dizR; acc.of += r.ofR; acc.desp += r.despR; acc.conta += r.valConta;
          linhas.push({ ano: String(ano), mes, semana: rotulo, periodo: `${mes.slice(0,3)} • ${rotulo}`, conselho: r.cCons, congregacao: r.cNome,
            dizimos: r.dizR, ofertas: r.ofR, entradas: r.entR, despesas: r.despR, saldo: r.entR - r.despR,
            valor_conta_especifica: r.valConta, contas_individuais: r.indiv, detalhes: r.todas });
        }
        totais.entradas += acc.ent; totais.dizimos += acc.diz; totais.ofertas += acc.of; totais.despesas += acc.desp;
        totais.saldo_liquido += acc.ent - acc.desp; totais.conta_selecionada_total += acc.conta;
        series.push({ ano: String(ano), mes, semana: rotulo, periodo: rotulo, entradas: acc.ent, dizimos: acc.diz, ofertas: acc.of,
          despesas: acc.desp, saldo: acc.ent - acc.desp, valor_conta_especifica: acc.conta, contas: acc.contas, contas_individuais: acc.indiv, parcial: false });
      }
    } else {
      let aProcessar = [];
      if (filtroSemanas){
        for (const sc of semanasAlvo){ const a = matchAba(sc); if (a) aProcessar.push([sc, a]); }
      } else {
        const fech = Object.entries(abas).find(([k]) => k.toUpperCase().includes('FECHAMENTO'));
        aProcessar = fech ? [fech] : Object.entries(abas);
      }
      const acc = { ent: 0, diz: 0, of: 0, desp: 0, conta: 0, contas: {}, indiv: Object.fromEntries(contasAlvo.map(c => [c, 0])) };
      const mapaCongs = {};
      for (const [, abaC] of aProcessar){
        for (const reg of (abaC.registros || [])){
          const r = await processarReg(reg, acc); if (!r) continue;
          acc.ent += r.entR; acc.diz += r.dizR; acc.of += r.ofR; acc.desp += r.despR; acc.conta += r.valConta;
          const cg = mapaCongs[r.cNome] = mapaCongs[r.cNome] || { ano: String(ano), mes,
            semana: filtroSemanas ? semanasAlvo.join('+').replace(/º\./g, 'ª') : 'Consolidado',
            periodo: `${mes.slice(0,3)}/${String(ano).slice(2)}`, conselho: r.cCons, congregacao: r.cNome,
            dizimos: 0, ofertas: 0, entradas: 0, despesas: 0, saldo: 0, valor_conta_especifica: 0, contas_individuais: {}, detalhes: {} };
          cg.dizimos += r.dizR; cg.ofertas += r.ofR; cg.entradas += r.entR; cg.despesas += r.despR;
          cg.saldo += r.entR - r.despR; cg.valor_conta_especifica += r.valConta;
          for (const [k, v] of Object.entries(r.todas)) cg.detalhes[k] = (cg.detalhes[k] || 0) + num(v);
          for (const [k, v] of Object.entries(r.indiv)) cg.contas_individuais[k] = (cg.contas_individuais[k] || 0) + v;
        }
      }
      linhas.push(...Object.values(mapaCongs));
      totais.entradas += acc.ent; totais.dizimos += acc.diz; totais.ofertas += acc.of; totais.despesas += acc.desp;
      totais.saldo_liquido += acc.ent - acc.desp; totais.conta_selecionada_total += acc.conta;

      let rotulo = `${mes.slice(0,3)}/${String(ano).slice(2)}`;
      if (filtroSemanas && semanasAlvo.length === 1) rotulo += ` (${semanasAlvo[0].slice(0,2)}ª)`;
      const hoje = new Date(); let parcial = false;
      if (+ano === hoje.getFullYear() && indiceMes(mes) === hoje.getMonth() + 1){
        const ciclo = obterCiclo(ano, mes);
        let movidas = 0;
        for (const [k, v] of Object.entries(abas)){
          if (!String(k).toUpperCase().includes('SEMANA')) continue;
          const regs = v.registros || [], tot = v.totais || {};
          if (regs.some(r => Math.abs(num(r.total_entradas)) > EPS || Math.abs(num(r.total_despesas)) > EPS)
              || Math.abs(num(tot.total_entradas)) > EPS || Math.abs(num(tot.total_despesas)) > EPS) movidas++;
        }
        parcial = movidas < ciclo.total_semanas;
      }
      series.push({ ano: String(ano), mes, semana: filtroSemanas ? semanasAlvo.join('+').replace(/º\./g, 'ª') : 'Consolidado',
        periodo: rotulo, entradas: acc.ent, dizimos: acc.diz, ofertas: acc.of, despesas: acc.desp, saldo: acc.ent - acc.desp,
        valor_conta_especifica: acc.conta, contas: acc.contas, contas_individuais: acc.indiv, parcial });
    }
  }

  const validos = series.filter(s => (Math.abs(s.entradas) > EPS || Math.abs(s.despesas) > EPS) && !s.parcial);
  const n = Math.max(validos.length, 1);
  const mEnt = validos.reduce((a, s) => a + s.entradas, 0), mDesp = validos.reduce((a, s) => a + s.despesas, 0);
  totais.pontos_total = series.length; totais.pontos_com_dados = validos.length;
  totais.media_entradas = mEnt / n; totais.media_despesas = mDesp / n; totais.media_saldo = (mEnt - mDesp) / n;
  totais.margem_operacional_pct = totais.entradas > 0 ? (totais.entradas - totais.despesas) / totais.entradas * 100 : 0;
  totais.pct_dizimos = totais.entradas > 0 ? totais.dizimos / totais.entradas * 100 : 0;
  totais.pct_ofertas = totais.entradas > 0 ? totais.ofertas / totais.entradas * 100 : 0;
  totais.missoes = Object.entries(totais.contas_detalhe_entradas).reduce((a, [k, v]) => a + (CONTAS_MISSOES.has(cf(k)) ? num(v) : 0), 0);

  return { periodos: series.map(s => s.periodo), series, linhas, totais,
    contas_selecionadas: temContas ? contasAlvo : [], semanas_selecionadas: semanasAlvo, filtro_semanas_ativo: filtroSemanas };
}

/* média de referência (paridade com obter_gestao_unificada_web) */
async function mediaReferencia(filtros, dados){
  try {
    const agora = new Date();
    const semanasAlvo = normalizarFiltroSemanas(filtros.semanas);
    const ativo = semanasAlvo[0] !== 'FECHAMENTO DO MÊS' && semanasAlvo.length < 5;
    const idxAtual = agora.getFullYear() * 12 + agora.getMonth();
    const idxFim = ativo ? idxAtual : idxAtual - 1;
    let idxIni, janela;
    if (agora.getFullYear() >= 2027){ idxIni = idxFim - 11; janela = 'ultimos_12_meses'; }
    else { idxIni = agora.getFullYear() * 12; janela = 'ano_vigente'; }
    if (idxFim - idxIni < 1){ idxIni = idxFim - 11; janela = 'ultimos_12_meses'; }
    let rotulo = janela === 'ultimos_12_meses' ? 'Média últimos 12 meses' : 'Média do ano';
    if (ativo && semanasAlvo.length === 1) rotulo += ` (${semanasAlvo[0][0]}ª semana)`;
    const ref = await consultarCruzamento(
      Math.floor(idxIni / 12), ORDEM_MESES[idxIni % 12], Math.floor(idxFim / 12), ORDEM_MESES[idxFim % 12],
      { conselho: filtros.conselho, congregacao: filtros.congregacao, contas: filtros.contas, semanas: ativo ? filtros.semanas : null });
    const chave = (filtros.contas || []).length ? 'valor_conta_especifica' : 'entradas';
    const vals = (ref.series || []).filter(s => Math.abs(num(s.entradas)) > EPS || Math.abs(num(s.despesas)) > EPS).map(s => num(s[chave]));
    const mediaMensal = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const pontos = (dados.series || []).length;
    const mesesSel = gerarListaPeriodos(filtros.ano_ini, filtros.mes_ini, filtros.ano_fim, filtros.mes_fim).length;
    return { valor: pontos > 0 ? mediaMensal * mesesSel / pontos : mediaMensal, valor_mensal: mediaMensal, rotulo, janela };
  } catch(e){ return null; }
}

/* ============================================================================
   ENGINE — analisar_mes_detalhado
   ============================================================================ */
const _mediaCampos = rs => Object.fromEntries(['entradas','dizimos','ofertas','despesas','saldo_liquido'].map(c => [c, rs.length ? rs.reduce((a, r) => a + r[c], 0) / rs.length : 0]));

async function analisarMes(ano, mes){
  const anoI = parseInt(ano, 10);
  if (!Number.isFinite(anoI)) return { sucesso: false, mensagem: 'Ano inválido para análise mensal.' };
  const mesIdx = indiceMes(String(mes || '').trim() || 'Janeiro'), mesNome = ORDEM_MESES[mesIdx - 1];
  const [consF, congF] = filtrosEscopo();

  const resumos = {};
  await Promise.all(ORDEM_MESES.map(async (m, i) => { const r = await resumoMes(anoI, m, consF, congF); if (r) resumos[i + 1] = r; }));
  const atual = resumos[mesIdx];
  if (!atual || !atual.tem_dados) return { sucesso: false, mensagem: `Nenhum movimento financeiro importado para ${mesNome}/${anoI}.` };

  let anterior, rotuloAnt;
  if (mesIdx > 1){ anterior = resumos[mesIdx - 1]; rotuloAnt = `${ORDEM_MESES[mesIdx - 2]}/${anoI}`; }
  else { anterior = await resumoMes(anoI - 1, 'Dezembro', consF, congF); rotuloAnt = `Dezembro/${anoI - 1}`; }
  const mesmoMesLY = await resumoMes(anoI - 1, mesNome, consF, congF);

  const mesesAte = Object.entries(resumos).filter(([i, r]) => +i <= mesIdx && r.tem_dados).map(([, r]) => r);
  const mesesHist = Object.entries(resumos).filter(([i, r]) => +i < mesIdx && r.tem_dados).map(([, r]) => r);
  const mediaMensalAno = _mediaCampos(mesesAte), mediaMensalAnt = _mediaCampos(mesesHist);
  const semAno = mesesAte.reduce((a, r) => a + r.semanas_com_dados, 0);
  const mediaSemAnoEnt = semAno ? mesesAte.reduce((a, r) => a + r.entradas, 0) / semAno : 0;
  const mediaSemAnoDesp = semAno ? mesesAte.reduce((a, r) => a + r.despesas, 0) / semAno : 0;

  const ciclo = obterCiclo(anoI, mesNome);
  const semanasTotal = ciclo.total_semanas;
  const semanasCicloDados = atual.semanas.slice(0, semanasTotal).filter(s => s.tem_dados).length;
  atual.semanas.forEach((s, i) => { s.fora_ciclo = i + 1 > semanasTotal; });
  const faltantes = Math.max(0, semanasTotal - semanasCicloDados);

  const semanasAtualDados = semanasCicloDados > 0 ? atual.semanas.slice(0, semanasCicloDados) : [];
  const entAtualP = semanasAtualDados.reduce((a, s) => a + s.entradas, 0);
  const despAtualP = semanasAtualDados.reduce((a, s) => a + s.despesas, 0);
  const dizAtualP = semanasAtualDados.reduce((a, s) => a + s.dizimos, 0);
  const ofAtualP = semanasAtualDados.reduce((a, s) => a + s.ofertas, 0);
  let entAntP = 0, despAntP = 0, dizAntP = 0, ofAntP = 0;
  let vEquivEnt = null, vEquivDesp = null, vEquivDiz = null, vEquivOf = null, vEquivRes = null;
  if (anterior && semanasCicloDados > 0){
    const sAnt = anterior.semanas.slice(0, semanasCicloDados);
    entAntP = sAnt.reduce((a, s) => a + s.entradas, 0); despAntP = sAnt.reduce((a, s) => a + s.despesas, 0);
    dizAntP = sAnt.reduce((a, s) => a + s.dizimos, 0); ofAntP = sAnt.reduce((a, s) => a + s.ofertas, 0);
    vEquivEnt = variacaoPct(entAtualP, entAntP); vEquivDesp = variacaoPct(despAtualP, despAntP);
    vEquivDiz = variacaoPct(dizAtualP, dizAntP); vEquivOf = variacaoPct(ofAtualP, ofAntP);
    vEquivRes = variacaoPct(entAtualP - despAtualP, entAntP - despAntP);
  }

  const razoes = mesesHist.filter(r => r.entradas > EPS).map(r => r.despesas / r.entradas);
  const razaoDespEnt = razoes.length ? mediaArr(razoes) : 1;
  const entradasProj = entAtualP + atual.media_semanal_entradas * faltantes;
  const caixaDisp = atual.saldo_inicial_mes + entradasProj;
  const despesasProj = Math.max(despAtualP, Math.min(entradasProj * razaoDespEnt, caixaDisp));

  const projecao = {
    mes_em_andamento: faltantes > 0, semanas_restantes: faltantes,
    fechamento_entradas: +entradasProj.toFixed(2), fechamento_despesas: +despesasProj.toFixed(2),
    base_semanal_usada: 'ritmo semanal do mês', razao_desp_ent: +razaoDespEnt.toFixed(4),
  };
  projecao.fechamento_saldo = +(projecao.fechamento_entradas - projecao.fechamento_despesas).toFixed(2);

  const equiv = { rotulo: rotuloAnt, semanas_equivalentes: semanasCicloDados,
    entradas_parcial_atual: +entAtualP.toFixed(2), despesas_parcial_atual: +despAtualP.toFixed(2),
    dizimos_parcial_atual: +dizAtualP.toFixed(2), ofertas_parcial_atual: +ofAtualP.toFixed(2),
    entradas_parcial_anterior: +(anterior && semanasCicloDados > 0 ? entAntP : 0).toFixed(2),
    despesas_parcial_anterior: +(anterior && semanasCicloDados > 0 ? despAntP : 0).toFixed(2),
    dizimos_parcial_anterior: +dizAntP.toFixed(2), ofertas_parcial_anterior: +ofAntP.toFixed(2),
    resultado_parcial_anterior: +(anterior && semanasCicloDados > 0 ? entAntP - despAntP : 0).toFixed(2),
    var_entradas_equiv: vEquivEnt, var_despesas_equiv: vEquivDesp, var_dizimos_equiv: vEquivDiz,
    var_ofertas_equiv: vEquivOf, var_resultado_equiv: vEquivRes };

  const taxas = mesesHist.filter(r => r.semanas_com_dados).map(r => r.entradas / r.semanas_com_dados);
  const nHist = taxas.length;
  const movel3 = mesesHist.length ? mediaArr(mesesHist.slice(-3).map(r => r.entradas)) : 0;
  const [pNome, pAno] = mesIdx < 12 ? [ORDEM_MESES[mesIdx], anoI] : ['Janeiro', anoI + 1];
  const semanasProx = obterCiclo(pAno, pNome).total_semanas;
  let taxaProx;
  if (nHist >= 3){ const xs = taxas.map((_, i) => i); const [a, b] = polyfit1(xs, taxas); taxaProx = Math.max(0, a * nHist + b); }
  else if (nHist) taxaProx = mediaArr(taxas);
  else taxaProx = num(atual.media_semanal_entradas);
  const projEntProx = taxaProx * semanasProx, projDespProx = projEntProx * razaoDespEnt;
  Object.assign(projecao, {
    proximo_mes_entradas: +projEntProx.toFixed(2), proximo_mes_despesas: +projDespProx.toFixed(2),
    proximo_mes_saldo: +(projEntProx - projDespProx).toFixed(2), proximo_mes_rotulo: `${pNome}/${pAno}`,
    semanas_proximo_mes: semanasProx, taxa_semanal_projetada: +taxaProx.toFixed(2),
    media_movel_3m_entradas: +movel3.toFixed(2),
    confianca: nHist >= 6 ? 'alta' : nHist >= 3 ? 'moderada' : 'baixa', meses_historico: nHist,
  });

  const comparativos = {
    mes_anterior: { rotulo: rotuloAnt, dados: anterior,
      var_entradas: anterior ? variacaoPct(atual.entradas, anterior.entradas) : null,
      var_dizimos: anterior ? variacaoPct(atual.dizimos, anterior.dizimos) : null,
      var_ofertas: anterior ? variacaoPct(atual.ofertas, anterior.ofertas) : null,
      var_despesas: anterior ? variacaoPct(atual.despesas, anterior.despesas) : null,
      var_saldo: anterior ? variacaoPct(atual.saldo_liquido, anterior.saldo_liquido) : null },
    media_anual: { media_mensal: mediaMensalAno, media_mensal_anteriores: mediaMensalAnt,
      media_semanal_entradas: mediaSemAnoEnt, media_semanal_despesas: mediaSemAnoDesp, semanas_contabilizadas: semAno,
      var_entradas: variacaoPct(atual.entradas, mediaMensalAno.entradas),
      var_despesas: variacaoPct(atual.despesas, mediaMensalAno.despesas),
      var_entradas_anteriores: variacaoPct(atual.entradas, mediaMensalAnt.entradas),
      var_semanal_entradas: variacaoPct(atual.media_semanal_entradas, mediaSemAnoEnt) },
    mesmo_mes_ano_anterior: { rotulo: `${mesNome}/${anoI - 1}`, dados: mesmoMesLY,
      var_entradas: mesmoMesLY ? variacaoPct(atual.entradas, mesmoMesLY.entradas) : null,
      var_despesas: mesmoMesLY ? variacaoPct(atual.despesas, mesmoMesLY.despesas) : null },
    mes_anterior_equiv: equiv,
  };

  const insights = []; const ins = (tipo, texto) => insights.push({ tipo, texto });
  let vEnt, rotCmpEnt, vDesp, rotCmpDesp;
  if (projecao.mes_em_andamento && equiv.var_entradas_equiv !== null){ vEnt = equiv.var_entradas_equiv; rotCmpEnt = `${equiv.semanas_equivalentes} primeiras semanas de ${rotuloAnt}`; }
  else { vEnt = comparativos.mes_anterior.var_entradas; rotCmpEnt = rotuloAnt; }
  if (vEnt !== null){
    if (vEnt > 3) ins('positivo', `Entradas ${vEnt >= 0 ? '+' : ''}${vEnt.toFixed(1)}% acima de ${rotCmpEnt}.`);
    else if (vEnt < -3) ins('atencao', `Entradas ${vEnt.toFixed(1)}% abaixo de ${rotCmpEnt}.`);
    else ins('neutro', `Entradas estáveis em relação a ${rotCmpEnt} (${vEnt >= 0 ? '+' : ''}${vEnt.toFixed(1)}%).`);
  }
  if (projecao.mes_em_andamento && equiv.var_despesas_equiv !== null){ vDesp = equiv.var_despesas_equiv; rotCmpDesp = `${equiv.semanas_equivalentes} primeiras semanas de ${rotuloAnt}`; }
  else { vDesp = comparativos.mes_anterior.var_despesas; rotCmpDesp = rotuloAnt; }
  if (vDesp !== null){
    if (vDesp > 8) ins('atencao', `Despesas +${vDesp.toFixed(1)}% acima de ${rotCmpDesp} — verifique saídas extraordinárias.`);
    else if (vDesp < -8) ins('positivo', `Despesas ${vDesp.toFixed(1)}% abaixo de ${rotCmpDesp}.`);
  }
  const vAno = comparativos.media_anual.var_entradas;
  if (vAno !== null){
    if (vAno >= 5) ins('positivo', `Mês +${vAno.toFixed(1)}% acima da média mensal de ${anoI}.`);
    else if (vAno <= -5) ins('atencao', `Mês ${vAno.toFixed(1)}% abaixo da média mensal de ${anoI}.`);
  }
  const vYoy = comparativos.mesmo_mes_ano_anterior.var_entradas;
  if (vYoy !== null) ins(vYoy >= 0 ? 'positivo' : 'atencao', `Comparado a ${mesNome}/${anoI - 1}, as entradas variaram ${vYoy >= 0 ? '+' : ''}${vYoy.toFixed(1)}%.`);
  if (atual.saldo_liquido < 0) ins('negativo', `Resultado do mês negativo: ${moeda(atual.saldo_liquido)} — despesas superaram entradas.`);
  else if (atual.despesas > 0 && atual.entradas > 0 && atual.saldo_liquido / atual.entradas < 0.05) ins('atencao', 'Margem de saldo líquido abaixo de 5% das entradas — folga financeira apertada.');
  const semanasOk = atual.semanas.filter(s => s.tem_dados);
  if (semanasOk.length){
    const melhor = semanasOk.reduce((a, b) => b.entradas > a.entradas ? b : a);
    const pior = semanasOk.reduce((a, b) => b.entradas < a.entradas ? b : a);
    ins('neutro', `Melhor semana: ${tituloSemana(melhor.semana)} (${moeda(melhor.entradas)}). Menor: ${tituloSemana(pior.semana)} (${moeda(pior.entradas)}).`);
  }
  if (atual.entradas > 0) ins('neutro', `Dízimos representam ${(atual.dizimos / atual.entradas * 100).toFixed(1)}% das entradas; ofertas ${(atual.ofertas / atual.entradas * 100).toFixed(1)}%.`);
  if (Object.keys(atual.por_congregacao).length){
    const [nomeD, dD] = Object.entries(atual.por_congregacao).reduce((a, b) => b[1].entradas > a[1].entradas ? b : a);
    ins('neutro', `Congregação destaque em entradas: ${nomeD} (${moeda(dD.entradas)}).`);
  }
  if (projecao.mes_em_andamento) ins('info', `Mês em andamento (${semanasCicloDados}/${semanasTotal} fechamentos): projeção de fechamento em ${moeda(projecao.fechamento_entradas)} de entradas e ${moeda(projecao.fechamento_saldo)} de saldo líquido.`);
  const semanasFora = atual.semanas.filter(s => s.fora_ciclo && s.tem_dados);
  if (semanasFora.length) ins('atencao', `Há movimento lançado em semana fora do ciclo configurado (${semanasTotal} fechamentos): ${semanasFora.map(s => s.semana).join(', ')}.`);
  ins('info', `Projeção para o próximo mês: ${moeda(projecao.proximo_mes_entradas)} de entradas (confiança ${projecao.confianca}, base ${nHist} meses).`);

  return { sucesso: true, periodo: { ano: String(anoI), mes: mesNome, mes_indice: mesIdx },
    atual, comparativos, projecao, ciclo, insights,
    serie_anual: Object.entries(resumos).sort((a, b) => +a[0] - +b[0]).map(([i, r]) => ({ mes: ORDEM_MESES[+i - 1], mes_indice: +i, entradas: r.entradas, despesas: r.despesas, saldo: r.saldo_liquido, semanas_com_dados: r.semanas_com_dados })) };
}

/* ============================================================================
   ENGINE — calcular_fluxo_caixa
   ============================================================================ */
function semanaCorrente(resumo, totalSemanas){
  if (!resumo) return 1;
  for (let i = 0; i < Math.min(totalSemanas, resumo.semanas.length); i++) if (!resumo.semanas[i].tem_dados) return i + 1;
  return totalSemanas;
}
function saldoSemanaAnterior(resumo, semanaAtual){
  if (!resumo) return 0;
  if (semanaAtual <= 1) return num(resumo.saldo_mes_anterior);
  const ant = resumo.semanas[semanaAtual - 2] || {};
  const acum = num(ant.saldo_campo);
  if (Math.abs(acum) < EPS && !ant.tem_dados) return 0;
  return Math.abs(acum) > EPS ? acum : num(ant.saldo);
}
async function mediaSemanalAno(anoI, mesIdx){
  let ent = 0, sem = 0;
  for (let i = 1; i <= mesIdx; i++){
    const r = await resumoMes(anoI, ORDEM_MESES[i - 1], null, null);
    if (r && r.tem_dados){ ent += r.entradas; sem += r.semanas_com_dados; }
  }
  return sem ? ent / sem : 0;
}
async function mediaSemanaPosicao(anoI, mesIdx, semanaAtual){
  const vals = [];
  for (let m = 1; m < mesIdx; m++){
    const r = await resumoMes(anoI, ORDEM_MESES[m - 1], null, null);
    const sems = (r || {}).semanas || [];
    if (semanaAtual <= sems.length && sems[semanaAtual - 1].tem_dados) vals.push(num(sems[semanaAtual - 1].entradas));
  }
  return vals.length ? [mediaArr(vals), vals.length] : [0, 0];
}
async function calcularFluxo(ano, mes){
  const anoI = parseInt(ano, 10);
  if (!Number.isFinite(anoI)) return { sucesso: false, mensagem: 'Ano inválido.' };
  const mesIdx = indiceMes(String(mes || '').trim() || 'Janeiro'), mesNome = ORDEM_MESES[mesIdx - 1];
  const [consF, congF] = filtrosEscopo();
  const ciclo = obterCiclo(anoI, mesNome);
  const totalSemanas = ciclo.total_semanas;
  const resumo = await resumoMes(anoI, mesNome, consF, congF);
  const semanaAtual = semanaCorrente(resumo, totalSemanas);
  const saldoAnt = saldoSemanaAnterior(resumo, semanaAtual);
  const deficitAnt = Math.min(0, saldoAnt);
  const brutoNec = deficitAnt < 0 ? +(Math.abs(deficitAnt) / FATOR_RETENCAO_CAIXA).toFixed(2) : 0;

  const semanas = (resumo || {}).semanas || [];
  let receitaRealizada = 0;
  if (resumo && semanaAtual <= semanas.length && semanas[semanaAtual - 1].tem_dados) receitaRealizada = num(semanas[semanaAtual - 1].entradas);
  const mediaSemMes = num((resumo || {}).media_semanal_entradas);
  const [mediaPos, nPos] = await mediaSemanaPosicao(anoI, mesIdx, semanaAtual);
  const mediaSemAno = resumo ? await mediaSemanalAno(anoI, mesIdx) : 0;
  let receitaProj, origem;
  if (mediaPos){ receitaProj = mediaPos; origem = 'posicao'; }
  else if (mediaSemMes){ receitaProj = mediaSemMes; origem = 'mes'; }
  else { receitaProj = mediaSemAno; origem = 'ano'; }
  const rGerentes = receitaRealizada || receitaProj;

  const despesas = listarDespesas(anoI, mesNome).map(d => ({ ...d, quitada: _quitada(d), paga_semana_atual: !!d.quitacao?.[String(semanaAtual)] }));
  const dPago = +despesas.filter(d => d.quitada).reduce((a, d) => a + d.valor_previsto, 0).toFixed(2);
  const dPend = +despesas.filter(d => !d.quitada).reduce((a, d) => a + d.valor_previsto, 0).toFixed(2);
  const sLiquido = +(rGerentes - brutoNec - dPend).toFixed(2);
  const base = dPend + dPago, limiar = LIMIAR_SEMAFORO_AMARELO * Math.max(base, brutoNec);
  const semaforo = sLiquido >= 0 ? 'verde' : (limiar > 0 && Math.abs(sLiquido) <= limiar ? 'amarelo' : 'vermelho');
  const porCat = {};
  for (const d of despesas) if (!d.quitada) porCat[d.categoria] = (porCat[d.categoria] || 0) + d.valor_previsto;
  const catMaior = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  const hoje = new Date();
  const mesFechado = (anoI * 12 + mesIdx) < (hoje.getFullYear() * 12 + hoje.getMonth() + 1) || (resumo && num(resumo.semanas_com_dados) >= totalSemanas);
  let fechamentoReal = {};
  if (mesFechado && resumo){
    const resultado = num(resumo.entradas) - num(resumo.despesas);
    let caixaFinal = num(resumo.saldo_campo);
    if (Math.abs(caixaFinal) < EPS) caixaFinal = num(resumo.saldo_inicial_mes) + resultado;
    fechamentoReal = { entradas_mes: +num(resumo.entradas).toFixed(2), despesas_mes: +num(resumo.despesas).toFixed(2),
      resultado_mes: +resultado.toFixed(2), caixa_final: +caixaFinal.toFixed(2), saldo_inicial: +num(resumo.saldo_inicial_mes).toFixed(2) };
  }
  return { sucesso: true, periodo: { ano: String(anoI), mes: mesNome, mes_indice: mesIdx }, ciclo, semana_atual: semanaAtual,
    mes_fechado: mesFechado, fechamento_real: fechamentoReal,
    saldo_semana_anterior: +saldoAnt.toFixed(2), deficit_anterior: +deficitAnt.toFixed(2), bruto_necessario: brutoNec,
    receita_realizada_semana: +receitaRealizada.toFixed(2), receita_projetada_semana: +receitaProj.toFixed(2),
    receita_origem: receitaRealizada ? 'realizada' : origem, meses_historico_posicao: nPos,
    receita_gerentes: +rGerentes.toFixed(2), despesas, despesas_pendentes: dPend, despesas_quitadas: dPago,
    total_despesas: +(dPend + dPago).toFixed(2),
    pct_despesas_pendentes: (dPend + dPago) ? +(dPend / (dPend + dPago) * 100).toFixed(1) : 0,
    categoria_maior_pendencia: catMaior, saldo_liquido: sLiquido, semaforo };
}

/* ============================================================================
   UI — shell + 5 abas
   ============================================================================ */
const G = {
  aba: 'cruzamento', dados: null, mensal: null, fluxo: null,
  periodos: [], graf: null, grafMS: null, grafME: null,
  modelo: 'bar', dimensao: 'tempo', editando: null, filtrosAberto: true, contasAberto: false, contasEntradasAberto: false, contasSaidasAberto: false,
};
const ABAS = [
  ['cruzamento', 'Cruzamento & BI', 'fa-code-compare', '#f59e0b'],
  ['mensal', 'Análise do Mês', 'fa-calendar-week', '#8b5cf6'],
  ['fluxo', 'Projeção de Despesas', 'fa-money-bill-transfer', '#10b981'],
  ['indicadores', 'Indicadores', 'fa-chart-line', '#38bdf8'],
  ['relatorios', 'Relatórios', 'fa-file-pdf', '#ef4444'],
];
const el = id => document.getElementById(id);
const card = (titulo, valor, cor = '', det = '') => `
  <div class="border rounded-xl p-3" style="background:var(--bg-card);border-color:var(--border-color)">
    <p class="text-[10px] font-bold uppercase opacity-60">${titulo}</p>
    <p class="mt-1 text-base font-black tabular-nums ${cor}">${valor}</p>
    ${det ? `<p class="text-[10px] opacity-50 mt-0.5">${det}</p>` : ''}
  </div>`;
const linhaInd = (nome, valor, max) => {
  const pct = max > 0 ? Math.max(2, Math.min(100, num(valor) / max * 100)) : 2;
  return `<div><div class="flex justify-between gap-3 text-xs mb-1"><span class="truncate">${esc(nome || 'Não informado')}</span><strong>${moeda(valor)}</strong></div>
    <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--bg-surface)"><div class="h-full bg-amber-500 rounded-full" style="width:${pct}%"></div></div></div>`;
};
const seloVar = (v, invertido = false) => {
  if (v === null || v === undefined || isNaN(v)) return '<span class="text-[10px] opacity-50">sem base</span>';
  const bom = invertido ? v <= 0 : v >= 0;
  return `<span class="${bom ? 'text-emerald-500' : 'text-red-500'} text-[10px] font-bold"><i class="fa-solid ${v >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} mr-0.5"></i>${v >= 0 ? '+' : ''}${num(v).toFixed(1)}%</span>`;
};
const selHtml = (id, opts, val, onchange) => `<select id="${id}" ${onchange ? `onchange="${onchange}"` : ''} class="px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;

window.renderGestao = function(){
  el('dash-conteudo').innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center gap-3 pb-3 border-b" style="border-color:var(--border-color)">
        <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background:rgba(245,158,11,.12)"><i class="fa-solid fa-chart-pie text-lg text-amber-500"></i></div>
        <div class="flex-1 min-w-0"><h2 class="font-bold text-sm">Gestão Unificada</h2><p class="text-[10px] opacity-60">BI financeiro, projeções e relatórios — mesmos cálculos do desktop</p></div>
      </div>
      <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style="scrollbar-width:none">
        ${(perfilAdmin() ? [...ABAS, ['usuarios', 'Usuários', 'fa-user-shield', '#f43f5e'], ['dispositivos', 'Dispositivos', 'fa-tower-broadcast', '#38bdf8']] : ABAS).map(([id, nome, ico, cor]) => `<button onclick="gestaoAba('${id}')" id="gnav-${id}" class="gestao-nav shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border cursor-pointer whitespace-nowrap" style="border-color:var(--border-color)"><i class="fa-solid ${ico}" style="color:${cor}"></i>${nome}</button>`).join('')}
      </div>
      <div id="gestao-corpo"><div class="flex items-center justify-center gap-2.5 py-16 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando módulo…</div></div>
    </div>`;
  gestaoAba(G.aba);
};

window.gestaoAba = async function(aba){
  G.aba = aba;
  document.querySelectorAll('.gestao-nav').forEach(b => {
    const ativo = b.id === `gnav-${aba}`;
    b.style.background = ativo ? 'var(--color-primary-light)' : 'var(--bg-card)';
    b.style.borderColor = ativo ? 'var(--color-primary)' : 'var(--border-color)';
  });
  if (aba === 'usuarios') return renderAbaUsuarios();
  if (aba === 'dispositivos') return renderAbaDispositivos();
  if (!G.periodos.length) G.periodos = await listarPeriodos();
  if (aba === 'cruzamento' || aba === 'indicadores' || aba === 'relatorios') renderAbaCruzamento();
  else if (aba === 'mensal') renderAbaMensal();
  else if (aba === 'fluxo') renderAbaFluxo();
};

/* ===================== ABA 1/4/5 — Cruzamento + Indicadores + Relatórios ===================== */
function _filtrosUI(){
  const ord = [...G.periodos].sort((a, b) => (+b.ano) - (+a.ano) || indiceMes(b.mes) - indiceMes(a.mes));
  const ult = ord[0] || { ano: new Date().getFullYear(), mes: ORDEM_MESES[new Date().getMonth()] };
  const anos = [...new Set(G.periodos.map(p => String(p.ano)))].sort().map(a => [a, a]);
  if (!anos.length) anos.push([String(ult.ano), String(ult.ano)]);
  const mesesOpts = ORDEM_MESES.map(m => [m, m]);
  const f = G.filtros || { ano_ini: ult.ano, mes_ini: ult.mes, ano_fim: ult.ano, mes_fim: ult.mes, conselho: 'Todos', congregacao: 'Todas', semanas: [], contas: [] };
  G.filtros = f;
  const nContas = f.contas.length, nSem = f.semanas.length;
  return `
    <div class="border rounded-2xl p-3 space-y-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
      <button onclick="G_filtrosToggle()" class="w-full flex items-center justify-between text-xs font-bold cursor-pointer">
        <span class="flex items-center gap-2"><i class="fa-solid fa-filter text-amber-500"></i>Filtros do cruzamento</span>
        <i class="fa-solid ${G.filtrosAberto ? 'fa-chevron-up' : 'fa-chevron-down'} opacity-60"></i>
      </button>
      <p class="text-[10px] opacity-60">${f.mes_ini}/${f.ano_ini} a ${f.mes_fim}/${f.ano_fim} • ${f.conselho}${f.congregacao !== 'Todas' ? ' • ' + f.congregacao : ''} • ${nContas ? nContas + ' conta(s)' : 'Todas as contas'}${nSem ? ' • ' + nSem + ' semana(s)' : ''}</p>
      <div id="gestao-filtros-corpo" class="${G.filtrosAberto ? '' : 'hidden'} space-y-2.5">
        <div class="grid grid-cols-2 gap-2">
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">De</span><div class="flex gap-1.5">${selHtml('gf-ano-ini', anos, f.ano_ini)}${selHtml('gf-mes-ini', mesesOpts, f.mes_ini)}</div></div>
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Até</span><div class="flex gap-1.5">${selHtml('gf-ano-fim', anos, f.ano_fim)}${selHtml('gf-mes-fim', mesesOpts, f.mes_fim)}</div></div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Conselho</span><select id="gf-conselho" onchange="gestaoMudaConselho()" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todos">Todos</option></select></div>
          <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Congregação</span><select id="gf-congregacao" class="w-full px-2 py-1.5 rounded-lg border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)"><option value="Todas">Todas</option></select></div>
        </div>
        <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Semanas específicas</span>
          <div class="flex flex-wrap gap-1.5">${[1,2,3,4,5].map(n => `<button onclick="gestaoToggleSemana(${n})" class="gsem px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer" data-sem="${n}" style="border-color:var(--border-color)">${n}ª</button>`).join('')}
            <span class="text-[10px] opacity-50 self-center">vazio = fechamento do mês</span></div></div>
        <div>
          <button onclick="G_contasToggle()" class="w-full flex items-center justify-between px-2.5 py-2 rounded-lg border text-[11px] font-bold cursor-pointer" style="border-color:var(--border-color)">
            <span id="gestao-contas-titulo"><i class="fa-solid fa-list-check mr-1.5 text-amber-500"></i>Contas analisadas ${nContas ? `(${nContas} selecionadas)` : '(todas)'}</span>
            <i class="fa-solid ${G.contasAberto ? 'fa-chevron-up' : 'fa-chevron-down'} opacity-60"></i></button>
          <div id="gestao-contas-corpo" class="${G.contasAberto ? '' : 'hidden'} mt-2 border rounded-xl p-2 space-y-1" style="border-color:var(--border-color)">
            <input id="gf-busca-conta" oninput="gestaoBuscaConta()" placeholder="Buscar conta…" class="w-full px-2.5 py-1.5 rounded-lg border text-xs mb-1" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
            <button onclick="G_contasGrupoToggle('entradas', this)" class="w-full flex items-center justify-between text-[10px] font-bold uppercase opacity-60 pt-1 cursor-pointer"><span>Entradas (${CONTAS_ENTRADAS_BI.length})</span><i class="fa-solid ${G.contasEntradasAberto ? 'fa-chevron-up' : 'fa-chevron-down'}"></i></button>
            <div id="gestao-contas-entradas" class="${G.contasEntradasAberto ? '' : 'hidden'} space-y-0.5">
            ${CONTAS_ENTRADAS_BI.map(c => `<label class="gconta flex items-start gap-2 p-1.5 rounded-lg cursor-pointer" data-nome="${esc(cf(c))}"><input type="checkbox" onchange="gestaoContaMudou()" class="gestao-conta-cb mt-0.5 accent-amber-500" value="${esc(c)}" ${f.contas.includes(c) ? 'checked' : ''}><span class="text-[11px] leading-snug">${esc(c)}</span></label>`).join('')}
            </div>
            <button onclick="G_contasGrupoToggle('saidas', this)" class="w-full flex items-center justify-between text-[10px] font-bold uppercase opacity-60 pt-1 cursor-pointer"><span>Saídas (${CONTAS_SAIDAS_BI.length})</span><i class="fa-solid ${G.contasSaidasAberto ? 'fa-chevron-up' : 'fa-chevron-down'}"></i></button>
            <div id="gestao-contas-saidas" class="${G.contasSaidasAberto ? '' : 'hidden'} space-y-0.5">
            ${CONTAS_SAIDAS_BI.map(c => `<label class="gconta flex items-start gap-2 p-1.5 rounded-lg cursor-pointer" data-nome="${esc(cf(c))}"><input type="checkbox" onchange="gestaoContaMudou()" class="gestao-conta-cb mt-0.5 accent-red-500" value="${esc(c)}" ${f.contas.includes(c) ? 'checked' : ''}><span class="text-[11px] leading-snug">${esc(c)}</span></label>`).join('')}
            </div>
          </div>
        </div>
        <button onclick="gestaoCarregar()" class="w-full py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#b45309,#d97706)"><i class="fa-solid fa-bolt mr-1.5"></i>Cruzar dados financeiros</button>
      </div>
    </div>`;
}
function _aplicarFiltrosVisivel(){
  el('gestao-filtros-corpo')?.classList.toggle('hidden', !G.filtrosAberto);
  const ico = document.querySelector('#gestao-corpo .fa-chevron-up, #gestao-corpo .fa-chevron-down');
  if (ico){ ico.classList.toggle('fa-chevron-up', G.filtrosAberto); ico.classList.toggle('fa-chevron-down', !G.filtrosAberto); }
}
window.G_filtrosToggle = () => { G.filtrosAberto = !G.filtrosAberto; _aplicarFiltrosVisivel(); };
window.G_contasToggle = () => { G.contasAberto = !G.contasAberto; el('gestao-contas-corpo')?.classList.toggle('hidden', !G.contasAberto); };
window.gestaoToggleSemana = n => {
  const i = G.filtros.semanas.indexOf(`${n}º. SEMANA`);
  if (i >= 0) G.filtros.semanas.splice(i, 1); else G.filtros.semanas.push(`${n}º. SEMANA`);
  document.querySelectorAll('.gsem').forEach(b => {
    const on = G.filtros.semanas.includes(`${b.dataset.sem}º. SEMANA`);
    b.style.background = on ? 'rgba(245,158,11,.18)' : 'transparent';
    b.style.borderColor = on ? '#f59e0b' : 'var(--border-color)';
  });
};
window.G_contasGrupoToggle = (grupo, btn) => {
  const aberto = grupo === 'entradas' ? (G.contasEntradasAberto = !G.contasEntradasAberto) : (G.contasSaidasAberto = !G.contasSaidasAberto);
  el(`gestao-contas-${grupo}`)?.classList.toggle('hidden', !aberto);
  const ico = btn?.querySelector('i.fa-solid');
  if (ico){ ico.classList.toggle('fa-chevron-up', aberto); ico.classList.toggle('fa-chevron-down', !aberto); }
};
window.gestaoContaMudou = () => {
  const cbs = [...document.querySelectorAll('.gestao-conta-cb')];
  cbs.forEach(c => { const l = c.closest('.gconta'); if (l) l.style.background = c.checked ? 'var(--color-primary-light)' : ''; });
  const n = cbs.filter(c => c.checked).length;
  const t = el('gestao-contas-titulo');
  if (t) t.innerHTML = `<i class="fa-solid fa-list-check mr-1.5 text-amber-500"></i>Contas analisadas ${n ? `(${n} selecionadas)` : '(todas)'}`;
};
window.gestaoBuscaConta = () => {
  const q = cf(el('gf-busca-conta').value);
  if (q){ G.contasEntradasAberto = true; G.contasSaidasAberto = true;
    el('gestao-contas-entradas')?.classList.remove('hidden');
    el('gestao-contas-saidas')?.classList.remove('hidden'); }
  document.querySelectorAll('.gconta').forEach(l => l.classList.toggle('hidden', q && !l.dataset.nome.includes(q)));
};
window.gestaoMudaConselho = async () => {
  const sel = el('gf-conselho'), cong = el('gf-congregacao');
  const { porConselho } = await mapaConselhos();
  const lista = sel.value === 'Todos' ? Object.values(porConselho).flat() : (porConselho[sel.value] || []);
  cong.innerHTML = '<option value="Todas">Todas</option>' + [...new Set(lista)].sort().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
};
function _lerFiltros(){
  const f = G.filtros;
  f.ano_ini = el('gf-ano-ini')?.value ?? f.ano_ini; f.mes_ini = el('gf-mes-ini')?.value ?? f.mes_ini;
  f.ano_fim = el('gf-ano-fim')?.value ?? f.ano_fim; f.mes_fim = el('gf-mes-fim')?.value ?? f.mes_fim;
  f.conselho = el('gf-conselho')?.value || 'Todos'; f.congregacao = el('gf-congregacao')?.value || 'Todas';
  f.contas = [...document.querySelectorAll('.gestao-conta-cb:checked')].map(c => c.value);
  return f;
}
async function _popularConselhos(){
  const { porConselho } = await mapaConselhos();
  const sel = el('gf-conselho'); if (!sel) return;
  sel.innerHTML = '<option value="Todos">Todos</option>' + Object.keys(porConselho).sort().map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value = G.filtros.conselho || 'Todos';
  await gestaoMudaConselho();
  el('gf-congregacao').value = G.filtros.congregacao || 'Todas';
}

function renderAbaCruzamento(){
  const corpo = el('gestao-corpo');
  const isCruz = G.aba === 'cruzamento', isInd = G.aba === 'indicadores', isRel = G.aba === 'relatorios';
  corpo.innerHTML = _filtrosUI() + (isCruz ? `
      <div id="gestao-kpis" class="grid grid-cols-2 gap-2.5"></div>
      <div class="border rounded-2xl p-4" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="flex flex-wrap justify-between items-center gap-2 mb-3">
          <div><h3 class="font-bold text-sm">Análise visual</h3><span id="gestao-periodo-label" class="text-[10px] opacity-60"></span></div>
          <div class="flex items-center gap-2 text-xs">
            <select id="gestao-dimensao" onchange="gestaoDimensao(this.value)" class="px-2 py-1.5 rounded-lg border text-[11px]" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
              <option value="tempo" ${G.dimensao==='tempo'?'selected':''}>Evolução por período</option>
              <option value="conselho" ${G.dimensao==='conselho'?'selected':''}>Comparar conselhos</option>
              <option value="congregacao" ${G.dimensao==='congregacao'?'selected':''}>Comparar congregações</option>
            </select>
            <div class="flex rounded-lg border overflow-hidden" style="border-color:var(--border-color)">
              <button id="gfmt-bar" onclick="gestaoModelo('bar')" class="px-2.5 py-1.5 cursor-pointer" title="Colunas"><i class="fa-solid fa-chart-column"></i></button>
              <button id="gfmt-line" onclick="gestaoModelo('line')" class="px-2.5 py-1.5 cursor-pointer" title="Linhas"><i class="fa-solid fa-chart-line"></i></button>
            </div>
            <label id="gestao-media-wrap" class="flex items-center gap-1 text-[10px] font-bold opacity-80"><input type="checkbox" id="gestao-media-cb" onchange="gestaoGrafico()" class="accent-amber-500">Média</label>
          </div>
        </div>
        <div class="relative h-64"><canvas id="gestao-canvas"></canvas><p id="gestao-graf-aviso" class="hidden absolute inset-0 flex items-center justify-center text-[11px] opacity-60 text-center px-4">Gráficos indisponíveis — a biblioteca de gráficos não carregou.</p></div>
      </div>
      <div id="gestao-comparativos" class="grid grid-cols-3 gap-2.5"></div>
      <div class="border rounded-2xl p-4" style="background:var(--bg-card);border-color:var(--border-color)">
        <h3 class="font-bold text-sm mb-3">Ranking de conselhos</h3><div id="gestao-ranking" class="space-y-3"></div>
      </div>
      <div class="border rounded-xl overflow-x-auto" style="border-color:var(--border-color)">
        <table class="w-full text-left text-xs whitespace-nowrap"><thead class="sticky top-0" style="background:var(--bg-surface)"><tr><th class="p-3">Período</th><th class="p-3">Semana</th><th class="p-3">Conselho</th><th class="p-3">Congregação</th><th class="p-3">Entradas</th><th class="p-3">Dízimos</th><th class="p-3">Ofertas</th><th class="p-3">Despesas</th><th class="p-3" id="gestao-th-valor">Saldo</th></tr></thead>
        <tbody id="gestao-tbody" class="divide-y" style="border-color:var(--border-color)"><tr><td colspan="9" class="p-8 text-center opacity-60">Configure os filtros e cruze os dados.</td></tr></tbody></table>
      </div>` : '')
    + (isInd ? `
      <div id="ind-cards" class="grid grid-cols-2 gap-2.5"></div>
      <div id="ind-insights" class="grid grid-cols-1 gap-2.5"></div>
      <div class="border rounded-2xl p-4" style="background:var(--bg-card);border-color:var(--border-color)"><h3 class="font-bold text-sm mb-3">Desempenho por conselho</h3><div id="ind-conselhos" class="space-y-3"></div></div>
      <div class="border rounded-2xl p-4" style="background:var(--bg-card);border-color:var(--border-color)"><h3 class="font-bold text-sm mb-3">Congregações em destaque</h3><div id="ind-congs" class="space-y-3"></div></div>` : '')
    + (isRel ? `
      <div class="border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3" style="background:var(--bg-card);border-color:var(--border-color)">
        <div class="flex-1 min-w-48"><h3 class="font-bold text-sm">Relatório oficial da Gestão Unificada</h3><p id="rel-resumo" class="text-xs opacity-70 mt-1">Cruze os dados para visualizar o conteúdo do PDF.</p></div>
        <button onclick="gestaoExportarPDF()" class="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"><i class="fa-solid fa-file-pdf mr-1.5"></i>Gerar PDF</button>
      </div>
      <div id="rel-kpis" class="grid grid-cols-2 gap-2.5"></div>
      <div class="border rounded-xl overflow-x-auto" style="border-color:var(--border-color)">
        <table class="w-full text-left text-xs whitespace-nowrap"><thead class="sticky top-0" style="background:var(--bg-surface)"><tr><th class="p-3">Período</th><th class="p-3">Congregação</th><th class="p-3">Conselho</th><th class="p-3">Entradas</th><th class="p-3">Despesas</th><th class="p-3">Saldo</th></tr></thead>
        <tbody id="rel-tbody" class="divide-y" style="border-color:var(--border-color)"><tr><td colspan="6" class="p-8 text-center opacity-60">Sem dados para pré-visualização.</td></tr></tbody></table>
      </div>` : '');
  _popularConselhos();
  if (G.dados) renderizarCruzamento(G.dados);
  else if (!isCruz) gestaoCarregar();
}

window.gestaoModelo = m => { G.modelo = m; gestaoGrafico(); };
window.gestaoDimensao = d => { G.dimensao = d; gestaoGrafico(); };
window.gestaoCarregar = async function(){
  const f = _lerFiltros();
  if (G.filtrosAberto){ G.filtrosAberto = false; _aplicarFiltrosVisivel(); }
  const tb = el('gestao-tbody'); if (tb) tb.innerHTML = '<tr><td colspan="9" class="p-8 text-center opacity-60"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Cruzando dados…</td></tr>';
  try {
    const dados = await consultarCruzamento(f.ano_ini, f.mes_ini, f.ano_fim, f.mes_fim, f);
    dados.filtros = { ...f };
    dados.media_referencia = await mediaReferencia(f, dados);
    G.dados = dados;
    renderizarCruzamento(dados);
    if (G.aba !== 'cruzamento') toast('Dados atualizados.');
  } catch(e){
    if (tb) tb.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-red-500">${esc(e.message || 'Falha ao carregar.')}</td></tr>`;
  }
};

function renderizarCruzamento(dados){
  const t = dados.totais || {}, linhas = dados.linhas || [], series = dados.series || [];
  const consultor = perfilConsultor();
  const ofLiq = num(t.ofertas) - num(t.missoes);
  const setHtml = (id, html) => { const e = el(id); if (e) e.innerHTML = html; };
  const nContasK = (dados.contas_selecionadas || []).length;
  const cardConta = nContasK ? card('Contas selecionadas', moeda(t.conta_selecionada_total), 'text-amber-500', nContasK === 1 ? dados.contas_selecionadas[0] : `${nContasK} contas no filtro`) : '';
  setHtml('gestao-kpis', consultor
    ? cardConta + card('Entradas', moeda(t.entradas)) + card('Dízimos', moeda(t.dizimos), 'text-sky-500') + card('Ofertas', moeda(ofLiq), 'text-amber-500', 'Ofertas gerais (sem Missões)') + card('Missões', moeda(t.missoes), 'text-purple-400') + card('Despesas', moeda(t.despesas), 'text-red-500')
    : cardConta + card('Entradas', moeda(t.entradas)) + card('Dízimos', moeda(t.dizimos), 'text-sky-500') + card('Ofertas', moeda(t.ofertas), 'text-amber-500') + card('Despesas', moeda(t.despesas), 'text-red-500') + card('Resultado', moeda(t.saldo_liquido), num(t.saldo_liquido) >= 0 ? 'text-emerald-500' : 'text-red-500'));
  const f = dados.filtros || {};
  const pl = el('gestao-periodo-label'); if (pl) pl.textContent = `${f.mes_ini}/${f.ano_ini} a ${f.mes_fim}/${f.ano_fim}`;
  const conselhos = Object.entries(t.por_conselho || {}).sort((a, b) => b[1] - a[1]);
  const congs = Object.entries(t.por_congregacao || {}).sort((a, b) => b[1] - a[1]);
  setHtml('gestao-ranking', conselhos.slice(0, 8).map(([n, v]) => linhaInd(n, v, conselhos[0]?.[1] || 1)).join('') || '<p class="text-xs opacity-60">Sem dados.</p>');

  const validos = series.filter(p => (num(p.entradas) > 0 || num(p.despesas) > 0) && !p.parcial);
  const at = validos.at(-1) || {}, ant = validos.at(-2) || {};
  setHtml('gestao-comparativos', (consultor ? [['Entradas','entradas'],['Despesas','despesas']] : [['Entradas','entradas'],['Despesas','despesas'],['Resultado','saldo']]).map(([tt, k]) => {
    const v = variacaoPct(at[k], ant[k]);
    return `<div class="border rounded-xl p-3 min-w-0" style="background:var(--bg-card);border-color:var(--border-color)"><p class="text-[10px] font-bold uppercase opacity-60 truncate">${tt}</p><p class="mt-1 text-sm font-black tabular-nums whitespace-nowrap ${v === null ? 'opacity-60' : v >= 0 ? 'text-emerald-500' : 'text-red-500'}">${v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}</p><p class="text-[10px] opacity-60 mt-1 truncate">${esc(at.periodo || '-')} vs ${esc(ant.periodo || '-')}</p></div>`;
  }).join(''));

  const nContas = nContasK;
  const thV = el('gestao-th-valor');
  if (thV) thV.textContent = nContas ? (nContas === 1 ? dados.contas_selecionadas[0] : `${nContas} contas sel.`) : 'Saldo';
  const tb = el('gestao-tbody');
  if (tb) tb.innerHTML = linhas.map(i => {
    const val = nContas ? i.valor_conta_especifica : i.saldo;
    return `<tr><td class="p-3">${esc(i.periodo)}</td><td class="p-3 opacity-70">${esc(i.semana)}</td><td class="p-3">${esc(i.conselho)}</td><td class="p-3 font-semibold">${esc(i.congregacao)}</td><td class="p-3 text-emerald-500">${moeda(i.entradas)}</td><td class="p-3">${moeda(i.dizimos)}</td><td class="p-3">${moeda(i.ofertas)}</td><td class="p-3 text-red-500">${moeda(i.despesas)}</td><td class="p-3 font-bold">${moeda(val)}</td></tr>`;
  }).join('') || '<tr><td colspan="9" class="p-8 text-center opacity-60">Nenhum movimento financeiro encontrado.</td></tr>';

  setHtml('ind-cards', card('Média de entradas', moeda(t.media_entradas), 'text-emerald-500', 'por período com movimento')
    + card('Média de despesas', moeda(t.media_despesas), 'text-red-500', 'por período com movimento')
    + (consultor ? '' : card('Resultado médio', moeda(t.media_saldo), num(t.media_saldo) >= 0 ? 'text-emerald-500' : 'text-red-500') + card('Margem operacional', `${num(t.margem_operacional_pct).toFixed(1)}%`, 'text-amber-500', '(entradas − despesas) ÷ entradas')));
  const rel = num(t.entradas) > 0 ? num(t.despesas) / num(t.entradas) * 100 : 0;
  const tend = variacaoPct(at.entradas, validos[0]?.entradas);
  const ins = (ico, tit, val, det, cor) => `<div class="border rounded-xl p-4" style="background:var(--bg-card);border-color:var(--border-color)"><div class="flex items-center gap-2 text-xs font-bold"><i class="fa-solid ${ico} ${cor}"></i>${tit}</div><p class="text-lg font-bold mt-2">${val}</p><p class="text-[10px] opacity-60 mt-1">${det}</p></div>`;
  setHtml('ind-insights',
    ins('fa-trophy', 'Maior conselho', esc(conselhos[0]?.[0] || 'Sem dados'), moeda(conselhos[0]?.[1] || 0), 'text-amber-500')
    + ins('fa-building', 'Maior congregação', esc(congs[0]?.[0] || 'Sem dados'), moeda(congs[0]?.[1] || 0), 'text-sky-500')
    + ins('fa-scale-balanced', 'Comprometimento das entradas', `${rel.toFixed(1)}%`, 'Percentual das entradas consumido por saídas', 'text-red-500')
    + ins('fa-arrow-trend-up', 'Tendência das entradas', tend === null ? 'Sem base' : `${tend >= 0 ? '+' : ''}${tend.toFixed(1)}%`, `${esc(validos[0]?.periodo || '-')} até ${esc(at.periodo || '-')}`, tend !== null && tend >= 0 ? 'text-emerald-500' : 'text-red-500'));
  setHtml('ind-conselhos', conselhos.map(([n, v]) => linhaInd(n, v, conselhos[0]?.[1] || 1)).join('') || '<p class="text-xs opacity-60">Sem dados.</p>');
  setHtml('ind-congs', congs.slice(0, 15).map(([n, v]) => linhaInd(n, v, congs[0]?.[1] || 1)).join('') || '<p class="text-xs opacity-60">Sem dados.</p>');

  setHtml('rel-kpis', card('Entradas', moeda(t.entradas)) + card('Saídas', moeda(t.despesas), 'text-red-500') + card('Registros', String(linhas.length), 'text-sky-500') + card('Contas selecionadas', String(nContas), 'text-amber-500'));
  const rs = el('rel-resumo'); if (rs) rs.textContent = `${f.mes_ini}/${f.ano_ini} a ${f.mes_fim}/${f.ano_fim} • ${f.conselho || 'Todos'} • ${linhas.length} registro(s).`;
  const rtb = el('rel-tbody');
  if (rtb) rtb.innerHTML = linhas.map(i => `<tr><td class="p-3">${esc(i.periodo)}</td><td class="p-3 font-semibold">${esc(i.congregacao)}</td><td class="p-3">${esc(i.conselho)}</td><td class="p-3 text-emerald-500">${moeda(i.entradas)}</td><td class="p-3 text-red-500">${moeda(i.despesas)}</td><td class="p-3 font-bold">${moeda(i.saldo)}</td></tr>`).join('') || '<tr><td colspan="6" class="p-8 text-center opacity-60">Sem dados.</td></tr>';
  gestaoGrafico();
}

window.gestaoGrafico = function(){
  if (typeof Chart === 'undefined'){
    el('gestao-graf-aviso')?.classList.remove('hidden');
    return;
  }
  el('gestao-graf-aviso')?.classList.add('hidden');
  if (!G.dados) return;
  const cb = el('gestao-media-cb');
  if (cb){ const off = G.dimensao !== 'tempo'; cb.disabled = off; if (off) cb.checked = false; el('gestao-media-wrap')?.classList.toggle('opacity-45', off); }
  const t = G.dados.totais || {}, sel = G.dados.contas_selecionadas || [];
  const todasEnt = sel.length === CONTAS_ENTRADAS_BI.length && CONTAS_ENTRADAS_BI.every(c => sel.includes(c));
  const cores = ['#10b981','#ef4444','#f59e0b','#0ea5e9','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  let labels = [], datasets = [];
  if (G.dimensao === 'tempo'){
    const s = G.dados.series || [];
    labels = s.map(i => i.periodo);
    const total = !sel.length || todasEnt;
    datasets = [{ label: total ? 'Total geral de entradas' : 'Total das contas selecionadas', data: s.map(i => num(total ? i.entradas : i.valor_conta_especifica)), borderColor: cores[0], backgroundColor: cores[0] + '99', tension: .28 }];
    const mref = G.dados.media_referencia || {};
    if (cb?.checked && num(mref.valor) > 0) datasets.push({ type: 'line', label: `${mref.rotulo || 'Média'} · ${moeda(mref.valor)}`, data: s.map(() => num(mref.valor)), borderColor: '#f59e0b', borderDash: [8, 5], borderWidth: 2, pointRadius: 0, fill: false, order: -1 });
  } else {
    const mapa = G.dimensao === 'conselho' ? t.por_conselho || {} : t.por_congregacao || {};
    const rank = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, G.dimensao === 'conselho' ? 12 : 20);
    labels = rank.map(i => i[0]);
    datasets = [{ label: sel.length ? 'Contas selecionadas' : 'Entradas totais', data: rank.map(i => num(i[1])), backgroundColor: rank.map((_, i) => cores[i % 8] + 'cc'), borderColor: rank.map((_, i) => cores[i % 8]), borderWidth: 1 }];
  }
  ['gfmt-bar', 'gfmt-line'].forEach((id, i) => { const b = el(id); if (b){ const on = ['bar','line'][i] === G.modelo; b.style.background = on ? '#d97706' : 'var(--bg-input)'; b.style.color = on ? '#fff' : 'var(--text-main)'; } });
  const ctx = el('gestao-canvas')?.getContext('2d'); if (!ctx) return;
  if (G.graf) G.graf.destroy();
  const cat = G.dimensao !== 'tempo';
  G.graf = new Chart(ctx, { type: G.modelo, data: { labels, datasets },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: cat ? 'y' : 'x', interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${moeda(c.raw)}` } } },
      scales: cat ? { x: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString('pt-BR', { notation: 'compact' }) } }, y: { ticks: { autoSkip: false } } }
                  : { y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString('pt-BR', { notation: 'compact' }) } }, x: { ticks: { maxRotation: 35 } } } } });
};

window.gestaoExportarPDF = async function(){
  if (!G.dados){ toast('Cruze os dados primeiro.'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const t = G.dados.totais || {}, f = G.dados.filtros || {};
    doc.setFontSize(16); doc.text('SGE — Relatório Gestão Unificada', 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${f.mes_ini}/${f.ano_ini} a ${f.mes_fim}/${f.ano_fim}   Conselho: ${f.conselho}   Congregação: ${f.congregacao}`, 14, 22);
    doc.text(`Entradas: ${moeda(t.entradas)}   Dízimos: ${moeda(t.dizimos)}   Ofertas: ${moeda(t.ofertas)}   Despesas: ${moeda(t.despesas)}   Saldo: ${moeda(t.saldo_liquido)}`, 14, 28);
    doc.autoTable({
      startY: 34, head: [['Período', 'Semana', 'Conselho', 'Congregação', 'Entradas', 'Dízimos', 'Ofertas', 'Despesas', 'Saldo']],
      body: (G.dados.linhas || []).map(i => [i.periodo, i.semana, i.conselho, i.congregacao, moeda(i.entradas), moeda(i.dizimos), moeda(i.ofertas), moeda(i.despesas), moeda(i.saldo)]),
      styles: { fontSize: 7 }, headStyles: { fillColor: [180, 83, 9] },
    });
    doc.save(`gestao-unificada_${f.mes_ini}-${f.ano_ini}_a_${f.mes_fim}-${f.ano_fim}.pdf`);
    toast('PDF gerado.');
  } catch(e){ toast('Falha ao gerar PDF: ' + e.message); }
};

/* ===================== ABA 2 — Análise do Mês ===================== */
function renderAbaMensal(){
  const ord = [...G.periodos].sort((a, b) => (+b.ano) - (+a.ano) || indiceMes(b.mes) - indiceMes(a.mes));
  const ult = ord[0] || { ano: new Date().getFullYear(), mes: ORDEM_MESES[new Date().getMonth()] };
  const anos = [...new Set(G.periodos.map(p => String(p.ano)))].sort().map(a => [a, a]);
  if (!anos.length) anos.push([String(ult.ano), String(ult.ano)]);
  const m = G.mensalSel || { ano: ult.ano, mes: ult.mes };
  G.mensalSel = m;
  el('gestao-corpo').innerHTML = `
    <div class="border rounded-2xl p-3 flex flex-wrap items-center gap-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex-1 min-w-40"><h3 class="font-bold text-sm flex items-center gap-2"><i class="fa-solid fa-calendar-week text-violet-400"></i>Análise Mensal Executiva</h3><p class="text-[10px] opacity-60 mt-0.5">Comparativos, projeções e feedbacks automáticos.</p></div>
      ${selHtml('mm-ano', anos, m.ano, 'gestaoMensalSel()')}${selHtml('mm-mes', ORDEM_MESES.map(x => [x, x]), m.mes, 'gestaoMensalSel()')}
      ${(() => { const c = obterCiclo(m.ano, m.mes); return `<span class="text-[10px] font-bold uppercase opacity-60">Ciclo</span><span class="px-2 py-1.5 rounded-lg border text-xs font-bold" style="border-color:var(--border-color)" title="Ciclo de fechamentos configurado no desktop">${c.total_semanas} semanas</span>`; })()}
      <button onclick="gestaoMensalCarregar()" class="px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold cursor-pointer"><i class="fa-solid fa-chart-line mr-1"></i>Analisar</button>
    </div>
    <div id="mm-kpis" class="grid grid-cols-2 gap-2.5"></div>
    <div id="mm-medias" class="grid grid-cols-2 gap-2.5"></div>
    <div class="border rounded-2xl p-4" style="background:var(--bg-card);border-color:var(--border-color)"><h3 class="font-bold text-sm mb-2">Semanas do mês</h3><span id="mm-semanas-label" class="text-[10px] opacity-60"></span><div class="relative h-56 mt-2"><canvas id="mm-graf-semanas"></canvas></div></div>
    <div class="border rounded-2xl p-4" style="background:var(--bg-card);border-color:var(--border-color)"><h3 class="font-bold text-sm mb-2">Evolução do ano e projeção</h3><span id="mm-evo-label" class="text-[10px] opacity-60"></span><div class="relative h-56 mt-2"><canvas id="mm-graf-evo"></canvas></div></div>
    <div id="mm-projecoes" class="grid grid-cols-1 gap-2.5"></div>
    <div><h3 class="font-bold text-sm mb-2 flex items-center gap-2"><i class="fa-solid fa-lightbulb text-amber-500"></i>Feedbacks automáticos</h3><div id="mm-insights" class="grid grid-cols-1 gap-2.5"></div></div>
    <div class="border rounded-2xl p-4" style="background:var(--bg-card);border-color:var(--border-color)"><h3 class="font-bold text-sm mb-3">Top congregações do mês</h3><div id="mm-ranking" class="space-y-3"></div></div>
    <div class="border rounded-xl overflow-x-auto" style="border-color:var(--border-color)">
      <table class="w-full text-left text-xs whitespace-nowrap"><thead class="sticky top-0" style="background:var(--bg-surface)"><tr><th class="p-3">Semana</th><th class="p-3">Entradas</th><th class="p-3">Dízimos</th><th class="p-3">Ofertas</th><th class="p-3">Despesas</th><th class="p-3">Resultado</th><th class="p-3">Acumulado</th></tr></thead>
      <tbody id="mm-tbody" class="divide-y" style="border-color:var(--border-color)"></tbody></table>
    </div>`;
  gestaoMensalCarregar();
}
window.gestaoMensalSel = () => { G.mensalSel = { ano: el('mm-ano').value, mes: el('mm-mes').value }; gestaoMensalCarregar(); };
window.gestaoCiclo = () => { toast('Ciclo de fechamentos é configurado no desktop — app somente leitura.'); };
window.gestaoMensalCarregar = async function(){
  const k = el('mm-kpis'); if (k) k.innerHTML = '<div class="col-span-2 border rounded-xl p-6 text-center opacity-60 text-xs" style="border-color:var(--border-color)"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Calculando…</div>';
  const res = await analisarMes(G.mensalSel.ano, G.mensalSel.mes);
  if (G.aba !== 'mensal') return;
  if (!res.sucesso){
    G.mensal = null;
    if (k) k.innerHTML = `<div class="col-span-2 border rounded-xl p-6 text-center text-red-500 text-xs" style="border-color:var(--border-color)">${esc(res.mensagem)}</div>`;
    return;
  }
  G.mensal = res;
  const a = res.atual, comp = res.comparativos, ant = comp.mes_anterior, anual = comp.media_anual, yoy = comp.mesmo_mes_ano_anterior, proj = res.projecao, equiv = comp.mes_anterior_equiv;
  const selFech = el('mm-fech'); if (selFech) selFech.value = String(res.ciclo.total_semanas);
  const temEquiv = proj.mes_em_andamento && num(equiv.semanas_equivalentes) > 0;
  const sub = temEquiv ? `vs ${equiv.semanas_equivalentes} primeiras sem. de ${esc(equiv.rotulo)}` : `vs ${esc(ant.rotulo || '-')}`;
  const pick = (chave, fb) => temEquiv && equiv[chave] !== null && equiv[chave] !== undefined ? equiv[chave] : fb;
  const saldoIni = num(a.saldo_inicial_mes ?? a.saldo_mes_anterior), caixa = num(a.saldo_campo);
  const temCaixa = Math.abs(caixa) > EPS || Math.abs(saldoIni) > EPS;
  const kcard = (t2, v, varr, cor, inv = false, det = '') => `<div class="border rounded-xl p-3" style="background:var(--bg-card);border-color:var(--border-color)"><div class="flex items-start justify-between gap-2"><p class="text-[10px] font-bold uppercase opacity-60">${t2}</p>${varr === false ? '' : seloVar(varr, inv)}</div><p class="mt-1 text-base font-black tabular-nums ${cor}">${v}</p>${det ? `<p class="text-[10px] opacity-50 mt-1">${det}</p>` : ''}</div>`;
  el('mm-kpis').innerHTML =
    kcard('Entradas', moeda(a.entradas), pick('var_entradas_equiv', ant.var_entradas), 'text-emerald-500', false, sub)
    + kcard('Dízimos', moeda(a.dizimos), pick('var_dizimos_equiv', ant.var_dizimos), 'text-sky-500', false, sub)
    + kcard('Ofertas', moeda(a.ofertas), pick('var_ofertas_equiv', ant.var_ofertas), 'text-amber-500', false, sub)
    + kcard('Despesas', moeda(a.despesas), pick('var_despesas_equiv', ant.var_despesas), 'text-red-500', true, sub)
    + (perfilConsultor() ? '' : kcard('Resultado', moeda(a.saldo_liquido), pick('var_resultado_equiv', ant.var_saldo), num(a.saldo_liquido) >= 0 ? 'text-emerald-500' : 'text-red-500', false, sub)
    + kcard('Caixa da Semana', moeda(caixa), false, caixa >= 0 ? 'text-emerald-500' : 'text-red-500', false, temCaixa ? `Inicial: ${moeda(saldoIni)}` : ''));
  const mmAnt = anual.media_mensal_anteriores || anual.media_mensal || {};
  const mcard = (t2, v, det, cor = 'text-sky-400') => `<div class="border rounded-xl p-3" style="background:var(--bg-card);border-color:var(--border-color)"><p class="text-[10px] font-bold uppercase opacity-60">${t2}</p><p class="mt-1 text-sm font-bold tabular-nums ${cor}">${v}</p><p class="text-[10px] opacity-50 mt-1">${det}</p></div>`;
  el('mm-medias').innerHTML =
    mcard('Média semanal do mês', moeda(a.media_semanal_entradas), `${seloVar(anual.var_semanal_entradas)} vs média do ano (${moeda(anual.media_semanal_entradas)})`)
    + mcard('Média mensal do ano', moeda(mmAnt.entradas), `${seloVar(anual.var_entradas_anteriores ?? anual.var_entradas)} mês atual vs média (fechados)`)
    + mcard('Média semanal desp. (ano)', moeda(anual.media_semanal_despesas), `${anual.semanas_contabilizadas || 0} semanas contabilizadas`, 'text-red-400')
    + mcard(yoy.dados ? `Mesmo mês em ${+res.periodo.ano - 1}` : 'Comparativo anual', yoy.dados ? moeda(yoy.dados.entradas) : 'Sem dados', yoy.dados ? `${seloVar(yoy.var_entradas)} entradas vs ${res.periodo.mes}/${res.periodo.ano}` : `Nenhum registro em ${esc(yoy.rotulo || '-')}`);

  const cardsProj = [];
  if (proj.mes_em_andamento) cardsProj.push(`<div class="border rounded-xl p-4" style="background:var(--bg-card);border-color:var(--border-color)"><div class="flex items-center gap-2 text-xs font-bold"><i class="fa-solid fa-hourglass-half text-violet-400"></i>Fechamento projetado do mês</div><p class="text-lg font-bold mt-2 text-emerald-500 tabular-nums">${moeda(proj.fechamento_entradas)}</p><p class="text-[10px] opacity-60 mt-1">${proj.semanas_restantes} sem. restantes × ${esc(proj.base_semanal_usada)} • despesas prev. ${moeda(proj.fechamento_despesas)}${perfilConsultor() ? '' : ` • saldo ${moeda(proj.fechamento_saldo)}`}</p></div>`);
  cardsProj.push(`<div class="border rounded-xl p-4" style="background:var(--bg-card);border-color:var(--border-color)"><div class="flex items-center gap-2 text-xs font-bold"><i class="fa-solid fa-arrow-trend-up text-sky-400"></i>Projeção próximo mês (${esc(proj.proximo_mes_rotulo || '-')})</div><p class="text-lg font-bold mt-2 text-sky-400 tabular-nums">${moeda(proj.proximo_mes_entradas)}</p><p class="text-[10px] opacity-60 mt-1">taxa semanal ${moeda(proj.taxa_semanal_projetada)} × ${proj.semanas_proximo_mes} semanas • confiança ${esc(proj.confianca)} (base ${proj.meses_historico} meses) • média móvel 3m ${moeda(proj.media_movel_3m_entradas)}</p></div>`);
  el('mm-projecoes').innerHTML = cardsProj.join('');

  const icoTipo = { positivo: ['fa-circle-check', 'text-emerald-500'], atencao: ['fa-triangle-exclamation', 'text-amber-500'], negativo: ['fa-circle-xmark', 'text-red-500'], neutro: ['fa-circle-info', 'text-sky-400'], info: ['fa-lightbulb', 'text-violet-400'] };
  el('mm-insights').innerHTML = (res.insights || []).map(i => { const [ico, cor] = icoTipo[i.tipo] || icoTipo.neutro; return `<div class="border rounded-xl p-3 flex gap-2.5 text-xs" style="background:var(--bg-card);border-color:var(--border-color)"><i class="fa-solid ${ico} ${cor} mt-0.5 shrink-0"></i><span>${esc(i.texto)}</span></div>`; }).join('');

  const ranking = Object.entries(a.por_congregacao || {}).sort((x, y) => y[1].entradas - x[1].entradas);
  el('mm-ranking').innerHTML = ranking.map(([n, d]) => linhaInd(n, d.entradas, num(ranking[0]?.[1]?.entradas) || 1)).join('') || '<p class="text-xs opacity-60">Sem dados.</p>';
  el('mm-semanas-label').textContent = `${res.periodo.mes}/${res.periodo.ano} • ${a.semanas_com_dados} semana(s) com movimento • ciclo de ${res.ciclo.total_semanas} fechamentos`;
  el('mm-evo-label').textContent = `Entradas por mês em ${res.periodo.ano}`;
  el('mm-tbody').innerHTML = (a.semanas || []).map(s => `<tr class="${s.tem_dados ? '' : 'opacity-45'}"><td class="p-3 font-semibold">${esc(s.semana)}${s.fora_ciclo ? ' <span class="text-[9px] text-amber-500 font-bold">(fora do ciclo)</span>' : s.tem_dados ? '' : ' <span class="text-[9px] opacity-70">(sem movimento)</span>'}</td><td class="p-3 text-emerald-500 tabular-nums">${moeda(s.entradas)}</td><td class="p-3 tabular-nums">${moeda(s.dizimos)}</td><td class="p-3 tabular-nums">${moeda(s.ofertas)}</td><td class="p-3 text-red-500 tabular-nums">${moeda(s.despesas)}</td><td class="p-3 font-bold tabular-nums ${num(s.saldo) >= 0 ? 'text-emerald-500' : 'text-red-500'}">${moeda(s.saldo)}</td><td class="p-3 font-bold tabular-nums ${num(s.saldo_campo) >= 0 ? 'text-sky-400' : 'text-red-400'}">${moeda(s.saldo_campo)}</td></tr>`).join('')
    + (a.tem_dados ? `<tr style="background:var(--bg-surface)"><td class="p-3 font-black">TOTAL DO MÊS</td><td class="p-3 font-black text-emerald-500 tabular-nums">${moeda(a.entradas)}</td><td class="p-3 font-bold tabular-nums">${moeda(a.dizimos)}</td><td class="p-3 font-bold tabular-nums">${moeda(a.ofertas)}</td><td class="p-3 font-black text-red-500 tabular-nums">${moeda(a.despesas)}</td><td class="p-3 font-black tabular-nums ${num(a.saldo_liquido) >= 0 ? 'text-emerald-500' : 'text-red-500'}">${moeda(a.saldo_liquido)}</td><td class="p-3 font-black tabular-nums ${num(a.saldo_campo) >= 0 ? 'text-sky-400' : 'text-red-400'}">${moeda(a.saldo_campo)}</td></tr>` : '');
  graficosMensal(res);
};
function graficosMensal(res){
  if (typeof Chart === 'undefined') return;
  const a = res.atual, anual = res.comparativos?.media_anual || {}, proj = res.projecao || {};
  const ctxS = el('mm-graf-semanas')?.getContext('2d');
  if (ctxS){
    const sems = a.semanas || [], media = num(anual.media_semanal_entradas);
    if (G.grafMS) G.grafMS.destroy();
    G.grafMS = new Chart(ctxS, { data: { labels: sems.map(s => s.semana), datasets: [
      { type: 'bar', label: 'Entradas', data: sems.map(s => s.entradas), backgroundColor: '#10b981bb', borderColor: '#10b981', borderWidth: 1, borderRadius: 6 },
      { type: 'bar', label: 'Despesas', data: sems.map(s => s.despesas), backgroundColor: '#ef4444bb', borderColor: '#ef4444', borderWidth: 1, borderRadius: 6 },
      { type: 'line', label: 'Média semanal do ano', data: sems.map(() => media), borderColor: '#f59e0b', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false } ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${moeda(c.raw)}` } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString('pt-BR', { notation: 'compact' }) } } } } });
  }
  const ctxE = el('mm-graf-evo')?.getContext('2d');
  if (ctxE){
    const serie = res.serie_anual || [], labels = serie.map(p => p.mes.slice(0, 3));
    const ent = serie.map(p => p.entradas), desp = serie.map(p => p.despesas);
    const labelsP = [...labels], entP = serie.map(() => null), despP = serie.map(() => null);
    if (proj.proximo_mes_entradas !== undefined && serie.length){
      labelsP.push((proj.proximo_mes_rotulo || 'Próx.').slice(0, 3));
      if (proj.mes_em_andamento && proj.fechamento_entradas !== undefined){
        entP[serie.length - 1] = proj.fechamento_entradas; despP[serie.length - 1] = proj.fechamento_despesas;
        if (serie.length >= 2){ entP[serie.length - 2] = serie.at(-2).entradas; despP[serie.length - 2] = serie.at(-2).despesas; }
      } else { entP[serie.length - 1] = serie.at(-1).entradas; despP[serie.length - 1] = serie.at(-1).despesas; }
      entP.push(proj.proximo_mes_entradas); despP.push(proj.proximo_mes_despesas);
    }
    if (G.grafME) G.grafME.destroy();
    G.grafME = new Chart(ctxE, { type: 'line', data: { labels: labelsP, datasets: [
      { label: 'Entradas', data: ent, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.12)', tension: .3, fill: true, pointRadius: 3 },
      { label: 'Despesas', data: desp, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.08)', tension: .3, fill: true, pointRadius: 3 },
      { label: 'Projeção entradas', data: entP, borderColor: '#8b5cf6', borderDash: [6, 4], borderWidth: 2, pointRadius: 4, pointStyle: 'rectRot', fill: false },
      { label: 'Projeção despesas', data: despP, borderColor: '#f59e0b', borderDash: [6, 4], borderWidth: 2, pointRadius: 4, pointStyle: 'rectRot', fill: false } ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${moeda(c.raw)}` } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => Number(v).toLocaleString('pt-BR', { notation: 'compact' }) } } } } });
  }
}

/* ===================== ABA 3 — Projeção de Despesas & Fluxo ===================== */
function renderAbaFluxo(){
  const ord = [...G.periodos].sort((a, b) => (+b.ano) - (+a.ano) || indiceMes(b.mes) - indiceMes(a.mes));
  const ult = ord[0] || { ano: new Date().getFullYear(), mes: ORDEM_MESES[new Date().getMonth()] };
  const anos = [...new Set(G.periodos.map(p => String(p.ano)))].sort().map(a => [a, a]);
  if (!anos.length) anos.push([String(ult.ano), String(ult.ano)]);
  const m = G.fluxoSel || { ano: ult.ano, mes: ult.mes };
  G.fluxoSel = m;
  el('gestao-corpo').innerHTML = `
    <div class="border rounded-2xl p-3 flex flex-wrap items-center gap-2.5" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex-1 min-w-40"><h3 class="font-bold text-sm flex items-center gap-2"><i class="fa-solid fa-money-bill-transfer text-emerald-400"></i>Projeção de Despesas & Fluxo de Caixa</h3><p class="text-[10px] opacity-60 mt-0.5">Semáforo de caixa e despesas fixas do mês. <span class="text-amber-500">Somente leitura — a gestão é feita no desktop.</span></p></div>
      ${selHtml('fx-ano', anos, m.ano, 'gestaoFluxoSel()')}${selHtml('fx-mes', ORDEM_MESES.map(x => [x, x]), m.mes, 'gestaoFluxoSel()')}
      
    </div>
    <div id="fx-semaforo" class="border rounded-2xl p-4" style="border-color:var(--border-color)"></div>
    <div id="fx-kpis" class="grid grid-cols-2 gap-2.5"></div>
    <div class="border rounded-2xl overflow-hidden" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="px-4 py-3 border-b" style="border-color:var(--border-color)"><h3 class="font-bold text-sm">Despesas fixas do mês</h3><span id="fx-legenda" class="text-[10px] opacity-60"></span></div>
      <div class="overflow-x-auto"><table class="w-full text-left text-xs whitespace-nowrap"><thead style="background:var(--bg-surface)"><tr id="fx-thead"></tr></thead><tbody id="fx-tbody" class="divide-y" style="border-color:var(--border-color)"></tbody></table></div>
    </div>
`;
  gestaoFluxoCarregar();
}
window.gestaoFluxoSel = () => { G.fluxoSel = { ano: el('fx-ano').value, mes: el('fx-mes').value }; gestaoFluxoCarregar(); };
window.gestaoFluxoCarregar = async function(){
  const sem = el('fx-semaforo'); if (sem) sem.innerHTML = '<div class="flex items-center gap-2 opacity-60 text-xs justify-center"><i class="fa-solid fa-circle-notch fa-spin"></i>Calculando fluxo de caixa…</div>';
  const c = await calcularFluxo(G.fluxoSel.ano, G.fluxoSel.mes);
  if (G.aba !== 'fluxo') return;
  if (!c.sucesso){ if (sem) sem.innerHTML = `<div class="text-red-500 text-xs text-center">${esc(c.mensagem)}</div>`; return; }
  G.fluxo = c;
  const kcard = (t2, v, cor, det) => `<div class="border rounded-xl p-3" style="background:var(--bg-card);border-color:var(--border-color)"><p class="text-[10px] font-bold uppercase opacity-60">${t2}</p><p class="mt-1 text-sm font-black tabular-nums ${cor}">${v}</p><p class="text-[10px] opacity-50 mt-1">${det}</p></div>`;
  if (c.mes_fechado){
    const fr = c.fechamento_real || {}, cor = num(fr.caixa_final) >= 0 ? '#10b981' : '#ef4444';
    el('fx-semaforo').innerHTML = `<div class="flex items-center gap-4 rounded-xl p-4" style="background:${num(fr.caixa_final) >= 0 ? 'rgba(16,185,129,.10)' : 'rgba(239,68,68,.10)'}">
      <div class="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style="background:${cor}22;border:2px solid ${cor}"><i class="fa-solid fa-lock text-lg" style="color:${cor}"></i></div>
      <div class="flex-1"><p class="font-black text-sm tracking-wide" style="color:${cor}">MÊS FECHADO</p><p class="text-[11px] opacity-75 mt-0.5">Valores reais do fechamento de ${esc(c.periodo.mes)}/${c.periodo.ano} — sem projeção.</p></div>
      <div class="text-right shrink-0"><p class="text-[10px] uppercase opacity-60 font-bold">Caixa final</p><p class="text-xl font-black tabular-nums" style="color:${cor}">${moeda(fr.caixa_final)}</p></div></div>`;
    el('fx-kpis').innerHTML =
      kcard('Entradas do mês', moeda(fr.entradas_mes), 'text-sky-500', 'total real lançado')
      + kcard('Despesas do mês', moeda(fr.despesas_mes), 'text-red-500', 'total real lançado')
      + (perfilConsultor() ? '' : kcard('Resultado do mês', moeda(fr.resultado_mes), num(fr.resultado_mes) >= 0 ? 'text-emerald-500' : 'text-red-500', 'entradas − despesas'))
      + kcard('Fixas pagas', moeda(c.despesas_quitadas), 'text-emerald-500', 'liquidadas no período')
      + kcard('Fixas pendentes', moeda(c.despesas_pendentes), 'text-red-500', `${c.pct_despesas_pendentes}% das fixas`);
  } else {
    const cfg = { verde: { cor: '#10b981', bg: 'rgba(16,185,129,.10)', ico: 'fa-circle-check', rot: 'EQUILIBRADO', msg: 'As entradas previstas cobrem a reposição do caixa e todas as despesas fixas do ciclo.' },
      amarelo: { cor: '#f59e0b', bg: 'rgba(245,158,11,.10)', ico: 'fa-triangle-exclamation', rot: 'EM ALERTA DE CAIXA', msg: 'Margem apertada: a sobra prevista ficou negativa dentro de 15% dos compromissos.' },
      vermelho: { cor: '#ef4444', bg: 'rgba(239,68,68,.10)', ico: 'fa-circle-xmark', rot: 'CRÍTICO — AUSTERIDADE', msg: 'Saldo severamente negativo: as entradas previstas não cobrem a reposição do caixa nem as despesas pendentes.' } }[c.semaforo];
    el('fx-semaforo').innerHTML = `<div class="flex items-center gap-4 rounded-xl p-4" style="background:${cfg.bg}">
      <div class="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style="background:${cfg.cor}22;border:2px solid ${cfg.cor}"><i class="fa-solid ${cfg.ico} text-lg" style="color:${cfg.cor}"></i></div>
      <div class="flex-1"><p class="font-black text-sm tracking-wide" style="color:${cfg.cor}">${cfg.rot}</p><p class="text-[11px] opacity-75 mt-0.5">${cfg.msg}</p></div>
      <div class="text-right shrink-0"><p class="text-[10px] uppercase opacity-60 font-bold">Sobra prevista</p><p class="text-xl font-black tabular-nums ${num(c.saldo_liquido) >= 0 ? 'text-emerald-500' : 'text-red-500'}">${moeda(c.saldo_liquido)}</p><p class="text-[9px] opacity-55 mt-1">= entrada − reposição − fixas pendentes</p></div></div>`;
    const origemTxt = { realizada: 'valor real lançado', posicao: `média histórica da ${c.semana_atual}ª semana`, mes: 'média semanal do mês', ano: 'média semanal do ano' }[c.receita_origem] || 'projetada';
    const caixaPos = num(c.saldo_semana_anterior) >= 0;
    el('fx-kpis').innerHTML = [
      ['Entrada prevista da semana', moeda(c.receita_gerentes), 'text-sky-500', `semana ${c.semana_atual}/${c.ciclo?.total_semanas ?? '—'} • ${origemTxt}`],
      ['Caixa acumulado', moeda(c.saldo_semana_anterior), caixaPos ? 'text-emerald-500' : 'text-red-500', 'ao fim da última semana fechada'],
      caixaPos ? ['Reposição do caixa', moeda(0), 'text-emerald-500', 'caixa positivo — nada a repor'] : ['Entrada p/ repor o caixa', moeda(c.bruto_necessario), 'text-amber-500', 'receita bruta p/ cobrir caixa negativo (÷0,54)'],
      ['Fixas a pagar', moeda(c.despesas_pendentes), 'text-red-500', `${c.pct_despesas_pendentes}% das fixas`],
      ['Fixas já pagas', moeda(c.despesas_quitadas), 'text-emerald-500', 'liquidadas no período'],
    ].filter(k => !(perfilConsultor() && /caixa|resultado/i.test(k[0]))).map(k => kcard(...k)).join('');
  }
  const totalSem = c.ciclo?.total_semanas || 4;
  el('fx-thead').innerHTML = `<th class="p-3">Descrição</th><th class="p-3">Categoria</th><th class="p-3 text-right">Previsto</th>${Array.from({ length: totalSem }, (_, i) => `<th class="p-3 text-center">S${i + 1}${i + 1 === c.semana_atual ? ' <i class="fa-solid fa-arrow-down text-violet-400"></i>' : ''}</th>`).join('')}<th class="p-3 text-center">Status</th>${SOMENTE_LEITURA ? '' : '<th class="p-3 text-center">Ações</th>'}`;
  el('fx-tbody').innerHTML = !c.despesas?.length
    ? `<tr><td colspan="${5 + totalSem - (SOMENTE_LEITURA ? 1 : 0)}" class="p-8 text-center opacity-60">Nenhuma despesa fixa em ${esc(c.periodo.mes)}/${c.periodo.ano}.</td></tr>`
    : c.despesas.map(d => `<tr><td class="p-3 font-semibold">${esc(d.descricao)}</td><td class="p-3"><span class="px-2 py-0.5 rounded-md text-[10px] font-bold" style="background:var(--bg-surface)">${esc(d.categoria)}</span></td><td class="p-3 text-right font-bold tabular-nums">${moeda(d.valor_previsto)}</td>${Array.from({ length: totalSem }, (_, i) => { const s = i + 1, on = !!d.quitacao?.[String(s)]; return `<td class="p-3 text-center"><input type="checkbox" ${on ? 'checked' : ''} ${SOMENTE_LEITURA ? 'disabled' : `onchange="gestaoQuitacao('${d.id}',${s},this.checked)"`} class="w-4 h-4 accent-emerald-500 ${SOMENTE_LEITURA ? 'opacity-60' : ''}"></td>`; }).join('')}<td class="p-3 text-center">${d.quitada ? '<span class="text-[10px] font-bold text-emerald-500"><i class="fa-solid fa-check mr-0.5"></i>QUITADA</span>' : '<span class="text-[10px] font-bold text-amber-500">PENDENTE</span>'}</td>${SOMENTE_LEITURA ? '' : `<td class="p-3 text-center whitespace-nowrap"><button onclick="gestaoAbrirModalDesp('${d.id}')" class="px-2 py-1 rounded-md bg-sky-600/20 text-sky-400 cursor-pointer"><i class="fa-solid fa-pen text-[10px]"></i></button> <button onclick="gestaoRemoverDesp('${d.id}')" class="px-2 py-1 rounded-md bg-red-600/20 text-red-400 cursor-pointer"><i class="fa-solid fa-trash text-[10px]"></i></button></td>`}</tr>`).join('');
  el('fx-legenda').textContent = `${c.despesas?.length || 0} despesa(s) • ciclo de ${totalSem} fechamentos • quitação gerenciada no desktop`;
};
window.gestaoAbrirModalDesp = () => { toast('Somente leitura — despesas são gerenciadas no desktop.'); };
window.gestaoFecharModalDesp = () => {};
window.gestaoSalvarDesp = () => { toast('Somente leitura.'); };
window.gestaoRemoverDesp = () => { toast('Somente leitura.'); };
window.gestaoQuitacao = (id, sem, on) => { alternarQuitacao(id, sem, on); gestaoFluxoCarregar(); };

/* ===================== ABA 6 — Gestão de Usuários (Administrador) ===================== */
const GU_STATUS = {
  pendente:         { rot: 'Pendente',          cor: '#f59e0b', ico: 'fa-clock' },
  email_confirmado: { rot: 'Aguarda aprovação', cor: '#38bdf8', ico: 'fa-envelope-circle-check' },
  aprovado:         { rot: 'Aprovado',          cor: '#10b981', ico: 'fa-circle-check' },
  bloqueado:        { rot: 'Bloqueado',         cor: '#ef4444', ico: 'fa-ban' },
  inativo:          { rot: 'Inativo',           cor: '#94a3b8', ico: 'fa-circle-pause' },
  recusado:         { rot: 'Recusado',          cor: '#f43f5e', ico: 'fa-circle-xmark' },
};
const GU_FILTROS = [['Todos','Todos'], ['Email_Confirmado','Aguardando'], ['Pendente','Pendentes'], ['Aprovado','Aprovados'], ['Bloqueado','Bloqueados'], ['Inativo','Inativos'], ['Recusado','Recusados']];
const GU_LINK_BASE = 'https://cdaniel09917-design.github.io/sge/cadastro';
const GU = { lista: null, filtro: 'Todos', busca: '', sub: 'usuarios', catalogo: null, acessos: null, linkCong: '' };
const guApi = (action, payload) => api(action, payload, sessao()?.token);
const guBadge = st => { const m = GU_STATUS[cf(st)] || { rot: st || '-', cor: '#64748b', ico: 'fa-circle' };
  return `<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider" style="color:${m.cor};background:${m.cor}1c;border:1px solid ${m.cor}55"><i class="fa-solid ${m.ico} mr-0.5"></i>${m.rot}</span>`; };
const guFmtData = v => { const s = String(v || '').trim(); if (!s) return '-'; const d = new Date(s); return isNaN(d) ? s.slice(0, 10) : d.toLocaleDateString('pt-BR'); };

/* ---------- Aba Dispositivos (concorrência — paridade com o desktop) ---------- */
async function renderAbaDispositivos(){
  const corpo = el('gestao-corpo');
  corpo.innerHTML = `<div class="flex items-center justify-center gap-2.5 py-14 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando aparelhos…</div>`;
  try {
    const res = await guApi('listar_dispositivos_admin', {});
    GU.disp = res.dados || [];
  } catch (e) {
    corpo.innerHTML = `<div class="text-center py-10 text-xs" style="color:var(--color-danger)">${esc(e.message || 'Falha ao listar aparelhos.')}</div>`;
    return;
  }
  const cfg = { online: ['#10b981', 'Online'], ausente: ['#f59e0b', 'Ausente'], offline: ['#64748b', 'Desconectado'] };
  const fmtHb = s => { const d = new Date(String(s || '')); return isNaN(d) ? (s || '-') : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  const on = (GU.disp || []).filter(d => d.status === 'online').length;
  corpo.innerHTML = `
    <div class="space-y-2">
      <div class="flex items-center gap-2 mb-1">
        <p class="text-[11px] font-bold flex-1">${on} online agora • ${GU.disp.length} aparelho(s) conhecidos</p>
        <button onclick="renderAbaDispositivos()" class="px-3 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer" style="border-color:var(--border-color);color:var(--text-main)"><i class="fa-solid fa-rotate mr-1"></i>Atualizar</button>
      </div>
      ${GU.disp.map(d => {
        const [cor, rot] = cfg[d.status] || cfg.offline;
        const ehPwa = String(d.machine_id || '').startsWith('pwa-');
        const nome = d.nome_dispositivo || d.hostname || 'Aparelho';
        return `<div class="border rounded-2xl p-3 flex items-center gap-3 cursor-pointer" style="border-color:var(--border-color);background:var(--bg-card)" onclick="guRenomearDisp('${esc(d.machine_id)}')">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:${cor}1c"><i class="fa-solid ${ehPwa ? 'fa-mobile-screen' : 'fa-desktop'}" style="color:${cor}"></i></div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-bold truncate">${esc(nome)}</p>
            <p class="text-[9px] opacity-60 truncate">${esc(d.usuario_logado || '-')} • ${esc(d.perfil || '')} • ${esc(d.modulo_ativo || 'SGE')}</p>
            <p class="text-[9px] opacity-40 truncate font-mono">${esc(String(d.machine_id || '').slice(0, 18))}… · ${fmtHb(d.ultimo_heartbeat)}</p>
          </div>
          <span class="text-[9px] font-bold shrink-0" style="color:${cor}"><i class="fa-solid fa-circle text-[6px] mr-1"></i>${rot}</span>
        </div>`;
      }).join('') || '<div class="text-center py-10 text-xs opacity-50">Nenhum aparelho registrado ainda.</div>'}
      <p class="text-[9px] opacity-40 text-center pt-1">Toque num aparelho para dar um nome amigável a ele.</p>
    </div>`;
}
window.guRenomearDisp = async function(machineId){
  const atual = (GU.disp || []).find(d => d.machine_id === machineId);
  const nome = prompt('Nome do aparelho (ex.: Celular do Pastor):', atual?.nome_dispositivo || atual?.hostname || '');
  if (nome === null) return;
  try {
    const res = await guApi('renomear_dispositivo_admin', { machine_id: machineId, nome: nome.trim() });
    toast(res.mensagem || 'Aparelho renomeado.');
    renderAbaDispositivos();
  } catch (e) { toast(e.message || 'Falha ao renomear.'); }
};

function renderAbaUsuarios(){
  const corpo = el('gestao-corpo');
  corpo.innerHTML = `
    <div class="flex gap-1.5 mb-3">
      <button onclick="guSub('usuarios')" id="gu-tab-usuarios" class="flex-1 py-2 rounded-xl text-[11px] font-bold border cursor-pointer"><i class="fa-solid fa-users-gear mr-1.5"></i>Usuários</button>
      <button onclick="guSub('link')" id="gu-tab-link" class="flex-1 py-2 rounded-xl text-[11px] font-bold border cursor-pointer"><i class="fa-solid fa-link mr-1.5"></i>Link de cadastro</button>
    </div>
    <div id="gu-corpo"><div class="flex items-center justify-center gap-2.5 py-14 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando…</div></div>`;
  guSub(GU.sub);
}

window.guSub = function(sub){
  GU.sub = sub;
  ['usuarios','link'].forEach(s => { const b = el(`gu-tab-${s}`); if (!b) return;
    const on = s === sub;
    b.style.background = on ? 'rgba(244,63,94,.12)' : 'var(--bg-card)';
    b.style.borderColor = on ? '#f43f5e' : 'var(--border-color)';
    b.style.color = on ? '#f43f5e' : 'var(--text-muted)';
  });
  if (sub === 'link') return guRenderLink();
  if (GU.lista) return guRenderLista();
  guCarregar();
};

async function guCarregar(){
  const corpo = el('gu-corpo'); if (!corpo) return;
  corpo.innerHTML = `<div class="flex items-center justify-center gap-2.5 py-14 text-xs" style="color:var(--text-muted)"><div class="spin"></div>Carregando usuários…</div>`;
  try {
    const res = await guApi('listar_usuarios_admin', {});
    GU.lista = res.dados || [];
    guRenderLista();
  } catch (e) {
    corpo.innerHTML = `<div class="border rounded-2xl p-5 text-center" style="border-color:var(--border-color);background:var(--bg-card)">
      <i class="fa-solid fa-triangle-exclamation text-amber-500 text-xl"></i>
      <p class="text-xs mt-2 opacity-75">${esc(e.message || 'Falha ao carregar usuários.')}</p>
      <button onclick="guCarregar()" class="mt-3 px-4 py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer" style="background:#f43f5e">Tentar novamente</button></div>`;
  }
}
window.guCarregar = guCarregar;

function guRenderLista(){
  const corpo = el('gu-corpo'); if (!corpo) return;
  const lista = GU.lista || [];
  const conta = k => lista.filter(u => cf(u.status) === k).length;
  const kpis = `
    <div class="grid grid-cols-4 gap-2 mb-3">
      ${[['Aguardando', conta('email_confirmado'), '#38bdf8'], ['Pendentes', conta('pendente'), '#f59e0b'],
         ['Aprovados', conta('aprovado'), '#10b981'], ['Bloq./Inat.', conta('bloqueado') + conta('inativo') + conta('recusado'), '#ef4444']]
        .map(([r, v, c]) => `<div class="border rounded-xl p-2 text-center" style="background:var(--bg-card);border-color:var(--border-color)">
          <p class="text-[9px] font-bold uppercase opacity-60">${r}</p><p class="text-base font-black tabular-nums" style="color:${c}">${v}</p></div>`).join('')}
    </div>`;
  const chips = `<div class="flex gap-1.5 overflow-x-auto pb-1.5 -mx-1 px-1" style="scrollbar-width:none">
    ${GU_FILTROS.map(([v, t]) => `<button onclick="guFiltro('${v}')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer" style="border-color:${GU.filtro === v ? '#f43f5e' : 'var(--border-color)'};background:${GU.filtro === v ? 'rgba(244,63,94,.12)' : 'var(--bg-card)'};color:${GU.filtro === v ? '#f43f5e' : 'var(--text-muted)'}">${t}</button>`).join('')}
  </div>`;
  const busca = `<div class="flex gap-2 mb-2.5">
    <div class="flex-1 flex items-center gap-2 px-3 rounded-xl border" style="background:var(--bg-input);border-color:var(--border-color)">
      <i class="fa-solid fa-magnifying-glass text-[11px] opacity-50"></i>
      <input id="gu-busca" value="${esc(GU.busca)}" oninput="guBuscar()" placeholder="Nome, CPF, e-mail…" class="flex-1 bg-transparent py-2 text-xs outline-none" style="color:var(--text-main)">
    </div>
    <button onclick="guCarregar()" class="px-3 rounded-xl border cursor-pointer" style="border-color:var(--border-color);color:var(--text-muted)" title="Atualizar"><i class="fa-solid fa-rotate text-xs"></i></button>
  </div>`;

  const q = cf(GU.busca);
  const visiveis = lista.filter(u => {
    if (GU.filtro !== 'Todos' && cf(u.status) !== cf(GU.filtro)) return false;
    return !q || cf(`${u.cpf} ${u.nome} ${u.email} ${u.telefone}`).includes(q);
  });
  const cards = visiveis.length ? visiveis.map(u => `
    <button onclick="guAbrir('${u.cpf}')" class="w-full text-left border rounded-2xl p-3 cursor-pointer" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-black text-xs" style="background:${(GU_STATUS[cf(u.status)] || {}).cor || '#64748b'}1c;color:${(GU_STATUS[cf(u.status)] || {}).cor || '#64748b'}">${esc((u.nome || '?').trim().charAt(0).toUpperCase())}</div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold truncate">${esc(u.nome)}${u.tesoureiro ? ' <i class="fa-solid fa-coins text-[9px] text-amber-500" title="Tesoureiro"></i>' : ''}</p>
          <p class="text-[10px] opacity-60 font-mono">${esc(u.cpf)}</p>
          <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">${guBadge(u.status)}<span class="text-[9px] font-bold uppercase tracking-wider opacity-55">${esc(u.perfil || 'Consultor')}</span></div>
        </div>
        <i class="fa-solid fa-chevron-right text-[10px] opacity-40 mt-3"></i>
      </div>
    </button>`).join('')
    : `<div class="border rounded-2xl p-8 text-center text-xs opacity-60" style="border-color:var(--border-color)">Nenhum usuário neste filtro.</div>`;

  corpo.innerHTML = kpis + chips + busca + `<div class="space-y-2">${cards}</div>
    <p class="text-[9px] opacity-45 text-center pt-2">Toque no usuário para aprovar, bloquear, configurar acessos ou redefinir senha.</p>`;
}

window.guFiltro = v => { GU.filtro = v; guRenderLista(); };
window.guBuscar = () => { GU.busca = el('gu-busca')?.value || ''; guRenderLista(); setTimeout(() => { const i = el('gu-busca'); if (i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); };

/* ---------- Detalhe / ações do usuário ---------- */
window.guAbrir = function(cpf){
  const u = (GU.lista || []).find(x => x.cpf === cpf); if (!u) return;
  const st = cf(u.status);
  const linhaInfo = (rot, val) => `<div class="flex justify-between gap-3 py-1.5 border-b" style="border-color:var(--border-color)"><span class="text-[10px] uppercase font-bold opacity-55">${rot}</span><span class="text-[11px] font-semibold text-right">${esc(val || '-')}</span></div>`;
  const podeAprovar = st === 'email_confirmado', podeRecusar = st === 'email_confirmado' || st === 'pendente';
  const podeBloquear = st === 'aprovado', podeReativar = st === 'bloqueado' || st === 'inativo';
  const podeReenviar = st === 'pendente';
  const acaoBtn = (onclick, rot, ico, cor) => `<button onclick="${onclick}" class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold text-white cursor-pointer" style="background:${cor}"><i class="fa-solid ${ico}"></i>${rot}</button>`;
  const acaoBtnSec = (onclick, rot, ico, cor) => `<button onclick="${onclick}" class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold cursor-pointer border" style="border-color:${cor}66;color:${cor};background:${cor}14"><i class="fa-solid ${ico}"></i>${rot}</button>`;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="gu-sheet" class="fixed inset-0 z-[95] flex items-end justify-center" style="background:rgba(0,0,0,.55)" onclick="if(event.target===this)guFechar()">
      <div class="w-full max-w-lg rounded-t-3xl p-4 max-h-[92dvh] flex flex-col" style="background:var(--bg-card)">
        <div class="overflow-y-auto flex-1 pb-6">
        <div class="w-10 h-1 rounded-full mx-auto mb-3" style="background:var(--border-color)"></div>
        <div class="flex items-center gap-3 mb-3">
          <div class="w-11 h-11 rounded-full flex items-center justify-center font-black" style="background:${(GU_STATUS[st] || {}).cor || '#64748b'}1c;color:${(GU_STATUS[st] || {}).cor || '#64748b'}">${esc((u.nome || '?').charAt(0).toUpperCase())}</div>
          <div class="flex-1 min-w-0"><p class="font-bold text-sm truncate">${esc(u.nome)}</p><div class="mt-1">${guBadge(u.status)}</div></div>
          <button onclick="guFechar()" class="w-8 h-8 rounded-full border cursor-pointer" style="border-color:var(--border-color);color:var(--text-muted)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="border rounded-xl px-3 mb-3" style="border-color:var(--border-color)">
          ${linhaInfo('CPF', u.cpf)}${linhaInfo('E-mail', u.email)}${linhaInfo('Telefone', u.telefone)}
          ${linhaInfo('Perfil', u.perfil || 'Consultor')}${linhaInfo('Cadastro', guFmtData(u.criado))}
          ${u.aprovado_em ? linhaInfo(`Decisão (${u.aprovado_por || 'admin'})`, guFmtData(u.aprovado_em)) : ''}
          ${u.motivo ? linhaInfo('Motivo', u.motivo) : ''}
          ${linhaInfo('Abrangência', u.resumo_acessos)}
          ${u.tesoureiro ? linhaInfo('Tesoureiro de', u.congregacao_tesoureiro || 'sim') : ''}
        </div>
        ${podeAprovar ? `<div class="rounded-xl p-3 mb-3 border" style="background:rgba(5,150,105,.08);border-color:rgba(5,150,105,.35)">
          <p class="text-[10px] opacity-70 mb-2">Defina hierarquia, escopo e módulos — a <b>aprovação é o último passo</b>, para o usuário já nascer com o acesso certo.</p>
          <button onclick="guAcessos('${u.cpf}',true)" class="w-full py-2.5 rounded-xl text-[11px] font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,#059669,#10b981)"><i class="fa-solid fa-user-check mr-1"></i>Configurar acessos e aprovar</button>
        </div>` : ''}
        <div class="grid grid-cols-2 gap-2">
          ${podeReativar ? acaoBtn(`guStatus('${u.cpf}','Aprovado')`, 'Reativar', 'fa-rotate-left', '#059669') : ''}
          ${podeRecusar ? acaoBtnSec(`guStatus('${u.cpf}','Recusado')`, 'Recusar', 'fa-xmark', '#f43f5e') : ''}
          ${podeBloquear ? acaoBtnSec(`guStatus('${u.cpf}','Bloqueado')`, 'Bloquear', 'fa-ban', '#ef4444') : ''}
          ${podeBloquear ? acaoBtnSec(`guStatus('${u.cpf}','Inativo')`, 'Inativar', 'fa-circle-pause', '#94a3b8') : ''}
          ${podeReenviar ? acaoBtnSec(`guReenviar('${u.cpf}')`, 'Reenviar código', 'fa-envelope', '#38bdf8') : ''}
          ${acaoBtnSec(`guAcessos('${u.cpf}')`, 'Acessos & escopo', 'fa-shield-halved', '#8b5cf6')}
          ${acaoBtnSec(`guSenha('${u.cpf}')`, 'Redefinir senha', 'fa-key', '#f59e0b')}
        </div>
        </div>
      </div>
    </div>`);
};
window.guFechar = () => el('gu-sheet')?.remove();

window.guStatus = async function(cpf, status){
  const u = (GU.lista || []).find(x => x.cpf === cpf);
  let motivo = '', perfil = el('gu-perfil')?.value || '';
  if (status === 'Recusado' || status === 'Bloqueado' || status === 'Inativo'){
    const resp = prompt(`Motivo para marcar ${u?.nome || cpf} como ${status}:`);
    if (resp === null) return;
    motivo = resp;
  } else if (!confirm(`${status === 'Aprovado' && cf(u?.status) === 'email_confirmado' ? 'Aprovar' : 'Reativar'} o cadastro de ${u?.nome || cpf}?`)) return;
  try {
    const res = await guApi('alterar_status_usuario', { cpf, status, perfil, motivo });
    toast(res.mensagem || 'Status atualizado.');
    guFechar(); guCarregar();
  } catch (e) { toast(e.message || 'Falha ao alterar status.'); }
};

window.guReenviar = async function(cpf){
  try {
    const res = await api('reenviar_codigo_cadastro', { cpf });
    toast(res.mensagem || 'Código reenviado.');
  } catch (e) { toast(e.message || 'Falha ao reenviar.'); }
};

window.guSenha = async function(cpf){
  const u = (GU.lista || []).find(x => x.cpf === cpf);
  const senha = prompt(`Nova senha para ${u?.nome || cpf} (mín. 6 caracteres):`);
  if (senha === null) return;
  if (senha.trim().length < 6) return toast('Senha muito curta (mín. 6).');
  try {
    const res = await guApi('redefinir_senha_admin', { cpf, nova_senha: senha.trim() });
    toast(res.mensagem || 'Senha redefinida.');
  } catch (e) { toast(e.message || 'Falha ao redefinir senha.'); }
};

/* ---------- Sheet de acessos & escopo ---------- */
window.guAcessos = async function(cpf, aprovar){
  try {
    if (!GU.catalogo) GU.catalogo = await guApi('catalogo_acessos_admin', {});
    GU.acessos = await guApi('obter_acessos_admin', { cpf });
    GU.acessos.cpf = cpf;
    GU.aprovar = !!aprovar;
    GU.selCongs = new Set(GU.acessos.congregacoes || []);
    GU.selMods = new Set((GU.acessos.permissoes || []).map(p => p.modulo));
    GU.selDev = new Set(GU.acessos.dispositivos || []);
    GU.matriz = {};
    (GU.acessos.permissoes || []).forEach(p => {
      if (p.aba === '*') return;
      const mm = GU.matriz[p.modulo] = GU.matriz[p.modulo] || {};
      mm[p.aba] = (mm[p.aba] || new Set()).add(p.acao);
    });
  } catch (e) { return toast(e.message || 'Falha ao carregar acessos.'); }
  const a = GU.acessos, cat = GU.catalogo;
  const chip = (grupo, val, marcado) => `<button type="button" onclick="guToggle(this)" data-grupo="${grupo}" data-valor="${esc(val)}" data-on="${marcado ? 1 : 0}" class="gu-chip px-2.5 py-2 rounded-lg text-[10px] font-bold border cursor-pointer" style="border-color:${marcado ? '#8b5cf6' : 'var(--border-color)'};background:${marcado ? 'rgba(139,92,246,.15)' : 'var(--bg-card)'};color:${marcado ? '#a78bfa' : 'var(--text-muted)'}"><i class="fa-solid fa-check mr-1 gu-chip-ck${marcado ? '' : ' hidden'}"></i>${esc(val)}</button>`;
  const secao = (rot, hint, inner) => `<div class="border rounded-xl p-3" style="border-color:var(--border-color)">
    <p class="text-[10px] font-bold uppercase opacity-60 mb-0.5">${rot}</p>
    <p class="text-[9px] opacity-50 mb-2">${hint}</p>${inner}</div>`;
  guFechar();
  document.body.insertAdjacentHTML('beforeend', `
    <div id="gu-sheet" class="fixed inset-0 z-[95] flex items-end justify-center" style="background:rgba(0,0,0,.55)" onclick="if(event.target===this)guFechar()">
      <div class="w-full max-w-lg rounded-t-3xl p-4 max-h-[92dvh] flex flex-col" style="background:var(--bg-card)">
        <div class="overflow-y-auto flex-1 pb-2">
        <div class="w-10 h-1 rounded-full mx-auto mb-3" style="background:var(--border-color)"></div>
        <div class="flex items-center gap-2 mb-1">
          <i class="fa-solid ${GU.aprovar ? 'fa-user-check text-emerald-400' : 'fa-shield-halved text-violet-400'}"></i>
          <p class="font-bold text-sm flex-1">${GU.aprovar ? 'Aprovar ' : 'Acessos de '}${esc(a.nome || cpf)}</p>
          <button onclick="guFechar()" class="w-8 h-8 rounded-full border cursor-pointer" style="border-color:var(--border-color);color:var(--text-muted)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="text-[10px] opacity-60 mb-3">${GU.aprovar ? 'Defina hierarquia e escopo — o usuário só é aprovado ao tocar em Gravar no fim.' : 'Toque nos itens para marcar/desmarcar o que este usuário pode ver e operar.'}</p>
        <div class="space-y-3">
          ${secao('Papel (hierarquia)', 'Consultor lê • Operador lança/edita • Administrador tem acesso total',
            `<select id="gu-ac-papel" class="w-full px-3 py-2.5 rounded-xl border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
              ${['Consultor','Operador','Administrador'].map(p => `<option value="${p}" ${a.perfil === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>`)}
          ${secao('Tesouraria', 'Se marcado, o usuário lança o Relatório de Caixa da congregação fixa',
            `<label class="flex items-center gap-2 text-xs font-bold cursor-pointer"><input type="checkbox" id="gu-ac-tes" ${a.tesoureiro ? 'checked' : ''} onchange="guTesoureiro()" class="w-4 h-4 accent-amber-500"> É tesoureiro (Relatório de Caixa)</label>
            <div id="gu-ac-tes-cong" class="mt-2 ${a.tesoureiro ? '' : 'hidden'}">
              <select id="gu-ac-tes-sel" class="w-full px-3 py-2.5 rounded-xl border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
                <option value="">— selecione a congregação —</option>
                ${[...new Set((cat.congregacoes || []).map(c => c.conselho || 'Sem conselho'))].sort().map(g =>
                  `<optgroup label="${esc(g)}">${(cat.congregacoes || []).filter(c => (c.conselho || 'Sem conselho') === g).map(c => `<option value="${esc(c.nome)}" ${c.nome === a.congregacao_tesoureiro ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>`
                ).join('')}
              </select></div>`)}
          ${secao('Conselhos visíveis', 'Nada marcado = todos • marque para limitar e filtrar as congregações',
            `<div class="flex flex-wrap gap-1.5">${(cat.conselhos || []).map(c => chip('conselhos', c, a.conselhos.includes(c))).join('') || '<span class="text-[10px] opacity-50">Nenhum conselho cadastrado</span>'}</div>`)}
          ${secao('Congregações visíveis', 'Nada marcado = todas • marque conselhos acima para filtrar',
            `<div id="gu-congs-box"></div><p id="gu-congs-count" class="text-[9px] opacity-40 mt-1.5"></p>`)}
          ${secao('Módulos liberados', 'Nada marcado = acesso legado (todos os módulos)',
            `<div class="flex flex-wrap gap-1.5 mb-2">${(cat.modulos || []).map(m => chip('modulos', m.id, GU.selMods.has(m.id))).join('')}</div>
             <p class="text-[9px] opacity-50 mb-1.5">Por aba: <b>Ver</b>/<b>Operar</b> • aba sem marcação fica oculta • módulo sem aba marcada libera todas</p>
             <div id="gu-matriz-box"></div>`)}
          ${secao('Aparelhos autorizados', 'Vazio = entra de qualquer aparelho • com itens, o login só funciona nos listados',
            `<div id="gu-devs-box" class="flex flex-wrap gap-1.5 mb-2"></div>
             <div class="flex gap-1.5">
               <input id="gu-dev-add" placeholder="ID do aparelho (aparece no menu ⚙ do aparelho)" class="flex-1 px-3 py-2 rounded-xl border text-[10px]" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
               <button type="button" onclick="guAddDev()" class="px-3 py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer" style="background:#0ea5e9"><i class="fa-solid fa-plus"></i></button>
             </div>`)}
        </div>
        </div>
        <div class="pt-3 pb-2" style="border-top:1px solid var(--border-color)">
          <button onclick="guSalvarAcessos('${cpf}')" class="w-full py-3 rounded-xl text-xs font-bold text-white cursor-pointer" style="background:linear-gradient(135deg,${GU.aprovar ? '#059669,#10b981' : '#7c3aed,#8b5cf6'})"><i class="fa-solid ${GU.aprovar ? 'fa-user-check' : 'fa-floppy-disk'} mr-1.5"></i>${GU.aprovar ? 'Gravar e aprovar usuário' : 'Gravar acessos'}</button>
        </div>
      </div>
    </div>`);
  guRenderCongs();
  guRenderMatriz();
  guRenderDevs();
};
window.guToggle = btn => {
  const on = btn.dataset.on !== '1';
  btn.dataset.on = on ? '1' : '0';
  btn.style.borderColor = on ? '#8b5cf6' : 'var(--border-color)';
  btn.style.background = on ? 'rgba(139,92,246,.15)' : 'var(--bg-card)';
  btn.style.color = on ? '#a78bfa' : 'var(--text-muted)';
  btn.querySelector('.gu-chip-ck')?.classList.toggle('hidden', !on);
  if (btn.dataset.grupo === 'congregacoes') {
    on ? GU.selCongs?.add(btn.dataset.valor) : GU.selCongs?.delete(btn.dataset.valor);
  }
  if (btn.dataset.grupo === 'conselhos') guRenderCongs();
  if (btn.dataset.grupo === 'modulos') {
    on ? GU.selMods?.add(btn.dataset.valor) : (GU.selMods?.delete(btn.dataset.valor), delete (GU.matriz || {})[btn.dataset.valor]);
    guRenderMatriz();
  }
};
/* Matriz granular por módulo: abas/sub-abas × ações (paridade com o wizard desktop) */
window.guRenderMatriz = () => {
  const box = el('gu-matriz-box'); if (!box || !GU.catalogo) return;
  const acoes = GU.catalogo.acoes || [{ id: 'ver', rotulo: 'Ver' }, { id: 'operar', rotulo: 'Operar' }];
  const pill = (mod, aba, ac) => {
    const on = !!(GU.matriz?.[mod]?.[aba]?.has(ac.id));
    return `<button type="button" onclick="guMatrizTog('${mod}','${aba}','${ac.id}')" class="px-2 py-1 rounded-md text-[9px] font-bold border cursor-pointer" style="border-color:${on ? '#8b5cf6' : 'var(--border-color)'};background:${on ? 'rgba(139,92,246,.15)' : 'var(--bg-card)'};color:${on ? '#a78bfa' : 'var(--text-muted)'}">${ac.id === 'ver' ? 'Ver' : 'Operar'}</button>`;
  };
  const linha = (mod, abaId, rotulo, sub) => `<div class="flex items-center justify-between gap-2 py-1${sub ? ' pl-3 ml-1 border-l-2' : ''}"${sub ? ' style="border-color:var(--border-color)"' : ''}>
    <span class="text-[10px] font-semibold">${sub ? '<i class="fa-solid fa-turn-down fa-rotate-90 mr-1 opacity-40"></i>' : ''}${esc(rotulo)}</span>
    <span class="flex gap-1 shrink-0">${acoes.map(ac => pill(mod, abaId, ac)).join('')}</span></div>`;
  const mods = (GU.catalogo.modulos || []).filter(m => GU.selMods?.has(m.id));
  box.innerHTML = mods.map(m => `
    <div class="mb-2.5"><p class="text-[9px] font-black uppercase tracking-wide mb-1" style="color:#8b5cf6">${esc(m.rotulo)}</p>
    ${(m.abas || []).length
      ? (m.abas || []).map(a => linha(m.id, a.id, a.rotulo, false) + (a.subabas || []).map(s => linha(m.id, s.id, s.rotulo, true)).join('')).join('')
      : '<p class="text-[9px] opacity-40 py-0.5">Acesso integral às abas</p>'}</div>`
  ).join('') || '<span class="text-[10px] opacity-50">Marque módulos acima para configurar as abas.</span>';
};
window.guMatrizTog = (mod, aba, ac) => {
  GU.matriz = GU.matriz || {};
  const m = GU.matriz[mod] = GU.matriz[mod] || {};
  const s = m[aba] = m[aba] || new Set();
  s.has(ac) ? s.delete(ac) : s.add(ac);
  if (!s.size) delete m[aba];
  guRenderMatriz();
};
/* Congregações filtradas pelos conselhos marcados (seleção persistida em GU.selCongs) */
window.guRenderCongs = () => {
  const box = el('gu-congs-box'); if (!box || !GU.catalogo) return;
  const cons = new Set([...document.querySelectorAll('.gu-chip[data-grupo="conselhos"][data-on="1"]')].map(b => b.dataset.valor));
  const lista = (GU.catalogo.congregacoes || []).filter(c => !cons.size || cons.has(c.conselho));
  const chipCong = c => {
    const on = GU.selCongs?.has(c.nome);
    return `<button type="button" onclick="guToggle(this)" data-grupo="congregacoes" data-valor="${esc(c.nome)}" data-on="${on ? 1 : 0}" class="gu-chip px-2.5 py-2 rounded-lg text-[10px] font-bold border cursor-pointer" style="border-color:${on ? '#8b5cf6' : 'var(--border-color)'};background:${on ? 'rgba(139,92,246,.15)' : 'var(--bg-card)'};color:${on ? '#a78bfa' : 'var(--text-muted)'}"><i class="fa-solid fa-check mr-1 gu-chip-ck${on ? '' : ' hidden'}"></i>${esc(c.nome)}</button>`;
  };
  const grupos = {};
  lista.forEach(c => { const g = c.conselho || 'Sem conselho'; (grupos[g] = grupos[g] || []).push(c); });
  box.innerHTML = Object.keys(grupos).sort((x, y) => x === 'Sem conselho' ? 1 : y === 'Sem conselho' ? -1 : x.localeCompare(y)).map(g =>
    `<div class="mb-2.5"><p class="text-[9px] font-black uppercase tracking-wide mb-1" style="color:#8b5cf6">${esc(g)}</p><div class="flex flex-wrap gap-1.5">${grupos[g].map(chipCong).join('')}</div></div>`
  ).join('') || '<span class="text-[10px] opacity-50">Nenhuma congregação nesse conselho.</span>';
  const cnt = el('gu-congs-count');
  if (cnt) cnt.textContent = `${lista.length} congregações${cons.size ? ' (filtradas por conselho)' : ''}`;
};
window.guTesoureiro = () => el('gu-ac-tes-cong')?.classList.toggle('hidden', !el('gu-ac-tes')?.checked);
/* Aparelhos autorizados (whitelist de device_ids por usuário) */
window.guRenderDevs = () => {
  const box = el('gu-devs-box'); if (!box) return;
  box.innerHTML = [...(GU.selDev || [])].map(d =>
    `<button type="button" onclick="guDelDev('${esc(d)}')" title="Toque para remover • ${esc(d)}" class="px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold border cursor-pointer" style="border-color:#38bdf855;background:rgba(56,189,248,.1);color:#7dd3fc"><i class="fa-solid fa-mobile-screen mr-1"></i>${esc(d.slice(0, 14))}… <i class="fa-solid fa-xmark ml-1 opacity-60"></i></button>`
  ).join('') || '<span class="text-[10px] opacity-50">Livre — entra de qualquer aparelho.</span>';
};
window.guAddDev = () => {
  const inp = el('gu-dev-add'); const v = (inp?.value || '').trim();
  if (!v) return;
  GU.selDev = GU.selDev || new Set();
  GU.selDev.add(v); inp.value = ''; guRenderDevs();
};
window.guDelDev = d => { GU.selDev?.delete(d); guRenderDevs(); };
window.guSalvarAcessos = async function(cpf){
  const marcados = g => [...document.querySelectorAll(`.gu-chip[data-grupo="${g}"][data-on="1"]`)].map(b => b.dataset.valor);
  const tes = !!el('gu-ac-tes')?.checked;
  const papel = el('gu-ac-papel')?.value || 'Consultor';
  // Paridade com o wizard desktop: linha-marcador (mod,'*','*') + linhas granulares
  // + aba-pai 'ver' automática quando uma sub-aba ('dizimistas.x') está marcada.
  const permissoes = [];
  [...(GU.selMods || [])].forEach(mod => {
    permissoes.push({ modulo: mod, aba: '*', acao: '*' });
    Object.entries(GU.matriz?.[mod] || {}).forEach(([aba, acs]) =>
      [...acs].forEach(ac => permissoes.push({ modulo: mod, aba, acao: ac })));
    const emitidas = new Set(permissoes.filter(p => p.modulo === mod).map(p => p.aba));
    permissoes.filter(p => p.modulo === mod && p.aba.includes('.')).forEach(p => {
      const pai = p.aba.split('.')[0];
      if (!emitidas.has(pai)) { permissoes.push({ modulo: mod, aba: pai, acao: 'ver' }); emitidas.add(pai); }
    });
  });
  try {
    const res = await guApi('salvar_acessos_admin', {
      cpf, papel,
      conselhos: marcados('conselhos'), congregacoes: [...(GU.selCongs || [])],
      permissoes,
      dispositivos: [...(GU.selDev || [])],
      tesoureiro: tes, congregacao_tesoureiro: tes ? (el('gu-ac-tes-sel')?.value || '') : '',
    });
    if (GU.aprovar) {
      const r2 = await guApi('alterar_status_usuario', { cpf, status: 'Aprovado', perfil: papel, motivo: '' });
      toast(r2.mensagem || 'Usuário aprovado com acessos definidos.');
    } else {
      toast(res.mensagem || 'Acessos gravados.');
    }
    GU.aprovar = false;
    guFechar(); guCarregar();
  } catch (e) { toast(e.message || 'Falha ao gravar acessos.'); }
};

/* ---------- Gerador de link de cadastro ---------- */
async function guRenderLink(){
  const corpo = el('gu-corpo'); if (!corpo) return;
  try { if (!GU.catalogo) GU.catalogo = await guApi('catalogo_acessos_admin', {}); }
  catch (e) { corpo.innerHTML = `<p class="text-xs text-center opacity-60 py-10">${esc(e.message)}</p>`; return; }
  const congs = (GU.catalogo.congregacoes || []).map(c => c.nome);
  corpo.innerHTML = `
    <div class="border rounded-2xl p-4 space-y-3" style="background:var(--bg-card);border-color:var(--border-color)">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:rgba(56,189,248,.12)"><i class="fa-solid fa-link text-sky-400"></i></div>
        <div><p class="text-xs font-bold">Link de cadastro externo</p><p class="text-[10px] opacity-60">Envie pelo WhatsApp — a pessoa se cadastra e você aprova aqui.</p></div>
      </div>
      <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Congregação de origem (opcional)</span>
        <select id="gu-link-cong" onchange="guLinkMuda()" class="w-full px-3 py-2.5 rounded-xl border text-xs" style="background:var(--bg-input);border-color:var(--border-color);color:var(--text-main)">
          <option value="">— Link genérico (sem congregação) —</option>
          ${congs.map(c => `<option value="${esc(c)}" ${c === GU.linkCong ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select></div>
      <div><span class="text-[10px] font-bold uppercase opacity-60 block mb-1">Link gerado</span>
        <input id="gu-link-txt" readonly value="${esc(GU_LINK_BASE)}" class="w-full px-3 py-2.5 rounded-xl border text-[11px] font-mono" style="background:var(--bg-input);border-color:var(--border-color);color:#38bdf8"></div>
      <div class="grid grid-cols-3 gap-2">
        <button onclick="guLinkCopiar()" class="py-2.5 rounded-xl text-[11px] font-bold text-white cursor-pointer" style="background:#7c3aed"><i class="fa-solid fa-copy mr-1"></i>Copiar</button>
        <button onclick="guLinkWhats()" class="py-2.5 rounded-xl text-[11px] font-bold text-white cursor-pointer" style="background:#059669"><i class="fa-brands fa-whatsapp mr-1"></i>WhatsApp</button>
        <button onclick="window.open(el('gu-link-txt').value,'_blank')" class="py-2.5 rounded-xl text-[11px] font-bold border cursor-pointer" style="border-color:var(--border-color);color:var(--text-muted)"><i class="fa-solid fa-arrow-up-right-from-square mr-1"></i>Abrir</button>
      </div>
      <p class="text-[9px] opacity-45 leading-relaxed">O link genérico cadastra sem congregação de origem. Com congregação, o cadastro já nasce vinculado a ela.</p>
    </div>`;
  guLinkMuda();
}
window.guLinkMuda = () => {
  GU.linkCong = el('gu-link-cong')?.value || '';
  const txt = el('gu-link-txt'); if (txt) txt.value = GU_LINK_BASE + (GU.linkCong ? `?c=${encodeURIComponent(GU.linkCong)}` : '');
};
window.guLinkCopiar = async () => {
  const v = el('gu-link-txt')?.value || GU_LINK_BASE;
  try { await navigator.clipboard.writeText(v); toast('Link copiado!'); }
  catch { const i = el('gu-link-txt'); i?.select(); document.execCommand('copy'); toast('Link copiado!'); }
};
window.guLinkWhats = () => {
  const v = el('gu-link-txt')?.value || GU_LINK_BASE;
  window.open(`https://wa.me/?text=${encodeURIComponent('Cadastre-se no SGE AD Brasil pelo link: ' + v)}`, '_blank');
};

/* API de depuração/testes */
window.SGEG = { consultarCruzamento, resumoMes, analisarMes, calcularFluxo, carregarMovimento,
  listarPeriodos, mapaConselhos, obterCiclo, salvarCiclo, listarDespesas, adicionarDespesa,
  atualizarDespesa, removerDespesa, alternarQuitacao, mediaReferencia, G };

})();
