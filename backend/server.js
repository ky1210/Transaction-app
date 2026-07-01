const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 5000;
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'transactions.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
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

function readTransactions() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function saveTransactions(transactions) {
  fs.writeFileSync(dataFile, JSON.stringify(transactions, null, 2));
}

function getMonthName(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { month: 'long' });
}

function normalizeTransaction(body) {
  const date = (body.date || '').trim();
  const description = (body.description || '').trim();
  const debit = Number(body.debit || 0);
  const credit = Number(body.credit || 0);

  if (!date || !description) {
    return { error: 'Date and description are required.' };
  }

  if (Number.isNaN(debit) || Number.isNaN(credit)) {
    return { error: 'Debit and credit must be valid numbers.' };
  }

  if (debit < 0 || credit < 0) {
    return { error: 'Debit and credit cannot be negative.' };
  }

  if (debit === 0 && credit === 0) {
    return { error: 'Enter either debit or credit amount.' };
  }

  return {
    date,
    month: getMonthName(date),
    description,
    debit,
    credit,
    balanceImpact: credit - debit
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/transactions', (req, res) => {
  const transactions = readTransactions().sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(transactions);
});

app.post('/api/transactions', (req, res) => {
  const result = normalizeTransaction(req.body);
  if (result.error) {
    return res.status(400).json({ message: result.error });
  }

  const transactions = readTransactions();
  const transaction = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...result
  };

  transactions.push(transaction);
  saveTransactions(transactions);
  res.status(201).json(transaction);
});

app.put('/api/transactions/:id', (req, res) => {
  const transactions = readTransactions();
  const index = transactions.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: 'Transaction not found.' });
  }

  const result = normalizeTransaction(req.body);
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

app.get('/api/export/xlsx', (req, res) => {
  const transactions = readTransactions();

  const rows = transactions.map((item, index) => ({
    'S. No.': index + 1,
    Date: item.date,
    Month: item.month,
    Description: item.description,
    Debit: item.debit,
    Credit: item.credit,
    'Balance Impact': item.balanceImpact,
    'Created At': item.createdAt || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No transactions available' }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });

  const fileName = `transactions-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
app.delete('/api/transactions', (req, res) => {
  try {
    const transactions = readTransactions();

    if (!transactions.length) {
      return res.json({ message: 'No transactions to clear.' });
    }

    saveTransactions([]);
    res.json({ message: 'All transactions cleared successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to clear transactions.' });
  }
});