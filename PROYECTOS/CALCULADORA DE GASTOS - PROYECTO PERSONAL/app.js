const STORAGE_KEY = "control-financiero-v2";
const BUDGET_KEY = "control-financiero-budgets";
const API_URL = "api.php";

const monthNames = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric"
});

const money = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN"
});

const initialState = {
  activeMonth: new Date().toISOString().slice(0, 7),
  transactions: [],
  debts: [
    {
      id: crypto.randomUUID(),
      name: "Yape",
      amount: 92,
      day: 2,
      startMonth: "2026-06",
      endMonth: "2026-08",
      repeats: "monthly"
    },
    {
      id: crypto.randomUUID(),
      name: "Caja Huancayo",
      amount: 130,
      day: 2,
      startMonth: "2026-06",
      endMonth: "2026-08",
      repeats: "monthly"
    },
    {
      id: crypto.randomUUID(),
      name: "Angeles",
      amount: 60,
      day: 2,
      startMonth: "2026-07",
      endMonth: "2026-07",
      repeats: "once"
    },
    {
      id: crypto.randomUUID(),
      name: "Mama",
      amount: 57,
      day: 2,
      startMonth: "2026-07",
      endMonth: "2026-07",
      repeats: "once"
    }
  ]
};

let apiEnabled = false;
let state = loadState();
let budgets = loadBudgets();
let movementSearch = "";
let movementFilter = "all";
let deferredInstallPrompt = null;

const elements = {
  activeMonthLabel: document.querySelector("#activeMonthLabel"),
  incomeTotal: document.querySelector("#incomeTotal"),
  debtTotal: document.querySelector("#debtTotal"),
  expenseTotal: document.querySelector("#expenseTotal"),
  savingsMonthTotal: document.querySelector("#savingsMonthTotal"),
  savingsTotal: document.querySelector("#savingsTotal"),
  savingsList: document.querySelector("#savingsList"),
  balanceTotal: document.querySelector("#balanceTotal"),
  firstBalance: document.querySelector("#firstBalance"),
  firstIncome: document.querySelector("#firstIncome"),
  firstOut: document.querySelector("#firstOut"),
  secondBalance: document.querySelector("#secondBalance"),
  secondIncome: document.querySelector("#secondIncome"),
  secondOut: document.querySelector("#secondOut"),
  firstHalfList: document.querySelector("#firstHalfList"),
  secondHalfList: document.querySelector("#secondHalfList"),
  projectionGrid: document.querySelector("#projectionGrid"),
  transactionForm: document.querySelector("#transactionForm"),
  debtForm: document.querySelector("#debtForm"),
  resetData: document.querySelector("#resetData"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  dataMode: document.querySelector("#modeText")
};

Object.assign(elements, {
  transactionType: document.querySelector("#transactionType"),
  transactionCategory: document.querySelector("#transactionCategory"),
  monthlyBudget: document.querySelector("#monthlyBudget"),
  budgetAmount: document.querySelector("#budgetAmount"),
  budgetRemaining: document.querySelector("#budgetRemaining"),
  budgetProgress: document.querySelector("#budgetProgress"),
  editBudget: document.querySelector("#editBudget"),
  financialHealthTitle: document.querySelector("#financialHealthTitle"),
  financialHealthText: document.querySelector("#financialHealthText"),
  movementList: document.querySelector("#movementList"),
  movementSearch: document.querySelector("#movementSearch"),
  movementFilter: document.querySelector("#movementFilter"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  installApp: document.querySelector("#installApp"),
  mobileNextMonth: document.querySelector("#mobileNextMonth"),
  toast: document.querySelector("#toast")
});

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(initialState);

  try {
    const parsed = JSON.parse(stored);
    return {
      ...structuredClone(initialState),
      ...parsed,
      transactions: (parsed.transactions || []).map((item) => ({
        ...item,
        type: normalizeTransactionType(item),
        category: item.category || inferCategory(item),
        day: Number(item.day || 1)
      }))
    };
  } catch {
    return structuredClone(initialState);
  }
}

function loadBudgets() {
  try {
    return JSON.parse(localStorage.getItem(BUDGET_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveBudgets() {
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
}

function inferCategory(transaction) {
  const name = String(transaction.name || "").toLowerCase();
  const type = normalizeTransactionType(transaction);
  if (type === "income") return "Sueldo";
  if (type === "savings") return "Ahorro";
  if (/pasaje|tren|combi|taxi|gasolina|combustible/.test(name)) return "Transporte";
  if (/casa|hogar|alquiler/.test(name)) return "Hogar";
  if (/celular|internet|luz|agua|servicio/.test(name)) return "Servicios";
  if (/comida|mercado|supermercado|almuerzo/.test(name)) return "Alimentación";
  if (/salud|medicina|doctor|farmacia/.test(name)) return "Salud";
  return "Otros";
}

function normalizeTransactionType(transaction) {
  const name = String(transaction.name || "").toLowerCase();
  if (transaction.type === "savings" || name.includes("ahorro")) return "savings";
  return transaction.type;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("visible"), 2600);
}

async function api(action, payload = {}) {
  const response = await fetch(`${API_URL}?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.message || "No se pudo completar la accion");
  }

  return data;
}

async function loadRemoteState() {
  if (location.protocol === "file:") return false;

  try {
    const data = await api("load");
    state = {
      ...state,
      transactions: data.transactions || [],
      debts: data.debts || []
    };
    apiEnabled = true;
    elements.dataMode.textContent = "MySQL activo";
    return true;
  } catch {
    apiEnabled = false;
    elements.dataMode.textContent = "Guardado local";
    return false;
  }
}

function transactionKey(transaction) {
  return [
    normalizeTransactionType(transaction),
    transaction.category || inferCategory(transaction),
    transaction.name.trim().toLowerCase(),
    Number(transaction.amount).toFixed(2),
    Number(transaction.day),
    transaction.month
  ].join("|");
}

function debtKey(debt) {
  return [
    debt.name.trim().toLowerCase(),
    Number(debt.amount).toFixed(2),
    Number(debt.day),
    debt.startMonth,
    debt.endMonth,
    debt.repeats
  ].join("|");
}

async function migrateLocalStateToDatabase(localSnapshot) {
  if (!apiEnabled) return;

  const remoteTransactionKeys = new Set(state.transactions.map(transactionKey));
  const remoteDebtKeys = new Set(state.debts.map(debtKey));
  let migrated = 0;

  for (const transaction of localSnapshot.transactions || []) {
    if (remoteTransactionKeys.has(transactionKey(transaction))) continue;
    const data = await api("createTransaction", transaction);
    state.transactions.push(data.record);
    remoteTransactionKeys.add(transactionKey(data.record));
    migrated += 1;
  }

  for (const debt of localSnapshot.debts || []) {
    if (remoteDebtKeys.has(debtKey(debt))) continue;
    const data = await api("createDebt", debt);
    state.debts.push(data.record);
    remoteDebtKeys.add(debtKey(data.record));
    migrated += 1;
  }

  if (migrated > 0) {
    elements.dataMode.textContent = `MySQL activo (${migrated} migrados)`;
  }
}

function monthToDate(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatMonth(monthKey) {
  const label = monthNames.format(monthToDate(monthKey));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function addMonths(monthKey, amount) {
  const date = monthToDate(monthKey);
  date.setMonth(date.getMonth() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getHalfFromDay(day) {
  return Number(day) <= 15 ? "first" : "second";
}

function getHalfLabel(day) {
  return getHalfFromDay(day) === "first" ? "1ra quincena" : "2da quincena";
}

function debtAppliesToMonth(debt, monthKey) {
  if (debt.repeats === "once") return debt.startMonth === monthKey;
  return debt.startMonth <= monthKey && debt.endMonth >= monthKey;
}

function createEmptyHalf() {
  return {
    income: 0,
    expenses: 0,
    savings: 0,
    debtTotal: 0,
    items: []
  };
}

function getMonthData(monthKey) {
  const halves = {
    first: createEmptyHalf(),
    second: createEmptyHalf()
  };

  const transactions = state.transactions.filter((item) => item.month === monthKey);
  const debts = state.debts.filter((debt) => debtAppliesToMonth(debt, monthKey));

  transactions.forEach((transaction) => {
    transaction.type = normalizeTransactionType(transaction);
    const half = getHalfFromDay(transaction.day);
    halves[half].items.push({ ...transaction, source: "transaction" });
    if (transaction.type === "income") {
      halves[half].income += transaction.amount;
    } else if (transaction.type === "savings") {
      halves[half].savings += transaction.amount;
    } else {
      halves[half].expenses += transaction.amount;
    }
  });

  debts.forEach((debt) => {
    const half = getHalfFromDay(debt.day);
    halves[half].items.push({ ...debt, source: "debt", type: "debt" });
    halves[half].debtTotal += debt.amount;
  });

  Object.values(halves).forEach((half) => {
    half.items.sort((a, b) => Number(a.day) - Number(b.day) || a.name.localeCompare(b.name));
    half.out = half.expenses + half.savings + half.debtTotal;
    half.balance = half.income - half.out;
  });

  const income = halves.first.income + halves.second.income;
  const expenses = halves.first.expenses + halves.second.expenses;
  const savings = halves.first.savings + halves.second.savings;
  const debtTotal = halves.first.debtTotal + halves.second.debtTotal;

  return {
    halves,
    transactions,
    debts,
    income,
    expenses,
    savings,
    debtTotal,
    balance: income - expenses - savings - debtTotal
  };
}

function getSavingsData() {
  const savings = state.transactions
    .map((transaction) => ({ ...transaction, type: normalizeTransactionType(transaction) }))
    .filter((transaction) => transaction.type === "savings")
    .sort((a, b) => b.month.localeCompare(a.month) || Number(b.day) - Number(a.day));

  return {
    total: savings.reduce((sum, transaction) => sum + Number(transaction.amount), 0),
    items: savings
  };
}

function render() {
  const monthData = getMonthData(state.activeMonth);

  elements.activeMonthLabel.textContent = formatMonth(state.activeMonth);
  elements.incomeTotal.textContent = money.format(monthData.income);
  elements.debtTotal.textContent = money.format(monthData.debtTotal);
  elements.expenseTotal.textContent = money.format(monthData.expenses);
  elements.savingsMonthTotal.textContent = money.format(monthData.savings);
  setSignedAmount(elements.balanceTotal, monthData.balance);
  renderSavings();

  renderHalf("first", monthData.halves.first);
  renderHalf("second", monthData.halves.second);
  renderBudget(monthData);
  renderFinancialHealth(monthData);
  renderMovements(monthData);
  renderProjection();
  setDefaultFormDates();
}

function renderBudget(monthData) {
  const budget = Number(budgets[state.activeMonth] || 0);
  const spent = monthData.expenses + monthData.debtTotal;
  elements.monthlyBudget.value = budget || "";
  elements.budgetAmount.textContent = money.format(budget);

  if (!budget) {
    elements.budgetRemaining.textContent = "Configura tu presupuesto";
    elements.budgetProgress.style.width = "0%";
    elements.budgetProgress.style.background = "var(--accent)";
    return;
  }

  const remaining = budget - spent;
  const percentage = Math.min((spent / budget) * 100, 100);
  elements.budgetRemaining.textContent =
    remaining >= 0 ? `${money.format(remaining)} disponibles` : `${money.format(Math.abs(remaining))} excedidos`;
  elements.budgetProgress.style.width = `${percentage}%`;
  elements.budgetProgress.style.background = remaining < 0 ? "var(--red)" : percentage > 80 ? "#d68a16" : "var(--accent)";
}

function renderFinancialHealth(monthData) {
  if (!monthData.income && !monthData.expenses && !monthData.debtTotal) {
    elements.financialHealthTitle.textContent = "Sin movimientos";
    elements.financialHealthText.textContent = "Registra ingresos y gastos para calcular tu estado financiero.";
    return;
  }

  const committed = monthData.expenses + monthData.debtTotal + monthData.savings;
  const ratio = monthData.income ? committed / monthData.income : Infinity;

  if (ratio <= 0.7) {
    elements.financialHealthTitle.textContent = "Buen equilibrio";
    elements.financialHealthText.textContent = "Tus salidas consumen menos del 70% de tus ingresos del mes.";
  } else if (ratio <= 1) {
    elements.financialHealthTitle.textContent = "Margen ajustado";
    elements.financialHealthText.textContent = "Tus gastos están cerca de tus ingresos. Revisa compras no esenciales.";
  } else {
    elements.financialHealthTitle.textContent = "Atención al saldo";
    elements.financialHealthText.textContent = "Tus compromisos superan los ingresos registrados para este mes.";
  }
}

function renderMovements(monthData) {
  const items = [
    ...monthData.transactions.map((item) => ({ ...item, source: "transaction" })),
    ...monthData.debts.map((item) => ({ ...item, source: "debt", type: "debt" }))
  ]
    .filter((item) => movementFilter === "all" || (item.source === "debt" ? "debt" : item.type) === movementFilter)
    .filter((item) => {
      const term = movementSearch.trim().toLowerCase();
      return !term || `${item.name} ${item.category || ""}`.toLowerCase().includes(term);
    })
    .sort((a, b) => Number(a.day) - Number(b.day));

  elements.movementList.innerHTML = "";
  if (!items.length) {
    elements.movementList.append(emptyState("No hay movimientos que coincidan con el filtro."));
    return;
  }
  items.forEach((item) => elements.movementList.append(createItemRow(item)));
}

function renderSavings() {
  const savingsData = getSavingsData();
  elements.savingsTotal.textContent = money.format(savingsData.total);
  elements.savingsList.innerHTML = "";

  if (!savingsData.items.length) {
    elements.savingsList.append(emptyState("Aun no hay ahorros registrados."));
    return;
  }

  savingsData.items.slice(0, 5).forEach((item) => {
    elements.savingsList.append(createItemRow({ ...item, source: "transaction" }));
  });
}

function renderHalf(halfName, halfData) {
  const list = halfName === "first" ? elements.firstHalfList : elements.secondHalfList;
  const balance = halfName === "first" ? elements.firstBalance : elements.secondBalance;
  const income = halfName === "first" ? elements.firstIncome : elements.secondIncome;
  const out = halfName === "first" ? elements.firstOut : elements.secondOut;

  setSignedAmount(balance, halfData.balance);
  income.textContent = money.format(halfData.income);
  out.textContent = money.format(halfData.out);

  list.innerHTML = "";
  if (!halfData.items.length) {
    list.append(emptyState());
    return;
  }

  halfData.items.forEach((item) => {
    list.append(createItemRow(item));
  });
}

function createItemRow(item, compact = false) {
  const row = document.createElement("div");
  const kind = item.source === "debt" ? "debt" : item.type;
  row.className = `item-row ${kind}-item`;

  const detail =
    item.source === "debt"
      ? `Pago dia ${item.day}. ${formatMonth(item.startMonth)} - ${formatMonth(item.endMonth)}`
      : `Día ${item.day}. ${item.category || inferCategory(item)} · ${typeLabel(item.type)} · ${getHalfLabel(item.day)}`;

  const deleteAttr =
    item.source === "debt"
      ? `data-delete-debt="${item.id}"`
      : `data-delete-transaction="${item.id}"`;

  row.innerHTML = `
    <span class="item-badge">${iconFor(kind)}</span>
    <div>
      <strong>${escapeHtml(item.name)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
    <span class="amount">${money.format(item.amount)}</span>
    ${compact ? "" : `<button class="delete-button" type="button" ${deleteAttr} aria-label="Eliminar">x</button>`}
  `;

  if (compact) {
    row.addEventListener("dblclick", () => removeItem(item));
    row.title = "Doble clic para eliminar";
  }

  return row;
}

function iconFor(kind) {
  if (kind === "income") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M17 8c0-2-2-3-5-3s-5 1-5 3 2 3 5 3 5 1 5 3-2 3-5 3-5-1-5-3" /></svg>';
  }

  if (kind === "debt") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>';
  }

  if (kind === "savings") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 7c0-2.2-3.1-4-7-4S5 4.8 5 7v10c0 2.2 3.1 4 7 4s7-1.8 7-4V7z" /><path d="M5 7c0 2.2 3.1 4 7 4s7-1.8 7-4" /><path d="M5 12c0 2.2 3.1 4 7 4s7-1.8 7-4" /></svg>';
  }

  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M6 7v13h12V7M9 7V4h6v3M10 11v5M14 11v5" /></svg>';
}

function typeLabel(type) {
  if (type === "income") return "Ingreso";
  if (type === "savings") return "Ahorro";
  return "Gasto";
}

function renderProjection() {
  elements.projectionGrid.innerHTML = "";
  for (let index = 0; index < 6; index += 1) {
    const monthKey = addMonths(state.activeMonth, index);
    const data = getMonthData(monthKey);
    const card = document.createElement("article");
    card.className = "projection-card";
    card.innerHTML = `
      <h3>${formatMonth(monthKey)}</h3>
      <dl>
        <div><dt>Ingresos</dt><dd>${money.format(data.income)}</dd></div>
        <div><dt>Deudas</dt><dd>${money.format(data.debtTotal)}</dd></div>
        <div><dt>Ahorros</dt><dd>${money.format(data.savings)}</dd></div>
        <div><dt>Gastos</dt><dd>${money.format(data.expenses)}</dd></div>
        <div><dt>Saldo</dt><dd class="${data.balance < 0 ? "is-negative" : "is-positive"}">${money.format(data.balance)}</dd></div>
      </dl>
      <dl class="projection-split">
        <div><dt>1ra quincena</dt><dd>${money.format(data.halves.first.out)}</dd></div>
        <div><dt>2da quincena</dt><dd>${money.format(data.halves.second.out)}</dd></div>
      </dl>
    `;
    elements.projectionGrid.append(card);
  }
}

function emptyState(message = "Sin registros en esta quincena.") {
  const node = document.querySelector("#emptyStateTemplate").content.cloneNode(true);
  node.querySelector(".empty-state").textContent = message;
  return node;
}

function setSignedAmount(element, value) {
  element.textContent = money.format(value);
  element.classList.toggle("is-negative", value < 0);
  element.classList.toggle("is-positive", value >= 0);
}

function setDefaultFormDates() {
  document.querySelector("#transactionMonth").value = state.activeMonth;
  document.querySelector("#debtStart").value = state.activeMonth;
  document.querySelector("#debtEnd").value = state.activeMonth;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function removeItem(item) {
  if (item.source === "debt") {
    state.debts = state.debts.filter((debt) => String(debt.id) !== String(item.id));
  } else {
    state.transactions = state.transactions.filter((transaction) => String(transaction.id) !== String(item.id));
  }
  saveState();
  render();
}

elements.prevMonth.addEventListener("click", () => {
  state.activeMonth = addMonths(state.activeMonth, -1);
  saveState();
  render();
});

elements.nextMonth.addEventListener("click", () => {
  state.activeMonth = addMonths(state.activeMonth, 1);
  saveState();
  render();
});

elements.mobileNextMonth.addEventListener("click", () => elements.nextMonth.click());

elements.transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const transaction = {
    id: crypto.randomUUID(),
    type: normalizeTransactionType({
      type: document.querySelector("#transactionType").value,
      name: document.querySelector("#transactionName").value.trim()
    }),
    name: document.querySelector("#transactionName").value.trim(),
    category: elements.transactionCategory.value,
    amount: Number(document.querySelector("#transactionAmount").value),
    day: Number(document.querySelector("#transactionDay").value),
    month: document.querySelector("#transactionMonth").value
  };

  if (apiEnabled) {
    try {
      const data = await api("createTransaction", transaction);
      state.transactions.push(data.record);
    } catch {
      state.transactions.push(transaction);
      apiEnabled = false;
      elements.dataMode.textContent = "Guardado local";
    }
  } else {
    state.transactions.push(transaction);
  }

  form.reset();
  elements.transactionType.value = "expense";
  saveState();
  render();
  showToast("Movimiento guardado");
});

elements.debtForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const startMonth = document.querySelector("#debtStart").value;
  const endMonth = document.querySelector("#debtEnd").value;

  const debt = {
    id: crypto.randomUUID(),
    name: document.querySelector("#debtName").value.trim(),
    amount: Number(document.querySelector("#debtAmount").value),
    day: Number(document.querySelector("#debtDay").value),
    startMonth,
    endMonth: endMonth < startMonth ? startMonth : endMonth,
    repeats: document.querySelector("#debtRepeats").value
  };

  if (apiEnabled) {
    try {
      const data = await api("createDebt", debt);
      state.debts.push(data.record);
    } catch {
      state.debts.push(debt);
      apiEnabled = false;
      elements.dataMode.textContent = "Guardado local";
    }
  } else {
    state.debts.push(debt);
  }

  form.reset();
  saveState();
  render();
  showToast("Deuda guardada");
});

document.addEventListener("click", async (event) => {
  const debtButton = event.target.closest("[data-delete-debt]");
  const transactionButton = event.target.closest("[data-delete-transaction]");

  if (debtButton) {
    if (apiEnabled) {
      await api("deleteDebt", { id: debtButton.dataset.deleteDebt });
    }
    state.debts = state.debts.filter((debt) => String(debt.id) !== String(debtButton.dataset.deleteDebt));
    saveState();
    render();
  }

  if (transactionButton) {
    if (apiEnabled) {
      await api("deleteTransaction", { id: transactionButton.dataset.deleteTransaction });
    }
    state.transactions = state.transactions.filter(
      (transaction) => String(transaction.id) !== String(transactionButton.dataset.deleteTransaction)
    );
    saveState();
    render();
  }
});

elements.resetData.addEventListener("click", async () => {
  if (!window.confirm("¿Restaurar los datos de ejemplo? Tus registros actuales serán reemplazados.")) return;
  if (apiEnabled) {
    const data = await api("reset");
    state = {
      ...state,
      transactions: data.transactions || [],
      debts: data.debts || []
    };
  } else {
    state = structuredClone(initialState);
  }
  saveState();
  render();
  showToast("Datos de ejemplo restaurados");
});

elements.editBudget.addEventListener("click", () => {
  const isHidden = elements.monthlyBudget.hidden;
  elements.monthlyBudget.hidden = !isHidden;
  elements.editBudget.textContent = isHidden ? "Guardar" : "Editar";
  if (isHidden) {
    elements.monthlyBudget.focus();
  } else {
    budgets[state.activeMonth] = Math.max(0, Number(elements.monthlyBudget.value || 0));
    saveBudgets();
    render();
    showToast("Presupuesto actualizado");
  }
});

elements.monthlyBudget.addEventListener("keydown", (event) => {
  if (event.key === "Enter") elements.editBudget.click();
});

elements.movementSearch.addEventListener("input", (event) => {
  movementSearch = event.target.value;
  renderMovements(getMonthData(state.activeMonth));
});

elements.movementFilter.addEventListener("change", (event) => {
  movementFilter = event.target.value;
  renderMovements(getMonthData(state.activeMonth));
});

elements.transactionType.addEventListener("change", (event) => {
  if (event.target.value === "income") elements.transactionCategory.value = "Sueldo";
  if (event.target.value === "savings") elements.transactionCategory.value = "Ahorro";
});

elements.exportData.addEventListener("click", () => {
  const backup = {
    version: 3,
    exportedAt: new Date().toISOString(),
    state,
    budgets
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `control-financiero-${state.activeMonth}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Copia de seguridad exportada");
});

elements.importData.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (!backup.state || !Array.isArray(backup.state.transactions) || !Array.isArray(backup.state.debts)) {
      throw new Error("Formato no válido");
    }
    state = backup.state;
    budgets = backup.budgets || {};
    saveState();
    saveBudgets();
    render();
    showToast("Copia de seguridad importada");
  } catch {
    showToast("No se pudo importar el archivo");
  } finally {
    event.target.value = "";
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.installApp.hidden = false;
});

elements.installApp.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installApp.hidden = true;
});

async function boot() {
  const localSnapshot = structuredClone(state);
  render();
  await loadRemoteState();
  await migrateLocalStateToDatabase(localSnapshot);
  saveState();
  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

boot();
