const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { dbQuery, dbReady } = require('./db');
const { authenticateToken, JWT_SECRET } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Helper to clean up expired locks (older than 5 minutes)
async function cleanExpiredLocks() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  await dbQuery.run('DELETE FROM locks WHERE locked_at < ?', [fiveMinutesAgo]);
}

// 1. Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const admin = await dbQuery.get('SELECT * FROM admins WHERE username = ?', [username]);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, username: admin.username, role: admin.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Waiters API (Public GET, Protected POST/DELETE)
app.get('/api/waiters', async (req, res) => {
  try {
    const rows = await dbQuery.all('SELECT name FROM waiters ORDER BY name ASC');
    res.json(rows.map(r => r.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch waiters' });
  }
});

app.post('/api/waiters', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Waiter name is required' });
  }
  try {
    await dbQuery.run('INSERT INTO waiters (name) VALUES (?)', [name.trim()]);
    res.json({ message: 'Waiter added successfully', name: name.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Waiter name already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to add waiter' });
  }
});

app.delete('/api/waiters/:name', authenticateToken, async (req, res) => {
  const { name } = req.params;
  try {
    await dbQuery.run('DELETE FROM waiters WHERE name = ?', [name]);
    res.json({ message: 'Waiter deleted successfully', name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete waiter' });
  }
});

// 2. Get Tables State & Locks
app.get('/api/tables', async (req, res) => {
  try {
    await cleanExpiredLocks();
    const locks = await dbQuery.all('SELECT * FROM locks');
    
    // Build table status for tables 1-12
    const tables = [];
    for (let i = 1; i <= 12; i++) {
      const lock = locks.find(l => l.table_number === i);
      tables.push({
        table_number: i,
        is_locked: !!lock,
        locked_by: lock ? lock.waiter_id : null,
        locked_at: lock ? lock.locked_at : null
      });
    }
    res.json(tables);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Lock Table
app.post('/api/tables/:table_number/lock', async (req, res) => {
  const tableNumber = parseInt(req.params.table_number);
  const { waiter_id } = req.body;

  if (!tableNumber || tableNumber < 1 || tableNumber > 12) {
    return res.status(400).json({ error: 'Invalid table number' });
  }
  if (!waiter_id) {
    return res.status(400).json({ error: 'Waiter ID is required to lock table' });
  }

  try {
    await cleanExpiredLocks();
    const existingLock = await dbQuery.get('SELECT * FROM locks WHERE table_number = ?', [tableNumber]);

    if (existingLock) {
      if (existingLock.waiter_id !== waiter_id) {
        return res.status(409).json({
          error: `Table is currently being counted by waiter "${existingLock.waiter_id}"`
        });
      } else {
        // Renew lock
        await dbQuery.run('UPDATE locks SET locked_at = ? WHERE table_number = ?', [Date.now(), tableNumber]);
        return res.json({ message: 'Lock renewed successfully', table_number: tableNumber });
      }
    }

    // Acquire new lock
    await dbQuery.run(
      'INSERT INTO locks (table_number, waiter_id, locked_at) VALUES (?, ?, ?)',
      [tableNumber, waiter_id, Date.now()]
    );
    res.json({ message: 'Table locked successfully', table_number: tableNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to lock table' });
  }
});

// Release Table Lock
app.delete('/api/tables/:table_number/lock', async (req, res) => {
  const tableNumber = parseInt(req.params.table_number);
  const { waiter_id } = req.body; // optionally check waiter_id matching

  try {
    if (waiter_id) {
      await dbQuery.run('DELETE FROM locks WHERE table_number = ? AND waiter_id = ?', [tableNumber, waiter_id]);
    } else {
      await dbQuery.run('DELETE FROM locks WHERE table_number = ?', [tableNumber]);
    }
    res.json({ message: 'Table lock released successfully', table_number: tableNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to release lock' });
  }
});

// 3. Sync Transactions (bulk uploads from client IndexedDB)
app.post('/api/sync', async (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Transactions list must be an array' });
  }

  try {
    const syncedIds = [];
    for (const tx of transactions) {
      const {
        id,
        table_number,
        waiter_id,
        created_at,
        updated_at,
        is_deleted,
        plates,
        total_plates,
        total_amount
      } = tx;

      const platesStr = JSON.stringify(plates);
      const isDeletedInt = is_deleted ? 1 : 0;

      // Upsert transaction in SQLite
      const existing = await dbQuery.get('SELECT id FROM transactions WHERE id = ?', [id]);
      if (existing) {
        await dbQuery.run(`
          UPDATE transactions
          SET table_number = ?, waiter_id = ?, updated_at = ?, is_deleted = ?, plates = ?, total_plates = ?, total_amount = ?, status = 'synced'
          WHERE id = ?
        `, [table_number, waiter_id, updated_at, isDeletedInt, platesStr, total_plates, total_amount, id]);
      } else {
        await dbQuery.run(`
          INSERT INTO transactions (id, table_number, waiter_id, created_at, updated_at, is_deleted, plates, total_plates, total_amount, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        `, [id, table_number, waiter_id, created_at, updated_at || created_at, isDeletedInt, platesStr, total_plates, total_amount]);
      }
      
      // Auto release table lock when transaction is synced/submitted
      await dbQuery.run('DELETE FROM locks WHERE table_number = ? AND waiter_id = ?', [table_number, waiter_id]);
      
      syncedIds.push(id);
    }
    res.json({ message: 'Synchronization completed', synced_ids: syncedIds });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Database sync error' });
  }
});

// 4. Admin View: Get Transactions (filtered, paginated, or all)
app.get('/api/admin/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await dbQuery.all('SELECT * FROM transactions ORDER BY created_at DESC');
    // Format JSON fields back to object
    const formatted = transactions.map(tx => ({
      ...tx,
      is_deleted: !!tx.is_deleted,
      plates: JSON.parse(tx.plates)
    }));
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Admin View: Modify Transaction
app.put('/api/admin/transactions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { table_number, plates, total_plates, total_amount } = req.body;

  try {
    const existing = await dbQuery.get('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const updatedTime = new Date().toISOString();
    const platesStr = JSON.stringify(plates);

    await dbQuery.run(`
      UPDATE transactions
      SET table_number = ?, plates = ?, total_plates = ?, total_amount = ?, updated_at = ?
      WHERE id = ?
    `, [table_number, platesStr, total_plates, total_amount, updatedTime, id]);

    res.json({ message: 'Transaction updated successfully', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Admin View: Delete Transaction (Soft Delete)
app.delete('/api/admin/transactions/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await dbQuery.get('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const updatedTime = new Date().toISOString();
    await dbQuery.run(`
      UPDATE transactions
      SET is_deleted = 1, updated_at = ?
      WHERE id = ?
    `, [updatedTime, id]);

    res.json({ message: 'Transaction soft deleted successfully', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Admin Reports: Daily Report
// Path: GET /api/admin/reports/daily?date=2026-07-31
app.get('/api/admin/reports/daily', authenticateToken, async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD format
  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  try {
    // Select all transactions for the day, excluding soft-deleted
    // Compare prefix of ISO string created_at e.g. '2026-07-31T...' matches '2026-07-31'
    const sql = `
      SELECT * FROM transactions 
      WHERE is_deleted = 0 
      AND created_at LIKE ?
    `;
    const transactions = await dbQuery.all(sql, [`${date}%`]);

    let greenTotal = 0;
    let orangeTotal = 0;
    let redTotal = 0;
    let whiteTotal = 0;
    let blackTotal = 0;
    let blueTotal = 0;
    let totalRevenue = 0;
    let totalPlatesCount = 0;

    const formattedTxList = transactions.map(tx => {
      const plates = JSON.parse(tx.plates);
      greenTotal += plates.green || 0;
      orangeTotal += plates.orange || 0;
      redTotal += plates.red || 0;
      whiteTotal += plates.white || 0;
      blackTotal += plates.black || 0;
      blueTotal += plates.blue || 0;

      totalRevenue += tx.total_amount;
      totalPlatesCount += tx.total_plates;

      return {
        ...tx,
        is_deleted: false,
        plates
      };
    });

    res.json({
      date,
      summary: {
        plates: {
          green: greenTotal,
          orange: orangeTotal,
          red: redTotal,
          white: whiteTotal,
          black: blackTotal,
          blue: blueTotal
        },
        total_plates: totalPlatesCount,
        total_revenue: totalRevenue
      },
      transactions: formattedTxList
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

// Admin Reports: Monthly Report
// Path: GET /api/admin/reports/monthly?month=2026-07 (YYYY-MM format)
app.get('/api/admin/reports/monthly', authenticateToken, async (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (!month) {
    return res.status(400).json({ error: 'Month parameter is required' });
  }

  try {
    const sql = `
      SELECT * FROM transactions 
      WHERE is_deleted = 0 
      AND created_at LIKE ?
    `;
    const transactions = await dbQuery.all(sql, [`${month}%`]);

    let greenTotal = 0;
    let orangeTotal = 0;
    let redTotal = 0;
    let whiteTotal = 0;
    let blackTotal = 0;
    let blueTotal = 0;
    let totalRevenue = 0;
    let totalPlatesCount = 0;

    // Aggregate by day of the month
    // Key: YYYY-MM-DD, Value: total amount
    const dailyTrend = {};

    transactions.forEach(tx => {
      const day = tx.created_at.substring(0, 10);
      dailyTrend[day] = (dailyTrend[day] || 0) + tx.total_amount;

      const plates = JSON.parse(tx.plates);
      greenTotal += plates.green || 0;
      orangeTotal += plates.orange || 0;
      redTotal += plates.red || 0;
      whiteTotal += plates.white || 0;
      blackTotal += plates.black || 0;
      blueTotal += plates.blue || 0;

      totalRevenue += tx.total_amount;
      totalPlatesCount += tx.total_plates;
    });

    // Format daily trend for charting
    const trendData = Object.keys(dailyTrend).sort().map(day => ({
      date: day,
      revenue: dailyTrend[day]
    }));

    res.json({
      month,
      summary: {
        plates: {
          green: greenTotal,
          orange: orangeTotal,
          red: redTotal,
          white: whiteTotal,
          black: blackTotal,
          blue: blueTotal
        },
        total_plates: totalPlatesCount,
        total_revenue: totalRevenue
      },
      daily_trend: trendData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate monthly report' });
  }
});

dbReady.then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
});
