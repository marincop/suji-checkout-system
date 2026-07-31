import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { localDb } from '../db';
import { User, RefreshCw, AlertTriangle, Edit3, Trash2, X, Check } from 'lucide-react';

const PLATE_CONFIGS = [
  { key: 'green', name: '綠盤 Green', price: 50, color: '#4CAF50' },
  { key: 'orange', name: '橘盤 Orange', price: 70, color: '#FF9800' },
  { key: 'red', name: '紅盤 Red', price: 90, color: '#F44336' },
  { key: 'white', name: '白盤 White', price: 110, color: '#FFFFFF' },
  { key: 'black', name: '黑盤 Black', price: 130, color: '#212121' },
  { key: 'blue', name: '藍盤 Blue', price: 150, color: '#2196F3' }
];

export default function TableSelector({ activeWaiter, setActiveWaiter, onTableSelect }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [waiterList, setWaiterList] = useState([]);
  const [pendingTables, setPendingTables] = useState([]); // Tables with local unsynced transactions
  const [dailyTransactions, setDailyTransactions] = useState([]);

  // Edit transaction states (for waiter checkout modification)
  const [editingTx, setEditingTx] = useState(null);
  const [editTable, setEditTable] = useState(1);
  const [editPlates, setEditPlates] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  const fetchTablesAndLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch backend lock status
      const data = await api.getTables();
      setTables(data);

      // 2. Fetch local pending sync tables
      const pendingTx = await localDb.getPendingTransactions();
      const pendingNums = pendingTx.map(t => t.table_number);
      setPendingTables([...new Set(pendingNums)]);

      // 3. Fetch all local transactions for logs list
      const txLogs = await localDb.getAllTransactions();
      setDailyTransactions(txLogs);

      // 4. Fetch waiter list from database
      const list = await api.getWaiters();
      setWaiterList(list);
    } catch (err) {
      setError('載入資料失敗，切換至離線預設狀態');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTablesAndLogs();
    const interval = setInterval(fetchTablesAndLogs, 5000); // Poll lock states & logs
    return () => clearInterval(interval);
  }, []);

  const handleSelectTable = async (tableNum) => {
    if (!activeWaiter) {
      alert('請先選擇服務生姓名！');
      return;
    }

    setLoading(true);
    const lockRes = await api.lockTable(tableNum, activeWaiter);
    setLoading(false);

    if (lockRes.success) {
      onTableSelect(tableNum);
    } else {
      alert(lockRes.error || '該桌號目前正被其他服務生鎖定。');
      fetchTablesAndLogs();
    }
  };

  // Waiter Edit Transaction
  const openEditModal = (tx) => {
    setEditingTx(tx);
    setEditTable(tx.table_number);
    setEditPlates({ ...tx.plates });
  };

  const closeEditModal = () => {
    setEditingTx(null);
    setEditPlates({});
  };

  const handleEditPlateChange = (key, val) => {
    const num = Math.max(0, parseInt(val) || 0);
    setEditPlates(prev => ({ ...prev, [key]: num }));
  };

  const saveEdit = async () => {
    setEditLoading(true);
    const totalPlates = Object.values(editPlates).reduce((a, b) => a + b, 0);
    const totalAmount = PLATE_CONFIGS.reduce((sum, item) => sum + ((editPlates[item.key] || 0) * item.price), 0);

    try {
      // 1. Update IndexedDB locally (offline-first)
      await localDb.updateTransaction(editingTx.id, {
        table_number: editTable,
        plates: editPlates,
        total_plates: totalPlates,
        total_amount: totalAmount
      });

      // 2. Sync instantly if online
      if (api.isOnline()) {
        await api.syncPendingTransactions();
      }

      alert('交易紀錄已成功修改！');
      closeEditModal();
      fetchTablesAndLogs();
    } catch (err) {
      alert('修改失敗：' + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Waiter Delete Transaction
  const handleDeleteTx = async (id) => {
    if (!window.confirm('確定要「廢除/刪除」此筆結算紀錄嗎？此操作免密碼，並會自動同步扣除報表金額。')) return;
    try {
      // 1. Soft delete locally
      await localDb.softDeleteTransaction(id);

      // 2. Sync instantly if online
      if (api.isOnline()) {
        await api.syncPendingTransactions();
      }

      alert('已成功廢除該交易紀錄。');
      fetchTablesAndLogs();
    } catch (err) {
      alert('刪除失敗：' + err.message);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto p-4 animate-fade-in">
      {/* Waiter Selection Form */}
      <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <User className="text-yellow-400" />
          服務生登記 (免密碼)
        </h2>
        
        <div>
          <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
            選擇您的名字 (Select Waiter Name)
          </label>
          <select
            value={activeWaiter}
            onChange={(e) => setActiveWaiter(e.target.value)}
            className="w-full bg-[#1e3e27] border border-white/20 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all font-bold text-base"
          >
            <option value="">-- 請選擇您的名字 --</option>
            {waiterList.map((waiter) => (
              <option key={waiter} value={waiter}>
                {waiter}
              </option>
            ))}
          </select>
        </div>

        {activeWaiter && (
          <div className="text-sm text-emerald-300 font-semibold bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20">
            目前操作人員：<span className="text-yellow-300 text-base">{activeWaiter}</span>
          </div>
        )}
      </div>

      {/* Tables Selection Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            選擇點算桌號
          </h2>
          <button
            onClick={fetchTablesAndLogs}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            重新整理
          </button>
        </div>

        {error && (
          <div className="bg-amber-950/30 border border-amber-500/30 text-amber-200 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, i) => {
            const tableNum = i + 1;
            const tableStatus = tables.find((t) => t.table_number === tableNum);
            const isLocked = tableStatus?.is_locked;
            const isLockedBySelf = isLocked && tableStatus?.locked_by === activeWaiter;
            const isLockedByOther = isLocked && !isLockedBySelf;
            const hasPending = pendingTables.includes(tableNum);

            let borderStyle = 'border-white/15 hover:border-emerald-400';
            let bgStyle = 'bg-white/5 hover:bg-white/10';
            let badgeText = '';

            if (isLockedByOther) {
              borderStyle = 'border-rose-500/40 opacity-70 cursor-not-allowed';
              bgStyle = 'bg-rose-950/20';
              badgeText = `${tableStatus.locked_by} 點算中`;
            } else if (isLockedBySelf) {
              borderStyle = 'border-yellow-400/80 animate-pulse';
              bgStyle = 'bg-yellow-950/30';
              badgeText = '已鎖定此桌';
            } else if (hasPending) {
              borderStyle = 'border-amber-400/50';
              bgStyle = 'bg-amber-950/10';
              badgeText = '待同步紀錄';
            }

            return (
              <button
                key={tableNum}
                onClick={() => !isLockedByOther && handleSelectTable(tableNum)}
                disabled={isLockedByOther}
                className={`relative h-28 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 shadow-lg ${borderStyle} ${bgStyle} active:scale-95`}
              >
                {hasPending && (
                  <span className="absolute top-2 right-2 text-amber-400 animate-bounce" title="此桌有離線暫存交易">
                    <AlertTriangle size={16} />
                  </span>
                )}

                <span className="text-3xl font-extrabold tracking-tight">
                  {tableNum}
                </span>
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">
                  桌號 Table
                </span>

                {badgeText && (
                  <span className={`text-[10px] mt-1 px-1.5 py-0.5 rounded-md font-semibold ${
                    isLockedByOther ? 'bg-rose-500/20 text-rose-300' :
                    isLockedBySelf ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-amber-500/20 text-amber-300'
                  }`}>
                    {badgeText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Waiter & Manager Shared logs: 當日結算紀錄 */}
      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-bold">當日個人結算紀錄 (Daily My Logs)</h2>
        
        {!activeWaiter ? (
          <div className="glass-card p-6 text-center rounded-2xl text-white/50 text-sm border border-white/5 bg-black/10">
            請於上方選擇您的名字以查看當日個人結算紀錄。
          </div>
        ) : dailyTransactions.filter(tx => tx.waiter_id === activeWaiter).length === 0 ? (
          <div className="glass-card p-8 text-center rounded-2xl text-white/40 text-sm">
            目前無您點算的結算紀錄。
          </div>
        ) : (
          <div className="space-y-3">
            {dailyTransactions
              .filter(tx => tx.waiter_id === activeWaiter)
              .map((tx) => (
                <div
                  key={tx.id}
                  className="glass-card p-4 rounded-xl border border-white/10 flex items-center justify-between shadow-md"
                >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-yellow-300">桌號 #{tx.table_number}</span>
                    <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-md text-white/80">
                      服務生: {tx.waiter_id}
                    </span>
                    {tx.status === 'pending_sync' && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-semibold animate-pulse flex items-center gap-0.5">
                        <AlertTriangle size={10} />
                        待同步
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/60 mt-1">
                    時間: {new Date(tx.created_at).toLocaleTimeString('zh-TW')} | 總盤數: {tx.total_plates} 盤
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-lg font-extrabold text-emerald-300">${tx.total_amount} TWD</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEditModal(tx)}
                      className="p-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-white transition-all active:scale-95"
                      title="修改紀錄"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTx(tx.id)}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 rounded-xl transition-all active:scale-95"
                      title="刪除紀錄"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- EDIT MODAL (Free Access for waiters & manager adjustments) --- */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card w-full max-w-md rounded-3xl border border-white/15 p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold">修改結算交易資料</h3>
              <button onClick={closeEditModal} className="p-1 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase">修改桌號</label>
                <select
                  value={editTable}
                  onChange={(e) => setEditTable(parseInt(e.target.value))}
                  className="w-full bg-[#1e3e27] border border-white/20 rounded-xl px-4 py-2.5 text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>桌號 #{i + 1}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-white/60 uppercase">盤子數量調整</label>
                <div className="grid grid-cols-2 gap-3">
                  {PLATE_CONFIGS.map(plate => (
                    <div key={plate.key} className="bg-black/20 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <span style={{ backgroundColor: plate.color }} className="w-2.5 h-2.5 rounded-full border border-white/10"></span>
                        {plate.name.split(' ')[0]}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={editPlates[plate.key] ?? 0}
                        onChange={(e) => handleEditPlateChange(plate.key, e.target.value)}
                        className="w-12 text-center bg-black/30 border border-white/10 rounded-md font-bold text-sm py-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button
                onClick={closeEditModal}
                className="flex-1 py-3 bg-white/10 hover:bg-white/15 rounded-xl font-bold text-sm transition-all"
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                disabled={editLoading}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 shadow-md"
              >
                {editLoading ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                儲存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
