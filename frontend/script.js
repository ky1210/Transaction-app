const API_BASE = 'http://localhost:5000/api';

const transactionForm = document.getElementById('transactionForm');
const transactionIdInput = document.getElementById('transactionId');
const dateInput = document.getElementById('date');
const descriptionInput = document.getElementById('description');
const debitInput = document.getElementById('debit');
const creditInput = document.getElementById('credit');
const messageBox = document.getElementById('message');
const tableBody = document.getElementById('transactionTableBody');
const totalDebitEl = document.getElementById('totalDebit');
const totalCreditEl = document.getElementById('totalCredit');
const netBalanceEl = document.getElementById('netBalance');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const searchInput = document.getElementById('searchInput');
const emptyState = document.getElementById('emptyState');
const saveBtn = document.getElementById('saveBtn');

let transactions = [];

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

function getPayload() {
  return {
    date: dateInput.value,
    description: descriptionInput.value.trim(),
    debit: debitInput.value,
    credit: creditInput.value
  };
}

function resetForm() {
  transactionForm.reset();
  transactionIdInput.value = '';
  saveBtn.textContent = 'Save transaction';
  dateInput.value = new Date().toISOString().split('T')[0];
}

function renderSummary(items) {
  const totalDebit = items.reduce((sum, item) => sum + Number(item.debit || 0), 0);
  const totalCredit = items.reduce((sum, item) => sum + Number(item.credit || 0), 0);
  const net = totalCredit - totalDebit;

  totalDebitEl.textContent = formatCurrency(totalDebit);
  totalCreditEl.textContent = formatCurrency(totalCredit);
  netBalanceEl.textContent = formatCurrency(net);
  netBalanceEl.style.color = net >= 0 ? '#127c56' : '#d92d20';
}

function getFilteredTransactions() {
  const searchTerm = searchInput.value.trim().toLowerCase();

  return transactions.filter((item) => {
    return item.description.toLowerCase().includes(searchTerm);
  });
}

function renderTable() {
  const items = getFilteredTransactions();
  tableBody.innerHTML = '';

  if (!items.length) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  items.forEach((item) => {
    const row = document.createElement('tr');
    const balanceClass = Number(item.balanceImpact) >= 0 ? 'positive' : 'negative';

    row.innerHTML = `
      <td>${item.date}</td>
      <td>${item.description}</td>
      <td class="amount-debit">${Number(item.debit) ? formatCurrency(item.debit) : '-'}</td>
      <td class="amount-credit">${Number(item.credit) ? formatCurrency(item.credit) : '-'}</td>
      <td class="amount-balance ${balanceClass}">${formatCurrency(item.balanceImpact)}</td>
      <td>
        <div class="actions-cell">
          <button class="action-btn edit" data-id="${item.id}" data-action="edit">Edit</button>
          <button class="action-btn delete" data-id="${item.id}" data-action="delete">Delete</button>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });

  renderSummary(items);
}

async function loadTransactions() {
  try {
    const response = await fetch(`${API_BASE}/transactions`);
    transactions = await response.json();
    renderTable();
  } catch (error) {
    showMessage('Could not load transactions. Start the backend server.', 'error');
  }
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

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong.');
    }

    showMessage(id ? 'Transaction updated successfully.' : 'Transaction saved successfully.');
    resetForm();
    await loadTransactions();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function deleteTransaction(id) {
  const confirmed = window.confirm('Delete this transaction?');
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Delete failed.');
    }

    showMessage('Transaction deleted successfully.');
    await loadTransactions();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function editTransaction(id) {
  const item = transactions.find((entry) => entry.id === id);
  if (!item) return;

  transactionIdInput.value = item.id;
  dateInput.value = item.date;
  descriptionInput.value = item.description;
  debitInput.value = item.debit || '';
  creditInput.value = item.credit || '';
  saveBtn.textContent = 'Update transaction';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { id, action } = button.dataset;
  if (action === 'edit') editTransaction(id);
  if (action === 'delete') deleteTransaction(id);
}

function exportXlsx() {
  window.open(`${API_BASE}/export/xlsx`, '_blank');
}

transactionForm.addEventListener('submit', saveTransaction);
resetBtn.addEventListener('click', resetForm);
exportBtn.addEventListener('click', exportXlsx);
searchInput.addEventListener('input', renderTable);
tableBody.addEventListener('click', handleTableClick);

dateInput.value = new Date().toISOString().split('T')[0];
loadTransactions();