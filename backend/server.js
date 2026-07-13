const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 5000;

const dataDir = path.join(__dirname, 'data');
const accountsFile = path.join(dataDir, 'accounts.json');
const transactionsFile = path.join(dataDir, 'transactions.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(accountsFile)) {
  fs.writeFileSync(accountsFile, JSON.stringify([], null, 2));
}

if (!fs.existsSync(transactionsFile)) {
  fs.writeFileSync(transactionsFile, JSON.stringify([], null, 2));
}

app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readAccounts() {
  return readJson(accountsFile);
}

function saveAccounts(accounts) {
  writeJson(accountsFile, accounts);
}

function readTransactions() {
  return readJson(transactionsFile);
}

function saveTransactions(transactions) {
  writeJson(transactionsFile, transactions);
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAccountSummary(account, transactions) {
  const accountTransactions = transactions.filter((item) => item.accountId === account.id);
  const totalCredit = accountTransactions
    .filter((item) => item.type === 'credit')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalDebit = accountTransactions
    .filter((item) => item.type === 'debit')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    ...account,
    totalCredit,
    totalDebit,
    balance: totalCredit - totalDebit,
    transactionCount: accountTransactions.length
  };
}

function enrichTransaction(transaction, accounts) {
  const account = accounts.find((item) => item.id === transaction.accountId);
  const amount = Number(transaction.amount || 0);

  return {
    ...transaction,
    amount,
    balanceImpact: transaction.type === 'credit' ? amount : -amount,
    accountName: account ? account.name : 'Unknown Account'
  };
}

function normalizeAccount(body) {
  const name = (body.name || '').trim();

  if (!name) {
    return { error: 'Account name is required.' };
  }

  return { name };
}

function normalizeTransaction(body) {
  const accountId = (body.accountId || '').trim();
  const date = (body.date || '').trim();
  const description = (body.description || '').trim();
  const type = (body.type || '').trim().toLowerCase();
  const amount = Number(body.amount || 0);

  if (!accountId) {
    return { error: 'Account is required.' };
  }

  if (!date || !description) {
    return { error: 'Date and description are required.' };
  }

  if (!['debit', 'credit'].includes(type)) {
    return { error: 'Type must be debit or credit.' };
  }

  if (Number.isNaN(amount) || amount <= 0) {
    return { error: 'Amount must be greater than 0.' };
  }

  return {
    accountId,
    date,
    description,
    type,
    amount
  };
}

function getFilteredTransactions(allTransactions, query) {
  let items = [...allTransactions];

  if (query.accountId) {
    items = items.filter((item) => item.accountId === query.accountId);
  }

  if (query.type && ['debit', 'credit'].includes(query.type)) {
    items = items.filter((item) => item.type === query.type);
  }

  if (query.search) {
    const term = query.search.toLowerCase();
    items = items.filter((item) => item.description.toLowerCase().includes(term));
  }

  if (query.from) {
    items = items.filter((item) => item.date >= query.from);
  }

  if (query.to) {
    items = items.filter((item) => item.date <= query.to);
  }

  return items.sort((a, b) => new Date(b.date) - new Date(a.date));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/accounts', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();
  const result = accounts.map((account) => getAccountSummary(account, transactions));
  res.json(result);
});

app.post('/api/accounts', (req, res) => {
  const result = normalizeAccount(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const accounts = readAccounts();
  const duplicate = accounts.find(
    (item) => item.name.toLowerCase() === result.name.toLowerCase()
  );

  if (duplicate) {
    return res.status(400).json({ message: 'Account already exists.' });
  }

  const account = {
    id: makeId(),
    name: result.name,
    createdAt: new Date().toISOString()
  };

  accounts.push(account);
  saveAccounts(accounts);

  res.status(201).json(account);
});

app.put('/api/accounts/:id', (req, res) => {
  const accounts = readAccounts();
  const index = accounts.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Account not found.' });
  }

  const result = normalizeAccount(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const duplicate = accounts.find(
    (item) =>
      item.id !== req.params.id &&
      item.name.toLowerCase() === result.name.toLowerCase()
  );

  if (duplicate) {
    return res.status(400).json({ message: 'Another account already uses this name.' });
  }

  accounts[index] = {
    ...accounts[index],
    name: result.name,
    updatedAt: new Date().toISOString()
  };

  saveAccounts(accounts);
  res.json(accounts[index]);
});

app.delete('/api/accounts/:id', (req, res) => {
  const accounts = readAccounts();
  const accountExists = accounts.some((item) => item.id === req.params.id);

  if (!accountExists) {
    return res.status(404).json({ message: 'Account not found.' });
  }

  const remainingAccounts = accounts.filter((item) => item.id !== req.params.id);
  const transactions = readTransactions();
  const remainingTransactions = transactions.filter((item) => item.accountId !== req.params.id);

  saveAccounts(remainingAccounts);
  saveTransactions(remainingTransactions);

  res.json({ message: 'Account and linked transactions deleted successfully.' });
});

app.get('/api/transactions', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();
  const filtered = getFilteredTransactions(transactions, req.query);
  const result = filtered.map((item) => enrichTransaction(item, accounts));
  res.json(result);
});

app.post('/api/transactions', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();

  const result = normalizeTransaction(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const accountExists = accounts.some((item) => item.id === result.accountId);
  if (!accountExists) {
    return res.status(400).json({ message: 'Selected account does not exist.' });
  }

  const transaction = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    ...result
  };

  transactions.push(transaction);
  saveTransactions(transactions);

  res.status(201).json(enrichTransaction(transaction, accounts));
});

app.put('/api/transactions/:id', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();
  const index = transactions.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Transaction not found.' });
  }

  const result = normalizeTransaction(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const accountExists = accounts.some((item) => item.id === result.accountId);
  if (!accountExists) {
    return res.status(400).json({ message: 'Selected account does not exist.' });
  }

  transactions[index] = {
    ...transactions[index],
    ...result,
    updatedAt: new Date().toISOString()
  };

  saveTransactions(transactions);
  res.json(enrichTransaction(transactions[index], accounts));
});

app.delete('/api/transactions/:id', (req, res) => {
  const transactions = readTransactions();
  const filtered = transactions.filter((item) => item.id !== req.params.id);

  if (filtered.length === transactions.length) {
    return res.status(404).json({ message: 'Transaction not found.' });
  }

  saveTransactions(filtered);
  res.json({ message: 'Transaction deleted successfully.' });
});

app.delete('/api/transactions', (req, res) => {
  const accountId = req.query.accountId;
  const transactions = readTransactions();

  if (!accountId) {
    saveTransactions([]);
    return res.json({ message: 'All transactions cleared successfully.' });
  }

  const filtered = transactions.filter((item) => item.accountId !== accountId);
  saveTransactions(filtered);
  res.json({ message: 'Account transactions cleared successfully.' });
});

app.get('/api/export/xlsx', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();
  const filtered = getFilteredTransactions(transactions, req.query);
  const enriched = filtered.map((item) => enrichTransaction(item, accounts));

  const rows = enriched.map((item, index) => ({
    'S. No.': index + 1,
    Account: item.accountName,
    Date: item.date,
    Description: item.description,
    Type: item.type,
    Amount: item.amount,
    'Balance Impact': item.balanceImpact,
    'Created At': item.createdAt || '',
    'Updated At': item.updatedAt || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ Note: 'No transactions available for current filter' }]
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });

  const fileName = `transaction-app-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.send(buffer);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});