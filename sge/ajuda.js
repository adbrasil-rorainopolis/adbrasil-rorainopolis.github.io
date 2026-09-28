/* ===================== Central de Ajuda — "Como usar" por escopo =====================
   FAQ contextual: cada módulo/aba tem um bloco de perguntas e respostas.
   Itens com `se` só aparecem quando a condição é verdadeira no momento da
   abertura — assim o conteúdo se molda ao perfil e às permissões do usuário. */
(function(){

const _adm = () => (typeof sgeEhAdmin === 'function') && sgeEhAdmin();
const _tes = () => (typeof sgeTesoureiro === 'function') && sgeTesoureiro();
const _finAba = t => (typeof finAbaPermitida === 'function') && finAbaPermitida(t);
const _aba = (m, a) => (typeof sgeAbaPermitida === 'function') && sgeAbaPermitida(m, a);
const _mod = m => (typeof sgeModuloPermitido === 'function') && sgeModuloPermitido(m);
const _edita = () => (typeof semPodeEditar === 'function') && semPodeEditar();
const _piloto = () => { try { return typeof _memEhPiloto === 'function' && _memEhPiloto(); } catch(e){ return false; } };
const _membro = () => (typeof sgeModoAtual === 'function') && sgeModoAtual() === 'membro';

const SGE_AJUDA = {

  /* ---------------- Panorama ---------------- */
  dashboard: {
    t: 'Panorama Geral', ico: 'fa-house-chimney', cor: 'var(--color-primary)',
    intro: 'Tela inicial do aplicativo. Reúne a saudação, o versículo do momento e os resumos liberados para o seu perfil. Os cartões exibidos obedecem à matriz de permissões — nem todo perfil vê todos.',
    grupos: [
      { titulo: 'O que aparece aqui', itens: [
        { q: 'Versículo do momento', a: 'Uma passagem bíblica exibida no topo, que alterna automaticamente ao longo do dia.' },
        { q: 'Cartão Congregações', a: 'Total de congregações ativas do campo e a lista com o conselho de cada uma.', se: () => _aba('dashboard','congregacoes') },
        { q: 'Cartão Dizimistas', a: 'Quantidade de membros ativos no Rol de Dizimistas (desconsidera excluídos e inativados sem retorno).', se: () => _aba('dashboard','membros') },
        { q: 'Resumo Financeiro', a: 'Resumo do período financeiro mais recente — o mesmo número da Central de Relatórios.', se: () => _aba('dashboard','financeiro') },
      ]},
      { titulo: 'Ações e navegação', itens: [
        { q: 'Menu inferior', a: 'Cada ícone abre um módulo. Você só vê os módulos liberados para o seu usuário — se um módulo sumiu, fale com o administrador.' },
        { q: 'Botão Sair', a: 'Encerra a sessão neste aparelho e volta à tela de login. Seus dados ficam salvos na nuvem.' },
        { q: 'Modo Membro (⇄)', a: 'Quando seu usuário está vinculado a um cadastro de membro, aparece o botão de alternância para o Portal do Membro — visão pessoal de contribuições, estudos e comunidade.', se: () => (typeof sgeModoPodeAlternar === 'function') && sgeModoPodeAlternar() },
        { q: 'Trava de manutenção', a: 'No canto superior pode aparecer um banner quando o administrador ativa o modo manutenção — durante ele, apenas o administrador navega.', se: _adm },
      ]},
    ],
  },

  /* ---------------- Gestão Unificada ---------------- */
  gestao: {
    t: 'Gestão Unificada', ico: 'fa-chart-pie', cor: '#f59e0b',
    intro: 'Inteligência financeira do campo: cruzamentos, indicadores e relatórios com os mesmos cálculos do desktop. Cada aba é liberada separadamente na Gestão de Usuários.',
    grupos: [
      { titulo: 'Cruzamento & BI', se: () => _aba('gestao','cruzamento'), itens: [
        { q: 'O que faz', a: 'Cruza os lançamentos financeiros por período, conselho, congregação e contas — e desenha o gráfico correspondente.' },
        { q: 'Modo de análise', a: 'Define o cruzamento: evolução no tempo, comparativo anual, mês a mês, meses específicos lado a lado, tabela anual ou comparativo por conselho/congregação.' },
        { q: 'Filtros', a: 'Período inicial/final, conselho e congregação restringem a base. "Contas" escolhe quais rubricas entram no somatório; "semanas específicas" compara a mesma semana entre os meses.' },
        { q: 'Formato e linha de média', a: 'Alterna gráfico de colunas/linhas e pode desenhar a linha de média de referência (média dos meses encerrados — o mês atual nunca entra no cálculo).' },
      ]},
      { titulo: 'Análise do Mês', se: () => _aba('gestao','mensal'), itens: [
        { q: 'O que faz', a: 'Radiografia de um mês específico: totais por conta, comparativo com meses anteriores, rankings por conselho e congregação.' },
        { q: 'Ciclo do mês', a: 'Considera quantas semanas (fechamentos) o mês teve — afeta médias e projeções.' },
      ]},
      { titulo: 'Indicadores', se: () => _aba('gestao','indicadores'), itens: [
        { q: 'O que faz', a: 'Estatísticas consolidadas: evolução interanual, participação de conselhos e congregações e indicadores derivados dos lançamentos.' },
      ]},
      { titulo: 'Relatórios', se: () => _aba('gestao','relatorios'), itens: [
        { q: 'O que faz', a: 'Gera os documentos oficiais em PDF — apresentação executiva e relatórios gerenciais do período selecionado.' },
      ]},
      { titulo: 'Dúvidas comuns', itens: [
        { q: 'Não vejo uma aba', a: 'As abas da Gestão são concedidas uma a uma na Gestão de Usuários. Se precisa de acesso, peça ao administrador.' },
        { q: 'Números diferentes do esperado', a: 'Confira o filtro de período e as contas marcadas — o gráfico reflete exatamente a base filtrada.' },
      ]},
    ],
  },

  /* ---------------- Financeiro — menu ---------------- */
  financeiro: {
    t: 'Financeiro & Tesouraria', ico: 'fa-vault', cor: '#10b981',
    intro: 'Central da tesouraria: cadastro de dizimistas, lançamentos semanais, envio e conferência de caixa. Cada aba abaixo é liberada separadamente — a lista muda conforme o seu perfil.',
    grupos: [
      { titulo: 'Abas do módulo', itens: [
        { q: 'Rol de Dizimistas', a: 'Cadastro dos irmãos dizimistas: conselho, congregação, telefone, espelho de contribuições e histórico de congregações.', se: () => _finAba('rol') },
        { q: 'Frequência', a: 'Classifica os dizimistas por assiduidade (Fiel, Irregular, Novo, Ausente, Nunca contribuiu) com base nas competências.', se: () => _finAba('frequencia') },
        { q: 'Lançamentos Semanais', a: 'A grade principal: dízimos e ofertas por irmão e por semana do mês, com PIX/espécie e status.', se: () => _finAba('semanal') },
        { q: 'Livro de Dizimistas', a: 'Documento oficial dourado, mensal ou anual: capa com QR de autenticidade, sumário, detalhamento e estatísticas — exportável em PDF.', se: () => _finAba('livro') },
        { q: 'Envio de Caixa', a: 'Fechamento e envio do relatório semanal da congregação para a central, com rascunho, envio e retificação.', se: () => _finAba('relatorio') },
        { q: 'Conferência de Caixa', a: 'Recebimento central: confere o que cada congregação enviou, fecha semanas e acompanha pendências.', se: () => _finAba('prestacao') },
        { q: 'Eventos Diversos', a: 'Orçamentos e eventos do campo com receitas e despesas próprias.', se: () => _finAba('orcamentos') },
      ]},
      { titulo: 'Dúvidas comuns', itens: [
        { q: 'Semana fechada', a: 'Quando a semana é fechada no desktop, os lançamentos dela ficam somente leitura. Alterações passam a ser retificações auditadas.', se: () => _adm() || _tes() || _aba('financeiro','dizimistas') },
        { q: 'Lançamento sumiu da tela', a: 'Toque no botão ↻ da grade: ele força nova leitura da nuvem. Se o registro existir no banco, ele reaparece.' },
        { q: 'Não vejo uma aba', a: 'As abas são concedidas individualmente. Fale com o administrador para liberar no seu perfil.' },
      ]},
    ],
  },

  /* ---------------- Financeiro — Rol de Dizimistas ---------------- */
  'fin.rol': {
    t: 'Rol de Dizimistas', ico: 'fa-users-line', cor: '#38bdf8',
    intro: 'Cadastro oficial dos irmãos dizimistas do campo. A lista respeita o seu escopo de conselhos e congregações.',
    grupos: [
      { titulo: 'Filtros e lista', itens: [
        { q: 'Conselho / Congregação', a: 'Restringe a lista. As congregações seguem a ordem canônica do campo (não alfabética).' },
        { q: 'Status', a: 'Filtra por Ativos, Inativos, Com ou Sem telefone.' },
        { q: 'Busca', a: 'Localiza por nome, ID ou telefone — filtra enquanto você digita.' },
        { q: 'Cartão do membro', a: 'Mostra nome, conselho, congregação e telefone, com selo Ativo/Inativo e o ícone de vínculo quando o irmão tem usuário no Portal do Membro.' },
      ]},
      { titulo: 'Ações por membro', itens: [
        { q: 'Editar (lápis azul)', a: 'Corrige nome, telefone, conselho e congregação do cadastro.', se: _edita },
        { q: 'Espelho de Contribuições (saco roxo)', a: 'Extrato completo dos lançamentos do irmão por período, com total acumulado, média e detalhamento mês a mês.' },
        { q: 'Histórico de Congregações (prédio âmbar)', a: 'Linha do tempo das congregações pelas quais o membro passou.' },
        { q: 'Vínculo do Portal (elo verde)', a: 'Liga o cadastro do irmão a um usuário do Portal do Membro — é o que libera o "Meu Financeiro" dele. Exclusivo do administrador.', se: _adm },
      ]},
      { titulo: 'Dúvidas comuns', itens: [
        { q: 'Cadastrar novo dizimista', a: 'Use o botão de cadastro na aba Lançamentos Semanais ou no desktop — o novo membro já fica disponível para lançamento.', se: _edita },
        { q: 'Membro mudou de congregação', a: 'Edite o cadastro e troque a congregação — o histórico registra a transferência automaticamente.' },
      ]},
    ],
  },

  /* ---------------- Financeiro — Frequência ---------------- */
  'fin.frequencia': {
    t: 'Frequência', ico: 'fa-calendar-check', cor: '#34d399',
    intro: 'Mede a assiduidade dos dizimistas por competência (mês de referência). Classifica cada membro ativo e consolida a taxa de fidelidade.',
    grupos: [
      { titulo: 'Como funciona', itens: [
        { q: 'Filtros', a: 'Ano, mês de referência, conselho e congregação definem a base avaliada. O botão "Analisar frequência" recalcula.' },
        { q: 'Classificação', a: '<b>Fiel</b> contribuiu nas últimas competências; <b>Irregular</b> contribui no período, mas com intervalos; <b>Novo</b> começou no mês atual ou anterior; <b>Ausente</b> já contribuiu mas não no mês de referência; <b>Nunca contribuiu</b> não tem lançamento.' },
        { q: 'Taxa de fidelidade', a: 'Percentual de membros ativos classificados como fiéis/recorrentes sobre o total avaliado.' },
        { q: 'Toque numa faixa', a: 'Os cartões listam os irmãos daquela classificação — útil para visita ou acompanhamento pastoral.' },
      ]},
      { titulo: 'Observações', itens: [
        { q: 'Data de envio não conta', a: 'A classificação olha a competência (mês/semana do lançamento), não o dia em que foi digitado — lançar atrasado não distorce o resultado.' },
        { q: 'Membros sem valor', a: 'Quem nunca teve lançamento aparece como "Nunca contribuiu", separado de quem parou de contribuir.' },
      ]},
    ],
  },

  /* ---------------- Financeiro — Lançamentos Semanais ---------------- */
  'fin.semanal': {
    t: 'Lançamentos Semanais', ico: 'fa-receipt', cor: '#f59e0b',
    intro: 'A grade principal da tesouraria: cada linha é um irmão dizimista; cada lançamento guarda valor, semana, canal (PIX/espécie) e status.',
    grupos: [
      { titulo: 'Filtros', itens: [
        { q: 'Ano e Mês', a: 'Definem a competência exibida na grade.' },
        { q: 'Exportar mês no WhatsApp', a: 'Gera o resumo completo do mês filtrado (todas as semanas, nomes, valores, canal e status) pronto para enviar ou colar no WhatsApp — conferência ou relançamento manual.' },
        { q: 'Chips 1ª–5ª', a: 'Seleciona a semana do mês trabalhada na grade.' },
        { q: 'Conselho / Congregação / Busca / Situação', a: 'Refinam a lista: por escopo, por nome/ID/valor e por situação (com valor, sem lançamento, enviados, em edição).' },
      ]},
      { titulo: 'Grade e lançamento', itens: [
        { q: 'Status na lista', a: '<b>Enviado</b> já consta no fechamento; <b>Em edição</b> tem valor lançado ainda não enviado; <b>Não enviado</b> está sem lançamento naquela semana.' },
        { q: 'Lançar ou corrigir', a: 'Toque no irmão para abrir o lançamento: informe valor e canal (PIX ou espécie, com congregação de destino quando itinerante) e grave.' },
        { q: 'Semana fechada', a: 'Abaixo do aviso de cadeado, a grade fica somente leitura. Com permissão de admin, salvar vira retificação registrada em auditoria.' },
        { q: 'Conflito de versão', a: 'Se outro aparelho alterou o mesmo registro, o app recarrega a grade sozinho e avisa — confira o valor novo e salve de novo se precisar.' },
      ]},
      { titulo: 'Barra de ações', itens: [
        { q: '↻ Atualizar', a: 'Descarta o cache local e lê a nuvem de novo — use quando suspeitar que algo não apareceu.' },
        { q: 'Divergências (lupa)', a: 'Auditoria de concorrência: compara lançamentos entre estações e aponta diferenças de valor/status.' },
        { q: 'Gestão de Lotes (cadeado)', a: 'Painel administrativo de fechamento de semanas e meses — exclusivo do administrador.', se: _adm },
        { q: 'Cadastrar membro (+)', a: 'Inclui um novo dizimista direto da grade.', se: _edita },
      ]},
      { titulo: 'Dúvidas comuns', itens: [
        { q: 'Lancei e não apareceu', a: 'Toque em ↻. Se persistir, o registro pode estar com escopo diferente (outro conselho/congregação) — confira os filtros.' },
        { q: 'Valor zerado', a: 'Salvar com valor vazio/0 equivale a remover o lançamento daquela semana.' },
      ]},
    ],
  },

  /* ---------------- Financeiro — Livro de Dizimistas ---------------- */
  'fin.livro': {
    t: 'Livro de Dizimistas', ico: 'fa-book-open', cor: '#d4af37',
    intro: 'O documento oficial dos dizimistas, no formato de livro: capa dourada com timbrado e QR de autenticidade, sumário, detalhamento e estatísticas — digital e exportável em PDF.',
    grupos: [
      { titulo: 'Período', itens: [
        { q: 'Mensal ou Anual', a: 'Mensal gera capítulos por semana; anual gera um capítulo por mês do ano selecionado.' },
        { q: 'Capa e QR code', a: 'A capa traz o timbrado da igreja, o período e um QR de autenticidade — apontar a câmera abre a página de verificação do documento.' },
        { q: 'Sumário', a: 'Lista os capítulos com o total de cada um para navegação rápida.' },
      ]},
      { titulo: 'Detalhamento', itens: [
        { q: 'Organização', a: 'Cada capítulo agrupa por Conselho → Congregação na ordem canônica do campo; dentro de cada grupo, os irmãos seguem ordem alfabética.' },
        { q: 'Colunas', a: 'Nome, semana, valor e canal (PIX/espécie) — com congregação e conselho de origem no agrupamento.' },
        { q: 'Estatísticas', a: 'Totais gerais, número de dizimistas, ticket médio e totais por conselho e por congregação.' },
      ]},
      { titulo: 'Exportação', itens: [
        { q: 'Gerar PDF', a: 'Exporta o livro inteiro em PDF oficial, mantendo capa, sumário, detalhamento e QR — pronto para imprimir ou arquivar.' },
      ]},
    ],
  },

  /* ---------------- Financeiro — Envio de Caixa ---------------- */
  'fin.relatorio': {
    t: 'Envio de Caixa', ico: 'fa-file-invoice-dollar', cor: '#a78bfa',
    intro: 'Central de relatórios semanais: aqui a congregação monta o fechamento da semana e envia para a central. O passo a passo detalhado continua no botão "?" dentro da própria tela.',
    grupos: [
      { titulo: 'Fluxo', itens: [
        { q: 'Central de relatórios', a: 'Lista as congregações e o status do relatório da semana — use a busca ou os chips para localizar a sua.' },
        { q: 'Ações do topo', a: 'Os cinco botões conduzem o fluxo: novo relatório, gravar rascunho, enviar, corrigir (retificar enviado) e fechamento.' },
        { q: 'Rascunho', a: 'GRAVAR guarda o trabalho sem transmitir; ENVIAR entrega oficialmente à central — o selo "Rascunho" some só depois do envio.' },
        { q: 'Retificação', a: 'Relatório enviado pode ser corrigido: entra em modo retificação e GRAVAR salva a nova versão mantendo o histórico.' },
        { q: 'Somente leitura', a: 'Relatórios enviados/recebidos de semanas fechadas abrem para visualização; a edição só volta via retificação autorizada.' },
      ]},
      { titulo: 'Ajuda detalhada', itens: [
        { q: 'Passo a passo completo', a: 'Dentro da tela, o botão <b>?</b> ao lado das ações abre o tutorial completo da central — campos, envio e conferência.' },
      ]},
    ],
  },

  /* ---------------- Financeiro — Conferência de Caixa ---------------- */
  'fin.prestacao': {
    t: 'Conferência de Caixa', ico: 'fa-clipboard-check', cor: '#f472b6',
    intro: 'Visão da central: acompanha o que cada congregação enviou e recebeu por semana do mês. Acesso restrito ao administrador.',
    grupos: [
      { titulo: 'Uso', itens: [
        { q: 'Grade por congregação', a: 'Toque numa congregação para lançar ou corrigir o valor recebido naquela semana.' },
        { q: 'Cadeado da semana', a: 'Toque no cadeado para fechar todas as semanas até a selecionada — ou reabrir a partir dela.', se: _adm },
        { q: 'Semana bloqueada', a: 'O selo âmbar indica semana travada para edição — o cadeado reabre quando necessário.' },
        { q: 'Saídas manuais', a: 'Lançadas somente no desktop — aqui aparecem consolidadas na leitura.' },
      ]},
    ],
  },

  /* ---------------- Financeiro — Eventos Diversos ---------------- */
  'fin.orcamentos': {
    t: 'Eventos Diversos', ico: 'fa-note-sticky', cor: '#22d3ee',
    intro: 'Orçamentos e eventos do campo com movimentação própria — separados da rotina de dízimos.',
    grupos: [
      { titulo: 'Uso', itens: [
        { q: 'Lista de eventos', a: 'Mostra os eventos cadastrados com totais de receita e despesa. Toque para abrir o detalhe.' },
        { q: 'Detalhe do evento', a: 'Resumo do orçamento, lançamentos e saldo daquele evento específico.' },
      ]},
    ],
  },

  /* ---------------- Secretaria — Relatório Espiritual ---------------- */
  secretaria: {
    t: 'Relatório Espiritual', ico: 'fa-dove', cor: '#f472b6',
    intro: 'O relatório espiritual mensal do campo — o mesmo formulário de papel da secretaria, digitalizado: cultos, decisões, batismos, evangelismo, jovens e ação social.',
    grupos: [
      { titulo: 'Tela', itens: [
        { q: 'Meses no topo', a: 'Os chips navegam entre os meses lançados — cada mês guarda ~50 indicadores.' },
        { q: 'Cards resumo', a: 'Os 6 cartões agregam Cultos, Decisões, Reconciliações, Batismos, Evangelismo e Ação Social do mês selecionado.' },
        { q: 'Gráfico', a: 'Evolução de um indicador ao longo dos meses — toque num indicador para trocar e alterne colunas/linhas no canto.' },
        { q: 'Lançar mês (+)', a: 'Abre o formulário completo para registrar um novo mês. Disponível para quem tem permissão de edição.' },
        { q: 'Atualizar (↻)', a: 'Recarrega os dados da nuvem.' },
      ]},
      { titulo: 'Ajuda detalhada', itens: [
        { q: 'O que cada card soma', a: 'Cultos = Doutrina + Público + Ar Livre + Lares + EBD; Decisões/Reconciliações = as 5 faixas etárias; Batismos = Espírito Santo + nas Águas; Evangelismo = Visitas + Alcance; Ação Social = assistências registradas.' },
        { q: 'Explicação completa dos indicadores', a: `<button onclick="ajudaFechar();if(typeof espAjuda==='function')espAjuda()" class="px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer" style="border-color:var(--border-color);color:var(--color-primary);background:var(--bg-card)"><i class="fa-solid fa-circle-question mr-1"></i>Abrir detalhamento dos cálculos</button>` },
      ]},
    ],
  },

  /* ---------------- Missões ---------------- */
  missoes: {
    t: 'Missões', ico: 'fa-globe', cor: '#fb923c',
    intro: 'Arrecadação missionária do campo — EBD, Culto de Missões, Oferta Missionária e Círculo de Oração, com metas anuais e evolução histórica.',
    grupos: [
      { titulo: 'Arrecadação do Campo', se: () => _aba('missoes','arrecadacao'), itens: [
        { q: 'Filtros', a: 'Ano, mês, semana (ou "Fechamento do mês") e conselho definem a base exibida.' },
        { q: 'Contribuições por congregação', a: 'Tabela com o que cada congregação arrecadou nas fontes missionárias — EBD, Culto de Missões, Oferta e Círculo de Oração.' },
        { q: 'Cards', a: 'Totais do período filtrado por fonte de arrecadação.' },
      ]},
      { titulo: 'Histórico & Evolução', se: () => _aba('missoes','historico'), itens: [
        { q: 'O que faz', a: 'Evolução da arrecadação missionária ao longo dos meses e comparação entre períodos.' },
      ]},
      { titulo: 'Metas Anuais', se: () => _aba('missoes','metas'), itens: [
        { q: 'O que faz', a: 'Metas de arrecadação por congregação para o ano, com acompanhamento do percentual alcançado.' },
      ]},
    ],
  },

  /* ---------------- Módulo Contábil ---------------- */
  contabil: {
    t: 'Módulo Contábil', ico: 'fa-scale-balanced', cor: '#818cf8',
    intro: 'Demonstrações contábeis oficiais do campo. Acesso restrito: administradores ou concessão específica na Gestão de Usuários.',
    grupos: [
      { titulo: 'Demonstrações', itens: [
        { q: 'Modos', a: '<b>Balancete</b> — mês selecionado; <b>Exercício</b> — o ano inteiro; <b>Série</b> — evolução mês a mês.' },
        { q: 'PDF oficial', a: 'Gera o documento contábil formatado para impressão/arquivo.' },
      ]},
      { titulo: 'Contas a Pagar/Receber', itens: [
        { q: 'Fluxo', a: 'Posição de obrigações e recebíveis do período — o que entra, o que sai e o que fica programado.' },
      ]},
      { titulo: 'Indicadores', itens: [
        { q: 'Salários mínimos', a: 'Resultados convertidos em SM do exercício vigente — leitura real do poder de compra da arrecadação.' },
        { q: 'Crescimento interanual (YoY)', a: 'Compara o mês e o acumulado com o mesmo período do ano anterior — nominal e em SM.' },
        { q: 'Índices sobre a receita bruta', a: 'Quanto de cada real arrecadado fica na operação (líquida) e quanto vai para missões (repasse).' },
      ]},
    ],
  },

  /* ---------------- Comunidade ---------------- */
  comunidade: {
    t: 'Comunidade', ico: 'fa-users', cor: '#f59e0b',
    intro: 'Feed interno da igreja — avisos, posts e vida comunitária. Módulo em piloto: liberado gradualmente por usuário.',
    grupos: [
      { titulo: 'Uso', itens: [
        { q: 'Feed', a: 'Lista as publicações do campo — avisos, cultos e conteúdos direcionados.' },
        { q: 'Atualizar (↻)', a: 'Recarrega o feed da nuvem.' },
        { q: 'Interações', a: 'Posts podem trazer mídia (foto, vídeo) e reações — os contadores aparecem em cada publicação.' },
      ]},
      { titulo: 'Acesso', itens: [
        { q: 'Não vejo o módulo', a: 'A Comunidade está em piloto — se ainda não aparece para você, aguarde a liberação ou fale com o administrador.' },
      ]},
    ],
  },

  /* ---------------- Acessos e permissões (admin) ---------------- */
  acessos: {
    t: 'Acessos e permissões', ico: 'fa-user-shield', cor: '#f43f5e',
    intro: 'Ferramentas administrativas: gerencia quem entra no sistema, o que cada usuário pode ver e os aparelhos conectados. Exclusivo do administrador.',
    grupos: [
      { titulo: 'Usuários', itens: [
        { q: 'Cadastro', a: 'Cria usuários com perfil (administrador/operador), define se é tesoureiro e concede módulos e abas individualmente.' },
        { q: 'Escopo', a: 'Restringe o usuário a conselhos e congregações específicos — ele só vê e só lança dentro do escopo.' },
        { q: 'Vínculo ao membro', a: 'Associa o usuário a um cadastro do Rol de Dizimistas — libera o Portal do Membro para ele.' },
      ]},
      { titulo: 'Aparelhos', itens: [
        { q: 'Sessões e dispositivos', a: 'Lista os aparelhos conectados à conta e permite encerrar sessões remotamente.' },
      ]},
    ],
  },

  /* ---------------- Portal do Membro ---------------- */
  membro: {
    t: 'Portal do Membro', ico: 'fa-user', cor: '#0ea5e9',
    intro: 'Sua visão pessoal no aplicativo: contribuições, estudos e comunidade — só você vê os seus dados.',
    grupos: [
      { titulo: 'Início', itens: [
        { q: 'Palavra do dia', a: 'Versículo diário e atalhos para os módulos do portal.' },
        { q: 'Novidades', a: 'Cartões que levam direto ao Meu Financeiro, Comunidade e Estudos conforme a liberação.' },
      ]},
      { titulo: 'Meu Financeiro', itens: [
        { q: 'O que mostra', a: 'Seus dízimos e ofertas registrados pela tesouraria — organizados por ano e mês, com totais e acumulado geral.' },
        { q: 'Extrato em PDF', a: 'Botão "Extrato" gera o PDF oficial das suas contribuições do ano — comprovante para declaração.' },
        { q: 'Cadastro não localizado', a: 'Se aparecer "sem vínculo", peça à secretaria da tesouraria para vincular seu usuário no Rol de Dizimistas.' },
      ]},
      { titulo: 'Estudos', se: _piloto, itens: [
        { q: 'Plano de leitura', a: 'Leitura anual da Bíblia distribuída por dia — os capítulos do dia já vêm calculados.' },
        { q: 'Devocionais', a: 'Devocionais publicados pela Comunidade aparecem aqui.' },
      ]},
      { titulo: 'Comunidade / Minha Congregação', itens: [
        { q: 'Comunidade', a: 'Feed interno da igreja direcionado a você — em piloto.', se: _piloto },
        { q: 'Em construção', a: 'Minha Congregação reunirá escalas, avisos e agenda da sua congregação — chega nas próximas versões.' },
      ]},
    ],
  },

  /* ---------------- Módulo em construção ---------------- */
  governanca: {
    t: 'Congregações & Lideranças', ico: 'fa-church', cor: '#38bdf8',
    intro: 'Gestão da rede de congregações, conselhos e diretoria do campo.',
    grupos: [
      { titulo: 'Status', itens: [
        { q: 'Em construção', a: 'No mobile este módulo está sendo adaptado — os dados já sincronizam com a nuvem e a gestão completa está disponível no aplicativo desktop.' },
      ]},
    ],
  },
};

/* ---------- renderização ---------- */
const _ajEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function _ajVisivel(item){
  if (!item) return false;
  if (item.se === undefined) return true;
  try { return typeof item.se === 'function' ? !!item.se() : !!item.se; } catch(e){ return false; }
}

/* Botão "?" padrão dos headers — mesmo estilo dos botões de ajuda existentes. */
window.ajudaBtn = function(ctx, cls){
  return `<button onclick="ajudaAbrir('${ctx}')" title="Como usar — ajuda desta tela" class="${cls || 'w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer shrink-0 text-[13px] font-extrabold'}" style="border-color:var(--border-color);color:var(--color-primary);background:var(--bg-card)">?</button>`;
};

window.ajudaAbrir = function(ctx){
  const d = SGE_AJUDA[ctx] || SGE_AJUDA[ctx?.split('.')[0]];
  if (!d){ toast('Ajuda não disponível nesta tela.'); return; }
  document.getElementById('ajuda-overlay')?.remove();
  const m = document.createElement('div');
  m.id = 'ajuda-overlay';
  m.className = 'fixed inset-0 z-[85] flex items-center justify-center p-5';
  m.style.background = 'rgba(0,0,0,.78)';
  const grupos = (d.grupos || []).map(g => {
    const itens = (g.itens || []).filter(_ajVisivel);
    if (!itens.length || (g.se && !_ajVisivel(g))) return '';
    return `<div>
      <p class="font-bold text-[11px] mb-1.5 flex items-center gap-1.5" style="color:${d.cor}"><i class="fa-solid ${d.ico} text-[10px]"></i>${_ajEsc(g.titulo)}</p>
      <div class="space-y-1.5">
        ${itens.map(it => `<details class="rounded-xl border overflow-hidden" style="border-color:var(--border-color);background:var(--bg-input)">
          <summary class="px-3 py-2.5 text-[11px] font-bold cursor-pointer list-none flex items-center justify-between gap-2">${_ajEsc(it.q)}<i class="fa-solid fa-chevron-down text-[9px] opacity-40 shrink-0"></i></summary>
          <p class="px-3 pb-3 text-[11px] leading-relaxed opacity-80">${it.a}</p>
        </details>`).join('')}
      </div>
    </div>`;
  }).filter(Boolean).join('');
  m.innerHTML = `
    <div class="rounded-2xl w-full max-w-[430px] max-h-[85vh] flex flex-col" style="background:var(--bg-card);border:1px solid var(--border-color)">
      <div class="flex items-center gap-2 px-4 py-3 border-b shrink-0" style="border-color:var(--border-color)">
        <i class="fa-solid ${d.ico}" style="color:${d.cor}"></i>
        <span class="text-xs font-bold flex-1 truncate">Como usar — ${_ajEsc(d.t)}</span>
        <button onclick="ajudaFechar()" class="w-7 h-7 rounded-lg cursor-pointer text-xs" style="background:var(--bg-input);color:var(--text-muted)"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="p-4 space-y-4 text-[11px] leading-relaxed overflow-y-auto" style="color:var(--text-main)">
        <p class="opacity-80">${d.intro}</p>
        ${grupos}
      </div>
      <div class="px-4 py-3 border-t text-center shrink-0" style="border-color:var(--border-color)">
        <p class="text-[9px] opacity-50">A ajuda mostra apenas as funções liberadas para o seu perfil.</p>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
};

window.ajudaFechar = function(){ document.getElementById('ajuda-overlay')?.remove(); };

})();
