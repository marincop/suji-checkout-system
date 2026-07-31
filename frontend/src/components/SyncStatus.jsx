import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { localDb } from '../db';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function SyncStatus({ onSyncCompleted }) {
  const [isOnline, setIsOnline] = useState(api.isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState(null); // 'success' | 'failed' | null

  const updatePendingCount = async () => {
    const pending = await localDb.getPendingTransactions();
    setPendingCount(pending.length);
  };

  useEffect(() => {
    updatePendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodically poll Dexie for pending count (in case transactions are added/edited)
    const interval = setInterval(updatePendingCount, 2500);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const triggerSync = async () => {
    if (!api.isOnline()) return;
    setIsSyncing(true);
    setLastSyncStatus(null);
    try {
      const res = await api.syncPendingTransactions();
      if (res.success) {
        setLastSyncStatus('success');
        updatePendingCount();
        if (onSyncCompleted) onSyncCompleted();
      } else {
        setLastSyncStatus('failed');
      }
    } catch (err) {
      setLastSyncStatus('failed');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setLastSyncStatus(null), 3000);
    }
  };

  return (
    <div className="flex items-center space-x-3 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-sm font-medium">
      {/* Network Status Badge */}
      <div className="flex items-center space-x-1.5">
        {isOnline ? (
          <>
            <Wifi size={16} className="text-emerald-400 animate-pulse" />
            <span className="text-emerald-100 hidden sm:inline">已連線</span>
          </>
        ) : (
          <>
            <WifiOff size={16} className="text-amber-400" />
            <span className="text-amber-100 hidden sm:inline">離線模式</span>
          </>
        )}
      </div>

      <div className="h-4 w-px bg-white/20"></div>

      {/* Sync Queue Info */}
      <div className="flex items-center space-x-2">
        {pendingCount > 0 ? (
          <span className="text-amber-300 font-bold flex items-center gap-1.5">
            {pendingCount} 筆待同步
          </span>
        ) : (
          <span className="text-emerald-300 flex items-center gap-1">
            <CheckCircle2 size={14} />
            資料已同步
          </span>
        )}

        {isOnline && pendingCount > 0 && (
          <button
            onClick={triggerSync}
            disabled={isSyncing}
            className={`p-1 hover:bg-white/10 rounded-full transition-all ${
              isSyncing ? 'animate-spin text-emerald-400' : 'text-white'
            }`}
            title="手動同步"
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {/* Mini notification toasts */}
      {lastSyncStatus === 'success' && (
        <span className="text-xs text-emerald-400 font-bold ml-2 animate-bounce">同步成功!</span>
      )}
      {lastSyncStatus === 'failed' && (
        <span className="text-xs text-rose-400 font-bold ml-2">同步失敗</span>
      )}
    </div>
  );
}
