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
  fs.writeFileSync(
    accountsFile,
    JSON.stringify(
      [
        {
          id: 'acc-default',
          name: 'Cash',
          createdAt: new Date().toISOString()
        }
      ],
      null,
      2
    )
  );
}

if (!fs.existsSync(transactionsFile)) {
  fs.writeFileSync(transactionsFile, JSON.stringify([], null, 2));
}

app.use(
  cors({
    origin: [
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
  })
);

app.use(express.json());

function readJson(filePath, fallback = []) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readAccounts() {
  return readJson(accountsFile, []);
}

function saveAccounts(accounts) {
  writeJson(accountsFile, accounts);
}

function readTransactions() {
  return readJson(transactionsFile, []);
}

function saveTransactions(transactions) {
  writeJson(transactionsFile, transactions);
}

function normalizeAccount(body) {
  const name = String(body.name || '').trim();

  if (!name) {
    return { error: 'Account name is required.' };
  }

  if (name.length < 2) {
    return { error: 'Account name must be at least 2 characters.' };
  }

  return { name };
}

function normalizeTransaction(body, accounts) {
  const accountId = String(body.accountId || '').trim();
  const date = String(body.date || '').trim();
  const description = String(body.description || '').trim();
  const type = String(body.type || '').trim().toLowerCase();
  const amount = Number(body.amount);

  if (!accountId) {
    return { error: 'Account is required.' };
  }

  const account = accounts.find((item) => item.id === accountId);
  if (!account) {
    return { error: 'Selected account does not exist.' };
  }

  if (!date) {
    return { error: 'Date is required.' };
  }

  if (!description) {
    return { error: 'Description is required.' };
  }

  if (!['debit', 'credit'].includes(type)) {
    return { error: 'Transaction type must be debit or credit.' };
  }

  if (Number.isNaN(amount) || amount <= 0) {
    return { error: 'Amount must be greater than 0.' };
  }

  return {
    accountId,
    accountName: account.name,
    date,
    description,
    type,
    amount: Number(amount.toFixed(2)),
    debit: type === 'debit' ? Number(amount.toFixed(2)) : 0,
    credit: type === 'credit' ? Number(amount.toFixed(2)) : 0,
    balanceImpact: type === 'credit' ? Number(amount.toFixed(2)) : -Number(amount.toFixed(2))
  };
}

function sortTransactions(items) {
  return [...items].sort((a, b) => {
    const dateCompare = new Date(b.date) - new Date(a.date);
    if (dateCompare !== 0) return dateCompare;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function buildAccountSummary(accounts, transactions) {
  return accounts.map((account) => {
    const accountTransactions = transactions.filter((item) => item.accountId === account.id);
    const totalDebit = accountTransactions.reduce((sum, item) => sum + Number(item.debit || 0), 0);
    const totalCredit = accountTransactions.reduce((sum, item) => sum + Number(item.credit || 0), 0);

    return {
      ...account,
      totalDebit,
      totalCredit,
      balance: totalCredit - totalDebit,
      transactionCount: accountTransactions.length
    };
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* Accounts */

app.get('/api/accounts', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();
  const summary = buildAccountSummary(accounts, transactions);
  res.json(summary);
});

app.post('/api/accounts', (req, res) => {
  const accounts = readAccounts();
  const result = normalizeAccount(req.body);

  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const duplicate = accounts.find(
    (item) => item.name.toLowerCase() === result.name.toLowerCase()
  );

  if (duplicate) {
    return res.status(400).json({ message: 'Account with this name already exists.' });
  }

  const account = {
    id: `acc-${Date.now()}`,
    name: result.name,
    createdAt: new Date().toISOString()
  };

  accounts.push(account);
  saveAccounts(accounts);

  res.status(201).json(account);
});

app.put('/api/accounts/:id', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();
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
    return res.status(400).json({ message: 'Another account with this name already exists.' });
  }

  const oldName = accounts[index].name;
  accounts[index] = {
    ...accounts[index],
    name: result.name,
    updatedAt: new Date().toISOString()
  };

  const updatedTransactions = transactions.map((item) =>
    item.accountId === req.params.id
      ? { ...item, accountName: result.name }
      : item
  );

  saveAccounts(accounts);
  saveTransactions(updatedTransactions);

  res.json({
    message: `Account "${oldName}" updated successfully.`,
    account: accounts[index]
  });
});

app.delete('/api/accounts/:id', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();
  const index = accounts.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Account not found.' });
  }

  if (accounts.length === 1) {
    return res.status(400).json({ message: 'At least one account must remain.' });
  }

  const hasTransactions = transactions.some((item) => item.accountId === req.params.id);
  if (hasTransactions) {
    return res.status(400).json({
      message: 'This account has transactions. Delete or move them first.'
    });
  }

  const removed = accounts[index];
  const filtered = accounts.filter((item) => item.id !== req.params.id);
  saveAccounts(filtered);

  res.json({ message: `Account "${removed.name}" deleted successfully.` });
});

/* Transactions */

app.get('/api/transactions', (req, res) => {
  const transactions = readTransactions();
  const { accountId, type, search, from, to } = req.query;

  let filtered = [...transactions];

  if (accountId && accountId !== 'all') {
    filtered = filtered.filter((item) => item.accountId === accountId);
  }

  if (type && type !== 'all') {
    filtered = filtered.filter((item) => item.type === type);
  }

  if (search) {
    const term = String(search).trim().toLowerCase();
    filtered = filtered.filter((item) =>
      String(item.description || '').toLowerCase().includes(term)
    );
  }

  if (from) {
    filtered = filtered.filter((item) => item.date >= from);
  }

  if (to) {
    filtered = filtered.filter((item) => item.date <= to);
  }

  res.json(sortTransactions(filtered));
});

app.post('/api/transactions', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();

  const result = normalizeTransaction(req.body, accounts);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const transaction = {
    id: `txn-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...result
  };

  transactions.push(transaction);
  saveTransactions(transactions);

  res.status(201).json(transaction);
});

app.put('/api/transactions/:id', (req, res) => {
  const accounts = readAccounts();
  const transactions = readTransactions();
  const index = transactions.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Transaction not found.' });
  }

  const result = normalizeTransaction(req.body, accounts);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  transactions[index] = {
    ...transactions[index],
    ...result,
    updatedAt: new Date().toISOString()
  };

  saveTransactions(transactions);
  res.json(transactions[index]);
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
  const { accountId } = req.query;
  const transactions = readTransactions();

  if (!transactions.length) {
    return res.json({ message: 'No transactions to clear.' });
  }

  if (accountId && accountId !== 'all') {
    const remaining = transactions.filter((item) => item.accountId !== accountId);
    const removedCount = transactions.length - remaining.length;

    if (!removedCount) {
      return res.json({ message: 'No transactions found for this account.' });
    }

    saveTransactions(remaining);
    return res.json({ message: `Cleared ${removedCount} transaction(s) from this account.` });
  }

  saveTransactions([]);
  res.json({ message: 'All transactions cleared successfully.' });
});

/* Export */

app.get('/api/export/xlsx', (req, res) => {
  const transactions = readTransactions();
  const { accountId, type, search, from, to } = req.query;

  let filtered = [...transactions];

  if (accountId && accountId !== 'all') {
    filtered = filtered.filter((item) => item.accountId === accountId);
  }

  if (type && type !== 'all') {
    filtered = filtered.filter((item) => item.type === type);
  }

  if (search) {
    const term = String(search).trim().toLowerCase();
    filtered = filtered.filter((item) =>
      String(item.description || '').toLowerCase().includes(term)
    );
  }

  if (from) {
    filtered = filtered.filter((item) => item.date >= from);
  }

  if (to) {
    filtered = filtered.filter((item) => item.date <= to);
  }

  const rows = sortTransactions(filtered).map((item, index) => ({
    'S. No.': index + 1,
    Date: item.date,
    Account: item.accountName,
    Description: item.description,
    Type: item.type,
    Amount: item.amount,
    Debit: item.debit,
    Credit: item.credit,
    Balance: item.balanceImpact,
    'Created At': item.createdAt || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ Note: 'No transactions available' }]
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });

  const fileName = `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`;
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