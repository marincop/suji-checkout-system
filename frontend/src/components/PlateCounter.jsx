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
  { key: 'green', name: '綠盤', price: 50, color: '#4CAF50', textLight: true },
  { key: 'orange', name: '橘盤', price: 70, color: '#FF9800', textLight: true },
  { key: 'red', name: '紅盤', price: 90, color: '#F44336', textLight: true },
  { key: 'white', name: '白盤', price: 110, color: '#FFFFFF', textLight: false },
  { key: 'black', name: '黑盤', price: 130, color: '#212121', textLight: true },
  { key: 'blue', name: '藍盤', price: 150, color: '#2196F3', textLight: true }
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

  useEffect(() => {
    if (!api.isOnline()) return;
    const renewLock = () => api.lockTable(tableNumber, waiterId);
    const interval = setInterval(renewLock, 30 * 1000);
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

      await localDb.saveTransaction(newTx);

      if (api.isOnline()) {
        const syncRes = await api.syncPendingTransactions();
        if (syncRes.success) {
          console.log('Transaction synced online instantly.');
        } else {
          console.log('Transaction saved locally, waiting for online sync.');
        }
      }

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
    <div className="max-w-md mx-auto p-2 space-y-4 animate-fade-in pb-44">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-black/20 p-3 rounded-2xl border border-white/5 shadow-md">
        <button
          onClick={handleClear}
          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl transition-all"
          title="清空重置"
        >
          <Trash2 size={16} />
        </button>
        <div className="text-right">
          <span className="block text-base font-extrabold text-white">桌號 #{tableNumber}</span>
          <span className="text-[10px] text-yellow-300 font-bold uppercase tracking-wider">
            服務生: {waiterId}
          </span>
        </div>
      </div>

      {/* Plates 3x2 Grid (Fits perfectly on one screen) */}
      <div className="grid grid-cols-2 gap-3">
        {PLATE_CONFIGS.map((item) => {
          const currentCount = plates[item.key] || 0;
          return (
            <div
              key={item.key}
              className="glass-card p-3 rounded-2xl flex flex-col items-center justify-between border border-white/10 shadow-lg text-center gap-2"
            >
              {/* Circular Plate Clicker */}
              <button
                onClick={() => handleIncrement(item.key)}
                style={{
                  backgroundColor: item.color,
                  boxShadow: item.key === 'white' 
                    ? 'inset 0 -3px 6px rgba(0,0,0,0.1), 0 3px 8px rgba(0,0,0,0.15)' 
                    : 'inset 0 -3px 6px rgba(0,0,0,0.4), 0 3px 8px rgba(0,0,0,0.25)',
                  color: item.textLight ? '#FFFFFF' : '#1e3e27'
                }}
                className="w-16 h-16 rounded-full plate-bounce flex flex-col items-center justify-center font-extrabold shadow-inner shrink-0 relative transition-transform"
              >
                <span className="text-xs font-bold leading-none">${item.price}</span>
                <div
                  style={{ borderColor: item.textLight ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }}
                  className="absolute inset-2.5 rounded-full border border-dashed"
                ></div>
              </button>

              {/* Plate Name Label */}
              <div>
                <h3 className="font-bold text-sm text-white">{item.name}</h3>
              </div>

              {/* Compact Stepper controls */}
              <div className="flex items-center justify-between bg-black/25 rounded-xl p-0.5 w-full">
                <button
                  onClick={() => handleDecrement(item.key)}
                  className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg font-bold text-base select-none"
                >
                  -
                </button>

                <input
                  type="number"
                  pattern="\d*"
                  value={currentCount || ''}
                  onChange={(e) => handleInputChange(item.key, e.target.value)}
                  placeholder="0"
                  className="w-8 text-center bg-transparent border-0 font-extrabold text-base text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />

                <button
                  onClick={() => handleIncrement(item.key)}
                  className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg font-bold text-base select-none"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sticky Checkout summary */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1e3e27]/95 backdrop-blur-lg border-t border-white/15 shadow-2xl flex flex-col gap-2.5 max-w-md mx-auto z-40 rounded-t-3xl">
        <div className="flex justify-between items-center px-2">
          <div>
            <span className="text-[10px] text-white/60 block">總盤數</span>
            <span className="text-lg font-extrabold text-yellow-300">{totalPlates} 盤</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-white/60 block">即時總金額</span>
            <span className="text-lg font-extrabold text-emerald-300">${totalAmount} TWD</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading || totalPlates === 0}
          className={`w-full py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            totalPlates === 0
              ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
              : 'bg-emerald-500 hover:bg-emerald-400 text-white active:scale-[0.98]'
          }`}
        >
          {loading ? (
            <RefreshCw className="animate-spin" size={16} />
          ) : (
            <Check size={16} />
          )}
          確認結算
        </button>

        <button
          onClick={handleCancel}
          disabled={loading}
          className="w-full py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl font-bold text-xs text-white/80 transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
        >
          <ArrowLeft size={12} />
          返回桌號選單 (解鎖)
        </button>
      </div>
    </div>
  );
}
