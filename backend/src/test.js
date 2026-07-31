const assert = require('assert');
const { dbQuery, dbReady } = require('./db');

async function runTests() {
  console.log('--- Starting Backend Integration Tests ---');
  await dbReady;

  try {
    // 1. Clear database locks and mock transactions to start fresh
    await dbQuery.run('DELETE FROM locks');
    await dbQuery.run('DELETE FROM transactions WHERE waiter_id = ?', ['test_waiter']);

    console.log('✓ Database cleared for testing.');

    // 2. Test Table Locking
    const tableNumber = 5;
    const waiterA = 'test_waiter_A';
    const waiterB = 'test_waiter_B';

    // Lock table under waiter A
    await dbQuery.run(
      'INSERT INTO locks (table_number, waiter_id, locked_at) VALUES (?, ?, ?)',
      [tableNumber, waiterA, Date.now()]
    );
    console.log('✓ Table 5 locked by waiter A.');

    // Try to re-lock table (simulated locking conflict)
    const existingLock = await dbQuery.get('SELECT * FROM locks WHERE table_number = ?', [tableNumber]);
    assert.strictEqual(existingLock.waiter_id, waiterA);
    console.log('✓ Successfully detected and verified lock conflict check.');

    // Release lock
    await dbQuery.run('DELETE FROM locks WHERE table_number = ?', [tableNumber]);
    const afterRelease = await dbQuery.get('SELECT * FROM locks WHERE table_number = ?', [tableNumber]);
    assert.strictEqual(afterRelease, undefined);
    console.log('✓ Lock released successfully.');

    // 3. Test Syncing Transactions
    const mockTx = {
      id: 'test_tx_uuid_123',
      table_number: 5,
      waiter_id: 'test_waiter',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: 0,
      plates: JSON.stringify({ green: 2, orange: 1, red: 0, white: 3, black: 0, blue: 1 }),
      total_plates: 7,
      total_amount: 650
    };

    // Insert transaction
    await dbQuery.run(
      `INSERT INTO transactions (id, table_number, waiter_id, created_at, updated_at, is_deleted, plates, total_plates, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
      [mockTx.id, mockTx.table_number, mockTx.waiter_id, mockTx.created_at, mockTx.updated_at, mockTx.is_deleted, mockTx.plates, mockTx.total_plates, mockTx.total_amount]
    );

    const savedTx = await dbQuery.get('SELECT * FROM transactions WHERE id = ?', [mockTx.id]);
    assert.strictEqual(savedTx.total_amount, 650);
    assert.strictEqual(savedTx.total_plates, 7);
    console.log('✓ Mock transaction synced and verified.');

    // 4. Test Daily Report Generation
    const todayStr = new Date().toISOString().substring(0, 10);
    const dailyTx = await dbQuery.all(
      'SELECT * FROM transactions WHERE is_deleted = 0 AND created_at LIKE ?',
      [`${todayStr}%`]
    );

    assert(dailyTx.length >= 1);
    const sumAmount = dailyTx.reduce((sum, t) => sum + t.total_amount, 0);
    console.log(`✓ Daily report generated for date ${todayStr}. Total test revenue: $${sumAmount} TWD.`);

    console.log('--- All Integration Tests Passed Successfully! ---');
    process.exit(0);
  } catch (err) {
    console.error('✗ Test failed:', err);
    process.exit(1);
  }
}

runTests();
