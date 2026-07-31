import { localDb } from '../db';

const API_BASE = window.location.origin.includes('localhost:5173')
  ? 'http://localhost:5001/api'
  : '/api';

// Get token from localStorage
export function getAdminToken() {
  return localStorage.getItem('sushi_admin_token');
}

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem('sushi_admin_token', token);
  } else {
    localStorage.removeItem('sushi_admin_token');
  }
}

export const api = {
  // Check online status
  isOnline() {
    return navigator.onLine;
  },

  // Lock Table
  async lockTable(tableNumber, waiterId) {
    if (!this.isOnline()) return { success: true, offline: true }; // Allow offline work
    try {
      const res = await fetch(`${API_BASE}/tables/${tableNumber}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_id: waiterId })
      });
      if (res.status === 409) {
        const data = await res.json();
        return { success: false, error: data.error };
      }
      if (!res.ok) throw new Error('Lock failed');
      return { success: true };
    } catch (err) {
      console.warn('Offline or server error locking table, fallback to offline local mode:', err);
      return { success: true, offline: true };
    }
  },

  // Unlock Table
  async unlockTable(tableNumber, waiterId) {
    if (!this.isOnline()) return;
    try {
      await fetch(`${API_BASE}/tables/${tableNumber}/lock`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_id: waiterId })
      });
    } catch (err) {
      console.warn('Unlock API error:', err);
    }
  },

  // Fetch Tables Lock status
  async getTables() {
    if (!this.isOnline()) {
      return Array.from({ length: 12 }, (_, i) => ({
        table_number: i + 1,
        is_locked: false,
        locked_by: null
      }));
    }
    try {
      const res = await fetch(`${API_BASE}/tables`);
      if (!res.ok) throw new Error('Fetch tables failed');
      return await res.json();
    } catch (err) {
      console.warn('Failed to fetch online tables, using offline state:', err);
      return Array.from({ length: 12 }, (_, i) => ({
        table_number: i + 1,
        is_locked: false,
        locked_by: null
      }));
    }
  },

  // Trigger sync of pending transactions
  async syncPendingTransactions() {
    if (!this.isOnline()) return { success: false, reason: 'Offline' };

    try {
      const pending = await localDb.getPendingTransactions();
      if (pending.length === 0) return { success: true, count: 0 };

      const res = await fetch(`${API_BASE}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: pending })
      });

      if (!res.ok) throw new Error('Sync request failed');

      const data = await res.json();
      await localDb.markAsSynced(data.synced_ids);
      return { success: true, count: data.synced_ids.length };
    } catch (err) {
      console.error('Synchronization failed:', err);
      return { success: false, reason: err.message };
    }
  },

  // Admin Login
  async adminLogin(username, password) {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    setAdminToken(data.token);
    return data;
  },

  // Admin get daily report
  async getDailyReport(date) {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/admin/reports/daily?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) setAdminToken(null);
      throw new Error('Unauthorized or failed daily report');
    }
    return await res.json();
  },

  // Admin get monthly report
  async getMonthlyReport(month) {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/admin/reports/monthly?month=${month}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) setAdminToken(null);
      throw new Error('Unauthorized or failed monthly report');
    }
    return await res.json();
  },

  // Admin Edit Transaction
  async editTransaction(id, updatedFields) {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/admin/transactions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updatedFields)
    });
    if (!res.ok) throw new Error('Failed to update transaction');
    return await res.json();
  },

  // Admin Delete Transaction (Soft delete)
  async deleteTransaction(id) {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/admin/transactions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to delete transaction');
    return await res.json();
  },

  // Waiters Management
  async getWaiters() {
    try {
      const res = await fetch(`${API_BASE}/waiters`);
      if (!res.ok) throw new Error('Failed to fetch waiters');
      return await res.json();
    } catch (err) {
      console.warn('Offline or failed to fetch waiters, using local default list:', err);
      return ['小林', '阿明', '小美', '雅婷']; // Fallback
    }
  },

  async addWaiter(name) {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/waiters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add waiter');
    }
    return await res.json();
  },

  async deleteWaiter(name) {
    const token = getAdminToken();
    const res = await fetch(`${API_BASE}/waiters/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error('Failed to delete waiter');
    return await res.json();
  }
};
