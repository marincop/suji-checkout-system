const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

let resolveDbReady;
const dbReady = new Promise((resolve) => {
  resolveDbReady = resolve;
});

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Create transactions table
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        table_number INTEGER,
        waiter_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        is_deleted INTEGER DEFAULT 0,
        status TEXT DEFAULT 'synced',
        plates TEXT, -- JSON string
        total_plates INTEGER,
        total_amount INTEGER
      )
    `);

    // Create locks table
    db.run(`
      CREATE TABLE IF NOT EXISTS locks (
        table_number INTEGER PRIMARY KEY,
        waiter_id TEXT,
        locked_at INTEGER
      )
    `);

    // Create waiters table
    db.run(`
      CREATE TABLE IF NOT EXISTS waiters (
        name TEXT PRIMARY KEY
      )
    `, () => {
      // Seed default waiters
      const defaultWaiters = ['小林', '阿明', '小美', '雅婷'];
      db.get('SELECT COUNT(*) as count FROM waiters', (err, row) => {
        if (err) {
          console.error('Error checking waiters count:', err.message);
          return;
        }
        if (row && row.count === 0) {
          const stmt = db.prepare('INSERT INTO waiters (name) VALUES (?)');
          defaultWaiters.forEach(waiter => {
            stmt.run(waiter);
          });
          stmt.finalize((err) => {
            if (err) console.error('Error seeding waiters:', err.message);
            else console.log('Default waiters seeded successfully.');
          });
        }
      });
    });

    // Create admins table
    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT,
        role TEXT DEFAULT 'admin'
      )
    `, () => {
      // Seed default admin: store_manager / admin123
      const username = 'store_manager';
      db.get('SELECT * FROM admins WHERE username = ?', [username], (err, row) => {
        if (err) {
          console.error('Error checking admin user:', err.message);
          resolveDbReady();
          return;
        }
        if (!row) {
          const salt = bcrypt.genSaltSync(10);
          const hash = bcrypt.hashSync('admin123', salt);
          db.run(
            'INSERT INTO admins (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
            ['admin_01', username, hash, 'admin'],
            (err) => {
              if (err) {
                console.error('Error seeding admin user:', err.message);
              } else {
                console.log('Default admin seeded successfully (store_manager / admin123).');
              }
              resolveDbReady();
            }
          );
        } else {
          resolveDbReady();
        }
      });
    });
  });
}

// Wrap db run/get/all in Promises for modern async/await
const dbQuery = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

module.exports = { db, dbQuery, dbReady };
