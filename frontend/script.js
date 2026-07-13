const API_BASE = 'https://transaction-app-x3ks.onrender.com/api';

const accountsScreen = document.getElementById('accountsScreen');
const detailsScreen = document.getElementById('detailsScreen');
const accountsGrid = document.getElementById('accountsGrid');

const selectedAccountTitle = document.getElementById('selectedAccountTitle');
const selectedAccountName = document.getElementById('selectedAccountName');
const selectedAccountTxCount = document.getElementById('selectedAccountTxCount');

const totalCreditEl = document.getElementById('totalCredit');
const totalDebitEl = document.getElementById('totalDebit');
const netBalanceEl = document.getElementById('netBalance');

const toggleTransactionFormBtn = document.getElementById('toggleTransactionFormBtn');
const transactionComposer = document.getElementById('transactionComposer');
const composerTitle = document.getElementById('composerTitle');

const transactionForm = document.getElementById('transactionForm');
const transactionIdInput = document.getElementById('transactionId');
const dateInput = document.getElementById('date');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const messageBox = document.getElementById('message');

const mobileRecordList = document.getElementById('mobileRecordList');
const emptyState = document.getElementById('emptyState');

const newAccountBtn = document.getElementById('newAccountBtn');
const backBtn = document.getElementById('backBtn');

const openDrawerBtn = document.getElementById('openDrawerBtn');
const detailsDrawerBtn = document.getElementById('detailsDrawerBtn');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const sideDrawer = document.getElementById('sideDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');

const drawerAccountFilter = document.getElementById('drawerAccountFilter');
const searchInput = document.getElementById('searchInput');
const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const chipButtons = document.querySelectorAll('[data-filter-type]');

const exportBtn = document.getElementById('exportBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');

const typeButtons = document.querySelectorAll('.type-btn');

let accounts = [];
let transactions = [];
let selectedAccountId = null;
let selectedType = 'debit';
let selectedFilterType = 'all';

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

function openDrawer() {
  sideDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
}

function closeDrawer() {
  sideDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
}

function setScreen(screen) {
  accountsScreen.classList.toggle('active', screen === 'accounts');
  detailsScreen.classList.toggle('active', screen === 'details');
}

function setTransactionType(type) {
  selectedType = type;
  typeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

function setFilterType(type) {
  selectedFilterType = type;
  chipButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filterType === type);
  });
  renderSelectedAccountTransactions();
}

function getSelectedAccount() {
  return accounts.find((account) => account.id === selectedAccountId);
}

function renderAccountCards() {
  accountsGrid.innerHTML = '';

  accounts.forEach((account) => {
    const card = document.createElement('article');
    card.className = 'account-card';
    card.innerHTML = `
      <div class="account-card-top">
        <div>
          <h3>${account.name}</h3>
          <p>${account.transactionCount || 0} record(s)</p>
        </div>
        <span class="status-pill">${formatCurrency(account.balance)}</span>
      </div>

      <div class="account-stats">
        <div class="account-stat">
          <span>Credit</span>
          <strong>${formatCurrency(account.totalCredit)}</strong>
        </div>
        <div class="account-stat">
          <span>Debit</span>
          <strong>${formatCurrency(account.totalDebit)}</strong>
        </div>
      </div>

      <div class="account-card-actions">
        <button class="primary-btn select-account-btn" data-id="${account.id}" type="button">Open account</button>
      </div>
    `;
    accountsGrid.appendChild(card);
  });

  if (!accounts.length) {
    accountsGrid.innerHTML = `
      <div class="empty-state">
        <h3>No accounts yet</h3>
        <p>Create your first account to get started.</p>
      </div>
    `;
  }
}

function populateDrawerAccounts() {
  drawerAccountFilter.innerHTML = `
    <option value="all">All accounts</option>
    ${accounts.map((account) => `<option value="${account.id}">${account.name}</option>`).join('')}
  `;
}

function renderSelectedAccountSummary() {
  const account = getSelectedAccount();
  if (!account) return;

  selectedAccountTitle.textContent = account.name;
  selectedAccountName.textContent = account.name;
  selectedAccountTxCount.textContent = `${account.transactionCount || 0} records`;

  totalCreditEl.textContent = formatCurrency(account.totalCredit);
  totalDebitEl.textContent = formatCurrency(account.totalDebit);
  netBalanceEl.textContent = formatCurrency(account.balance);
  netBalanceEl.className = account.balance >= 0 ? 'amount positive' : 'amount negative';
}

function getVisibleTransactions() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const fromDate = fromDateInput.value;
  const toDate = toDateInput.value;
  const accountFilter = drawerAccountFilter.value || selectedAccountId || 'all';

  return transactions.filter((item) => {
    const baseAccountMatch = item.accountId === selectedAccountId;
    const filterAccountMatch = accountFilter === 'all' || item.accountId === accountFilter;
    const searchMatch = !searchTerm || item.description.toLowerCase().includes(searchTerm);
    const fromMatch = !fromDate || item.date >= fromDate;
    const toMatch = !toDate || item.date <= toDate;
    const typeMatch = selectedFilterType === 'all' || item.type === selectedFilterType;

    return baseAccountMatch && filterAccountMatch && searchMatch && fromMatch && toMatch && typeMatch;
  });
}

function renderSelectedAccountTransactions() {
  const items = getVisibleTransactions();
  mobileRecordList.innerHTML = '';
  emptyState.classList.toggle('hidden', items.length > 0);

  items.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'transaction-item';
    row.innerHTML = `
      <div class="transaction-item-top">
        <div>
          <h3>${item.description}</h3>
          <div class="transaction-meta">
            <span>${item.date}</span>
            <span>${item.accountName}</span>
          </div>
        </div>
        <span class="type-pill ${item.type}">${item.type}</span>
      </div>

      <div class="transaction-item-bottom">
        <div>
          <div class="muted-label">Amount</div>
          <div class="amount ${item.type}">${formatCurrency(item.amount)}</div>
        </div>
        <div>
          <div class="muted-label">Impact</div>
          <div class="amount ${item.balanceImpact >= 0 ? 'positive' : 'negative'}">
            ${formatCurrency(item.balanceImpact)}
          </div>
        </div>
      </div>
    `;
    mobileRecordList.appendChild(row);
  });
}

async function loadAccounts() {
  const response = await fetch(`${API_BASE}/accounts`);
  if (!response.ok) throw new Error('Failed to load accounts.');
  accounts = await response.json();
  renderAccountCards();
  populateDrawerAccounts();
}

async function loadTransactions() {
  const response = await fetch(`${API_BASE}/transactions`);
  if (!response.ok) throw new Error('Failed to load transactions.');
  transactions = await response.json();
  renderSelectedAccountTransactions();
}

async function refreshData() {
  await loadAccounts();
  await loadTransactions();
  renderSelectedAccountSummary();
}

function openAccount(accountId) {
  selectedAccountId = accountId;
  drawerAccountFilter.value = accountId;
  renderSelectedAccountSummary();
  renderSelectedAccountTransactions();
  setScreen('details');
  closeDrawer();
}

function resetForm() {
  transactionForm.reset();
  transactionIdInput.value = '';
  composerTitle.textContent = 'Add transaction';
  saveBtn.textContent = 'Save transaction';
  dateInput.value = new Date().toISOString().split('T')[0];
  setTransactionType('debit');
  transactionComposer.classList.add('hidden');
}

function toggleComposer() {
  transactionComposer.classList.toggle('hidden');
  if (!transactionComposer.classList.contains('hidden')) {
    transactionComposer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function getPayload() {
  return {
    accountId: selectedAccountId,
    date: dateInput.value,
    description: descriptionInput.value.trim(),
    type: selectedType,
    amount: Number(amountInput.value || 0)
  };
}

async function saveTransaction(event) {
  event.preventDefault();
  const id = transactionIdInput.value;
  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_BASE}/transactions/${id}` : `${API_BASE}/transactions`;

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getPayload())
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not save transaction.');

    showMessage(id ? 'Transaction updated.' : 'Transaction added.');
    resetForm();
    await refreshData();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function addAccount() {
  const name = window.prompt('Enter account name');
  if (!name) return;

  try {
    const response = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not create account.');

    await loadAccounts();
    openAccount(data.id);
  } catch (error) {
    alert(error.message);
  }
}

function exportXlsx() {
  const params = new URLSearchParams();
  params.set('accountId', selectedAccountId);
  if (selectedFilterType !== 'all') params.set('type', selectedFilterType);
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (fromDateInput.value) params.set('from', fromDateInput.value);
  if (toDateInput.value) params.set('to', toDateInput.value);

  window.location.href = `${API_BASE}/export/xlsx?${params.toString()}`;
}

function exportPdf() {
  const items = getVisibleTransactions();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`${getSelectedAccount()?.name || 'Account'} Transactions`, 14, 16);

  const rows = items.map((item) => [
    item.date,
    item.description,
    item.type,
    formatCurrency(item.amount),
    formatCurrency(item.balanceImpact)
  ]);

  doc.autoTable({
    startY: 24,
    head: [['Date', 'Description', 'Type', 'Amount', 'Impact']],
    body: rows
  });

  doc.save('transactions.pdf');
}

openDrawerBtn.addEventListener('click', openDrawer);
detailsDrawerBtn.addEventListener('click', openDrawer);
closeDrawerBtn.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

newAccountBtn.addEventListener('click', addAccount);
backBtn.addEventListener('click', () => {
  setScreen('accounts');
  closeDrawer();
});

toggleTransactionFormBtn.addEventListener('click', toggleComposer);
transactionForm.addEventListener('submit', saveTransaction);
resetBtn.addEventListener('click', resetForm);
clearFiltersBtn.addEventListener('click', () => {
  searchInput.value = '';
  fromDateInput.value = '';
  toDateInput.value = '';
  drawerAccountFilter.value = selectedAccountId || 'all';
  setFilterType('all');
  renderSelectedAccountTransactions();
});
exportBtn.addEventListener('click', exportXlsx);
exportPdfBtn.addEventListener('click', exportPdf);

searchInput.addEventListener('input', renderSelectedAccountTransactions);
fromDateInput.addEventListener('input', renderSelectedAccountTransactions);
toDateInput.addEventListener('input', renderSelectedAccountTransactions);
drawerAccountFilter.addEventListener('change', renderSelectedAccountTransactions);

chipButtons.forEach((btn) => {
  btn.addEventListener('click', () => setFilterType(btn.dataset.filterType));
});

typeButtons.forEach((btn) => {
  btn.addEventListener('click', () => setTransactionType(btn.dataset.type));
});

accountsGrid.addEventListener('click', (event) => {
  const button = event.target.closest('.select-account-btn');
  if (!button) return;
  openAccount(button.dataset.id);
});

dateInput.value = new Date().toISOString().split('T')[0];
setTransactionType('debit');
setFilterType('all');
setScreen('accounts');

refreshData().catch((error) => {
  console.error(error);
});