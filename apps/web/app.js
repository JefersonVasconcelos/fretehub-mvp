const API = location.origin;
let token = localStorage.getItem("fretehub-v2-token") || "";
let state = { orders: [], carriers: [], rates: [], integrations: [], channels: [], user: null };
let demoRole = localStorage.getItem("fretehub-v2-demo-role") || "";

const $ = (id) => document.getElementById(id);
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Falha na API");
  return data;
}

function setTitle(title, subtitle) {
  $("title").textContent = title;
  $("subtitle").textContent = subtitle;
}

function setNavHidden(hidden) {
  document.querySelector(".shell").classList.toggle("nav-hidden", hidden);
  $("showNav").classList.toggle("hidden", !hidden);
  localStorage.setItem("fretehub-v2-nav-hidden", hidden ? "1" : "0");
}

function currentRole() {
  return demoRole || state.user?.perfis?.[0] || state.user?.perfil || "Perfil";
}

function updateUserMenu() {
  const menu = $("userMenu");
  if (!state.user || !token) {
    menu.classList.add("hidden");
    closeUserMenu();
    return;
  }
  $("userMenuName").textContent = state.user.nome || "Usuario";
  $("userMenuEmail").textContent = state.user.email || "";
  $("userMenuRole").textContent = currentRole();
  document.querySelectorAll("[data-demo-role]").forEach((button) => {
    const selected = button.dataset.demoRole === currentRole();
    button.classList.toggle("selected", selected);
    button.textContent = button.dataset.demoRole;
  });
  menu.classList.remove("hidden");
}

function closeUserMenu() {
  $("userMenuDropdown")?.classList.add("hidden");
  $("userMenuButton")?.setAttribute("aria-expanded", "false");
}

function toggleUserMenu() {
  const dropdown = $("userMenuDropdown");
  const open = dropdown.classList.toggle("hidden");
  $("userMenuButton").setAttribute("aria-expanded", open ? "false" : "true");
}

function badge(value) {
  const cls = /Erro|Falha|Inativa|Vencida|Nao/.test(value) ? "bad" : /Pendente|Aguardando|Novo/.test(value) ? "warn" : "ok";
  return `<span class="badge ${cls}">${value || "-"}</span>`;
}

function toast(message) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function renderLogin() {
  setTitle("Login", "Entre para acessar a API V2.");
  state.user = null;
  updateUserMenu();
  $("app").innerHTML = `
    <section class="card form">
      <label>Email <input id="email" value="admin@salvadorcomercial.com.br"></label>
      <label>Senha <input id="password" type="password" value="Admin123!"></label>
      <button class="primary" id="login">Entrar</button>
    </section>`;
  $("login").onclick = async () => {
    try {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: $("email").value, password: $("password").value }),
      });
      token = data.token;
      localStorage.setItem("fretehub-v2-token", token);
      await loadBase();
      renderDashboard();
    } catch (err) {
      toast(err.message);
    }
  };
}

async function loadBase() {
  const [me, orders, carriers, rates, integrations, channels] = await Promise.all([
    request("/api/me"),
    request("/api/orders"),
    request("/api/carriers"),
    request("/api/rates"),
    request("/api/integrations"),
    request("/api/channels"),
  ]);
  state = { orders, carriers, rates, integrations, channels, user: me };
  if (!demoRole) demoRole = me.perfis?.[0] || me.perfil || "";
  updateUserMenu();
}

async function renderDashboard() {
  setActive("dashboard");
  setTitle("Dashboard operacional", `${state.orders.length} pedidos · ${state.carriers.filter((c) => c.status === "Ativa").length} transportadoras · ${state.rates.length} tarifas cadastradas`);
  const d = await request("/api/dashboard");
  const waiting = state.orders.filter((order) => order.status === "Aguardando Cotacao").length;
  const integrationErrors = state.orders.filter((order) => order.status === "Erro de Integracao" || order.statusProtheus === "Erro").length;
  const freightAboveLimit = state.orders.filter((order) => Number(order.freteCalculado || 0) > 100).length;
  const ratesExpiring = state.rates.filter((rate) => {
    const end = new Date(`${rate.vigenciaFim}T00:00:00`);
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    return end >= new Date() && end <= limit;
  }).length;
  const carrierCosts = groupedRows(
    state.orders.filter((order) => order.transportadoraSelecionadaId),
    (order) => carrierName(order.transportadoraSelecionadaId),
    (label, orders) => ({ label, value: sum(orders, "freteCalculado"), orders }),
  ).slice(0, 3);
  const channelRows = groupedRows(state.orders, (order) => order.canal || "Sem canal", (label, orders) => ({ label, value: orders.length, orders }));
  const channelCosts = groupedRows(state.orders, (order) => order.canal || "Sem canal", (label, orders) => ({ label, value: sum(orders, "freteCalculado") / Math.max(orders.length, 1) }));
  const regionRows = groupedRows(state.orders, (order) => order.ufDestino || "Sem UF", (label, orders) => ({ label, value: orders.length })).slice(0, 8);
  const ranking = carrierCosts.map((item) => ({
    name: item.label,
    orders: item.orders.length,
    cost: item.value,
    deadline: sum(item.orders, "prazoDias") / Math.max(item.orders.filter((order) => Number(order.prazoDias) > 0).length, 1),
  }));
  $("app").innerHTML = `<div class="dashboard-page">
    <div class="dashboard-metrics">
      ${dashboardMetric("Pedidos totais", d.pedidos, "cube", "blue")}
      ${dashboardMetric("Aguardando frete", waiting, "timer", "orange")}
      ${dashboardMetric("Erros de integracao", integrationErrors, "alert", "red")}
      ${dashboardMetric("Frete acima do limite", freightAboveLimit, "trend", "orange")}
      ${dashboardMetric("Tarifas vencidas", d.tarifasVencidas, "money", "red")}
      ${dashboardMetric("Tarifas prox. vencimento", ratesExpiring, "truck", "orange")}
    </div>
    <div class="dashboard-grid">
      <section class="card dashboard-chart wide">
        <h3>Custo por transportadora</h3>
        ${barChart(carrierCosts, { max: 1000, color: "#174f8f", ticks: [1000, 750, 500, 250, 0] })}
      </section>
      <section class="card dashboard-chart">
        <h3>Pedidos por canal</h3>
        ${pieChart(channelRows)}
      </section>
      <section class="card dashboard-chart">
        <h3>Custo medio por canal</h3>
        ${barChart(channelCosts, { max: 100, color: "#1976d2", ticks: [100, 75, 50, 25, 0] })}
      </section>
      <section class="card dashboard-chart">
        <h3>Pedidos por regiao</h3>
        ${barChart(regionRows, { max: 8, color: "#248f45", ticks: [8, 6, 4, 2, 0] })}
      </section>
      <section class="card dashboard-chart">
        <h3>Ranking transportadoras</h3>
        <div class="table compact-table"><table><thead><tr><th>Transportadora</th><th>Pedidos</th><th>Custo (R$)</th><th>Prazo medio</th></tr></thead><tbody>
          ${ranking.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.orders}</td><td>${item.cost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>${item.deadline.toFixed(1)}d</td></tr>`).join("")}
        </tbody></table></div>
      </section>
      <section class="card dashboard-table">
        <h3>Pedidos recentes</h3>
        <div class="table compact-table"><table><thead><tr><th>Pedido</th><th>Canal</th><th>Cliente</th><th>UF</th><th>Valor</th><th>Frete</th><th>Status</th></tr></thead><tbody>
          ${state.orders.slice(0, 6).map((order) => `<tr><td>${escapeHtml(order.numero)}</td><td>${escapeHtml(order.canal)}</td><td>${escapeHtml(order.cliente)}</td><td>${escapeHtml(order.ufDestino)}</td><td>${brl(order.valorPedido)}</td><td>${Number(order.freteCalculado || 0) ? brl(order.freteCalculado) : "-"}</td><td>${statusBadge(order.status)}</td></tr>`).join("")}
        </tbody></table></div>
      </section>
    </div>
  </div>`;
  animateDashboardNumbers();
}

function metric(label, value) {
  return `<section class="card metric"><span>${label}</span><strong>${value}</strong></section>`;
}

function carrierName(id) {
  return state.carriers.find((carrier) => carrier.id === id)?.nomeFantasia || "Sem transportadora";
}

function dashboardMetric(label, value, icon, tone) {
  return `<section class="card dashboard-metric">
    <span>${escapeHtml(label)}</span>
    <strong data-count="${Number(value || 0)}">0</strong>
    <i class="metric-icon ${tone}" data-icon="${icon}"></i>
  </section>`;
}

function barChart(items, options) {
  const max = options.max || Math.max(...items.map((item) => item.value), 1);
  const ticks = options.ticks || [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];
  return `<div class="bar-chart" style="--bar-color:${options.color};">
    <div class="chart-axis">${ticks.map((tick) => `<span>${tick}</span>`).join("")}</div>
    <div class="bar-plot">
      ${items.map((item, index) => `<div class="bar-item"><span class="bar" style="height:${Math.max(4, Math.round((item.value / max) * 100))}%; --bar-delay:${index * 90}ms"></span><small>${escapeHtml(item.label)}</small></div>`).join("")}
    </div>
  </div>`;
}

function pieChart(items) {
  const total = items.reduce((acc, item) => acc + item.value, 0) || 1;
  const colors = ["#174f8f", "#1976d2", "#238c45", "#f59e0b"];
  let start = 0;
  const segments = items.map((item, index) => {
    const end = start + (item.value / total) * 100;
    const segment = `${colors[index % colors.length]} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `<div class="pie-wrap">
    <div class="pie-chart" style="background: conic-gradient(${segments.join(", ")});"></div>
    <div class="pie-legend">${items.map((item, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(item.label)}</span>`).join("")}</div>
  </div>`;
}

function statusBadge(value) {
  const lower = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const cls = lower.includes("erro") || lower.includes("falha") || lower.includes("vencida")
    ? "bad"
    : lower.includes("nao iniciado")
      ? "muted"
      : lower.includes("novo") || lower.includes("frete definido")
        ? "info"
        : lower.includes("exped") || lower.includes("pendente") || lower.includes("aguardando") || lower.includes("transito") || lower.includes("coletado") || lower.includes("parcial")
          ? "warn"
          : "ok";
  return `<span class="status-pill ${cls}">${escapeHtml(value || "-")}</span>`;
}

function orderCarrier(order) {
  return order.transportadoraSelecionadaId ? carrierName(order.transportadoraSelecionadaId) : "-";
}

function orderFreight(order) {
  return Number(order.freteCalculado || 0) ? brl(order.freteCalculado) : "-";
}

function orderDeadline(order) {
  return Number(order.prazoDias || 0) ? `${order.prazoDias}d` : "-";
}

function orderProtheusStatus(order) {
  if (order.statusProtheus === "Erro" || String(order.status || "").includes("Erro")) return "Erro";
  if (order.statusProtheus === "Enviado" || Number(order.freteCalculado || 0)) return "Enviado";
  return "Pendente";
}

function orderExpeditionStatus(order, index) {
  const status = String(order.status || "");
  if (status.includes("Entregue")) return "Entregue";
  if (status.includes("Exped")) return "Coletado";
  if (status.includes("Enviado") && index % 2 === 1) return "Em trânsito";
  return "Não iniciado";
}

function orderStatusOptions() {
  return [...new Set(state.orders.map((order) => order.status).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function orderChannelOptions() {
  return [...new Set(state.orders.map((order) => order.canal).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function filterOrders() {
  const query = ($("orderSearch")?.value || "").trim().toLowerCase();
  const status = $("orderStatusFilter")?.value || "all";
  const channel = $("orderChannelFilter")?.value || "all";
  const quick = $("orderQuickFilter")?.value || "all";
  return state.orders.filter((order) => {
    const text = [order.numero, order.cliente, order.cepDestino].join(" ").toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesStatus = status === "all" || order.status === status;
    const matchesChannel = channel === "all" || order.canal === channel;
    const matchesQuick = quick === "all"
      || (quick === "noFreight" && !Number(order.freteCalculado || 0))
      || (quick === "errors" && (String(order.status || "").includes("Erro") || order.statusProtheus === "Erro"))
      || (quick === "protheusPending" && orderProtheusStatus(order) === "Pendente")
      || (quick === "expeditionPending" && orderExpeditionStatus(order, state.orders.indexOf(order)) === "Não iniciado");
    return matchesQuery && matchesStatus && matchesChannel && matchesQuick;
  });
}

function renderOrdersTable(orders) {
  const rows = orders.map((order) => {
    const index = state.orders.indexOf(order);
    return `<tr>
      <td>${escapeHtml(order.numero)}</td>
      <td>${escapeHtml(order.canal || "-")}</td>
      <td>${escapeHtml(order.cliente || "-")}</td>
      <td>${escapeHtml(order.ufDestino || "-")}</td>
      <td>${escapeHtml(order.cepDestino || "-")}</td>
      <td>${brl(order.valorPedido)}</td>
      <td>${Number(order.pesoRealKg || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}kg</td>
      <td>${escapeHtml(orderCarrier(order))}</td>
      <td>${orderFreight(order)}</td>
      <td>${orderDeadline(order)}</td>
      <td>${statusBadge(order.status)}</td>
      <td>${statusBadge(orderProtheusStatus(order))}</td>
      <td>${statusBadge(orderExpeditionStatus(order, index))}</td>
    </tr>`;
  }).join("");
  return rows || `<tr><td colspan="13" class="empty-state">Nenhum pedido encontrado.</td></tr>`;
}

function exportOrdersCsv(orders) {
  const header = ["Pedido", "Canal", "Cliente", "UF", "CEP", "Valor", "Peso", "Transp.", "Frete", "Prazo", "Status", "Protheus", "Expedicao"];
  const rows = orders.map((order) => {
    const index = state.orders.indexOf(order);
    return [
      order.numero,
      order.canal,
      order.cliente,
      order.ufDestino,
      order.cepDestino,
      brl(order.valorPedido),
      `${Number(order.pesoRealKg || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}kg`,
      orderCarrier(order),
      orderFreight(order),
      orderDeadline(order),
      order.status,
      orderProtheusStatus(order),
      orderExpeditionStatus(order, index),
    ];
  });
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "pedidos-fretehub.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function animateDashboardNumbers() {
  document.querySelectorAll("[data-count]").forEach((node) => {
    const target = Number(node.dataset.count || 0);
    const start = performance.now();
    const duration = 700;
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function renderOrders() {
  setActive("orders");
  setTitle("Pedidos", `${state.orders.length} pedidos exibidos`);
  $("app").innerHTML = `<section class="orders-page">
    <div class="orders-actions">
      <button class="secondary icon-button" id="exportOrdersCsv" type="button">⇩ Exportar CSV</button>
    </div>
    <div class="orders-filter">
      <label class="orders-search">
        <span>Buscar</span>
        <input id="orderSearch" placeholder="Buscar por número, cliente ou CEP">
      </label>
      <label>
        <span>Status</span>
        <select id="orderStatusFilter">
          <option value="all">Todos</option>
          ${orderStatusOptions().map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Canal</span>
        <select id="orderChannelFilter">
          <option value="all">Todos</option>
          ${orderChannelOptions().map((channel) => `<option value="${escapeHtml(channel)}">${escapeHtml(channel)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>Filtros rápidos</span>
        <select id="orderQuickFilter">
          <option value="all">Filtros rápidos</option>
          <option value="noFreight">Sem frete definido</option>
          <option value="errors">Com erro</option>
          <option value="protheusPending">Protheus pendente</option>
          <option value="expeditionPending">Expedição pendente</option>
        </select>
      </label>
    </div>
    <div class="table orders-table">
      <table>
        <thead><tr><th>Pedido</th><th>Canal</th><th>Cliente</th><th>UF</th><th>CEP</th><th>Valor</th><th>Peso</th><th>Transp.</th><th>Frete</th><th>Prazo</th><th>Status</th><th>Protheus</th><th>Expedição</th></tr></thead>
        <tbody id="ordersBody"></tbody>
      </table>
    </div>
  </section>`;
  const refresh = () => {
    const filtered = filterOrders();
    $("subtitle").textContent = `${filtered.length} pedidos exibidos`;
    $("ordersBody").innerHTML = renderOrdersTable(filtered);
  };
  ["orderSearch", "orderStatusFilter", "orderChannelFilter", "orderQuickFilter"].forEach((id) => {
    $(id).addEventListener(id === "orderSearch" ? "input" : "change", refresh);
  });
  $("exportOrdersCsv").onclick = () => exportOrdersCsv(filterOrders());
  refresh();
}

function carrierCubageDescription(carrier) {
  const factor = Number(carrier.fatorCubagem || 0);
  if (factor === 300) return "Maior entre peso real e cubado";
  if (factor === 250) return "Peso cubado quando superior em 20%";
  if (factor === 167) return "Padrão 6000";
  return "Regra de cubagem cadastrada";
}

function showCarrierModal(carrier = null) {
  document.querySelector(".modal-backdrop")?.remove();
  const editing = Boolean(carrier);
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `<form class="modal-card" id="carrierForm">
    <div class="modal-header">
      <div>
        <h3>${editing ? "Editar transportadora" : "Nova transportadora"}</h3>
        <p>${editing ? "Atualize os dados operacionais da transportadora." : "Cadastre uma transportadora para cotação de frete."}</p>
      </div>
      <button type="button" class="modal-close" id="closeCarrierModal">×</button>
    </div>
    <div class="modal-grid">
      <label>Nome fantasia <input id="carrierName" value="${escapeHtml(carrier?.nomeFantasia || "")}" required></label>
      <label>Razão social <input id="carrierLegalName" value="${escapeHtml(carrier?.razaoSocial || "")}" required></label>
      <label>CNPJ <input id="carrierCnpj" value="${escapeHtml(carrier?.cnpj || "")}"></label>
      <label>Status <select id="carrierStatus"><option value="Ativa" ${carrier?.status === "Ativa" ? "selected" : ""}>Ativa</option><option value="Inativa" ${carrier?.status === "Inativa" ? "selected" : ""}>Inativa</option></select></label>
      <label>Fator cubagem <input id="carrierCubage" type="number" min="1" step="1" value="${carrier?.fatorCubagem || 300}" required></label>
      <label>Prazo médio dias <input id="carrierDeadline" type="number" min="0" step="1" value="${carrier?.prazoMedioDias || 5}" required></label>
      <label>Modalidades <input id="carrierModes" value="${escapeHtml((carrier?.modalidades || ["Rodoviario"]).join(", "))}" required></label>
      <label>UFs atendidas <input id="carrierStates" value="${escapeHtml((carrier?.estadosAtendidos || ["BA"]).join(", "))}" required></label>
      <label>Contrato <input id="carrierContract" value="${escapeHtml(carrier?.contrato || "")}"></label>
      <label>Observações <input id="carrierNotes" value="${escapeHtml(carrier?.observacoes || "")}"></label>
    </div>
    <div class="modal-actions">
      <button class="secondary" type="button" id="cancelCarrier">Cancelar</button>
      <button class="primary" type="submit">${editing ? "Salvar alterações" : "Cadastrar transportadora"}</button>
    </div>
  </form>`;
  document.body.appendChild(modal);
  $("closeCarrierModal").onclick = () => modal.remove();
  $("cancelCarrier").onclick = () => modal.remove();
  $("carrierForm").onsubmit = async (event) => {
    event.preventDefault();
    const payload = {
      nomeFantasia: $("carrierName").value,
      razaoSocial: $("carrierLegalName").value,
      cnpj: $("carrierCnpj").value,
      status: $("carrierStatus").value,
      fatorCubagem: $("carrierCubage").value,
      prazoMedioDias: $("carrierDeadline").value,
      modalidades: $("carrierModes").value.split(",").map((item) => item.trim()).filter(Boolean),
      estadosAtendidos: $("carrierStates").value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
      contrato: $("carrierContract").value,
      observacoes: $("carrierNotes").value,
    };
    try {
      await request(editing ? `/api/carriers/${carrier.id}/update` : "/api/carriers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      state.carriers = await request("/api/carriers");
      modal.remove();
      toast(editing ? "Transportadora atualizada." : "Transportadora cadastrada.");
      renderCarriers();
    } catch (err) {
      toast(err.message);
    }
  };
}

function renderCarriers() {
  setActive("carriers");
  const activeCarriers = state.carriers.filter((carrier) => carrier.status === "Ativa");
  setTitle("Transportadoras", `${activeCarriers.length} cadastradas`);
  $("app").innerHTML = `<section class="carriers-page">
    <div class="carriers-actions">
      <button class="primary icon-button" id="newCarrier" type="button">+ Nova transportadora</button>
    </div>
    <div class="carrier-grid">
      ${activeCarriers.map((carrier) => `<section class="carrier-card">
        <div class="carrier-card-header">
          <div>
            <h3>${escapeHtml(carrier.nomeFantasia)}</h3>
            <p>${escapeHtml(carrier.razaoSocial)}</p>
          </div>
          <span class="carrier-status">Ativa</span>
        </div>
        <dl>
          <div><dt>CNPJ:</dt><dd>${escapeHtml(carrier.cnpj || "Não informado")}</dd></div>
          <div><dt>Contato:</dt><dd>Não informado</dd></div>
          <div><dt>Modalidades:</dt><dd>${(carrier.modalidades || []).map(escapeHtml).join(", ") || "Não informado"}</dd></div>
          <div><dt>Regiões:</dt><dd>${(carrier.estadosAtendidos || []).map(escapeHtml).join(", ") || "Não informado"}</dd></div>
          <div><dt>Prazo médio:</dt><dd>${carrier.prazoMedioDias || "-"} dias</dd></div>
          <div><dt>Cubagem:</dt><dd>${carrierCubageDescription(carrier)} (fator ${carrier.fatorCubagem})</dd></div>
          <div><dt>Contrato:</dt><dd>${escapeHtml(carrier.contrato || "Sem contrato")}</dd></div>
        </dl>
        <button class="secondary carrier-edit" type="button" data-carrier-edit="${escapeHtml(carrier.id)}">✎ Editar</button>
      </section>`).join("")}
    </div>
  </section>`;
  $("newCarrier").onclick = () => showCarrierModal();
  document.querySelectorAll("[data-carrier-edit]").forEach((button) => {
    button.onclick = () => {
      const carrier = state.carriers.find((item) => item.id === button.dataset.carrierEdit);
      if (carrier) showCarrierModal(carrier);
    };
  });
}

function renderQuote(orderId) {
  setActive("quote");
  setTitle("Cotacao", "Cotacao real salva pela API.");
  const order = state.orders.find((o) => o.id === orderId) || state.orders[0];
  $("app").innerHTML = `<section class="card form">
    <label>Pedido <select id="pedido">${state.orders.map((o) => `<option value="${o.id}" ${o.id === order.id ? "selected" : ""}>${o.numero} - ${o.cliente}</option>`).join("")}</select></label>
    <label>CEP destino <input id="cepDestino" value="${order.cepDestino}"></label>
    <label>UF destino <input id="ufDestino" value="${order.ufDestino}"></label>
    <label>Valor declarado <input id="valorDeclarado" type="number" value="${order.valorPedido}"></label>
    <label>Peso real kg <input id="pesoRealKg" type="number" value="${order.pesoRealKg}"></label>
    <label>Comprimento cm <input id="comprimentoCm" type="number" value="${order.comprimentoCm}"></label>
    <label>Largura cm <input id="larguraCm" type="number" value="${order.larguraCm}"></label>
    <label>Altura cm <input id="alturaCm" type="number" value="${order.alturaCm}"></label>
    <label>Volumes <input id="volumes" type="number" value="${order.volumes}"></label>
    <label>Prioridade <select id="prioridade"><option value="menor_custo">Menor custo</option><option value="menor_prazo">Menor prazo</option><option value="equilibrio">Equilibrio</option></select></label>
    <button class="primary" id="calculate">Calcular cotacao</button>
  </section><section id="quoteResult" style="margin-top:16px"></section>`;
  $("pedido").onchange = () => renderQuote($("pedido").value);
  $("calculate").onclick = calculateQuote;
}

async function calculateQuote() {
  const payload = {
    pedidoId: $("pedido").value,
    cepOrigem: "40010000",
    cepDestino: $("cepDestino").value,
    ufDestino: $("ufDestino").value.toUpperCase(),
    valorDeclarado: Number($("valorDeclarado").value),
    pesoRealKg: Number($("pesoRealKg").value),
    comprimentoCm: Number($("comprimentoCm").value),
    larguraCm: Number($("larguraCm").value),
    alturaCm: Number($("alturaCm").value),
    volumes: Number($("volumes").value),
    prioridade: $("prioridade").value,
  };
  const result = await request("/api/quotes", { method: "POST", body: JSON.stringify(payload) });
  $("quoteResult").innerHTML = `<div class="table"><table><thead><tr><th>Transportadora</th><th>Frete</th><th>Prazo</th><th>Status</th><th>Regra</th></tr></thead><tbody>
    ${result.options.map((o) => `<tr><td>${o.transportadoraNome}${o.recomendada ? `<br>${badge("Recomendada")}` : ""}</td><td>${o.disponivel ? brl(o.valorFrete) : "-"}</td><td>${o.prazoDias || "-"}</td><td>${badge(o.disponivel ? "Disponivel" : o.statusTarifa)}</td><td>${o.disponivel ? o.regrasAplicadas.join("<br>") : o.motivoIndisponibilidade}</td></tr>`).join("")}
  </tbody></table></div>`;
  toast("Cotacao salva no banco.");
}

function renderImport() {
  setActive("import");
  setTitle("Importar XLSX", "Importe pedidos ou tarifas por planilha.");
  $("app").innerHTML = `<section class="card form">
    <label>Tipo <select id="importType"><option value="orders">Pedidos</option><option value="rates">Tarifas</option></select></label>
    <label>Arquivo XLSX <input id="file" type="file" accept=".xlsx"></label>
    <button class="primary" id="sendImport">Importar</button>
  </section><section id="importResult" style="margin-top:16px"></section>`;
  $("sendImport").onclick = async () => {
    const file = $("file").files[0];
    if (!file) return toast("Selecione um arquivo XLSX.");
    const fileBase64 = await toBase64(file);
    const result = await request("/api/import/xlsx", { method: "POST", body: JSON.stringify({ type: $("importType").value, fileBase64 }) });
    $("importResult").innerHTML = `<section class="card"><strong>Importados: ${result.imported}</strong><pre>${JSON.stringify(result.errors, null, 2)}</pre></section>`;
    await loadBase();
  };
}

function formatDateTimeBR(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function maskedSecret(value) {
  return value ? "..........".replace(/\./g, "•") : "";
}

async function renderChannels() {
  setActive("channels");
  setTitle("Canais de venda", "Mercado Livre, Shopee e site próprio — configurações fictícias.");
  const logs = await request("/api/channel-logs");
  const channelOrder = ["MERCADO_LIVRE", "SHOPEE", "SITE_PROPRIO"];
  const channels = [...state.channels].sort((a, b) => channelOrder.indexOf(a.codigo) - channelOrder.indexOf(b.codigo));
  $("app").innerHTML = `<section class="channels-page">
    <div class="channel-grid">
      ${channels.map((channel) => `<section class="channel-card">
        <div class="channel-header">
          <h3>${escapeHtml(channel.nome)}</h3>
          <div class="channel-status-wrap">
            <span class="channel-status ${channel.ativo ? "active" : "inactive"}">${channel.ativo ? "Ativa" : "Inativa"}</span>
            <button class="channel-toggle ${channel.ativo ? "active" : ""}" type="button" data-channel-toggle="${escapeHtml(channel.id)}" aria-label="${channel.ativo ? "Inativar" : "Ativar"} ${escapeHtml(channel.nome)}"><span></span></button>
          </div>
        </div>
        <label>Client ID <input data-channel-field="clientId" data-channel-id="${escapeHtml(channel.id)}" value="${escapeHtml(channel.clientId || "")}"></label>
        <label>Client Secret (mascarada) <input data-channel-field="clientSecret" data-channel-id="${escapeHtml(channel.id)}" type="password" value="${escapeHtml(maskedSecret(channel.clientSecret))}"></label>
        <label>Frequência (min) <input data-channel-field="frequenciaMin" data-channel-id="${escapeHtml(channel.id)}" type="number" min="1" value="${channel.frequenciaMin || 5}"></label>
        <p class="channel-sync">Última sincronização: ${escapeHtml(formatDateTimeBR(channel.ultimaSincronizacao))}</p>
        <div class="channel-actions">
          <button class="secondary" type="button" data-channel-sync="${escapeHtml(channel.id)}">Sincronizar agora</button>
          <button type="button" data-channel-map="${escapeHtml(channel.id)}">Mapear campos</button>
        </div>
      </section>`).join("")}
    </div>
    <section class="card channel-log-card">
      <h3>Logs de integração — canais</h3>
      <div class="table channel-log-table"><table><thead><tr><th>Data</th><th>Canal</th><th>Tipo</th><th>Status</th><th>Mensagem</th></tr></thead><tbody>
        ${logs.map((log) => `<tr><td>${escapeHtml(formatDateTimeBR(log.data))}</td><td>${escapeHtml(log.canal)}</td><td>${escapeHtml(log.tipo)}</td><td>${statusBadge(log.status)}</td><td>${escapeHtml(log.mensagem)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty-state">Sem logs de canais.</td></tr>`}
      </tbody></table></div>
    </section>
    <p class="channel-note">Estrutura preparada para novas integrações (marketplaces adicionais, ERPs, WMS).</p>
  </section>`;
  attachChannelActions();
}

function channelPayload(channelId) {
  const channel = state.channels.find((item) => item.id === channelId);
  const secretField = document.querySelector(`[data-channel-field="clientSecret"][data-channel-id="${channelId}"]`);
  const secretValue = secretField?.value || "";
  return {
    clientId: document.querySelector(`[data-channel-field="clientId"][data-channel-id="${channelId}"]`)?.value || "",
    clientSecret: secretValue.includes("•") ? channel?.clientSecret || "" : secretValue,
    frequenciaMin: document.querySelector(`[data-channel-field="frequenciaMin"][data-channel-id="${channelId}"]`)?.value || 5,
  };
}

async function refreshChannels() {
  state.channels = await request("/api/channels");
  renderChannels();
}

function attachChannelActions() {
  document.querySelectorAll("[data-channel-toggle]").forEach((button) => {
    button.onclick = async () => {
      await request(`/api/channels/${button.dataset.channelToggle}/toggle`, { method: "POST" });
      toast("Status do canal atualizado.");
      refreshChannels();
    };
  });
  document.querySelectorAll("[data-channel-field]").forEach((input) => {
    input.onchange = async () => {
      try {
        await request(`/api/channels/${input.dataset.channelId}/save`, { method: "POST", body: JSON.stringify(channelPayload(input.dataset.channelId)) });
        toast("Canal salvo.");
        state.channels = await request("/api/channels");
      } catch (err) {
        toast(err.message);
      }
    };
  });
  document.querySelectorAll("[data-channel-sync]").forEach((button) => {
    button.onclick = async () => {
      const result = await request(`/api/channels/${button.dataset.channelSync}/sync`, { method: "POST" });
      toast(result.message);
      refreshChannels();
    };
  });
  document.querySelectorAll("[data-channel-map]").forEach((button) => {
    button.onclick = () => {
      const channel = state.channels.find((item) => item.id === button.dataset.channelMap);
      if (channel) showChannelMappingModal(channel);
    };
  });
}

function showChannelMappingModal(channel) {
  document.querySelector(".modal-backdrop")?.remove();
  const rows = [
    ["pedido.numero", "order_id"],
    ["pedido.cliente", "buyer_name"],
    ["pedido.cepDestino", "shipping.zip_code"],
    ["pedido.valorPedido", "total_amount"],
    ["pedido.statusExpedicao", "shipping.status"],
  ];
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `<section class="modal-card channel-map-modal">
    <div class="modal-header">
      <div>
        <h3>Mapear campos</h3>
        <p>${escapeHtml(channel.nome)}</p>
      </div>
      <button type="button" class="modal-close" id="closeChannelMap">×</button>
    </div>
    <div class="table">
      <table>
        <thead><tr><th>Campo FreteHub</th><th>Campo do canal</th></tr></thead>
        <tbody>${rows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td><input value="${escapeHtml(row[1])}"></td></tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="secondary" type="button" id="cancelChannelMap">Cancelar</button>
      <button class="primary" type="button" id="saveChannelMap">Salvar mapeamento</button>
    </div>
  </section>`;
  document.body.appendChild(modal);
  $("closeChannelMap").onclick = () => modal.remove();
  $("cancelChannelMap").onclick = () => modal.remove();
  $("saveChannelMap").onclick = () => {
    modal.remove();
    toast(`Mapeamento de ${channel.nome} salvo.`);
  };
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderIntegrations() {
  setActive("integrations");
  setTitle("Integracoes", "Conectores preparados para credenciais reais.");
  $("app").innerHTML = `<div class="grid cols-3">${state.integrations.map((i) => `<section class="card"><h3>${i.nome}</h3><p>${badge(i.status)}</p><p>${i.lastMessage || "Aguardando configuracao."}</p><button class="secondary" data-test="${i.id}">Testar</button></section>`).join("")}</div>`;
  document.querySelectorAll("[data-test]").forEach((b) => b.onclick = async () => {
    const result = await request("/api/integrations/test", { method: "POST", body: JSON.stringify({ id: b.dataset.test }) });
    toast(result.lastMessage);
    state.integrations = await request("/api/integrations");
    renderIntegrations();
  });
}

async function renderIntegrationDetail(type) {
  if (type === "protheus") return renderProtheusIntegration("config");
  const labels = {
    protheus: ["Integracao Protheus", "Envio de frete aprovado para o ERP."],
    mercadolivre: ["Mercado Livre", "Entrada de pedidos e dados de marketplace."],
    shopee: ["Shopee", "Entrada de pedidos e dados de marketplace."],
  };
  const names = { protheus: "Protheus", mercadolivre: "Mercado Livre", shopee: "Shopee" };
  setActive(type);
  setTitle(labels[type][0], labels[type][1]);
  const [logs, imports] = await Promise.all([
    request("/api/integration-logs"),
    request("/api/imports"),
  ]);
  const integration = state.integrations.find((item) => item.nome === names[type]);
  const relatedLogs = logs.filter((log) => String(log.integracao_id || "").toLowerCase().includes(type === "mercadolivre" ? "ml" : type));
  $("app").innerHTML = `<div class="grid cols-3">
    <section class="card">
      <h3>Status</h3>
      <p>${integration ? badge(integration.status) : badge("Nao configurado")}</p>
      <p>${escapeHtml(integration?.lastMessage || "Aguardando configuracao.")}</p>
      ${integration ? `<button class="secondary" id="testIntegration">Testar integracao</button>` : ""}
    </section>
    ${metric("Logs recentes", relatedLogs.length)}
    ${metric("Importacoes", imports.length)}
    <section class="card" style="grid-column: 1 / -1"><h3>Historico de integracao</h3><div class="table"><table><thead><tr><th>Evento</th><th>Status</th><th>Tentativas</th><th>Mensagem</th></tr></thead><tbody>${relatedLogs.map((log) => `<tr><td>${escapeHtml(log.tipo_evento)}</td><td>${badge(log.status)}</td><td>${log.tentativas}</td><td>${escapeHtml(log.mensagem || "")}</td></tr>`).join("") || `<tr><td colspan="4">Sem logs para este conector.</td></tr>`}</tbody></table></div></section>
  </div>`;
  if (integration) {
    $("testIntegration").onclick = async () => {
      const result = await request("/api/integrations/test", { method: "POST", body: JSON.stringify({ id: integration.id }) });
      toast(result.lastMessage);
      state.integrations = await request("/api/integrations");
      renderIntegrationDetail(type);
    };
  }
}

async function renderProtheusIntegration(tab = "config") {
  setActive("protheus");
  setTitle("Integração TOTVS Protheus", "Configuração, mapeamento, fila e logs. Nenhuma credencial real é utilizada.");
  const [logs] = await Promise.all([request("/api/integration-logs")]);
  const integration = state.integrations.find((item) => item.nome === "Protheus");
  const tabs = [
    ["config", "Configuração"],
    ["connectors", "Conectores"],
    ["mapping", "Mapeamento"],
    ["queue", "Logs e fila"],
  ];
  $("app").innerHTML = `<div class="integration-page">
    <div class="tabs">
      ${tabs.map(([id, label]) => `<button class="${tab === id ? "active" : ""}" data-protheus-tab="${id}">${label}</button>`).join("")}
    </div>
    ${renderProtheusTab(tab, integration, logs)}
  </div>`;
  document.querySelectorAll("[data-protheus-tab]").forEach((button) => {
    button.onclick = () => renderProtheusIntegration(button.dataset.protheusTab);
  });
  if ($("protheusTest")) {
    $("protheusTest").onclick = async () => {
      const result = await request("/api/integrations/test", { method: "POST", body: JSON.stringify({ id: integration?.id || "protheus" }) });
      toast(result.lastMessage || "Conexão testada.");
      state.integrations = await request("/api/integrations");
      renderProtheusIntegration("config");
    };
  }
  if ($("protheusSave")) {
    $("protheusSave").onclick = async () => {
      try {
        const saved = await request("/api/integrations/save", {
          method: "POST",
          body: JSON.stringify({
            id: integration?.id || "protheus",
            baseUrl: $("protheusBaseUrl").value,
            ambiente: $("protheusEnvironment").value,
            authType: $("protheusAuthType").value,
            frequenciaMin: $("protheusFrequency").value,
            usuario: $("protheusUser").value,
            senha: $("protheusPassword").value,
            ativa: $("protheusActive").checked,
          }),
        });
        toast(saved.lastMessage || "Configuração salva.");
        state.integrations = await request("/api/integrations");
        renderProtheusIntegration("config");
      } catch (err) {
        toast(err.message);
      }
    };
  }
  if ($("reprocessQueue")) $("reprocessQueue").onclick = () => toast("Fila de falhas reprocessada em modo demonstrativo.");
}

function renderProtheusTab(tab, integration, logs) {
  if (tab === "connectors") return renderProtheusConnectors();
  if (tab === "mapping") return renderProtheusMapping();
  if (tab === "queue") return renderProtheusQueue(logs);
  return renderProtheusConfig(integration);
}

function renderProtheusConfig(integration) {
  const credentials = integration?.credentials || {};
  const environment = credentials.ambiente || "Homologação";
  const authType = credentials.authType || "OAuth 2.0";
  return `<section class="card integration-panel">
    <div class="integration-form">
      <label>URL da API <input id="protheusBaseUrl" value="${escapeHtml(integration?.baseUrl || "https://protheus.homolog.salvadorcomercial.local/api")}"></label>
      <label>Ambiente <select id="protheusEnvironment"><option ${environment === "Homologação" ? "selected" : ""}>Homologação</option><option ${environment === "Produção" ? "selected" : ""}>Produção</option></select></label>
      <label>Tipo de autenticação <select id="protheusAuthType"><option ${authType === "Basic Auth" ? "selected" : ""}>Basic Auth</option><option ${authType === "OAuth 2.0" ? "selected" : ""}>OAuth 2.0</option><option ${authType === "Token estático" ? "selected" : ""}>Token estático</option></select></label>
      <label>Frequência (min) <input id="protheusFrequency" type="number" min="1" value="${credentials.frequenciaMin || 5}"></label>
      <label>Usuário (fictício) <input id="protheusUser" value="${escapeHtml(credentials.usuario || "integracao_frete")}"></label>
      <label>Senha (mascarada) <input id="protheusPassword" type="password" value="${escapeHtml(credentials.senha || "senha-demo")}"></label>
    </div>
    <div class="integration-footer">
      <label class="switch-row"><input id="protheusActive" type="checkbox" ${credentials.ativa === false ? "" : "checked"}><span class="switch-ui"></span><strong>Integração ativa</strong></label>
      <div class="integration-actions">
        <button class="secondary" id="protheusTest">Testar conexão</button>
        <button class="primary" id="protheusSave">Salvar</button>
      </div>
    </div>
    <p class="integration-note">${escapeHtml(integration?.lastMessage || "Ambiente demonstrativo — credenciais fictícias/mascaradas. Nenhuma chamada real é feita ao Protheus.")}</p>
  </section>`;
}

function renderProtheusConnectors() {
  const connectors = ["Pedidos", "Clientes", "Produtos", "Peso e dimensões", "Notas fiscais", "Transportadoras", "Frete", "Expedição", "Rastreio", "Status financeiro"];
  return `<section class="card integration-panel">
    <div class="connector-grid">
      ${connectors.map((item) => `<div class="connector-item"><span>${escapeHtml(item)}</span>${badge("Ativa")}</div>`).join("")}
    </div>
  </section>`;
}

function renderProtheusMapping() {
  const rows = [
    ["pedido.numero", "SC5_NUM", "string"],
    ["pedido.cliente", "SA1_NOME", "string"],
    ["pedido.cepDestino", "SA1_CEP", "string"],
    ["pedido.peso", "SC6_PESO", "string"],
    ["pedido.valor", "SC5_VLR", "string"],
    ["pedido.transportadora", "SC5_TRANS", "string"],
    ["pedido.freteCobrado", "SC5_FRETE", "string"],
    ["pedido.statusExpedicao", "SC9_STATUS", "string"],
  ];
  return `<section class="integration-panel">
    <div class="table"><table><thead><tr><th>Campo FreteHub</th><th>Campo Protheus</th><th>Tipo</th></tr></thead><tbody>
      ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>
  </section>`;
}

function renderProtheusQueue(logs) {
  const protheusLogs = logs.filter((log) => String(log.integracao_id || "").includes("protheus"));
  const fallbackRows = [
    ["03/07/2026, 16:53:19", "Envio", "Falha", "Timeout ao enviar pedido SC-100014."],
    ["02/07/2026, 16:53:19", "Recebimento", "Sucesso", "Status expedição atualizado (30 registros)."],
  ];
  const rows = protheusLogs.length
    ? protheusLogs.map((log) => [log.criado_em || "-", log.tipo_evento || "-", log.status === "ERRO" ? "Falha" : "Sucesso", log.mensagem || "-"])
    : fallbackRows;
  return `<div class="integration-queue">
    <div class="integration-toolbar"><button class="secondary" id="reprocessQueue">Reprocessar fila de falhas</button></div>
    <section class="card integration-panel">
      <h3>Logs de integração — Protheus</h3>
      <div class="table"><table><thead><tr><th>Data</th><th>Tipo</th><th>Status</th><th>Mensagem</th></tr></thead><tbody>
        ${rows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td>${badge(row[2])}</td><td>${escapeHtml(row[3])}</td></tr>`).join("")}
      </tbody></table></div>
    </section>
  </div>`;
}

async function renderReports() {
  setActive("reports");
  setTitle("Relatorios", "Filtros e exportacao. CSV disponivel; XLSX planejado.");
  const reports = buildReports();
  $("app").innerHTML = `<div class="report-page">
    <div class="report-actions">
      <button class="secondary" id="exportCsv">Exportar CSV</button>
      <button class="secondary" id="exportXlsx">XLSX</button>
    </div>
    <section class="card report-filter">
      <label>Tipo de relatorio
        <select id="reportType">
          ${reports.map((report) => `<option value="${report.id}">${escapeHtml(report.label)}</option>`).join("")}
        </select>
      </label>
    </section>
    <section class="card report-result">
      <div id="reportTable"></div>
    </section>
  </div>`;
  const renderSelectedReport = () => {
    const report = reports.find((item) => item.id === $("reportType").value) || reports[0];
    $("reportTable").innerHTML = renderReportTable(report);
  };
  $("reportType").onchange = renderSelectedReport;
  $("exportCsv").onclick = () => exportReportCsv(reports.find((item) => item.id === $("reportType").value) || reports[0]);
  $("exportXlsx").onclick = () => toast("Exportacao XLSX planejada para a proxima etapa.");
  $("reportType").value = "cost-carrier";
  renderSelectedReport();
}

function buildReports() {
  const carrierName = (id) => state.carriers.find((carrier) => carrier.id === id)?.nomeFantasia || "Sem transportadora";
  const activeOrders = state.orders || [];
  const today = new Date();
  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(today.getDate() + 30);
  return [
    {
      id: "cost-period",
      label: "Custo por periodo",
      columns: ["Periodo", "Pedidos", "Custo total", "Frete cobrado", "Diferenca"],
      rows: [sumOrders("Base atual", activeOrders)],
    },
    {
      id: "cost-carrier",
      label: "Custo por transportadora",
      columns: ["Transportadora", "Pedidos", "Custo total"],
      rows: groupedRows(activeOrders, (order) => carrierName(order.transportadoraSelecionadaId), (label, orders) => [
        label,
        orders.length,
        brl(sum(orders, "freteCalculado")),
      ]),
    },
    {
      id: "cost-channel",
      label: "Custo por canal",
      columns: ["Canal", "Pedidos", "Custo total", "Ticket medio"],
      rows: groupedRows(activeOrders, (order) => order.canal || "Sem canal", (label, orders) => [
        label,
        orders.length,
        brl(sum(orders, "freteCalculado")),
        brl(sum(orders, "valorPedido") / Math.max(orders.length, 1)),
      ]),
    },
    {
      id: "cost-state",
      label: "Custo por estado/regiao",
      columns: ["UF destino", "Pedidos", "Custo total", "Prazo medio"],
      rows: groupedRows(activeOrders, (order) => order.ufDestino || "Sem UF", (label, orders) => [
        label,
        orders.length,
        brl(sum(orders, "freteCalculado")),
        `${Math.round(sum(orders, "prazoDias") / Math.max(orders.filter((order) => Number(order.prazoDias) > 0).length, 1))} dias`,
      ]),
    },
    {
      id: "without-quote",
      label: "Pedidos sem cotacao",
      columns: ["Pedido", "Cliente", "Canal", "Destino", "Status"],
      rows: activeOrders
        .filter((order) => Number(order.freteCalculado || 0) <= 0)
        .map((order) => [order.numero, order.cliente, order.canal, order.ufDestino, order.status]),
    },
    {
      id: "freight-gap",
      label: "Divergencia de frete (calculado vs cobrado)",
      columns: ["Pedido", "Transportadora", "Calculado", "Cobrado", "Diferenca"],
      rows: activeOrders
        .filter((order) => Number(order.freteCalculado || 0) || Number(order.freteCobrado || 0))
        .map((order) => [
          order.numero,
          carrierName(order.transportadoraSelecionadaId),
          brl(order.freteCalculado),
          brl(order.freteCobrado),
          brl(Number(order.freteCobrado || 0) - Number(order.freteCalculado || 0)),
        ]),
    },
    {
      id: "expired-rates",
      label: "Tarifas vencidas",
      columns: ["Tarifa", "Transportadora", "Destino", "Vigencia fim", "Status"],
      rows: state.rates
        .filter((rate) => rate.status === "Vencida" || new Date(`${rate.vigenciaFim}T00:00:00`) < today)
        .map((rate) => [rate.nome, carrierName(rate.transportadoraId), rate.ufDestino, rate.vigenciaFim, rate.status]),
    },
    {
      id: "rates-expiring",
      label: "Tarifas proximas do vencimento",
      columns: ["Tarifa", "Transportadora", "Destino", "Vigencia fim", "Dias restantes"],
      rows: state.rates
        .filter((rate) => {
          const end = new Date(`${rate.vigenciaFim}T00:00:00`);
          return end >= today && end <= inThirtyDays;
        })
        .map((rate) => {
          const days = Math.ceil((new Date(`${rate.vigenciaFim}T00:00:00`) - today) / 86400000);
          return [rate.nome, carrierName(rate.transportadoraId), rate.ufDestino, rate.vigenciaFim, days];
        }),
    },
    {
      id: "carrier-performance",
      label: "Desempenho de transportadoras",
      columns: ["Transportadora", "Pedidos", "Custo medio", "Prazo medio", "Custo total"],
      rows: groupedRows(
        activeOrders.filter((order) => order.transportadoraSelecionadaId),
        (order) => carrierName(order.transportadoraSelecionadaId),
        (label, orders) => [
          label,
          orders.length,
          brl(sum(orders, "freteCalculado") / Math.max(orders.length, 1)),
          `${Math.round(sum(orders, "prazoDias") / Math.max(orders.filter((order) => Number(order.prazoDias) > 0).length, 1))} dias`,
          brl(sum(orders, "freteCalculado")),
        ],
      ),
    },
    {
      id: "late-orders",
      label: "Pedidos fora do prazo",
      columns: ["Pedido", "Cliente", "Transportadora", "Prazo contratado", "Status"],
      rows: activeOrders
        .filter((order) => order.status === "Erro de Integracao" || order.statusProtheus === "Erro")
        .map((order) => [order.numero, order.cliente, carrierName(order.transportadoraSelecionadaId), `${order.prazoDias || 0} dias`, order.status]),
      note: "A V2 ainda nao possui data real de entrega; este relatorio usa erros operacionais como indicio.",
    },
    {
      id: "planned-realized",
      label: "Frete previsto x realizado",
      columns: ["Pedido", "Previsto", "Realizado", "Diferenca", "Status"],
      rows: activeOrders
        .filter((order) => Number(order.freteCalculado || 0) || Number(order.freteCobrado || 0))
        .map((order) => [
          order.numero,
          brl(order.freteCalculado),
          brl(order.freteCobrado),
          brl(Number(order.freteCobrado || 0) - Number(order.freteCalculado || 0)),
          order.status,
        ]),
    },
  ];
}

function groupedRows(items, keyFn, rowFn) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  });
  return [...groups.entries()].map(([key, values]) => rowFn(key, values));
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] || 0), 0);
}

function sumOrders(label, orders) {
  const calculated = sum(orders, "freteCalculado");
  const charged = sum(orders, "freteCobrado");
  return [label, orders.length, brl(calculated), brl(charged), brl(charged - calculated)];
}

function renderReportTable(report) {
  const rows = report.rows.length ? report.rows : [["Sem dados para este relatorio."]];
  return `${report.note ? `<p>${escapeHtml(report.note)}</p>` : ""}
    <div class="table"><table><thead><tr>${report.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>
    ${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
  </tbody></table></div>`;
}

function exportReportCsv(report) {
  const rows = [report.columns, ...report.rows];
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

const settingsDefaults = {
  environment: "Homologação",
  environmentSplit: true,
  logicalBackup: true,
  criticalDeleteConfirm: true,
  formValidation: true,
  useGreaterWeight: true,
  blockExpiredRates: true,
  mandatoryApproval: true,
  freeShippingRule: false,
};

function loadSettingsControls() {
  try {
    return { ...settingsDefaults, ...JSON.parse(localStorage.getItem("fretehub-v2-settings-controls") || "{}") };
  } catch {
    return { ...settingsDefaults };
  }
}

function saveSettingsControls(settings) {
  localStorage.setItem("fretehub-v2-settings-controls", JSON.stringify(settings));
}

function settingsBadgeButton(id, active, activeLabel = "Ativa", inactiveLabel = "Inativa") {
  return `<button class="settings-badge ${active ? "active" : "inactive"}" type="button" data-settings-toggle="${id}">${active ? activeLabel : inactiveLabel}</button>`;
}

function settingsSwitch(id, active, label) {
  return `<button class="settings-switch ${active ? "active" : ""}" type="button" data-settings-toggle="${id}" aria-label="${escapeHtml(label)}"><span></span></button>`;
}

function renderSettings() {
  setActive("settings");
  setTitle("Configurações", "Preferências gerais, usuários e ambiente.");
  const settings = loadSettingsControls();
  $("app").innerHTML = `<div class="settings-page">
    <section class="settings-controls">
      <section class="card settings-control-card">
        <h3>Ambiente</h3>
        <div class="settings-control-row">
          <span>Ambiente ativo</span>
          <button class="settings-env-pill" type="button" data-settings-env>${escapeHtml(settings.environment)}</button>
        </div>
        <div class="settings-control-row">
          <span>Separação homologação/produção</span>
          ${settingsBadgeButton("environmentSplit", settings.environmentSplit)}
        </div>
        <div class="settings-control-row">
          <span>Backup lógico (tarifas e configurações)</span>
          ${settingsBadgeButton("logicalBackup", settings.logicalBackup)}
        </div>
        <div class="settings-control-row">
          <span>Confirmação para exclusões críticas</span>
          ${settingsSwitch("criticalDeleteConfirm", settings.criticalDeleteConfirm, "Confirmação para exclusões críticas")}
        </div>
        <div class="settings-control-row">
          <span>Validação de formulários e importações</span>
          ${settingsSwitch("formValidation", settings.formValidation, "Validação de formulários e importações")}
        </div>
      </section>
      <section class="card settings-control-card">
        <h3>Regras operacionais</h3>
        <div class="settings-control-row">
          <span>Considerar maior entre peso real e cubado</span>
          ${settingsSwitch("useGreaterWeight", settings.useGreaterWeight, "Considerar maior entre peso real e cubado")}
        </div>
        <div class="settings-control-row">
          <span>Bloquear tarifas vencidas em simulações</span>
          ${settingsSwitch("blockExpiredRates", settings.blockExpiredRates, "Bloquear tarifas vencidas em simulações")}
        </div>
        <div class="settings-control-row">
          <span>Aprovação obrigatória para alterações relevantes</span>
          ${settingsSwitch("mandatoryApproval", settings.mandatoryApproval, "Aprovação obrigatória para alterações relevantes")}
        </div>
        <div class="settings-control-row">
          <span>Frete grátis por regra (canal/valor/região)</span>
          ${settingsSwitch("freeShippingRule", settings.freeShippingRule, "Frete grátis por regra")}
        </div>
        <div class="settings-limit-note">
          <strong>Limite % frete/valor pedido</strong>
          <span>Alerta quando frete supera 30% do valor.</span>
        </div>
      </section>
    </section>
    <div class="grid cols-2">
    <section class="card">
      <h3>Acesso</h3>
      <p>Autenticacao local ativa com perfis e permissoes por usuario.</p>
      <button class="secondary" data-open-settings="admin">Gerenciar usuarios</button>
    </section>
    <section class="card">
      <h3>Navegacao</h3>
      <p>A coluna lateral pode ser ocultada e a preferencia fica salva neste navegador.</p>
      <button class="secondary" id="settingsHideNav">Ocultar menu lateral</button>
    </section>
    <section class="card">
      <h3>Integracoes</h3>
      <p>Protheus, Mercado Livre e Shopee estao preparados para credenciais reais.</p>
      <button class="secondary" data-open-settings="protheus">Ver Protheus</button>
      <button class="secondary" data-open-settings="mercadolivre">Ver Mercado Livre</button>
      <button class="secondary" data-open-settings="shopee">Ver Shopee</button>
    </section>
    <section class="card">
      <h3>Dados</h3>
      <p>Banco SQLite local com importacao XLSX, auditoria e tabelas de frete versionadas.</p>
      <button class="secondary" data-open-settings="import">Importar XLSX</button>
      <button class="secondary" data-open-settings="tariffs">Ver tarifas</button>
    </section>
    </div>
  </div>`;
  attachSettingsControls();
  $("settingsHideNav").onclick = () => setNavHidden(true);
  document.querySelectorAll("[data-open-settings]").forEach((button) => {
    button.onclick = () => navigate(button.dataset.openSettings);
  });
}

function attachSettingsControls() {
  document.querySelector("[data-settings-env]")?.addEventListener("click", () => {
    const settings = loadSettingsControls();
    settings.environment = settings.environment === "Homologação" ? "Produção" : "Homologação";
    saveSettingsControls(settings);
    toast(`Ambiente alterado para ${settings.environment}.`);
    renderSettings();
  });
  document.querySelectorAll("[data-settings-toggle]").forEach((button) => {
    button.onclick = () => {
      const settings = loadSettingsControls();
      const key = button.dataset.settingsToggle;
      settings[key] = !settings[key];
      saveSettingsControls(settings);
      toast("Configuração atualizada.");
      renderSettings();
    };
  });
}

async function renderAdmin() {
  setActive("admin");
  setTitle("Usuarios e Perfis", "Cadastro, exclusao logica e permissoes.");
  const [me, users, profiles, userProfiles] = await Promise.all([
    request("/api/me"),
    request("/api/users"),
    request("/api/profiles"),
    request("/api/user-profiles"),
  ]);
  $("app").innerHTML = `<div class="grid cols-3">
    <section class="card"><h3>Novo usuario</h3>
      <form id="userForm" class="form">
        <label>Nome <input id="userName" required></label>
        <label>Email <input id="userEmail" type="email" required></label>
        <label>Telefone <input id="userPhone"></label>
        <label>Senha <input id="userPassword" type="password" minlength="8" required></label>
        <label>Perfil <select id="userProfile">${profiles.map((p) => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join("")}</select></label>
        <button class="primary" type="submit">Cadastrar usuario</button>
      </form>
    </section>
    <section class="card" style="grid-column: span 2"><h3>Usuarios</h3><div class="table"><table><thead><tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Perfis</th><th>Status</th><th>Acao</th></tr></thead><tbody>${users.map((u) => `<tr><td>${escapeHtml(u.nome)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.telefone || "-")}</td><td>${(u.perfis || []).map(escapeHtml).join("<br>")}</td><td>${badge(u.status)}</td><td>${u.id === me.id ? "-" : `<button class="secondary" data-delete-user="${u.id}">Excluir</button>`}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card"><h3>Perfis</h3>${profiles.map((p) => `<p>${badge(p.codigo)} ${escapeHtml(p.nome)}</p>`).join("")}</section>
    <section class="card" style="grid-column: span 2"><h3>Associacoes</h3><div class="table"><table><thead><tr><th>Usuario</th><th>Perfil</th></tr></thead><tbody>${userProfiles.map((up) => `<tr><td>${escapeHtml(up.usuario)}</td><td>${escapeHtml(up.perfil)}</td></tr>`).join("")}</tbody></table></div></section>
  </div>`;
  $("userForm").onsubmit = async (event) => {
    event.preventDefault();
    try {
      await request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          nome: $("userName").value,
          email: $("userEmail").value,
          telefone: $("userPhone").value,
          senha: $("userPassword").value,
          perfilId: $("userProfile").value,
        }),
      });
      toast("Usuario cadastrado.");
      renderAdmin();
    } catch (err) {
      toast(err.message);
    }
  };
  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.onclick = async () => {
      if (!confirm("Excluir este usuario?")) return;
      try {
        await request(`/api/users/${button.dataset.deleteUser}`, { method: "DELETE" });
        toast("Usuario excluido.");
        renderAdmin();
      } catch (err) {
        toast(err.message);
      }
    };
  });
}

function formatDateBR(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatKg(value) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function tariffStatusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized.includes("VENC")) return "Vencida";
  if (normalized.includes("APROVACAO")) return "Pendente aprovação";
  if (normalized.includes("RASCUNHO")) return "Rascunho";
  if (normalized.includes("ARQUIVADA")) return "Arquivada";
  if (normalized.includes("CANCELADA")) return "Cancelada";
  return "Ativa";
}

function tariffIsExpired(table) {
  const status = String(table.status || "").toUpperCase();
  const end = new Date(`${table.data_fim_vigencia}T00:00:00`);
  return status.includes("VENC") || (status.includes("ATIVA") && end < new Date());
}

function tariffRows(tables, ranges) {
  return tables.map((table) => {
    const range = ranges.find((item) => item.tabela_tarifa_id === table.id) || {};
    const status = tariffIsExpired(table) ? "Vencida" : tariffStatusLabel(table.status);
    return {
      id: table.id,
      nome: table.nome,
      transportadora: table.transportadora,
      rota: `${range.uf_origem || table.origem_uf || "-"}→${range.uf_destino || "-"}`,
      peso: `${formatKg(range.peso_minimo_kg)}-${formatKg(range.peso_maximo_kg)}kg`,
      prazo: `${range.prazo_dias || "-"}d`,
      vigencia: `${formatDateBR(table.data_inicio_vigencia)} → ${formatDateBR(table.data_fim_vigencia)}`,
      versao: `v${table.versao || 1}`,
      status,
      statusRaw: table.status,
      vigenciaInicio: table.data_inicio_vigencia,
      vigenciaFim: table.data_fim_vigencia,
      pesoMinimoKg: range.peso_minimo_kg ?? 0,
      pesoMaximoKg: range.peso_maximo_kg ?? 0,
      prazoDias: range.prazo_dias ?? 0,
      pending: ["Pendente aprovação", "Rascunho"].includes(status),
    };
  });
}

function renderTariffRows(rows) {
  return rows.map((row) => `<tr>
    <td>${escapeHtml(row.nome)}</td>
    <td>${escapeHtml(row.transportadora)}</td>
    <td>${escapeHtml(row.rota)}</td>
    <td>${escapeHtml(row.peso)}</td>
    <td>${escapeHtml(row.prazo)}</td>
    <td>${escapeHtml(row.vigencia)}</td>
    <td>${escapeHtml(row.versao)}</td>
    <td>${statusBadge(row.status)}</td>
    <td><div class="tariff-row-actions"><button type="button" data-tariff-action="edit" data-tariff-id="${escapeHtml(row.id)}">Editar</button><button type="button" data-tariff-action="copy" data-tariff-id="${escapeHtml(row.id)}" aria-label="Duplicar tarifa">⧉</button></div></td>
  </tr>`).join("") || `<tr><td colspan="9" class="empty-state">Nenhuma tarifa cadastrada.</td></tr>`;
}

function downloadTariffCsvTemplate() {
  const csv = [
    ["nome", "transportadora", "uf_origem", "uf_destino", "peso_minimo_kg", "peso_maximo_kg", "prazo_dias", "vigencia_inicio", "vigencia_fim", "status"],
    ["Tabela exemplo", "Transportadora", "BA", "SP", "0", "30", "4", "2026-01-01", "2026-12-31", "Ativa"],
  ].map((row) => row.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "modelo-tarifas-fretehub.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function attachTariffActions() {
  document.querySelectorAll("[data-tariff-action]").forEach((button) => {
    button.onclick = async () => {
      const tariffId = button.dataset.tariffId;
      if (button.dataset.tariffAction === "copy") {
        try {
          await request(`/api/tariff-tables/${tariffId}/duplicate`, { method: "POST" });
          toast("Tarifa duplicada e enviada para aprovação.");
          renderTariffs();
        } catch (err) {
          toast(err.message);
        }
        return;
      }
      const row = currentTariffRows.find((item) => item.id === tariffId);
      if (row) showTariffEditModal(row);
    };
  });
}

let currentTariffRows = [];
let currentTariffMeta = { services: [], contracts: [] };

function showTariffEditModal(row) {
  document.querySelector(".modal-backdrop")?.remove();
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `<form class="modal-card tariff-edit-modal" id="tariffEditForm">
    <div class="modal-header">
      <div>
        <h3>Editar tarifa</h3>
        <p>${escapeHtml(row.transportadora)} · ${escapeHtml(row.versao)}</p>
      </div>
      <button type="button" class="modal-close" id="closeTariffModal">×</button>
    </div>
    <div class="modal-grid">
      <label>Nome <input id="tariffEditName" value="${escapeHtml(row.nome)}" required></label>
      <label>Status <select id="tariffEditStatus">
        <option value="ATIVA" ${row.statusRaw === "ATIVA" ? "selected" : ""}>Ativa</option>
        <option value="EM_APROVACAO" ${row.statusRaw === "EM_APROVACAO" ? "selected" : ""}>Pendente aprovação</option>
        <option value="RASCUNHO" ${row.statusRaw === "RASCUNHO" ? "selected" : ""}>Rascunho</option>
        <option value="VENCIDA" ${row.statusRaw === "VENCIDA" ? "selected" : ""}>Vencida</option>
        <option value="ARQUIVADA" ${row.statusRaw === "ARQUIVADA" ? "selected" : ""}>Arquivada</option>
        <option value="CANCELADA" ${row.statusRaw === "CANCELADA" ? "selected" : ""}>Cancelada</option>
      </select></label>
      <label>Início vigência <input id="tariffEditStart" type="date" value="${escapeHtml(row.vigenciaInicio)}" required></label>
      <label>Fim vigência <input id="tariffEditEnd" type="date" value="${escapeHtml(row.vigenciaFim)}" required></label>
      <label>Peso mínimo kg <input id="tariffEditWeightStart" type="number" min="0" step="0.1" value="${row.pesoMinimoKg}" required></label>
      <label>Peso máximo kg <input id="tariffEditWeightEnd" type="number" min="0" step="0.1" value="${row.pesoMaximoKg}" required></label>
      <label>Prazo dias <input id="tariffEditDeadline" type="number" min="0" step="1" value="${row.prazoDias}" required></label>
    </div>
    <div class="modal-actions">
      <button class="secondary" type="button" id="cancelTariffEdit">Cancelar</button>
      <button class="primary" type="submit">Salvar alterações</button>
    </div>
  </form>`;
  document.body.appendChild(modal);
  $("closeTariffModal").onclick = () => modal.remove();
  $("cancelTariffEdit").onclick = () => modal.remove();
  $("tariffEditForm").onsubmit = async (event) => {
    event.preventDefault();
    try {
      await request(`/api/tariff-tables/${row.id}/update`, {
        method: "POST",
        body: JSON.stringify({
          nome: $("tariffEditName").value,
          status: $("tariffEditStatus").value,
          vigenciaInicio: $("tariffEditStart").value,
          vigenciaFim: $("tariffEditEnd").value,
          pesoMinimoKg: $("tariffEditWeightStart").value,
          pesoMaximoKg: $("tariffEditWeightEnd").value,
          prazoDias: $("tariffEditDeadline").value,
        }),
      });
      modal.remove();
      toast("Tarifa atualizada.");
      renderTariffs();
    } catch (err) {
      toast(err.message);
    }
  };
}

function showTariffCreateModal() {
  document.querySelector(".modal-backdrop")?.remove();
  const activeCarriers = state.carriers.filter((carrier) => carrier.status === "Ativa");
  const firstCarrierId = activeCarriers[0]?.id || "";
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `<form class="modal-card tariff-edit-modal" id="tariffCreateForm">
    <div class="modal-header">
      <div>
        <h3>Nova tarifa</h3>
        <p>Crie uma tabela tarifária com faixa inicial.</p>
      </div>
      <button type="button" class="modal-close" id="closeCreateTariffModal">×</button>
    </div>
    <div class="modal-grid">
      <label>Nome <input id="tariffCreateName" required></label>
      <label>Transportadora <select id="tariffCreateCarrier" required>${activeCarriers.map((carrier) => `<option value="${escapeHtml(carrier.id)}">${escapeHtml(carrier.nomeFantasia)}</option>`).join("")}</select></label>
      <label>Serviço <select id="tariffCreateService" required></select></label>
      <label>Contrato <select id="tariffCreateContract" required></select></label>
      <label>Status <select id="tariffCreateStatus"><option value="RASCUNHO">Rascunho</option><option value="EM_APROVACAO">Pendente aprovação</option><option value="ATIVA">Ativa</option></select></label>
      <label>UF origem <input id="tariffCreateOrigin" maxlength="2" value="BA" required></label>
      <label>UF destino <input id="tariffCreateDestination" maxlength="2" required></label>
      <label>Início vigência <input id="tariffCreateStart" type="date" required></label>
      <label>Fim vigência <input id="tariffCreateEnd" type="date" required></label>
      <label>CEP inicial <input id="tariffCreateCepStart" maxlength="8" value="00000000" required></label>
      <label>CEP final <input id="tariffCreateCepEnd" maxlength="8" value="99999999" required></label>
      <label>Peso mínimo kg <input id="tariffCreateWeightStart" type="number" min="0" step="0.1" value="0" required></label>
      <label>Peso máximo kg <input id="tariffCreateWeightEnd" type="number" min="0" step="0.1" value="30" required></label>
      <label>Prazo dias <input id="tariffCreateDeadline" type="number" min="0" step="1" value="5" required></label>
      <label>Frete base R$ <input id="tariffCreateBase" type="number" min="0" step="0.01" value="0" required></label>
      <label>Kg excedente R$ <input id="tariffCreateKg" type="number" min="0" step="0.01" value="0"></label>
      <label>Frete mínimo R$ <input id="tariffCreateMinimum" type="number" min="0" step="0.01" value="0"></label>
    </div>
    <div class="modal-actions">
      <button class="secondary" type="button" id="cancelCreateTariff">Cancelar</button>
      <button class="primary" type="submit">Criar tarifa</button>
    </div>
  </form>`;
  document.body.appendChild(modal);
  const fillDependentSelects = () => {
    const carrierId = $("tariffCreateCarrier").value || firstCarrierId;
    const services = currentTariffMeta.services.filter((service) => service.transportadora_id === carrierId);
    const contracts = currentTariffMeta.contracts.filter((contract) => contract.transportadora_id === carrierId && contract.status === "ATIVO");
    $("tariffCreateService").innerHTML = services.map((service) => `<option value="${escapeHtml(service.id)}">${escapeHtml(service.nome)}</option>`).join("");
    $("tariffCreateContract").innerHTML = contracts.map((contract) => `<option value="${escapeHtml(contract.id)}">${escapeHtml(contract.numero_contrato)}</option>`).join("");
  };
  $("closeCreateTariffModal").onclick = () => modal.remove();
  $("cancelCreateTariff").onclick = () => modal.remove();
  $("tariffCreateCarrier").onchange = fillDependentSelects;
  fillDependentSelects();
  $("tariffCreateForm").onsubmit = async (event) => {
    event.preventDefault();
    try {
      await request("/api/tariff-tables", {
        method: "POST",
        body: JSON.stringify({
          nome: $("tariffCreateName").value,
          transportadoraId: $("tariffCreateCarrier").value,
          servicoId: $("tariffCreateService").value,
          contratoId: $("tariffCreateContract").value,
          status: $("tariffCreateStatus").value,
          ufOrigem: $("tariffCreateOrigin").value,
          ufDestino: $("tariffCreateDestination").value,
          vigenciaInicio: $("tariffCreateStart").value,
          vigenciaFim: $("tariffCreateEnd").value,
          cepInicio: $("tariffCreateCepStart").value,
          cepFim: $("tariffCreateCepEnd").value,
          pesoMinimoKg: $("tariffCreateWeightStart").value,
          pesoMaximoKg: $("tariffCreateWeightEnd").value,
          prazoDias: $("tariffCreateDeadline").value,
          valorFreteBase: $("tariffCreateBase").value,
          valorKgExcedente: $("tariffCreateKg").value,
          freteMinimo: $("tariffCreateMinimum").value,
        }),
      });
      modal.remove();
      toast("Tarifa criada.");
      renderTariffs();
    } catch (err) {
      toast(err.message);
    }
  };
}

async function renderTariffs() {
  setActive("tariffs");
  const [tables, ranges, services, contracts] = await Promise.all([
    request("/api/tariff-tables"),
    request("/api/tariff-ranges"),
    request("/api/carrier-services"),
    request("/api/carrier-contracts"),
  ]);
  currentTariffMeta = { services, contracts };
  const rows = tariffRows(tables, ranges);
  currentTariffRows = rows;
  const listRows = rows.filter((row) => !row.pending);
  const pendingRows = rows.filter((row) => row.pending);
  const expiredCount = tables.filter(tariffIsExpired).length;
  const activeCount = tables.filter((table) => String(table.status || "").toUpperCase().includes("ATIVA") && !tariffIsExpired(table)).length;
  const expiringSoon = tables.filter((table) => {
    const end = new Date(`${table.data_fim_vigencia}T00:00:00`);
    const days = Math.ceil((end - new Date()) / 86400000);
    return String(table.status || "").toUpperCase().includes("ATIVA") && !tariffIsExpired(table) && days >= 0 && days <= 30;
  }).length;
  setTitle("Tarifas", `${tables.length} tarifas · ${activeCount} ativas · ${expiredCount} vencidas`);
  $("app").innerHTML = `<section class="tariffs-page">
    <div class="tariffs-actions">
      <button class="secondary icon-button" id="tariffTemplate" type="button">⇩ Modelo CSV</button>
      <button class="secondary icon-button" id="tariffImport" type="button">⇧ Importar CSV</button>
      <button class="primary icon-button" id="newTariff" type="button">+ Nova tarifa</button>
    </div>
    ${expiringSoon ? `<div class="tariff-alert">${expiringSoon} tarifa(s) ativa(s) vencem em até 30 dias — reveja antes do término.</div>` : ""}
    <div class="tariff-tabs">
      <button class="active" type="button" data-tariff-tab="list">Lista</button>
      <button type="button" data-tariff-tab="pending">Pendentes aprovação</button>
    </div>
    <div class="table tariffs-table">
      <table>
        <thead><tr><th>Nome</th><th>Transportadora</th><th>Rota</th><th>Peso</th><th>Prazo</th><th>Vigência</th><th>Versão</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody id="tariffsBody">${renderTariffRows(listRows)}</tbody>
      </table>
    </div>
  </section>`;
  $("tariffTemplate").onclick = downloadTariffCsvTemplate;
  $("tariffImport").onclick = () => toast("Importação CSV será conectada à rotina de importação.");
  $("newTariff").onclick = showTariffCreateModal;
  document.querySelectorAll("[data-tariff-tab]").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("[data-tariff-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
      $("tariffsBody").innerHTML = button.dataset.tariffTab === "pending"
        ? renderTariffRows(pendingRows).replace("Nenhuma tarifa cadastrada.", "Nenhuma tarifa pendente de aprovação.")
        : renderTariffRows(listRows);
      attachTariffActions();
    };
  });
  attachTariffActions();
}

async function renderOps() {
  setActive("ops");
  setTitle("Operacao", "Contratos, servicos, logs e importacoes.");
  const [services, contracts, imports, lines, logs, history] = await Promise.all([
    request("/api/carrier-services"),
    request("/api/carrier-contracts"),
    request("/api/imports"),
    request("/api/import-lines"),
    request("/api/integration-logs"),
    request("/api/order-history"),
  ]);
  $("app").innerHTML = `<div class="grid cols-3">
    ${metric("Servicos", services.length)}
    ${metric("Contratos", contracts.length)}
    ${metric("Logs integracao", logs.length)}
    <section class="card" style="grid-column: 1 / -1"><h3>Contratos</h3><div class="table"><table><thead><tr><th>Contrato</th><th>Transportadora</th><th>Vigencia</th><th>Status</th></tr></thead><tbody>${contracts.map((c) => `<tr><td>${c.numero_contrato}</td><td>${c.transportadora_id}</td><td>${c.data_inicio}<br>${c.data_fim}</td><td>${badge(c.status)}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card" style="grid-column: 1 / -1"><h3>Importacoes</h3><div class="table"><table><thead><tr><th>Arquivo</th><th>Tipo</th><th>Status</th><th>Linhas</th><th>Erros</th></tr></thead><tbody>${imports.map((i) => `<tr><td>${i.nome_arquivo}</td><td>${i.tipo}</td><td>${badge(i.status)}</td><td>${i.total_linhas}</td><td>${i.linhas_com_erro}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card" style="grid-column: 1 / -1"><h3>Logs de integracao</h3><div class="table"><table><thead><tr><th>Integracao</th><th>Evento</th><th>Status</th><th>Tentativas</th><th>Mensagem</th></tr></thead><tbody>${logs.map((l) => `<tr><td>${l.integracao_id}</td><td>${l.tipo_evento}</td><td>${badge(l.status)}</td><td>${l.tentativas}</td><td>${l.mensagem || ""}</td></tr>`).join("")}</tbody></table></div></section>
  </div>`;
}

async function renderAudit() {
  setActive("audit");
  setTitle("Auditoria", "Historico gravado no banco.");
  const audits = await request("/api/audits");
  $("app").innerHTML = `<div class="table"><table><thead><tr><th>Data</th><th>Usuario</th><th>Acao</th><th>Entidade</th><th>Detalhe</th></tr></thead><tbody>${audits.map((a) => `<tr><td>${a.created_at}</td><td>${a.usuario_nome}</td><td>${badge(a.acao)}</td><td>${a.entidade}</td><td>${a.detalhe}</td></tr>`).join("")}</tbody></table></div>`;
}

function setActive(view) {
  document.querySelectorAll(".side button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
}

document.querySelectorAll(".side button").forEach((b) => b.onclick = async () => {
  if (b.id === "hideNav") return setNavHidden(true);
  if (!token) return renderLogin();
  navigate(b.dataset.view);
});

function navigate(view) {
  if (view === "dashboard") return renderDashboard();
  if (view === "orders") return renderOrders();
  if (view === "quote") return renderQuote();
  if (view === "import") return renderImport();
  if (view === "carriers") return renderCarriers();
  if (view === "channels") return renderChannels();
  if (view === "integrations") return renderIntegrations();
  if (view === "protheus") return renderIntegrationDetail("protheus");
  if (view === "mercadolivre") return renderIntegrationDetail("mercadolivre");
  if (view === "shopee") return renderIntegrationDetail("shopee");
  if (view === "reports") return renderReports();
  if (view === "settings") return renderSettings();
  if (view === "admin") return renderAdmin();
  if (view === "tariffs") return renderTariffs();
  if (view === "ops") return renderOps();
  if (view === "audit") return renderAudit();
}

$("logout").onclick = () => {
  token = "";
  localStorage.removeItem("fretehub-v2-token");
  state.user = null;
  updateUserMenu();
  renderLogin();
};

$("userMenuButton").onclick = (event) => {
  event.stopPropagation();
  toggleUserMenu();
};

document.querySelectorAll("[data-demo-role]").forEach((button) => {
  button.onclick = () => {
    demoRole = button.dataset.demoRole;
    localStorage.setItem("fretehub-v2-demo-role", demoRole);
    updateUserMenu();
    closeUserMenu();
    toast(`Perfil demo alterado para ${demoRole}.`);
  };
});

document.addEventListener("click", (event) => {
  if (!$("userMenu").contains(event.target)) closeUserMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeUserMenu();
});

$("showNav").onclick = () => setNavHidden(false);
setNavHidden(localStorage.getItem("fretehub-v2-nav-hidden") === "1");

(async function start() {
  if (!token) return renderLogin();
  try {
    await loadBase();
    renderDashboard();
  } catch {
    renderLogin();
  }
})();
