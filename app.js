const STORAGE_KEY = "fretehub-mvp-state-v1";
const today = new Date().toISOString().slice(0, 10);
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const digits = (v) => String(v || "").replace(/\D/g, "");
const byId = (id) => document.getElementById(id);
const days = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const users = [
  ["u1", "Ana Ribeiro", "Administrador"],
  ["u2", "Carlos Mendes", "Gestor de Logistica"],
  ["u3", "Fernanda Lima", "Operador de Frete"],
  ["u4", "Roberto Souza", "Financeiro"],
  ["u5", "Juliana Alves", "Consulta"],
].map(([id, nome, perfil]) => ({ id, nome, perfil }));

const baseCarriers = [
  {
    id: "t1",
    nomeFantasia: "Vale Sul",
    razaoSocial: "Transportadora Vale Sul LTDA",
    cnpj: "12.345.678/0001-90",
    status: "Ativa",
    fatorCubagem: 300,
    modalidades: ["Rodoviario", "Fracionado"],
    estadosAtendidos: ["BA", "SP", "PR", "SC", "RS"],
    prazoMedioDias: 5,
    contrato: "CTR-2026-001",
    observacoes: "Principal para Sul e Sudeste."
  },
  {
    id: "t2",
    nomeFantasia: "Expresso Gaucho",
    razaoSocial: "Expresso Gaucho Logistica SA",
    cnpj: "23.456.789/0001-11",
    status: "Ativa",
    fatorCubagem: 250,
    modalidades: ["Rodoviario", "Expresso"],
    estadosAtendidos: ["RS", "SC", "PR", "SP"],
    prazoMedioDias: 4,
    contrato: "CTR-2026-002",
    observacoes: "Melhor prazo para regiao Sul."
  },
  {
    id: "t3",
    nomeFantasia: "Rota Certa",
    razaoSocial: "Rota Certa Transportes LTDA",
    cnpj: "34.567.890/0001-22",
    status: "Ativa",
    fatorCubagem: 167,
    modalidades: ["Rodoviario", "Fracionado"],
    estadosAtendidos: ["BA", "SP", "RJ", "MG", "PR", "SC", "RS"],
    prazoMedioDias: 7,
    contrato: "CTR-2026-003",
    observacoes: "Cobertura ampla, custo maior."
  },
  {
    id: "t4",
    nomeFantasia: "Nordeste Cargas",
    razaoSocial: "Nordeste Cargas Expressas LTDA",
    cnpj: "45.678.901/0001-33",
    status: "Inativa",
    fatorCubagem: 300,
    modalidades: ["Fracionado"],
    estadosAtendidos: ["BA", "SE", "PE", "AL", "CE"],
    prazoMedioDias: 3,
    contrato: "CTR-2026-004",
    observacoes: "Contrato aguardando renovacao."
  }
];

const baseRates = [
  ["tar1", "Vale Sul - Fracionado SP", "t1", "Fracionado", "SP", "01000000", "19999999", 0, 80, 22, 2.1, 0.14, 0.003, 12, 9, 0.0015, 5, 45, 900, "Ativa", -60, 90],
  ["tar2", "Expresso Gaucho - RS Expresso", "t2", "Expresso", "RS", "90000000", "99999999", 0, 60, 28, 2.35, 0.16, 0.0035, 10, 14, 0.0018, 4, 55, 1100, "Ativa", -30, 60],
  ["tar3", "Rota Certa - RJ Rodoviario", "t3", "Rodoviario", "RJ", "20000000", "28999999", 0, 100, 30, 2.55, 0.18, 0.004, 8, 16, 0.002, 6, 60, 1300, "Ativa", -10, 120],
  ["tar4", "Vale Sul - Parana vencida", "t1", "Rodoviario", "PR", "80000000", "87999999", 0, 70, 24, 2.0, 0.13, 0.0025, 8, 10, 0.0012, 5, 42, 850, "Vencida", -200, -15],
  ["tar5", "Nordeste Cargas - Bahia", "t4", "Fracionado", "BA", "40000000", "48999999", 0, 40, 16, 1.65, 0.10, 0.002, 6, 3, 0.001, 3, 30, 500, "Ativa", -5, 60],
  ["tar6", "Rota Certa - Minas pendente", "t3", "Rodoviario", "MG", "30000000", "39999999", 0, 90, 26, 2.2, 0.14, 0.003, 8, 12, 0.0015, 5, 50, 950, "Pendente de Aprovacao", 1, 180]
].map((r) => ({
  id: r[0], nome: r[1], transportadoraId: r[2], modalidade: r[3], ufOrigem: "BA", ufDestino: r[4],
  cepInicio: r[5], cepFim: r[6], pesoInicioKg: r[7], pesoFimKg: r[8], taxaFixa: r[9], kgExcedente: r[10],
  combustivelPercentual: r[11], riscoPercentual: r[12], interiorValor: r[13], pedagioValor: r[14], seguroPercentual: r[15],
  prazoDias: r[16], minimoFrete: r[17], maximoFrete: r[18], status: r[19], vigenciaInicio: days(r[20]), vigenciaFim: days(r[21]),
  regrasAdicionais: "Tabela demonstrativa para MVP.", versao: 1
}));

function makeOrders() {
  const channels = ["Mercado Livre", "Shopee", "Site Proprio"];
  const customers = ["Joao da Silva", "Maria Souza", "Pedro Almeida", "Aline Barreto", "Lucas Ferreira", "Camila Duarte"];
  const ufs = ["SP", "RS", "RJ", "PR", "MG", "BA", "SC"];
  const cepBase = { SP: "01310", RS: "90010", RJ: "20040", PR: "80010", MG: "30110", BA: "40010", SC: "88010" };
  const statuses = ["Novo", "Aguardando Cotacao", "Frete Definido", "Enviado ao Protheus", "Em Expedicao", "Entregue", "Erro de Integracao"];
  return Array.from({ length: 50 }, (_, i) => {
    const uf = ufs[i % ufs.length];
    const status = statuses[(i * 3) % statuses.length];
    const hasFreight = ["Frete Definido", "Enviado ao Protheus", "Em Expedicao", "Entregue"].includes(status);
    return {
      id: `p${i + 1}`,
      numero: `SC-${100000 + i}`,
      canal: channels[i % channels.length],
      cliente: customers[i % customers.length],
      cepOrigem: "40010000",
      cepDestino: `${cepBase[uf]}${String((i * 17) % 900).padStart(3, "0")}`,
      cidadeDestino: uf === "SP" ? "Sao Paulo" : uf === "RS" ? "Porto Alegre" : uf === "RJ" ? "Rio de Janeiro" : "Capital",
      ufDestino: uf,
      valorPedido: 120 + ((i * 43) % 900),
      pesoRealKg: +(0.5 + ((i * 7) % 35) * 0.55).toFixed(2),
      comprimentoCm: 22 + (i % 40),
      larguraCm: 16 + (i % 25),
      alturaCm: 10 + (i % 30),
      volumes: 1 + (i % 3 === 0 ? 1 : 0),
      produtos: ["Eletronico compacto", "Utensilios cozinha", "Ferramenta manual", "Kit escritorio"][i % 4],
      status,
      transportadoraSelecionadaId: hasFreight ? ["t1", "t2", "t3"][i % 3] : "",
      modalidadeSelecionada: hasFreight ? (i % 2 ? "Fracionado" : "Rodoviario") : "",
      cotacaoEscolhidaId: "",
      opcaoEscolhidaId: "",
      freteCalculado: hasFreight ? +(45 + ((i * 11) % 120)).toFixed(2) : 0,
      freteCobrado: hasFreight ? +(48 + ((i * 9) % 125)).toFixed(2) : 0,
      prazoDias: hasFreight ? 3 + (i % 5) : 0,
      statusProtheus: status === "Erro de Integracao" ? "Erro" : hasFreight ? "Enviado" : "Pendente",
      atualizadoEm: days(-(i % 7))
    };
  });
}

const initialState = {
  currentUserId: "u1",
  carriers: baseCarriers,
  rates: baseRates,
  orders: makeOrders(),
  quotes: [],
  quoteOptions: [],
  audits: [
    { id: "a1", usuarioNome: "Carlos Mendes", acao: "APROVOU_TARIFA", entidade: "Tarifa", entidadeId: "tar1", detalhe: "Aprovou tarifa Vale Sul SP.", criadoEm: days(-3) },
    { id: "a2", usuarioNome: "Fernanda Lima", acao: "ALTEROU_PEDIDO", entidade: "Pedido", entidadeId: "p4", detalhe: "Atualizou peso de pedido demo.", criadoEm: days(-2) }
  ]
};

let state = loadState();
let activeView = "dashboard";
let lastQuoteId = "";

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...structuredClone(initialState), ...saved } : structuredClone(initialState);
  } catch {
    return structuredClone(initialState);
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function currentUser() { return users.find((u) => u.id === state.currentUserId) || users[0]; }
function can(action) {
  const p = currentUser().perfil;
  const rules = {
    cotar: ["Administrador", "Gestor de Logistica", "Operador de Frete"],
    escolherFrete: ["Administrador", "Gestor de Logistica", "Operador de Frete"],
    gerenciarTarifas: ["Administrador", "Gestor de Logistica"],
    configurar: ["Administrador"]
  };
  return (rules[action] || []).includes(p);
}
function audit(acao, entidade, entidadeId, detalhe) {
  state.audits.unshift({ id: `a${Date.now()}`, usuarioNome: currentUser().nome, acao, entidade, entidadeId, detalhe, criadoEm: new Date().toISOString() });
  saveState();
}
function carrierName(id) { return state.carriers.find((c) => c.id === id)?.nomeFantasia || "-"; }
function badge(status) {
  const s = String(status || "-");
  const cls = /Erro|Vencida|Inativa|Cancelada|Indisponivel/.test(s) ? "danger" : /Pendente|Aguardando|Novo|Sem/.test(s) ? "warning" : /Ativa|Definido|Entregue|Escolhida|Disponivel/.test(s) ? "success" : "info";
  return `<span class="badge ${cls}">${s}</span>`;
}
function metric(label, value) { return `<section class="card metric"><span>${label}</span><strong>${value}</strong></section>`; }
function option(value, selected = "") { return `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`; }
function empty(msg = "Nenhum registro encontrado.") { return `<div class="empty-state"><strong>${msg}</strong></div>`; }

function setView(view, options = {}) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  const titles = {
    dashboard: ["Dashboard", "Visao operacional de fretes, tarifas e pedidos."],
    pedidos: ["Pedidos", "Consulta, filtros e decisao de frete por pedido."],
    cotacao: ["Cotacao", "Calcule, salve e vincule opcoes de frete a pedidos."],
    transportadoras: ["Transportadoras", "Cadastro operacional de transportadoras e contratos."],
    tarifas: ["Tarifas", "Gestao de tabelas, vigencias, status e regras."],
    auditoria: ["Auditoria", "Historico de alteracoes e decisoes relevantes."],
    relatorios: ["Relatorios", "Custos, divergencias e exportacao CSV."],
    configuracoes: ["Configuracoes", "Preferencias operacionais e dados demo."]
  };
  byId("page-title").textContent = titles[view][0];
  byId("page-subtitle").textContent = titles[view][1];
  render(options);
}

function render(options = {}) {
  const views = { dashboard: renderDashboard, pedidos: renderOrders, cotacao: () => renderQuote(options.orderId), transportadoras: renderCarriers, tarifas: renderRates, auditoria: renderAudit, relatorios: renderReports, configuracoes: renderSettings };
  byId("app").innerHTML = views[activeView]();
  bindEvents();
}

function renderDashboard() {
  const orders = state.orders;
  const noQuote = orders.filter((o) => !o.cotacaoEscolhidaId && !o.opcaoEscolhidaId).length;
  const withFreight = orders.filter((o) => o.status === "Frete Definido").length;
  const expiredRates = state.rates.filter((r) => r.status === "Vencida" || r.vigenciaFim < today).length;
  const soonRates = state.rates.filter((r) => r.status === "Ativa" && r.vigenciaFim <= days(30)).length;
  const carrierTotals = state.carriers.map((c) => ({ name: c.nomeFantasia, total: orders.filter((o) => o.transportadoraSelecionadaId === c.id).reduce((s, o) => s + num(o.freteCalculado), 0) }));
  const max = Math.max(...carrierTotals.map((i) => i.total), 1);
  return `
    <div class="grid cols-4">
      ${metric("Pedidos", orders.length)}${metric("Cotacoes geradas", state.quotes.length)}${metric("Frete definido", withFreight)}${metric("Sem cotacao", noQuote)}
      ${metric("Tarifas vencidas", expiredRates)}${metric("Vencem em 30 dias", soonRates)}${metric("Auditorias", state.audits.length)}${metric("Transportadoras", state.carriers.length)}
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <section class="card"><div class="card-header"><h2>Custo por transportadora</h2><p>Baseado em pedidos com frete definido.</p></div><div class="card-body">
        ${carrierTotals.map((i) => `<div class="bar-row"><span>${i.name}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, Math.round(i.total / max * 100))}%"></div></div><strong>${brl(i.total)}</strong></div>`).join("")}
      </div></section>
      <section class="card"><div class="card-header"><h2>Alertas operacionais</h2><p>Pontos que exigem acao.</p></div><div class="card-body">
        <p>${badge("Pendente")} ${noQuote} pedidos sem decisao de frete.</p>
        <p>${badge("Vencida")} ${expiredRates} tarifa(s) vencida(s).</p>
        <p>${badge("Aguardando")} ${soonRates} tarifa(s) vencem em ate 30 dias.</p>
        <p>${badge("Erro de Integracao")} ${orders.filter((o) => o.status === "Erro de Integracao").length} pedido(s) com erro simulado.</p>
      </div></section>
    </div>`;
}

function ordersTable(rows) {
  if (!rows.length) return `<tr><td colspan="9">${empty()}</td></tr>`;
  return rows.map((o) => `<tr>
    <td><strong>${o.numero}</strong><br><span class="muted">${o.canal}</span></td><td>${o.cliente}<br><span class="muted">${o.produtos}</span></td>
    <td>${o.cepDestino}<br><span class="muted">${o.cidadeDestino}/${o.ufDestino}</span></td><td>${brl(o.valorPedido)}</td><td>${o.pesoRealKg} kg<br><span class="muted">${o.volumes} vol.</span></td>
    <td>${badge(o.status)}</td><td>${carrierName(o.transportadoraSelecionadaId)}<br><span class="money">${o.freteCalculado ? brl(o.freteCalculado) : "-"}</span></td>
    <td>${o.statusProtheus}</td><td><button class="button quote-order" data-order-id="${o.id}" ${can("cotar") ? "" : "disabled"}>Cotar</button></td>
  </tr>`).join("");
}
function renderOrders() {
  const statuses = [...new Set(state.orders.map((o) => o.status))];
  const channels = [...new Set(state.orders.map((o) => o.canal))];
  return `<div class="toolbar"><div class="filters">
    <div class="field"><label>Busca</label><input id="orderSearch" placeholder="Pedido, cliente ou CEP"></div>
    <div class="field"><label>Status</label><select id="orderStatus"><option value="">Todos</option>${statuses.map((s) => option(s)).join("")}</select></div>
    <div class="field"><label>Canal</label><select id="orderChannel"><option value="">Todos</option>${channels.map((s) => option(s)).join("")}</select></div>
  </div><button class="button secondary" id="exportOrders">Exportar CSV</button></div>
  <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Destino</th><th>Valor</th><th>Peso</th><th>Status</th><th>Frete</th><th>Protheus</th><th>Acao</th></tr></thead><tbody id="ordersTable">${ordersTable(state.orders)}</tbody></table></div>`;
}

function renderQuote(orderId) {
  const order = state.orders.find((o) => o.id === orderId) || state.orders.find((o) => o.status !== "Frete Definido") || state.orders[0];
  const quote = lastQuoteId ? state.quotes.find((q) => q.id === lastQuoteId) : state.quotes.find((q) => q.pedidoId === order.id);
  const opts = quote ? state.quoteOptions.filter((o) => o.cotacaoId === quote.id) : [];
  return `<div class="split"><section class="card"><div class="card-header"><h2>Simulador</h2><p>Dados do pedido e prioridade.</p></div><div class="card-body"><div class="form-grid">
    <div class="field wide"><label>Pedido</label><select id="quoteOrder">${state.orders.map((o) => `<option value="${o.id}" ${o.id === order.id ? "selected" : ""}>${o.numero} - ${o.cliente}</option>`).join("")}</select></div>
    <div class="field"><label>CEP origem</label><input id="cepOrigem" value="${order.cepOrigem}"></div><div class="field"><label>CEP destino</label><input id="cepDestino" value="${order.cepDestino}"></div>
    <div class="field"><label>UF destino</label><input id="ufDestino" value="${order.ufDestino}"></div><div class="field"><label>Valor declarado</label><input id="valorDeclarado" type="number" value="${order.valorPedido}"></div>
    <div class="field"><label>Peso real kg</label><input id="pesoRealKg" type="number" step="0.01" value="${order.pesoRealKg}"></div><div class="field"><label>Volumes</label><input id="volumes" type="number" value="${order.volumes}"></div>
    <div class="field"><label>Comprimento cm</label><input id="comprimentoCm" type="number" value="${order.comprimentoCm}"></div><div class="field"><label>Largura cm</label><input id="larguraCm" type="number" value="${order.larguraCm}"></div>
    <div class="field"><label>Altura cm</label><input id="alturaCm" type="number" value="${order.alturaCm}"></div><div class="field"><label>Prioridade</label><select id="prioridade"><option value="menor_custo">Menor custo</option><option value="menor_prazo">Menor prazo</option><option value="equilibrio">Equilibrio</option></select></div>
    <div class="field wide"><label>Transportadoras</label><div class="check-list">${state.carriers.map((c) => `<label class="check-item"><input class="carrier-check" type="checkbox" value="${c.id}" checked> ${c.nomeFantasia} - ${c.status}</label>`).join("")}</div></div>
    <button class="button wide" id="calculateQuote" ${can("cotar") ? "" : "disabled"}>Calcular cotacao</button>
  </div></div></section><section class="card"><div class="card-header"><h2>Opcoes</h2><p>${quote ? `${quote.status} - peso usado ${quote.pesoConsideradoKg.toFixed(2)} kg` : "Calcule para comparar transportadoras."}</p></div><div class="card-body">${quoteOptionsTable(opts)}</div></section></div>`;
}
function quoteOptionsTable(opts) {
  if (!opts.length) return empty("Nenhuma cotacao calculada para este pedido.");
  return `<div class="table-wrap"><table><thead><tr><th>Transportadora</th><th>Peso</th><th>Frete</th><th>Taxas</th><th>Prazo</th><th>Status</th><th>Regras</th><th>Acao</th></tr></thead><tbody>${opts.map((o) => `<tr>
    <td><strong>${o.transportadoraNome}</strong><br><span class="muted">${o.modalidade}</span>${o.recomendada ? `<br>${badge("Recomendada")}` : ""}</td>
    <td>Real ${o.pesoRealKg.toFixed(2)} kg<br>Usado ${o.pesoConsideradoKg.toFixed(2)} kg</td><td class="money"><strong>${o.disponivel ? brl(o.valorFrete) : "-"}</strong></td><td>${o.disponivel ? brl(o.valorTaxas) : "-"}</td>
    <td>${o.disponivel ? `${o.prazoDias}d` : "-"}</td><td>${badge(o.disponivel ? "Disponivel" : o.statusTarifa)}</td><td>${o.disponivel ? o.regrasAplicadas.join("<br>") : o.motivoIndisponibilidade}${o.motivoRecomendacao ? `<br><strong>${o.motivoRecomendacao}</strong>` : ""}</td>
    <td><button class="button choose-option" data-option-id="${o.id}" ${o.disponivel && can("escolherFrete") ? "" : "disabled"}>Escolher</button></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function renderCarriers() {
  return `<div class="grid cols-3">${state.carriers.map((c) => `<section class="card"><div class="card-header"><h2>${c.nomeFantasia}</h2><p>${c.razaoSocial}</p></div><div class="card-body"><p>${badge(c.status)} Contrato ${c.contrato}</p><p><strong>CNPJ:</strong> ${c.cnpj}</p><p><strong>Modalidades:</strong> ${c.modalidades.join(", ")}</p><p><strong>Estados:</strong> ${c.estadosAtendidos.join(", ")}</p><p><strong>Fator cubagem:</strong> ${c.fatorCubagem}</p><p class="muted">${c.observacoes}</p></div></section>`).join("")}</div>`;
}
function renderRates() {
  return `<div class="toolbar"><button class="button secondary" id="downloadRateModel">Baixar modelo CSV</button></div><div class="table-wrap"><table><thead><tr><th>Tarifa</th><th>Transportadora</th><th>Rota</th><th>CEP</th><th>Peso</th><th>Base</th><th>Prazo</th><th>Vigencia</th><th>Status</th></tr></thead><tbody>${state.rates.map((r) => `<tr><td><strong>${r.nome}</strong><br><span class="muted">v${r.versao}</span></td><td>${carrierName(r.transportadoraId)}<br>${r.modalidade}</td><td>${r.ufOrigem} -> ${r.ufDestino}</td><td>${r.cepInicio} a ${r.cepFim}</td><td>${r.pesoInicioKg} a ${r.pesoFimKg} kg</td><td>${brl(r.taxaFixa)} + ${brl(r.kgExcedente)}/kg</td><td>${r.prazoDias}d</td><td>${r.vigenciaInicio}<br>${r.vigenciaFim}</td><td>${badge(r.status)}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderAudit() {
  return `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Usuario</th><th>Acao</th><th>Entidade</th><th>Detalhe</th></tr></thead><tbody>${state.audits.map((a) => `<tr><td>${new Date(a.criadoEm).toLocaleString("pt-BR")}</td><td>${a.usuarioNome}</td><td>${badge(a.acao)}</td><td>${a.entidade}<br><span class="muted">${a.entidadeId}</span></td><td>${a.detalhe}</td></tr>`).join("")}</tbody></table></div>`;
}
function renderReports() {
  const divergence = state.orders.filter((o) => o.freteCalculado && o.freteCobrado && Math.abs(o.freteCalculado - o.freteCobrado) > 20);
  return `<div class="grid cols-3">${metric("Divergencias", divergence.length)}${metric("Custo calculado", brl(state.orders.reduce((s, o) => s + num(o.freteCalculado), 0)))}${metric("Opcoes cotadas", state.quoteOptions.length)}</div><section class="card" style="margin-top:16px"><div class="card-header"><h2>Exportacoes</h2><p>CSV para analise externa.</p></div><div class="card-body"><button class="button secondary" id="exportQuotes">Exportar cotacoes</button> <button class="button secondary" id="exportAudit">Exportar auditoria</button></div></section>`;
}
function renderSettings() {
  return `<section class="card"><div class="card-header"><h2>Configuracoes do MVP</h2><p>Dados salvos no navegador.</p></div><div class="card-body"><p><strong>Usuario atual:</strong> ${currentUser().nome} - ${currentUser().perfil}</p><p><strong>Persistencia:</strong> localStorage</p><p><strong>Ambiente:</strong> demonstrativo</p><button class="button danger" id="resetData">Restaurar dados demo</button></div></section>`;
}

function bindEvents() {
  if (activeView === "pedidos") {
    const apply = () => {
      const q = byId("orderSearch").value.toLowerCase();
      const st = byId("orderStatus").value;
      const ch = byId("orderChannel").value;
      const rows = state.orders.filter((o) => `${o.numero} ${o.cliente} ${o.cepDestino}`.toLowerCase().includes(q) && (!st || o.status === st) && (!ch || o.canal === ch));
      byId("ordersTable").innerHTML = ordersTable(rows);
      bindOrderButtons();
    };
    ["orderSearch", "orderStatus", "orderChannel"].forEach((id) => byId(id).addEventListener("input", apply));
    byId("exportOrders").addEventListener("click", () => exportCsv("pedidos.csv", state.orders));
    bindOrderButtons();
  }
  if (activeView === "cotacao") {
    byId("quoteOrder").addEventListener("change", (e) => setView("cotacao", { orderId: e.target.value }));
    byId("calculateQuote").addEventListener("click", handleCalculateQuote);
    document.querySelectorAll(".choose-option").forEach((b) => b.addEventListener("click", () => chooseOption(b.dataset.optionId)));
  }
  if (activeView === "tarifas") byId("downloadRateModel").addEventListener("click", () => exportCsv("modelo-tarifas.csv", [baseRates[0]]));
  if (activeView === "relatorios") {
    byId("exportQuotes").addEventListener("click", () => exportCsv("cotacoes.csv", state.quotes));
    byId("exportAudit").addEventListener("click", () => exportCsv("auditoria.csv", state.audits));
  }
  if (activeView === "configuracoes") byId("resetData").addEventListener("click", () => {
    if (!confirm("Restaurar dados demo e apagar cotacoes locais?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    setupProfileSelect();
    setView("dashboard");
    toast("Dados demo restaurados.");
  });
}
function bindOrderButtons() { document.querySelectorAll(".quote-order").forEach((b) => b.addEventListener("click", () => setView("cotacao", { orderId: b.dataset.orderId }))); }

function handleCalculateQuote() {
  const order = state.orders.find((o) => o.id === byId("quoteOrder").value);
  const p = {
    pedidoId: order.id,
    cepOrigem: digits(byId("cepOrigem").value),
    cepDestino: digits(byId("cepDestino").value),
    ufDestino: byId("ufDestino").value.toUpperCase(),
    pesoRealKg: num(byId("pesoRealKg").value),
    comprimentoCm: num(byId("comprimentoCm").value),
    larguraCm: num(byId("larguraCm").value),
    alturaCm: num(byId("alturaCm").value),
    volumes: num(byId("volumes").value, 1),
    valorDeclarado: num(byId("valorDeclarado").value),
    prioridade: byId("prioridade").value,
    transportadorasHabilitadas: [...document.querySelectorAll(".carrier-check:checked")].map((i) => i.value)
  };
  const errors = [];
  if (!p.cepOrigem || !p.cepDestino) errors.push("Informe CEP origem e destino.");
  if (p.pesoRealKg <= 0 || p.comprimentoCm <= 0 || p.larguraCm <= 0 || p.alturaCm <= 0) errors.push("Peso e dimensoes devem ser maiores que zero.");
  if (p.valorDeclarado <= 0) errors.push("Valor declarado deve ser maior que zero.");
  if (!p.transportadorasHabilitadas.length) errors.push("Selecione ao menos uma transportadora.");
  if (errors.length) return toast(errors.join(" "));
  const result = calculateQuote(p);
  const quote = { id: `cot${Date.now()}`, pedidoId: order.id, usuarioId: currentUser().id, prioridade: p.prioridade, cepOrigem: p.cepOrigem, cepDestino: p.cepDestino, ufDestino: p.ufDestino, pesoRealKg: p.pesoRealKg, pesoCubadoKg: result.pesoCubadoMax, pesoConsideradoKg: result.pesoConsideradoMax, valorDeclarado: p.valorDeclarado, volumes: p.volumes, status: result.options.some((o) => o.disponivel) ? "Calculada" : "Sem Opcao", opcaoEscolhidaId: "", criadoEm: new Date().toISOString() };
  const options = result.options.map((o) => ({ ...o, id: `op${Date.now()}${Math.random().toString(16).slice(2)}`, cotacaoId: quote.id, criadoEm: new Date().toISOString() }));
  state.quotes.unshift(quote);
  state.quoteOptions.unshift(...options);
  lastQuoteId = quote.id;
  audit("GEROU_COTACAO", "Cotacao", quote.id, `Gerou cotacao para pedido ${order.numero}.`);
  saveState();
  setView("cotacao", { orderId: order.id });
  toast("Cotacao calculada e salva.");
}

function calculateQuote(p) {
  const options = [];
  let pesoCubadoMax = 0;
  let pesoConsideradoMax = 0;
  for (const c of state.carriers) {
    if (!p.transportadorasHabilitadas.includes(c.id)) continue;
    const pesoCubadoKg = (p.comprimentoCm * p.larguraCm * p.alturaCm / c.fatorCubagem) * p.volumes;
    const pesoConsideradoKg = Math.max(p.pesoRealKg, pesoCubadoKg);
    pesoCubadoMax = Math.max(pesoCubadoMax, pesoCubadoKg);
    pesoConsideradoMax = Math.max(pesoConsideradoMax, pesoConsideradoKg);
    if (c.status !== "Ativa") { options.push(unavailable(c, pesoCubadoKg, pesoConsideradoKg, "Transportadora inativa.")); continue; }
    const candidates = state.rates.filter((r) => r.transportadoraId === c.id);
    const rate = candidates.find((r) => isRateCompatible(r, p, pesoConsideradoKg));
    if (!rate) { options.push(unavailable(c, pesoCubadoKg, pesoConsideradoKg, explainNoRate(candidates, p, pesoConsideradoKg))); continue; }
    const kg = Math.max(0, pesoConsideradoKg - rate.pesoInicioKg);
    const valorBase = rate.taxaFixa + kg * rate.kgExcedente;
    const valorTaxas = valorBase * rate.combustivelPercentual + p.valorDeclarado * rate.seguroPercentual + p.valorDeclarado * rate.riscoPercentual + rate.interiorValor + rate.pedagioValor;
    let valorFrete = Math.max(valorBase + valorTaxas, rate.minimoFrete);
    if (rate.maximoFrete) valorFrete = Math.min(valorFrete, rate.maximoFrete);
    options.push({ transportadoraId: c.id, transportadoraNome: c.nomeFantasia, tarifaId: rate.id, modalidade: rate.modalidade, pesoRealKg: p.pesoRealKg, pesoCubadoKg, pesoConsideradoKg, valorBase: +valorBase.toFixed(2), valorTaxas: +valorTaxas.toFixed(2), valorFrete: +valorFrete.toFixed(2), prazoDias: rate.prazoDias, disponivel: true, statusTarifa: rate.status, regrasAplicadas: [pesoCubadoKg > p.pesoRealKg ? `Peso cubado aplicado (${pesoCubadoKg.toFixed(2)} kg)` : "Peso real aplicado", rate.regrasAdicionais].filter(Boolean), motivoIndisponibilidade: "", recomendada: false, motivoRecomendacao: "" });
  }
  const available = options.filter((o) => o.disponivel);
  if (available.length) {
    let best;
    let reason;
    if (p.prioridade === "menor_prazo") { best = available.reduce((a, b) => b.prazoDias < a.prazoDias ? b : a); reason = "Menor prazo entre as opcoes disponiveis."; }
    else if (p.prioridade === "equilibrio") { best = available.reduce((a, b) => b.valorFrete * b.prazoDias < a.valorFrete * a.prazoDias ? b : a); reason = "Melhor equilibrio entre custo e prazo."; }
    else { best = available.reduce((a, b) => b.valorFrete < a.valorFrete ? b : a); reason = "Menor custo entre as opcoes disponiveis."; }
    best.recomendada = true;
    best.motivoRecomendacao = reason;
  }
  return { options, pesoCubadoMax, pesoConsideradoMax };
}
function isRateCompatible(r, p, peso) {
  const cep = Number(p.cepDestino.padEnd(8, "0"));
  return r.status === "Ativa" && r.vigenciaInicio <= today && r.vigenciaFim >= today && r.ufOrigem === "BA" && r.ufDestino === p.ufDestino && cep >= Number(r.cepInicio) && cep <= Number(r.cepFim) && peso >= r.pesoInicioKg && peso <= r.pesoFimKg;
}
function explainNoRate(rates, p, peso) {
  if (!rates.length) return "Nenhuma tarifa cadastrada para esta transportadora.";
  if (rates.every((r) => r.status !== "Ativa")) return "Tarifa pendente, vencida ou cancelada.";
  if (rates.every((r) => r.vigenciaInicio > today || r.vigenciaFim < today)) return "Nenhuma tarifa vigente.";
  if (rates.every((r) => r.ufDestino !== p.ufDestino)) return "UF de destino nao atendida.";
  const cep = Number(p.cepDestino.padEnd(8, "0"));
  if (rates.every((r) => cep < Number(r.cepInicio) || cep > Number(r.cepFim))) return "CEP fora da area atendida.";
  if (rates.every((r) => peso < r.pesoInicioKg || peso > r.pesoFimKg)) return "Peso fora da faixa.";
  return "Nenhuma tarifa valida para esta combinacao.";
}
function unavailable(c, pesoCubadoKg, pesoConsideradoKg, reason) {
  return { transportadoraId: c.id, transportadoraNome: c.nomeFantasia, tarifaId: "", modalidade: "-", pesoRealKg: 0, pesoCubadoKg, pesoConsideradoKg, valorBase: 0, valorTaxas: 0, valorFrete: 0, prazoDias: 0, disponivel: false, statusTarifa: "Indisponivel", regrasAplicadas: [], motivoIndisponibilidade: reason, recomendada: false, motivoRecomendacao: "" };
}
function chooseOption(id) {
  const optionItem = state.quoteOptions.find((o) => o.id === id);
  const quote = state.quotes.find((q) => q.id === optionItem?.cotacaoId);
  const order = state.orders.find((o) => o.id === quote?.pedidoId);
  if (!optionItem || !quote || !order || !optionItem.disponivel) return toast("Nao foi possivel escolher esta opcao.");
  quote.status = "Escolhida";
  quote.opcaoEscolhidaId = optionItem.id;
  order.status = "Frete Definido";
  order.transportadoraSelecionadaId = optionItem.transportadoraId;
  order.modalidadeSelecionada = optionItem.modalidade;
  order.cotacaoEscolhidaId = quote.id;
  order.opcaoEscolhidaId = optionItem.id;
  order.freteCalculado = optionItem.valorFrete;
  order.prazoDias = optionItem.prazoDias;
  order.atualizadoEm = today;
  audit("ESCOLHEU_FRETE", "Pedido", order.id, `Escolheu ${optionItem.transportadoraNome} para ${order.numero} por ${brl(optionItem.valorFrete)}.`);
  saveState();
  setView("pedidos");
  toast("Frete escolhido e vinculado ao pedido.");
}
function exportCsv(filename, rows) {
  if (!rows.length) return toast("Nenhum dado para exportar.");
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(";")].concat(rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";"))).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
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
  const select = byId("profileSelect");
  select.innerHTML = users.map((u) => `<option value="${u.id}" ${u.id === state.currentUserId ? "selected" : ""}>${u.nome} - ${u.perfil}</option>`).join("");
  select.addEventListener("change", () => { state.currentUserId = select.value; saveState(); render(); toast(`Perfil ativo: ${currentUser().perfil}`); });
}
document.querySelectorAll(".nav-item").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
setupProfileSelect();
setView("dashboard");
