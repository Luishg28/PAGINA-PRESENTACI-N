const STORAGE_KEY = "control-financiero-v2";
const THEME_KEY = "control-financiero-theme";
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
  activeMonth: "2026-06",
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
  dataMode: document.querySelector("#modeText"),
  themeSelect: document.querySelector("#themeSelect")
};

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
        day: Number(item.day || 1)
      }))
    };
  } catch {
    return structuredClone(initialState);
  }
}

function normalizeTransactionType(transaction) {
  const name = String(transaction.name || "").toLowerCase();
  if (transaction.type === "savings" || name.includes("ahorro")) return "savings";
  return transaction.type;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  renderProjection();
  setDefaultFormDates();
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

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  elements.themeSelect.value = theme;
  localStorage.setItem(THEME_KEY, theme);
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
      : `Dia ${item.day}. ${typeLabel(item.type)} en ${getHalfLabel(item.day)}`;

  const deleteAttr =
    item.source === "debt"
      ? `data-delete-debt="${item.id}"`
      : `data-delete-transaction="${item.id}"`;

  row.innerHTML = `
    <span class="item-badge">${iconFor(kind)}</span>
    <div>
      <strong>${escapeHtml(item.name)}</strong>
      <small>${detail}</small>
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

elements.themeSelect.addEventListener("change", (event) => {
  applyTheme(event.target.value);
});

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
  saveState();
  render();
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
});

async function boot() {
  applyTheme(localStorage.getItem(THEME_KEY) || "fresh");
  const localSnapshot = structuredClone(state);
  await loadRemoteState();
  await migrateLocalStateToDatabase(localSnapshot);
  saveState();
  render();
}

boot();
