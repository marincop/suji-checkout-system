import React, { useState, useEffect } from 'react';
import { localDb } from '../db';
import { api } from '../utils/api';
import { ArrowLeft, Trash2, Check, RefreshCw } from 'lucide-react';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const PLATE_CONFIGS = [
  { key: 'green', name: '綠盤 Green', price: 50, color: '#4CAF50', textLight: true },
  { key: 'orange', name: '橘盤 Orange', price: 70, color: '#FF9800', textLight: true },
  { key: 'red', name: '紅盤 Red', price: 90, color: '#F44336', textLight: true },
  { key: 'white', name: '白盤 White', price: 110, color: '#FFFFFF', textLight: false },
  { key: 'black', name: '黑盤 Black', price: 130, color: '#212121', textLight: true },
  { key: 'blue', name: '藍盤 Blue', price: 150, color: '#2196F3', textLight: true }
];

export default function PlateCounter({ tableNumber, waiterId, onBack }) {
  const [plates, setPlates] = useState({
    green: 0,
    orange: 0,
    red: 0,
    white: 0,
    black: 0,
    blue: 0
  });

  const [loading, setLoading] = useState(false);

  // Renew table lock periodically while waiter is actively counting
  useEffect(() => {
    if (!api.isOnline()) return;
    const renewLock = () => api.lockTable(tableNumber, waiterId);
    const interval = setInterval(renewLock, 30 * 1000); // Renew every 30 seconds
    return () => clearInterval(interval);
  }, [tableNumber, waiterId]);

  const handleIncrement = (key) => {
    setPlates(prev => ({
      ...prev,
      [key]: prev[key] + 1
    }));
  };

  const handleDecrement = (key) => {
    setPlates(prev => ({
      ...prev,
      [key]: Math.max(0, prev[key] - 1)
    }));
  };

  const handleInputChange = (key, val) => {
    const num = parseInt(val) || 0;
    setPlates(prev => ({
      ...prev,
      [key]: Math.max(0, num)
    }));
  };

  const handleClear = () => {
    if (window.confirm('確定要清空所有盤數嗎？')) {
      setPlates({
        green: 0,
        orange: 0,
        red: 0,
        white: 0,
        black: 0,
        blue: 0
      });
    }
  };

  // Calculate totals
  const totalPlates = Object.values(plates).reduce((a, b) => a + b, 0);
  const totalAmount = PLATE_CONFIGS.reduce((sum, item) => sum + (plates[item.key] * item.price), 0);

  const handleCheckout = async () => {
    if (totalPlates === 0) {
      alert('請先輸入盤子數量後再點選確認結算！');
      return;
    }

    setLoading(true);

    try {
      const transactionId = generateUUID();
      const newTx = {
        id: transactionId,
        table_number: tableNumber,
        waiter_id: waiterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
        status: 'pending_sync',
        plates,
        total_plates: totalPlates,
        total_amount: totalAmount
      };
      // 1. Save to local IndexedDB (Offline-First)
      await localDb.saveTransaction(newTx);

      // 2. Attempt online synchronization
      if (api.isOnline()) {
        const syncRes = await api.syncPendingTransactions();
        if (syncRes.success) {
          console.log('Transaction synced online instantly.');
        } else {
          console.log('Transaction saved locally, waiting for online sync.');
        }
      }

      // 3. Inform waiter and return
      alert(`桌號 ${tableNumber} 結算完成！\n總盤數: ${totalPlates} 盤\n總金額: $${totalAmount} TWD`);
      onBack();
    } catch (err) {
      console.error(err);
      alert('儲存結算資料失敗。');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (window.confirm('確定要放棄本次點算並解鎖桌號嗎？')) {
      setLoading(true);
      await api.unlockTable(tableNumber, waiterId);
      setLoading(false);
      onBack();
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 animate-fade-in pb-32">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5 shadow-md">
        <button
          onClick={handleCancel}
          className="flex items-center gap-1 bg-white/10 hover:bg-white/15 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <div className="text-center">
          <span className="block text-xl font-bold">桌號 {tableNumber}</span>
          <span className="text-[10px] text-yellow-300 font-bold uppercase tracking-wider">
            服務生: {waiterId}
          </span>
        </div>
        <button
          onClick={handleClear}
          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl transition-all"
          title="清空重置"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Plates List grid */}
      <div className="space-y-4">
        {PLATE_CONFIGS.map((item) => {
          const currentCount = plates[item.key] || 0;
          return (
            <div
              key={item.key}
              className="glass-card p-4 rounded-2xl flex items-center justify-between border border-white/10 shadow-lg relative overflow-hidden"
            >
              {/* Left Side: Interactive Circle Plate */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleIncrement(item.key)}
                  style={{
                    backgroundColor: item.color,
                    boxShadow: item.key === 'white' ? 'inset 0 -4px 8px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.15)' : 'inset 0 -4px 8px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.25)',
                    color: item.textLight ? '#FFFFFF' : '#1e3e27'
                  }}
                  className="w-16 h-16 rounded-full plate-bounce flex flex-col items-center justify-center font-extrabold shadow-inner shrink-0 relative transition-transform"
                >
                  {/* Internal price indicator */}
                  <span className="text-xs font-semibold leading-none">${item.price}</span>
                  {/* Decorative concentric inner circle */}
                  <div
                    style={{ borderColor: item.textLight ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }}
                    className="absolute inset-2.5 rounded-full border border-dashed"
                  ></div>
                </button>

                <div>
                  <h3 className="font-bold text-base text-white">{item.name}</h3>
                  <p className="text-xs text-white/60">單價: ${item.price} TWD</p>
                </div>
              </div>

              {/* Right Side: Stepper controls (>= 48px touch targets) */}
              <div className="flex items-center gap-2">
                {/* Decrement Button */}
                <button
                  onClick={() => handleDecrement(item.key)}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl font-bold text-lg transition-all active:scale-90 select-none"
                >
                  -
                </button>

                {/* Number Display Input */}
                <input
                  type="number"
                  pattern="\d*"
                  value={currentCount || ''}
                  onChange={(e) => handleInputChange(item.key, e.target.value)}
                  placeholder="0"
                  className="w-14 h-12 text-center bg-black/35 border border-white/10 rounded-xl font-extrabold text-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />

                {/* Increment Button */}
                <button
                  onClick={() => handleIncrement(item.key)}
                  className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl font-bold text-lg transition-all active:scale-90 select-none"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sticky Checkout summary */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1e3e27]/90 backdrop-blur-lg border-t border-white/15 shadow-2xl flex flex-col gap-3 max-w-md mx-auto z-40 rounded-t-3xl">
        <div className="flex justify-between items-center px-2">
          <div>
            <span className="text-xs text-white/60 block">總盤數 (Total Plates)</span>
            <span className="text-2xl font-extrabold text-yellow-300">{totalPlates} 盤</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-white/60 block">即時總金額 (Total Amount)</span>
            <span className="text-2xl font-extrabold text-emerald-300">${totalAmount} TWD</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading || totalPlates === 0}
          className={`w-full py-4 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 shadow-lg transition-all ${
            totalPlates === 0
              ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
              : 'bg-emerald-500 hover:bg-emerald-400 text-white active:scale-[0.98]'
          }`}
        >
          {loading ? (
            <RefreshCw className="animate-spin" size={18} />
          ) : (
            <Check size={18} />
          )}
          確認結算 Checkout
        </button>
      </div>
    </div>
  );
}
