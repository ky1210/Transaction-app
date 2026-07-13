const API_BASE = 'https://transaction-app-x3ks.onrender.com/api';

const transactionForm = document.getElementById('transactionForm');
const transactionIdInput = document.getElementById('transactionId');
const accountSelect = document.getElementById('accountSelect');
const recordAccountFilter = document.getElementById('recordAccountFilter');
const dateInput = document.getElementById('date');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const messageBox = document.getElementById('message');
const totalCreditEl = document.getElementById('totalCredit');
const totalDebitEl = document.getElementById('totalDebit');
const netBalanceEl = document.getElementById('netBalance');
const accountsOverview = document.getElementById('accountsOverview');
const transactionTableBody = document.getElementById('transactionTableBody');
const mobileRecordList = document.getElementById('mobileRecordList');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const exportBtn = document.getElementById('exportBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const installBtn = document.getElementById('installBtn');
const newAccountBtn = document.getElementById('newAccountBtn');
const renameAccountBtn = document.getElementById('renameAccountBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const typeButtons = document.querySelectorAll('.type-btn');
const filterTypeButtons = document.querySelectorAll('[data-filter-type]');

let accounts = [];
let transactions = [];
let selectedType = 'debit';
let selectedFilterType = 'all';
let deferredPrompt = null;

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(Number(value || 0));
}

function showMessage(text, type = 'success') {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;

  if (text) {
    setTimeout(() => {
      messageBox.textContent = '';
      messageBox.className = 'message';
    }, 2500);
  }
}

function setTransactionType(type) {
  selectedType = type;
  typeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

function setFilterType(type) {
  selectedFilterType = type;
  filterTypeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filterType === type);
  });
  renderTransactions();
}

function getSelectedAccountId() {
  return accountSelect.value || 'all';
}

function getRecordAccountId() {
  return recordAccountFilter.value || 'all';
}

function renderAccountOptions() {
  const accountOptions = accounts
    .map((account) => `<option value="${account.id}">${account.name}</option>`)
    .join('');

  accountSelect.innerHTML = accountOptions;

  recordAccountFilter.innerHTML = `
    <option value="all">All accounts</option>
    ${accountOptions}
  `;

  if (accounts.length && !accountSelect.value) {
    accountSelect.value = accounts[0].id;
  }
}

function renderAccountsOverview() {
  accountsOverview.innerHTML = '';

  accounts.forEach((account) => {
    const card = document.createElement('article');
    card.className = 'account-card';
    card.innerHTML = `
      <h3>${account.name}</h3>
      <div class="account-mini-stats">
        <div>
          <span>Credit</span>
          <strong>${formatCurrency(account.totalCredit)}</strong>
        </div>
        <div>
          <span>Debit</span>
          <strong>${formatCurrency(account.totalDebit)}</strong>
        </div>
        <div>
          <span>Balance</span>
          <strong class="${account.balance >= 0 ? 'amount positive' : 'amount negative'}">
            ${formatCurrency(account.balance)}
          </strong>
        </div>
      </div>
    `;
    accountsOverview.appendChild(card);
  });
}

function getSelectedAccountSummary() {
  const selectedAccountId = getSelectedAccountId();
  return accounts.find((account) => account.id === selectedAccountId);
}

function renderSummary() {
  const account = getSelectedAccountSummary();

  if (!account) {
    totalCreditEl.textContent = formatCurrency(0);
    totalDebitEl.textContent = formatCurrency(0);
    netBalanceEl.textContent = formatCurrency(0);
    return;
  }

  totalCreditEl.textContent = formatCurrency(account.totalCredit);
  totalDebitEl.textContent = formatCurrency(account.totalDebit);
  netBalanceEl.textContent = formatCurrency(account.balance);
  netBalanceEl.className = account.balance >= 0 ? 'amount positive' : 'amount negative';
}

function getFilteredTransactions() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;
  const accountId = getRecordAccountId();

  return transactions.filter((item) => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm);
    const matchesFrom = !fromDate || item.date >= fromDate;
    const matchesTo = !toDate || item.date <= toDate;
    const matchesType = selectedFilterType === 'all' || item.type === selectedFilterType;
    const matchesAccount = accountId === 'all' || item.accountId === accountId;

    return matchesSearch && matchesFrom && matchesTo && matchesType && matchesAccount;
  });
}

function renderDesktopRows(items) {
  transactionTableBody.innerHTML = '';

  items.forEach((item) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${item.date}</td>
      <td>${item.description}</td>
      <td>${item.accountName}</td>
      <td><span class="type-badge ${item.type}">${item.type}</span></td>
      <td><span class="amount ${item.type}">${formatCurrency(item.amount)}</span></td>
      <td>
        <span class="amount ${item.balanceImpact >= 0 ? 'positive' : 'negative'}">
          ${formatCurrency(item.balanceImpact)}
        </span>
      </td>
      <td>
        <div class="actions-cell">
          <button class="action-btn edit" data-id="${item.id}" data-action="edit">Edit</button>
          <button class="action-btn delete" data-id="${item.id}" data-action="delete">Delete</button>
        </div>
      </td>
    `;

    transactionTableBody.appendChild(tr);
  });
}

function renderMobileCards(items) {
  mobileRecordList.innerHTML = '';

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'record-card';
    card.innerHTML = `
      <div class="record-card-top">
        <div>
          <h3>${item.description}</h3>
          <div class="record-meta">
            <span>${item.date}</span>
            <span>${item.accountName}</span>
          </div>
        </div>
        <span class="type-badge ${item.type}">${item.type}</span>
      </div>

      <div class="record-amount-row">
        <div>
          <div class="record-meta">Amount</div>
          <div class="amount ${item.type}">${formatCurrency(item.amount)}</div>
        </div>
        <div>
          <div class="record-meta">Balance impact</div>
          <div class="amount ${item.balanceImpact >= 0 ? 'positive' : 'negative'}">
            ${formatCurrency(item.balanceImpact)}
          </div>
        </div>
      </div>

      <div class="actions-cell" style="margin-top:14px;">
        <button class="action-btn edit" data-id="${item.id}" data-action="edit">Edit</button>
        <button class="action-btn delete" data-id="${item.id}" data-action="delete">Delete</button>
      </div>
    `;
    mobileRecordList.appendChild(card);
  });
}

function renderTransactions() {
  const items = getFilteredTransactions();
  emptyState.classList.toggle('hidden', items.length > 0);
  renderDesktopRows(items);
  renderMobileCards(items);
}

async function loadAccounts() {
  const response = await fetch(`${API_BASE}/accounts`);
  if (!response.ok) throw new Error('Could not load accounts.');
  accounts = await response.json();
  renderAccountOptions();
  renderAccountsOverview();
  renderSummary();
}

async function loadTransactions() {
  const response = await fetch(`${API_BASE}/transactions`);
  if (!response.ok) throw new Error('Could not load transactions.');
  transactions = await response.json();
  renderTransactions();
}

async function refreshAll() {
  await loadAccounts();
  await loadTransactions();
}

function resetForm() {
  transactionForm.reset();
  transactionIdInput.value = '';
  saveBtn.textContent = 'Save transaction';
  dateInput.value = new Date().toISOString().split('T')[0];
  setTransactionType('debit');
}

function getPayload() {
  return {
    accountId: getSelectedAccountId(),
    date: dateInput.value,
    description: descriptionInput.value.trim(),
    type: selectedType,
    amount: Number(amountInput.value || 0)
  };
}

async function saveTransaction(event) {
  event.preventDefault();

  const id = transactionIdInput.value;
  const payload = getPayload();
  const url = id ? `${API_BASE}/transactions/${id}` : `${API_BASE}/transactions`;
  const method = id ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to save transaction.');

    showMessage(id ? 'Transaction updated successfully.' : 'Transaction saved successfully.');
    resetForm();
    await refreshAll();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function editTransaction(id) {
  const item = transactions.find((entry) => entry.id === id);
  if (!item) return;

  transactionIdInput.value = item.id;
  accountSelect.value = item.accountId;
  dateInput.value = item.date;
  descriptionInput.value = item.description;
  amountInput.value = item.amount;
  setTransactionType(item.type);
  saveBtn.textContent = 'Update transaction';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteTransaction(id) {
  const confirmed = window.confirm('Delete this transaction?');
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Delete failed.');

    showMessage('Transaction deleted successfully.');
    await refreshAll();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function clearTransactions() {
  const accountId = getRecordAccountId();
  const confirmed = window.confirm(
    accountId === 'all'
      ? 'Clear all records from all accounts?'
      : 'Clear all records from this selected account?'
  );

  if (!confirmed) return;

  try {
    const query = accountId && accountId !== 'all' ? `?accountId=${encodeURIComponent(accountId)}` : '';
    const response = await fetch(`${API_BASE}/transactions${query}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Clear failed.');

    showMessage(data.message || 'Records cleared successfully.');
    await refreshAll();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function addAccount() {
  const name = window.prompt('Enter new account name:');
  if (!name) return;

  try {
    const response = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to add account.');

    showMessage('Account created successfully.');
    await loadAccounts();
    accountSelect.value = data.id;
    recordAccountFilter.value = 'all';
    renderSummary();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function renameAccount() {
  const account = getSelectedAccountSummary();
  if (!account) return;

  const name = window.prompt('Rename account:', account.name);
  if (!name) return;

  try {
    const response = await fetch(`${API_BASE}/accounts/${account.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to rename account.');

    showMessage(data.message || 'Account renamed successfully.');
    await refreshAll();
    accountSelect.value = account.id;
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function deleteAccount() {
  const account = getSelectedAccountSummary();
  if (!account) return;

  const confirmed = window.confirm(`Delete account "${account.name}"?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE}/accounts/${account.id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to delete account.');

    showMessage(data.message || 'Account deleted successfully.');
    await refreshAll();
    if (accounts.length) {
      accountSelect.value = accounts[0].id;
    }
    renderSummary();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function exportXlsx() {
  const params = new URLSearchParams();
  if (getRecordAccountId() !== 'all') params.set('accountId', getRecordAccountId());
  if (selectedFilterType !== 'all') params.set('type', selectedFilterType);
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (fromDateInput.value) params.set('from', fromDateInput.value);
  if (toDateInput.value) params.set('to', toDateInput.value);

  const query = params.toString();
  window.location.href = `${API_BASE}/export/xlsx${query ? `?${query}` : ''}`;
}

function exportPdf() {
  const items = getFilteredTransactions();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Transaction Report', 14, 16);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 22);

  const rows = items.map((item) => [
    item.date,
    item.accountName,
    item.description,
    item.type,
    formatCurrency(item.amount),
    formatCurrency(item.balanceImpact)
  ]);

  doc.autoTable({
    startY: 28,
    head: [['Date', 'Account', 'Description', 'Type', 'Amount', 'Balance Impact']],
    body: rows
  });

  doc.save('transaction-report.pdf');
}

function clearFilters() {
  searchInput.value = '';
  fromDateInput.value = '';
  toDateInput.value = '';
  recordAccountFilter.value = 'all';
  setFilterType('all');
  renderTransactions();
}

function handleRecordAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { id, action } = button.dataset;
  if (action === 'edit') editTransaction(id);
  if (action === 'delete') deleteTransaction(id);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    });
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.classList.remove('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });
}

transactionForm.addEventListener('submit', saveTransaction);
resetBtn.addEventListener('click', resetForm);
clearFiltersBtn.addEventListener('click', clearFilters);
clearAllBtn.addEventListener('click', clearTransactions);
exportBtn.addEventListener('click', exportXlsx);
exportPdfBtn.addEventListener('click', exportPdf);
newAccountBtn.addEventListener('click', addAccount);
renameAccountBtn.addEventListener('click', renameAccount);
deleteAccountBtn.addEventListener('click', deleteAccount);

searchInput.addEventListener('input', renderTransactions);
fromDateInput.addEventListener('input', renderTransactions);
toDateInput.addEventListener('input', renderTransactions);
recordAccountFilter.addEventListener('change', renderTransactions);
accountSelect.addEventListener('change', renderSummary);

typeButtons.forEach((btn) => {
  btn.addEventListener('click', () => setTransactionType(btn.dataset.type));
});

filterTypeButtons.forEach((btn) => {
  btn.addEventListener('click', () => setFilterType(btn.dataset.filterType));
});

transactionTableBody.addEventListener('click', handleRecordAction);
mobileRecordList.addEventListener('click', handleRecordAction);

dateInput.value = new Date().toISOString().split('T')[0];
setTransactionType('debit');
setFilterType('all');
registerServiceWorker();
setupInstallPrompt();

refreshAll().catch((error) => {
  showMessage(error.message || 'Failed to load app data.', 'error');
});