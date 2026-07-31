import Dexie from 'dexie';

export const db = new Dexie('SushiOfflineDatabase');

// Define database schema
// Note: We index fields we need to query by or sort by.
db.version(1).stores({
  transactions: 'id, table_number, waiter_id, created_at, updated_at, is_deleted, status, total_amount',
  config: 'key, value' // utility store for local settings
});

// Helper functions for transaction management
export const localDb = {
  async saveTransaction(transaction) {
    await db.transactions.put(transaction);
  },

  async getTransaction(id) {
    return await db.transactions.get(id);
  },

  async getPendingTransactions() {
    return await db.transactions.where('status').equals('pending_sync').toArray();
  },

  async getAllTransactions() {
    // Return sorted by date descending, excluding soft deleted
    const all = await db.transactions.toArray();
    return all
      .filter(tx => !tx.is_deleted)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async markAsSynced(ids) {
    await db.transaction('rw', db.transactions, async () => {
      for (const id of ids) {
        await db.transactions.update(id, { status: 'synced' });
      }
    });
  },

  async softDeleteTransaction(id) {
    const tx = await db.transactions.get(id);
    if (tx) {
      tx.is_deleted = true;
      tx.status = 'pending_sync';
      tx.updated_at = new Date().toISOString();
      await db.transactions.put(tx);
    }
  },

  async updateTransaction(id, updatedFields) {
    const tx = await db.transactions.get(id);
    if (tx) {
      const merged = {
        ...tx,
        ...updatedFields,
        status: 'pending_sync',
        updated_at: new Date().toISOString()
      };
      await db.transactions.put(merged);
    }
  }
};
