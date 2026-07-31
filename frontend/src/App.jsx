import React, { useState, useEffect } from 'react';
import TableSelector from './components/TableSelector';
import PlateCounter from './components/PlateCounter';
import AdminDashboard from './components/AdminDashboard';
import SyncStatus from './components/SyncStatus';
import { api } from './utils/api';
import { Settings, ArrowLeft } from 'lucide-react';

export default function App() {
  // Navigation views: 'waiter' | 'admin'
  const [currentView, setCurrentView] = useState('waiter');
  
  // Waiter session states
  const [activeWaiter, setActiveWaiter] = useState('');
  const [activeTable, setActiveTable] = useState(null);

  // Sync refresh hook
  const [syncTrigger, setSyncTrigger] = useState(0);

  const handleSyncCompleted = () => {
    setSyncTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (activeTable && activeWaiter) {
        e.preventDefault();
        e.returnValue = '點算中尚未結算，若離開頁面將自動釋放桌號。';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeTable, activeWaiter]);

  useEffect(() => {
    return () => {
      if (activeTable && activeWaiter) {
        api.unlockTable(activeTable, activeWaiter);
      }
    };
  }, [activeTable, activeWaiter]);

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* App Body Container */}
      <div className="flex-1 flex flex-col">
        {/* Premium Brand Header */}
        <header className="sticky top-0 bg-[#2E5D3C]/95 backdrop-blur-md border-b border-white/10 px-4 py-3.5 z-40 flex items-center justify-between max-w-4xl w-full mx-auto">
          <div className="flex items-center space-x-2.5">
            <img
              src="/logo.jpg"
              alt="蘇記豬肚雞 Logo"
              className="w-11 h-11 rounded-full border border-yellow-400/80 shadow-md object-cover"
            />
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight flex items-center gap-1 text-white">
                蘇記豬肚雞離線計價系統
              </h1>
              <p className="text-[9px] text-yellow-300 font-bold uppercase tracking-widest leading-none">
                中和環球概念店
              </p>
            </div>
          </div>

          <SyncStatus onSyncCompleted={handleSyncCompleted} />
        </header>

        {/* Main Workspace content */}
        <main className="flex-1 px-4 py-6 max-w-4xl w-full mx-auto">
          {/* Main Routing Views */}
          {currentView === 'waiter' ? (
            activeTable ? (
              <PlateCounter
                tableNumber={activeTable}
                waiterId={activeWaiter}
                onBack={() => setActiveTable(null)}
              />
            ) : (
              <TableSelector
                key={syncTrigger}
                activeWaiter={activeWaiter}
                setActiveWaiter={setActiveWaiter}
                onTableSelect={(num) => setActiveTable(num)}
              />
            )
          ) : (
            <div className="space-y-4">
              {/* Back button for Admin View */}
              <div className="max-w-4xl mx-auto px-4 flex justify-start">
                <button
                  onClick={() => setCurrentView('waiter')}
                  className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl transition-all"
                >
                  <ArrowLeft size={14} />
                  返回服務生點餐介面
                </button>
              </div>
              
              <AdminDashboard key={syncTrigger} />
            </div>
          )}
        </main>
      </div>

      {/* Small Admin Link at the very bottom (Only visible when waiter is NOT currently in PlateCounter view) */}
      {!activeTable && (
        <footer className="w-full text-center py-6 border-t border-white/5 bg-black/10 mt-12">
          {currentView === 'waiter' ? (
            <button
              onClick={() => setCurrentView('admin')}
              className="text-xs text-white/40 hover:text-white/80 transition-all flex items-center gap-1 mx-auto"
            >
              <Settings size={12} />
              進入店長管理後台 (需密碼)
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('waiter')}
              className="text-xs text-white/40 hover:text-white/80 transition-all flex items-center gap-1 mx-auto"
            >
              返回服務生操作介面
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
