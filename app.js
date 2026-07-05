const STORAGE_KEY = "fretehub-mvp-state-v1";

const today = new Date();
const daysFromNow = (days) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const brl = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

const users = [
  { id: "u1", nome: "Ana Ribeiro", email: "admin@salvadorcomercial.com.br", perfil: "Administrador", status: "Ativo" },
  { id: "u2", nome: "Carlos Mendes", email: "gestor@salvadorcomercial.com.br", perfil: "Gestor de Logistica", status: "Ativo" },
  { id: "u3", nome: "Fernanda Lima", email: "operador@salvadorcomercial.com.br", perfil: "Operador de Frete", status: "Ativo" },
  { id: "u4", nome: "Roberto Souza", email: "financeiro@salvadorcomercial.com.br", perfil: "Financeiro", status: "Ativo" },
  { id: "u5", nome: "Juliana Alves", email: "consulta@salvadorcomercial.com.br", perfil: "Consulta", status: "Ativo" },
];

const initialState = {
  currentUserId: "u1",
  carriers: [
    {
      id: "t1",
      razaoSocial: "Transportadora Vale Sul LTDA",
      nomeFantasia: "Vale Sul",
      cnpj: "12.345.678/0001-90",
      contato: "Marcos Silva",
      email: "operacional@valesul.demo",
      telefone: "(71) 3555-1000",
      modalidades: ["Rodoviario", "Fracionado"],
      regioes: ["Sul", "Sudeste", "Nordeste"],
      estadosAtendidos: ["BA", "SP", "PR", "SC", "RS"],
      prazoMedioDias: 5,
      politicaCubagem: "Maior entre peso real e cubado",
      fatorCubagem: 300,
      regrasColeta: "Coleta em D+1 para pedidos ate 15h",
      contrato: "CTR-2026-001",
      status: "Ativa",
      observacoes: "Transportadora principal para Sul e Sudeste.",
      criadoEm: daysFromNow(-90),
      atualizadoEm: daysFromNow(-5),
    },
    {
      id: "t2",
      razaoSocial: "Expresso Gaucho Logistica SA",
      nomeFantasia: "Expresso Gaucho",
      cnpj: "23.456.789/0001-11",
      contato: "Patricia Rocha",
      email: "sac@expressogaucho.demo",
      telefone: "(51) 3222-4400",
      modalidades: ["Rodoviario", "Expresso"],
      regioes: ["Sul", "SP"],
      estadosAtendidos: ["RS", "SC", "PR", "SP"],
      prazoMedioDias: 4,
      politicaCubagem: "Peso cubado quando superior ao real",
      fatorCubagem: 250,
      regrasColeta: "Coleta diaria de segunda a sexta",
      contrato: "CTR-2026-002",
      status: "Ativa",
      observacoes: "Melhor prazo para regiao Sul.",
      criadoEm: daysFromNow(-70),
      atualizadoEm: daysFromNow(-3),
    },
    {
      id: "t3",
      razaoSocial: "Rota Certa Transportes LTDA",
      nomeFantasia: "Rota Certa",
      cnpj: "34.567.890/0001-22",
      contato: "Henrique Dias",
      email: "comercial@rotacerta.demo",
      telefone: "(11) 4002-8922",
      modalidades: ["Rodoviario", "Fracionado"],
      regioes: ["Todas"],
      estadosAtendidos: ["BA", "SP", "RJ", "MG", "PR", "SC", "RS"],
      prazoMedioDias: 7,
      politicaCubagem: "Padrao 6000",
      fatorCubagem: 167,
      regrasColeta: "Coleta programada 3x por semana",
      contrato: "CTR-2026-003",
      status: "Ativa",
      observacoes: "Cobertura nacional, custo maior.",
      criadoEm: daysFromNow(-50),
      atualizadoEm: daysFromNow(-2),
    },
    {
      id: "t4",
      razaoSocial: "Nordeste Cargas Expressas LTDA",
      nomeFantasia: "Nordeste Cargas",
      cnpj: "45.678.901/0001-33",
      contato: "Aline Barreto",
      email: "atendimento@nordestecargas.demo",
      telefone: "(71) 3333-2020",
      modalidades: ["Fracionado"],
      regioes: ["Nordeste"],
      estadosAtendidos: ["BA", "SE", "PE", "AL", "CE"],
      prazoMedioDias: 3,
      politicaCubagem: "Maior entre real e cubado",
      fatorCubagem: 300,
      regrasColeta: "Coleta D+0 ate 12h",
      contrato: "CTR-2026-004",
      status: "Inativa",
      observacoes: "Aguardando renovacao de contrato.",
      criadoEm: daysFromNow(-30),
      atualizadoEm: daysFromNow(-1),
    },
  ],
  rates: [
    {
      id: "tar1",
      nome: "Vale Sul - Fracionado SP 2026",
      transportadoraId: "t1",
      modalidade: "Fracionado",
      ufOrigem: "BA",
      ufDestino: "SP",
      cepInicio: "01000000",
      cepFim: "19999999",
      pesoInicioKg: 0,
      pesoFimKg: 80,
      pesoCubadoAtivo: true,
      valorMinimoPedido: 0,
      valorMaximoPedido: 99999,
      taxaFixa: 22,
      kgExcedente: 2.1,
      combustivelPercentual: 0.14,
      riscoPercentual: 0.003,
      dificilAcessoValor: 0,
      interiorValor: 12,
      pedagioValor: 9,
      seguroPercentual: 0.0015,
      valorDeclaradoPercentual: 0.001,
      prazoDias: 5,
      minimoFrete: 45,
      maximoFrete: 900,
      regrasAdicionais: "Interior +1 dia no prazo.",
      status: "Ativa",
      versao: 3,
      vigenciaInicio: daysFromNow(-60),
      vigenciaFim: daysFromNow(80),
      criadoPor: "u2",
      aprovadoPor: "u1",
      criadoEm: daysFromNow(-60),
      atualizadoEm: daysFromNow(-10),
    },
    {
      id: "tar2",
      nome: "Expresso Gaucho - Sul Expresso",
      transportadoraId: "t2",
      modalidade: "Expresso",
      ufOrigem: "BA",
      ufDestino: "RS",
      cepInicio: "90000000",
      cepFim: "99999999",
      pesoInicioKg: 0,
      pesoFimKg: 60,
      pesoCubadoAtivo: true,
      valorMinimoPedido: 0,
      valorMaximoPedido: 99999,
      taxaFixa: 28,
      kgExcedente: 2.35,
      combustivelPercentual: 0.16,
      riscoPercentual: 0.0035,
      dificilAcessoValor: 18,
      interiorValor: 10,
      pedagioValor: 14,
      seguroPercentual: 0.0018,
      valorDeclaradoPercentual: 0.0012,
      prazoDias: 4,
      minimoFrete: 55,
      maximoFrete: 1100,
      regrasAdicionais: "Prioridade para capitais.",
      status: "Ativa",
      versao: 2,
      vigenciaInicio: daysFromNow(-30),
      vigenciaFim: daysFromNow(20),
      criadoPor: "u2",
      aprovadoPor: "u1",
      criadoEm: daysFromNow(-30),
      atualizadoEm: daysFromNow(-8),
    },
    {
      id: "tar3",
      nome: "Rota Certa - Nacional Rodoviario",
      transportadoraId: "t3",
      modalidade: "Rodoviario",
      ufOrigem: "BA",
      ufDestino: "RJ",
      cepInicio: "20000000",
      cepFim: "28999999",
      pesoInicioKg: 0,
      pesoFimKg: 100,
      pesoCubadoAtivo: true,
      valorMinimoPedido: 0,
      valorMaximoPedido: 99999,
      taxaFixa: 30,
      kgExcedente: 2.55,
      combustivelPercentual: 0.18,
      riscoPercentual: 0.004,
      dificilAcessoValor: 20,
      interiorValor: 8,
      pedagioValor: 16,
      seguroPercentual: 0.002,
      valorDeclaradoPercentual: 0.0012,
      prazoDias: 6,
      minimoFrete: 60,
      maximoFrete: 1300,
      regrasAdicionais: "Cobertura nacional.",
      status: "Ativa",
      versao: 1,
      vigenciaInicio: daysFromNow(-10),
      vigenciaFim: daysFromNow(120),
      criadoPor: "u2",
      aprovadoPor: "u1",
      criadoEm: daysFromNow(-10),
      atualizadoEm: daysFromNow(-4),
    },
    {
      id: "tar4",
      nome: "Vale Sul - Parana 2025",
      transportadoraId: "t1",
      modalidade: "Rodoviario",
      ufOrigem: "BA",
      ufDestino: "PR",
      cepInicio: "80000000",
      cepFim: "87999999",
      pesoInicioKg: 0,
      pesoFimKg: 70,
      pesoCubadoAtivo: true,
      valorMinimoPedido: 0,
      valorMaximoPedido: 99999,
      taxaFixa: 24,
      kgExcedente: 2.0,
      combustivelPercentual: 0.13,
      riscoPercentual: 0.0025,
      dificilAcessoValor: 0,
      interiorValor: 8,
      pedagioValor: 10,
      seguroPercentual: 0.0012,
      valorDeclaradoPercentual: 0.001,
      prazoDias: 5,
      minimoFrete: 42,
      maximoFrete: 850,
      regrasAdicionais: "Tabela vencida para teste.",
      status: "Vencida",
      versao: 2,
      vigenciaInicio: daysFromNow(-200),
      vigenciaFim: daysFromNow(-15),
      criadoPor: "u2",
      aprovadoPor: "u1",
      criadoEm: daysFromNow(-200),
      atualizadoEm: daysFromNow(-15),
    },
    {
      id: "tar5",
      nome: "Nordeste Cargas - Bahia Interior",
      transportadoraId: "t4",
      modalidade: "Fracionado",
      ufOrigem: "BA",
      ufDestino: "BA",
      cepInicio: "40000000",
      cepFim: "48999999",
      pesoInicioKg: 0,
      pesoFimKg: 40,
      pesoCubadoAtivo: true,
      valorMinimoPedido: 0,
      valorMaximoPedido: 99999,
      taxaFixa: 16,
      kgExcedente: 1.65,
      combustivelPercentual: 0.1,
      riscoPercentual: 0.002,
      dificilAcessoValor: 10,
      interiorValor: 6,
      pedagioValor: 3,
      seguroPercentual: 0.001,
      valorDeclaradoPercentual: 0.0008,
      prazoDias: 3,
      minimoFrete: 30,
      maximoFrete: 500,
      regrasAdicionais: "Transportadora inativa para teste.",
      status: "Ativa",
      versao: 1,
      vigenciaInicio: daysFromNow(-5),
      vigenciaFim: daysFromNow(60),
      criadoPor: "u2",
      aprovadoPor: "u1",
      criadoEm: daysFromNow(-5),
      atualizadoEm: daysFromNow(-2),
    },
    {
      id: "tar6",
      nome: "Rota Certa - Minas Pendente",
      transportadoraId: "t3",
      modalidade: "Rodoviario",
      ufOrigem: "BA",
      ufDestino: "MG",
      cepInicio: "30000000",
      cepFim: "39999999",
      pesoInicioKg: 0,
      pesoFimKg: 90,
      pesoCubadoAtivo: true,
      valorMinimoPedido: 0,
      valorMaximoPedido: 99999,
      taxaFixa: 26,
      kgExcedente: 2.2,
      combustivelPercentual: 0.14,
      riscoPercentual: 0.003,
      dificilAcessoValor: 0,
      interiorValor: 8,
      pedagioValor: 12,
      seguroPercentual: 0.0015,
      valorDeclaradoPercentual: 0.001,
      prazoDias: 5,
      minimoFrete: 50,
      maximoFrete: 950,
      regrasAdicionais: "Aguardando aprovacao.",
      status: "Pendente de Aprovacao",
      versao: 1,
      vigenciaInicio: daysFromNow(1),
      vigenciaFim: daysFromNow(180),
      criadoPor: "u2",
      aprovadoPor: "",
      criadoEm: daysFromNow(-1),
      atualizadoEm: daysFromNow(-1),
    },
  ],
  orders: Array.from({ length: 50 }, (_, index) => {
    const channels = ["Mercado Livre", "Shopee", "Site Proprio"];
    const customers = ["Joao da Silva", "Maria Souza", "Pedro Almeida", "Aline Barreto", "Lucas Ferreira", "Camila Duarte"];
    const ufs = ["SP", "RS", "RJ", "PR", "MG", "BA", "SC"];
    const cepBase = { SP: "01310", RS: "90010", RJ: "20040", PR: "80010", MG: "30110", BA: "40010", SC: "88010" };
    const statuses = ["Novo", "Aguardando Cotacao", "Frete Definido", "Enviado ao Protheus", "Em Expedicao", "Entregue", "Erro de Integracao"];
    const uf = ufs[index % ufs.length];
    const status = statuses[(index * 3) % statuses.length];
    const hasFreight = ["Frete Definido", "Enviado ao Protheus", "Em Expedicao", "Entregue"].includes(status);
    const carrierId = hasFreight ? ["t1", "t2", "t3"][index % 3] : "";
    return {
      id: `p${index + 1}`,
      numero: `SC-${String(100000 + index)}`,
      canal: channels[index % channels.length],
      cliente: customers[index % customers.length],
      cepOrigem: "40010000",
      cepDestino: `${cepBase[uf]}${String((index * 17) % 900).padStart(3, "0")}`,
      cidadeDestino: uf === "SP" ? "Sao Paulo" : uf === "RS" ? "Porto Alegre" : uf === "RJ" ? "Rio de Janeiro" : "Capital",
      ufDestino: uf,
      valorPedido: 120 + ((index * 43) % 900),
      pesoRealKg: +(0.5 + ((index * 7) % 35) * 0.55).toFixed(2),
      comprimentoCm: 22 + (index % 40),
      larguraCm: 16 + (index % 25),
      alturaCm: 10 + (index % 30),
      volumes: 1 + (index % 3 === 0 ? 1 : 0),
      produtos: ["Eletronico compacto", "Utensilios cozinha", "Ferramenta manual", "Kit escritorio"][index % 4],
      status,
      transportadoraSelecionadaId: carrierId,
      modalidadeSelecionada: carrierId ? (index % 2 ? "Fracionado" : "Rodoviario") : "",
      cotacaoEscolhidaId: "",
      opcaoEscolhidaId: "",
      freteCalculado: hasFreight ? +(45 + ((index * 11) % 120)).toFixed(2) : 0,
      freteCobrado: hasFreight ? +(48 + ((index * 9) % 125)).toFixed(2) : 0,
      prazoDias: hasFreight ? 3 + (index % 5) : 0,
      statusProtheus: status === "Erro de Integracao" ? "Erro" : hasFreight ? "Enviado" : "Pendente",
      statusExpedicao: status === "Entregue" ? "Entregue" : status === "Em Expedicao" ? "Separacao" : "Nao iniciado",
      codigoRastreio: hasFreight ? `BR${1000000 + index}FH` : "",
      criadoEm: daysFromNow(-(index % 30)),
      atualizadoEm: daysFromNow(-(index % 7)),
    };
  }),
  quotes: [],
  quoteOptions: [],
  audits: [
    { id: "a1", usuarioId: "u2", usuarioNome: "Carlos Mendes", acao: "APROVOU_TARIFA", entidade: "Tarifa", entidadeId: "tar1", detalhe: "Aprovou Vale Sul - Fracionado SP 2026", dadosAnteriores: "", dadosNovos: "", criadoEm: daysFromNow(-3) },
    { id: "a2", usuarioId: "u3", usuarioNome: "Fernanda Lima", acao: "ALTEROU_PEDIDO", entidade: "Pedido", entidadeId: "p4", detalhe: "Atualizou dados de peso do pedido SC-100003", dadosAnteriores: "", dadosNovos: "", criadoEm: daysFromNow(-2) },
  ],
};

let state = loadState();
let activeView = "dashboard";
let lastQuoteId = "";

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(initialState);
  try {
    return { ...structuredClone(initialState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentUser() {
  return users.find((user) => user.id === state.currentUserId) || users[0];
}

function can(action) {
  const profile = currentUser().perfil;
  const rules = {
    cotar: ["Administrador", "Gestor de Logistica", "Operador de Frete"],
    escolherFrete: ["Administrador", "Gestor de Logistica", "Operador de Frete"],
    gerenciarTarifas: ["Administrador", "Gestor de Logistica"],
    gerenciarTransportadoras: ["Administrador", "Gestor de Logistica"],
    configurar: ["Administrador"],
  };
  return (rules[action] || []).includes(profile);
}

function audit(acao, entidade, entidadeId, detalhe, dadosAnteriores = "", dadosNovos = "") {
  const user = currentUser();
  state.audits.unshift({
    id: `a${Date.now()}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    acao,
    entidade,
    entidadeId,
    detalhe,
    dadosAnteriores,
    dadosNovos,
    criadoEm: new Date().toISOString(),
  });
  saveState();
}

function setView(view, options = {}) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
  const titles = {
    dashboard: ["Dashboard", "Visao operacional de fretes, tarifas e pedidos."],
    pedidos: ["Pedidos", "Consulta, filtros e decisao de frete por pedido."],
    cotacao: ["Cotacao", "Calcule, salve e vincule opcoes de frete a pedidos."],
    transportadoras: ["Transportadoras", "Cadastro operacional de transportadoras e contratos."],
    tarifas: ["Tarifas", "Gestao de tabelas, vigencias, status e regras."],
    auditoria: ["Auditoria", "Historico de alteracoes e decisoes relevantes."],
    relatorios: ["Relatorios", "Custos, divergencias e exportacao CSV."],
    configuracoes: ["Configuracoes", "Preferencias operacionais e dados demo."],
  };
  document.getElementById("page-title").textContent = titles[view][0];
  document.getElementById("page-subtitle").textContent = titles[view][1];
  render(options);
}

function statusBadge(status) {
  const value = String(status || "");
  const danger = ["Erro", "Vencida", "Cancelada", "Bloqueada", "Erro de Integracao"].some((term) => value.includes(term));
  const warning = ["Pendente", "Aguardando", "Rascunho", "Sem Opcao"].some((term) => value.includes(term));
  const success = ["Ativa", "Aprovada", "Frete Definido", "Entregue", "Escolhida"].some((term) => value.includes(term));
  const cls = danger ? "danger" : warning ? "warning" : success ? "success" : "info";
  return `<span class="badge ${cls}">${value || "-"}</span>`;
}

function carrierName(id) {
  return state.carriers.find((carrier) => carrier.id === id)?.nomeFantasia || "-";
}

function render(options = {}) {
  const app = document.getElementById("app");
  const renderers = {
    dashboard: renderDashboard,
    pedidos: renderOrders,
    cotacao: () => renderQuote(options.orderId),
    transportadoras: renderCarriers,
    tarifas: renderRates,
    auditoria: renderAudit,
    relatorios: renderReports,
    configuracoes: renderSettings,
  };
  app.innerHTML = renderers[activeView]();
  bindViewEvents(options);
}

function renderDashboard() {
  const orders = state.orders;
  const rates = state.rates;
  const quotes = state.quotes;
  const noQuote = orders.filter((order) => !order.cotacaoEscolhidaId && !order.opcaoEscolhidaId).length;
  const withFreight = orders.filter((order) => order.status === "Frete Definido").length;
  const invalidRate = orders.filter((order) => order.status === "Aguardando Cotacao").length;
  const expiredRates = rates.filter((rate) => rate.status === "Vencida" || new Date(rate.vigenciaFim) < today).length;
  const soonRates = rates.filter((rate) => {
    const days = (new Date(rate.vigenciaFim) - today) / 86400000;
    return rate.status === "Ativa" && days > 0 && days <= 30;
  }).length;
  const costByCarrier = state.carriers.map((carrier) => {
    const total = orders.filter((order) => order.transportadoraSelecionadaId === carrier.id).reduce((sum, order) => sum + number(order.freteCalculado), 0);
    return { name: carrier.nomeFantasia, total };
  });
  const maxCost = Math.max(...costByCarrier.map((item) => item.total), 1);

  return `
    <div class="grid cols-4">
      ${metric("Pedidos", orders.length)}
      ${metric("Cotações geradas", quotes.length)}
      ${metric("Frete definido", withFreight)}
      ${metric("Sem cotação", noQuote)}
      ${metric("Tarifas vencidas", expiredRates)}
      ${metric("Vencem em 30 dias", soonRates)}
      ${metric("Aguardando cotação", invalidRate)}
      ${metric("Auditorias", state.audits.length)}
    </div>

    <div class="grid cols-2" style="margin-top:16px">
      <section class="card">
        <div class="card-header">
          <h2>Custo por transportadora</h2>
          <p>Baseado nos pedidos com frete definido.</p>
        </div>
        <div class="card-body">
          ${costByCarrier.map((item) => bar(item.name, item.total, maxCost, brl(item.total))).join("")}
        </div>
      </section>
      <section class="card">
        <div class="card-header">
          <h2>Alertas operacionais</h2>
          <p>Pontos que precisam de atenção.</p>
        </div>
        <div class="card-body">
          <p>${statusBadge("Pendente")} ${noQuote} pedidos sem cotação ou frete escolhido.</p>
          <p>${statusBadge("Vencida")} ${expiredRates} tarifa(s) vencida(s) bloqueadas para novas cotações.</p>
          <p>${statusBadge("Aguardando")} ${soonRates} tarifa(s) vencem nos próximos 30 dias.</p>
          <p>${statusBadge("Erro de Integracao")} ${orders.filter((o) => o.status === "Erro de Integracao").length} pedido(s) com erro de integração simulada.</p>
        </div>
      </section>
    </div>
  `;
}

function metric(label, value) {
  return `<section class="card metric"><span>${label}</span><strong>${value}</strong></section>`;
}

function bar(label, value, max, display) {
  const width = Math.max(2, Math.round((value / max) * 100));
  return `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      <strong>${display}</strong>
    </div>
  `;
}

function renderOrders() {
  return `
    <div class="toolbar">
      <div class="filters">
        <div class="field"><label>Busca</label><input id="orderSearch" placeholder="Pedido, cliente ou CEP" /></div>
        <div class="field"><label>Status</label><select id="orderStatus"><option value="">Todos</option>${unique(state.orders.map((o) => o.status)).map(option).join("")}</select></div>
        <div class="field"><label>Canal</label><select id="orderChannel"><option value="">Todos</option>${unique(state.orders.map((o) => o.canal)).map(option).join("")}</select></div>
      </div>
      <button class="button secondary" id="exportOrders">Exportar CSV</button>
    </div>
    <div id="ordersTable">${ordersTable(state.orders)}</div>
  `;
}

function ordersTable(orders) {
  if (!orders.length) return empty();
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Pedido</th><th>Canal</th><th>Cliente</th><th>Destino</th><th>Valor</th><th>Peso</th><th>Transportadora</th><th>Frete</th><th>Status</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map((order) => `
            <tr>
              <td><strong>${order.numero}</strong><br><span class="muted">${order.criadoEm}</span></td>
              <td>${order.canal}</td>
              <td>${order.cliente}</td>
              <td>${order.cepDestino}<br><span class="muted">${order.cidadeDestino}/${order.ufDestino}</span></td>
              <td class="money">${brl(order.valorPedido)}</td>
              <td>${order.pesoRealKg} kg<br><span class="muted">${order.comprimentoCm}x${order.larguraCm}x${order.alturaCm} cm</span></td>
              <td>${carrierName(order.transportadoraSelecionadaId)}<br><span class="muted">${order.modalidadeSelecionada || "-"}</span></td>
              <td class="money">${order.freteCalculado ? brl(order.freteCalculado) : "-"}</td>
              <td>${statusBadge(order.status)}</td>
              <td><button class="button secondary quote-order" data-order-id="${order.id}" ${can("cotar") ? "" : "disabled"}>Cotar</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderQuote(orderId) {
  const order = state.orders.find((item) => item.id === orderId) || state.orders.find((item) => item.status !== "Frete Definido") || state.orders[0];
  const quote = lastQuoteId ? state.quotes.find((item) => item.id === lastQuoteId) : null;
  const options = quote ? state.quoteOptions.filter((item) => item.cotacaoId === quote.id) : [];
  return `
    <div class="split">
      <section class="card">
        <div class="card-header">
          <h2>Parâmetros da cotação</h2>
          <p>Use um pedido existente ou ajuste os dados manualmente.</p>
        </div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field wide">
              <label>Pedido</label>
              <select id="quoteOrder">
                ${state.orders.map((item) => `<option value="${item.id}" ${item.id === order.id ? "selected" : ""}>${item.numero} - ${item.cliente} (${item.ufDestino})</option>`).join("")}
              </select>
            </div>
            ${inputField("CEP origem", "cepOrigem", order.cepOrigem)}
            ${inputField("CEP destino", "cepDestino", order.cepDestino)}
            ${inputField("UF destino", "ufDestino", order.ufDestino)}
            ${inputField("Peso real (kg)", "pesoRealKg", order.pesoRealKg, "number", "0.01")}
            ${inputField("Comprimento (cm)", "comprimentoCm", order.comprimentoCm, "number", "0.01")}
            ${inputField("Largura (cm)", "larguraCm", order.larguraCm, "number", "0.01")}
            ${inputField("Altura (cm)", "alturaCm", order.alturaCm, "number", "0.01")}
            ${inputField("Volumes", "volumes", order.volumes, "number", "1")}
            ${inputField("Valor declarado", "valorDeclarado", order.valorPedido, "number", "0.01")}
            <div class="field wide">
              <label>Prioridade</label>
              <select id="prioridade">
                <option value="menor_custo">Menor custo</option>
                <option value="menor_prazo">Menor prazo</option>
                <option value="equilibrio">Melhor equilíbrio</option>
              </select>
            </div>
            <div class="field wide">
              <label>Transportadoras habilitadas</label>
              <div class="check-list">
                ${state.carriers.map((carrier) => `
                  <label class="check-item">
                    <input type="checkbox" class="carrier-check" value="${carrier.id}" ${carrier.status === "Ativa" ? "checked" : ""} />
                    ${carrier.nomeFantasia} ${statusBadge(carrier.status)}
                  </label>
                `).join("")}
              </div>
            </div>
            <button class="button wide" id="calculateQuote" ${can("cotar") ? "" : "disabled"}>Calcular e salvar cotação</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Opções de frete</h2>
          <p>${quote ? `Cotação ${quote.id} - ${statusBadge(quote.status)}` : "Nenhuma cotação calculada nesta sessão."}</p>
        </div>
        <div class="card-body" id="quoteResults">
          ${options.length ? quoteOptionsTable(options) : empty("Calcule uma cotação para ver o comparativo.")}
        </div>
      </section>
    </div>
  `;
}

function inputField(label, id, value, type = "text", step = "") {
  return `<div class="field"><label>${label}</label><input id="${id}" type="${type}" ${step ? `step="${step}"` : ""} value="${value ?? ""}" /></div>`;
}

function quoteOptionsTable(options) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th></th><th>Transportadora</th><th>Modalidade</th><th>Pesos</th><th>Valor</th><th>Taxas</th><th>Prazo</th><th>Status</th><th>Regras</th><th>Ação</th></tr>
        </thead>
        <tbody>
          ${options.map((optionItem) => `
            <tr>
              <td>${optionItem.recomendada ? "★" : ""}</td>
              <td><strong>${optionItem.transportadoraNome}</strong></td>
              <td>${optionItem.modalidade || "-"}</td>
              <td>Real: ${optionItem.pesoRealKg.toFixed(2)} kg<br>Cubado: ${optionItem.pesoCubadoKg.toFixed(2)} kg<br>Usado: ${optionItem.pesoConsideradoKg.toFixed(2)} kg</td>
              <td class="money"><strong>${optionItem.disponivel ? brl(optionItem.valorFrete) : "-"}</strong></td>
              <td class="money">${optionItem.disponivel ? brl(optionItem.valorTaxas) : "-"}</td>
              <td>${optionItem.disponivel ? `${optionItem.prazoDias}d` : "-"}</td>
              <td>${statusBadge(optionItem.disponivel ? "Disponivel" : optionItem.statusTarifa)}</td>
              <td>${optionItem.disponivel ? optionItem.regrasAplicadas.join("<br>") || "Padrao" : `<span class="muted">${optionItem.motivoIndisponibilidade}</span>`}${optionItem.recomendada ? `<br><strong>${optionItem.motivoRecomendacao}</strong>` : ""}</td>
              <td><button class="button choose-option" data-option-id="${optionItem.id}" ${optionItem.disponivel && can("escolherFrete") ? "" : "disabled"}>Escolher</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCarriers() {
  return `
    <div class="grid cols-3">
      ${state.carriers.map((carrier) => `
        <section class="card">
          <div class="card-header">
            <h2>${carrier.nomeFantasia}</h2>
            <p>${carrier.razaoSocial}</p>
          </div>
          <div class="card-body">
            <p>${statusBadge(carrier.status)} Contrato ${carrier.contrato}</p>
            <p><strong>CNPJ:</strong> ${carrier.cnpj}</p>
            <p><strong>Modalidades:</strong> ${carrier.modalidades.join(", ")}</p>
            <p><strong>Estados:</strong> ${carrier.estadosAtendidos.join(", ")}</p>
            <p><strong>Fator cubagem:</strong> ${carrier.fatorCubagem}</p>
            <p class="muted">${carrier.observacoes}</p>
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function renderRates() {
  return `
    <div class="toolbar">
      <div class="filters">
        <button class="button secondary" id="downloadRateModel">Baixar modelo CSV</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Tarifa</th><th>Transportadora</th><th>Rota</th><th>CEP</th><th>Peso</th><th>Base</th><th>Prazo</th><th>Vigência</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${state.rates.map((rate) => `
            <tr>
              <td><strong>${rate.nome}</strong><br><span class="muted">v${rate.versao}</span></td>
              <td>${carrierName(rate.transportadoraId)}<br><span class="muted">${rate.modalidade}</span></td>
              <td>${rate.ufOrigem} → ${rate.ufDestino}</td>
              <td>${rate.cepInicio} a ${rate.cepFim}</td>
              <td>${rate.pesoInicioKg} a ${rate.pesoFimKg} kg</td>
              <td>${brl(rate.taxaFixa)} + ${brl(rate.kgExcedente)}/kg</td>
              <td>${rate.prazoDias}d</td>
              <td>${rate.vigenciaInicio}<br>${rate.vigenciaFim}</td>
              <td>${statusBadge(rate.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAudit() {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhe</th></tr></thead>
        <tbody>
          ${state.audits.map((item) => `
            <tr>
              <td>${new Date(item.criadoEm).toLocaleString("pt-BR")}</td>
              <td>${item.usuarioNome}</td>
              <td>${statusBadge(item.acao)}</td>
              <td>${item.entidade}<br><span class="muted">${item.entidadeId}</span></td>
              <td>${item.detalhe}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReports() {
  const divergence = state.orders.filter((order) => order.freteCalculado && order.freteCobrado && Math.abs(order.freteCalculado - order.freteCobrado) > 20);
  return `
    <div class="grid cols-3">
      ${metric("Divergências de frete", divergence.length)}
      ${metric("Custo total calculado", brl(state.orders.reduce((sum, order) => sum + number(order.freteCalculado), 0)))}
      ${metric("Opções de cotação", state.quoteOptions.length)}
    </div>
    <section class="card" style="margin-top:16px">
      <div class="card-header"><h2>Exportações</h2><p>Arquivos CSV para analise externa.</p></div>
      <div class="card-body">
        <button class="button secondary" id="exportQuotes">Exportar cotações</button>
        <button class="button secondary" id="exportAudit">Exportar auditoria</button>
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="card">
      <div class="card-header"><h2>Configurações do MVP</h2><p>Dados salvos no navegador para demonstrar persistência.</p></div>
      <div class="card-body">
        <p><strong>Usuário atual:</strong> ${currentUser().nome} - ${currentUser().perfil}</p>
        <p><strong>Persistência:</strong> localStorage</p>
        <p><strong>Ambiente:</strong> demonstrativo</p>
        <button class="button danger" id="resetData">Restaurar dados demo</button>
      </div>
    </section>
  `;
}

function bindViewEvents(options = {}) {
  if (activeView === "pedidos") bindOrdersEvents();
  if (activeView === "cotacao") bindQuoteEvents();
  if (activeView === "tarifas") bindRatesEvents();
  if (activeView === "relatorios") bindReportEvents();
  if (activeView === "configuracoes") bindSettingsEvents();
}

function bindOrdersEvents() {
  const apply = () => {
    const q = document.getElementById("orderSearch").value.toLowerCase();
    const status = document.getElementById("orderStatus").value;
    const channel = document.getElementById("orderChannel").value;
    const filtered = state.orders.filter((order) => {
      const text = `${order.numero} ${order.cliente} ${order.cepDestino}`.toLowerCase();
      return (!q || text.includes(q)) && (!status || order.status === status) && (!channel || order.canal === channel);
    });
    document.getElementById("ordersTable").innerHTML = ordersTable(filtered);
    bindOrderQuoteButtons();
  };
  ["orderSearch", "orderStatus", "orderChannel"].forEach((id) => document.getElementById(id).addEventListener("input", apply));
  document.getElementById("exportOrders").addEventListener("click", () => exportCsv("pedidos.csv", state.orders));
  bindOrderQuoteButtons();
}

function bindOrderQuoteButtons() {
  document.querySelectorAll(".quote-order").forEach((button) => {
    button.addEventListener("click", () => setView("cotacao", { orderId: button.dataset.orderId }));
  });
}

function bindQuoteEvents() {
  document.getElementById("quoteOrder").addEventListener("change", (event) => setView("cotacao", { orderId: event.target.value }));
  document.getElementById("calculateQuote").addEventListener("click", handleCalculateQuote);
  document.querySelectorAll(".choose-option").forEach((button) => {
    button.addEventListener("click", () => chooseOption(button.dataset.optionId));
  });
}

function bindRatesEvents() {
  document.getElementById("downloadRateModel").addEventListener("click", () => {
    const rows = [
      {
        nome: "Modelo Tarifa",
        transportadora: "Vale Sul",
        modalidade: "Fracionado",
        ufOrigem: "BA",
        ufDestino: "SP",
        cepInicio: "01000000",
        cepFim: "19999999",
        pesoInicioKg: 0,
        pesoFimKg: 30,
        taxaFixa: 20,
        kgExcedente: 1.85,
        combustivelPercentual: 0.15,
        prazoDias: 4,
      },
    ];
    exportCsv("modelo-tarifas-fretehub.csv", rows);
  });
}

function bindReportEvents() {
  document.getElementById("exportQuotes").addEventListener("click", () => exportCsv("cotacoes.csv", state.quotes));
  document.getElementById("exportAudit").addEventListener("click", () => exportCsv("auditoria.csv", state.audits));
}

function bindSettingsEvents() {
  document.getElementById("resetData").addEventListener("click", () => {
    if (!confirm("Restaurar dados demo e apagar cotações locais?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    setupProfileSelect();
    setView("dashboard");
    toast("Dados demo restaurados.");
  });
}

function handleCalculateQuote() {
  const order = state.orders.find((item) => item.id === document.getElementById("quoteOrder").value);
  const params = {
    pedidoId: order.id,
    cepOrigem: onlyDigits(document.getElementById("cepOrigem").value),
    cepDestino: onlyDigits(document.getElementById("cepDestino").value),
    ufDestino: document.getElementById("ufDestino").value.toUpperCase(),
    pesoRealKg: number(document.getElementById("pesoRealKg").value),
    comprimentoCm: number(document.getElementById("comprimentoCm").value),
    larguraCm: number(document.getElementById("larguraCm").value),
    alturaCm: number(document.getElementById("alturaCm").value),
    volumes: number(document.getElementById("volumes").value, 1),
    valorDeclarado: number(document.getElementById("valorDeclarado").value),
    prioridade: document.getElementById("prioridade").value,
    transportadorasHabilitadas: Array.from(document.querySelectorAll(".carrier-check:checked")).map((item) => item.value),
  };
  const errors = validateQuoteParams(params);
  if (errors.length) {
    toast(errors.join(" "));
    return;
  }
  const result = calculateQuote(params);
  const quote = {
    id: `cot${Date.now()}`,
    pedidoId: order.id,
    usuarioId: currentUser().id,
    prioridade: params.prioridade,
    cepOrigem: params.cepOrigem,
    cepDestino: params.cepDestino,
    ufDestino: params.ufDestino,
    pesoRealKg: params.pesoRealKg,
    pesoCubadoKg: result.pesoCubadoMax,
    pesoConsideradoKg: result.pesoConsideradoMax,
    valorDeclarado: params.valorDeclarado,
    volumes: params.volumes,
    status: result.options.some((item) => item.disponivel) ? "Calculada" : "Sem Opcao",
    opcaoEscolhidaId: "",
    criadoEm: new Date().toISOString(),
  };
  const options = result.options.map((item) => ({ ...item, id: `op${Date.now()}${Math.random().toString(16).slice(2)}`, cotacaoId: quote.id, criadoEm: new Date().toISOString() }));
  state.quotes.unshift(quote);
  state.quoteOptions.unshift(...options);
  lastQuoteId = quote.id;
  audit("GEROU_COTACAO", "Cotacao", quote.id, `Gerou cotação para pedido ${order.numero} com ${options.filter((item) => item.disponivel).length} opção(ões) disponível(is).`);
  saveState();
  setView("cotacao", { orderId: order.id });
  toast("Cotação calculada e salva.");
}

function validateQuoteParams(params) {
  const errors = [];
  if (!params.cepOrigem) errors.push("CEP origem é obrigatório.");
  if (!params.cepDestino) errors.push("CEP destino é obrigatório.");
  if (params.pesoRealKg <= 0) errors.push("Peso real deve ser maior que zero.");
  if (params.comprimentoCm <= 0 || params.larguraCm <= 0 || params.alturaCm <= 0) errors.push("Dimensões devem ser maiores que zero.");
  if (params.valorDeclarado <= 0) errors.push("Valor declarado deve ser maior que zero.");
  if (params.volumes < 1) errors.push("Volumes deve ser maior ou igual a 1.");
  if (!params.transportadorasHabilitadas.length) errors.push("Selecione pelo menos uma transportadora.");
  return errors;
}

function calculateQuote(params) {
  const options = [];
  let pesoCubadoMax = 0;
  let pesoConsideradoMax = 0;
  for (const carrier of state.carriers) {
    if (!params.transportadorasHabilitadas.includes(carrier.id)) continue;
    const pesoCubadoKg = (params.comprimentoCm * params.larguraCm * params.alturaCm / carrier.fatorCubagem) * params.volumes;
    const pesoConsideradoKg = Math.max(params.pesoRealKg, pesoCubadoKg);
    pesoCubadoMax = Math.max(pesoCubadoMax, pesoCubadoKg);
    pesoConsideradoMax = Math.max(pesoConsideradoMax, pesoConsideradoKg);
    const unavailableCarrier = carrier.status !== "Ativa";
    const candidateRates = state.rates.filter((rate) => rate.transportadoraId === carrier.id);
    const validRate = candidateRates.find((rate) => isRateCompatible(rate, params, pesoConsideradoKg));
    if (unavailableCarrier) {
      options.push(unavailableOption(carrier, pesoCubadoKg, pesoConsideradoKg, "Transportadora inativa."));
      continue;
    }
    if (!validRate) {
      const reason = explainNoRate(candidateRates, params, pesoConsideradoKg);
      options.push(unavailableOption(carrier, pesoCubadoKg, pesoConsideradoKg, reason));
      continue;
    }
    const kgCalculado = Math.max(0, pesoConsideradoKg - validRate.pesoInicioKg);
    const valorBase = validRate.taxaFixa + kgCalculado * validRate.kgExcedente;
    const taxaCombustivel = valorBase * validRate.combustivelPercentual;
    const taxaSeguro = params.valorDeclarado * validRate.seguroPercentual;
    const taxaValorDeclarado = params.valorDeclarado * validRate.valorDeclaradoPercentual;
    const taxaRisco = params.valorDeclarado * validRate.riscoPercentual;
    const taxasFixas = validRate.dificilAcessoValor + validRate.interiorValor + validRate.pedagioValor;
    const valorTaxas = taxaCombustivel + taxaSeguro + taxaValorDeclarado + taxaRisco + taxasFixas;
    let valorFrete = valorBase + valorTaxas;
    valorFrete = Math.max(valorFrete, validRate.minimoFrete);
    if (validRate.maximoFrete) valorFrete = Math.min(valorFrete, validRate.maximoFrete);
    options.push({
      transportadoraId: carrier.id,
      transportadoraNome: carrier.nomeFantasia,
      tarifaId: validRate.id,
      modalidade: validRate.modalidade,
      pesoRealKg: params.pesoRealKg,
      pesoCubadoKg,
      pesoConsideradoKg,
      valorBase: +valorBase.toFixed(2),
      valorTaxas: +valorTaxas.toFixed(2),
      valorFrete: +valorFrete.toFixed(2),
      prazoDias: validRate.prazoDias,
      disponivel: true,
      statusTarifa: validRate.status,
      regrasAplicadas: [
        pesoCubadoKg > params.pesoRealKg ? `Peso cubado aplicado (${pesoCubadoKg.toFixed(2)} kg)` : "Peso real aplicado",
        validRate.regrasAdicionais,
      ].filter(Boolean),
      motivoIndisponibilidade: "",
      recomendada: false,
      motivoRecomendacao: "",
    });
  }
  const available = options.filter((item) => item.disponivel);
  if (available.length) {
    let recommended;
    let reason;
    if (params.prioridade === "menor_prazo") {
      recommended = available.reduce((best, item) => (item.prazoDias < best.prazoDias ? item : best), available[0]);
      reason = "Menor prazo entre as opções disponíveis.";
    } else if (params.prioridade === "equilibrio") {
      recommended = available.reduce((best, item) => (item.valorFrete * item.prazoDias < best.valorFrete * best.prazoDias ? item : best), available[0]);
      reason = "Melhor equilíbrio entre custo e prazo.";
    } else {
      recommended = available.reduce((best, item) => (item.valorFrete < best.valorFrete ? item : best), available[0]);
      reason = "Menor custo entre as opções disponíveis.";
    }
    recommended.recomendada = true;
    recommended.motivoRecomendacao = reason;
  }
  return { options, pesoCubadoMax, pesoConsideradoMax };
}

function isRateCompatible(rate, params, pesoConsideradoKg) {
  const cep = Number(params.cepDestino.padEnd(8, "0"));
  const now = new Date().toISOString().slice(0, 10);
  return (
    rate.status === "Ativa" &&
    rate.vigenciaInicio <= now &&
    rate.vigenciaFim >= now &&
    rate.ufOrigem === "BA" &&
    rate.ufDestino === params.ufDestino &&
    cep >= Number(rate.cepInicio) &&
    cep <= Number(rate.cepFim) &&
    pesoConsideradoKg >= rate.pesoInicioKg &&
    pesoConsideradoKg <= rate.pesoFimKg
  );
}

function explainNoRate(rates, params, pesoConsideradoKg) {
  if (!rates.length) return "Nenhuma tarifa cadastrada para esta transportadora.";
  const now = new Date().toISOString().slice(0, 10);
  if (rates.every((rate) => rate.status !== "Ativa")) return "Tarifa em rascunho, pendente, vencida ou cancelada.";
  if (rates.every((rate) => rate.vigenciaInicio > now || rate.vigenciaFim < now)) return "Nenhuma tarifa vigente para esta rota.";
  if (rates.every((rate) => rate.ufDestino !== params.ufDestino)) return "UF de destino não atendida.";
  const cep = Number(params.cepDestino.padEnd(8, "0"));
  if (rates.every((rate) => cep < Number(rate.cepInicio) || cep > Number(rate.cepFim))) return "CEP fora da área atendida.";
  if (rates.every((rate) => pesoConsideradoKg < rate.pesoInicioKg || pesoConsideradoKg > rate.pesoFimKg)) return "Peso fora da faixa da tarifa.";
  return "Nenhuma tarifa válida para esta combinação.";
}

function unavailableOption(carrier, pesoCubadoKg, pesoConsideradoKg, reason) {
  return {
    transportadoraId: carrier.id,
    transportadoraNome: carrier.nomeFantasia,
    tarifaId: "",
    modalidade: "-",
    pesoRealKg: 0,
    pesoCubadoKg,
    pesoConsideradoKg,
    valorBase: 0,
    valorTaxas: 0,
    valorFrete: 0,
    prazoDias: 0,
    disponivel: false,
    statusTarifa: "Indisponivel",
    regrasAplicadas: [],
    motivoIndisponibilidade: reason,
    recomendada: false,
    motivoRecomendacao: "",
  };
}

function chooseOption(optionId) {
  const optionItem = state.quoteOptions.find((item) => item.id === optionId);
  const quote = state.quotes.find((item) => item.id === optionItem?.cotacaoId);
  const order = state.orders.find((item) => item.id === quote?.pedidoId);
  if (!optionItem || !quote || !order || !optionItem.disponivel) {
    toast("Não foi possível escolher esta opção.");
    return;
  }
  const before = JSON.stringify(order);
  quote.status = "Escolhida";
  quote.opcaoEscolhidaId = optionItem.id;
  order.status = "Frete Definido";
  order.transportadoraSelecionadaId = optionItem.transportadoraId;
  order.modalidadeSelecionada = optionItem.modalidade;
  order.cotacaoEscolhidaId = quote.id;
  order.opcaoEscolhidaId = optionItem.id;
  order.freteCalculado = optionItem.valorFrete;
  order.prazoDias = optionItem.prazoDias;
  order.atualizadoEm = new Date().toISOString().slice(0, 10);
  audit("ESCOLHEU_FRETE", "Pedido", order.id, `Escolheu ${optionItem.transportadoraNome} para ${order.numero} por ${brl(optionItem.valorFrete)}.`, before, JSON.stringify(order));
  saveState();
  setView("pedidos");
  toast("Frete escolhido e vinculado ao pedido.");
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function option(value) {
  return `<option value="${value}">${value}</option>`;
}

function empty(text = "Nenhum registro encontrado.") {
  return `<div class="empty-state"><strong>${text}</strong></div>`;
}

function exportCsv(filename, rows) {
  if (!rows.length) {
    toast("Nenhum dado para exportar.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(";")]
    .concat(rows.map((row) => headers.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(";")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function toast(message) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function setupProfileSelect() {
  const select = document.getElementById("profileSelect");
  select.innerHTML = users.map((user) => `<option value="${user.id}" ${user.id === state.currentUserId ? "selected" : ""}>${user.nome} - ${user.perfil}</option>`).join("");
  select.addEventListener("change", () => {
    state.currentUserId = select.value;
    saveState();
    render();
    toast(`Perfil ativo: ${currentUser().perfil}`);
  });
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

setupProfileSelect();
setView("dashboard");

