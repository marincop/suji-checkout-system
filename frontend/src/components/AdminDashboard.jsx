import React, { useState, useEffect } from 'react';
import { api, setAdminToken } from '../utils/api';
import {
  Lock,
  LogOut,
  TrendingUp,
  Calendar,
  Layers,
  Edit3,
  Trash,
  X,
  Check,
  RefreshCw,
  PieChart as PieIcon,
  BarChart4 as BarIcon,
  User
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

const PLATE_CONFIGS = [
  { key: 'green', name: '綠盤 Green', price: 50, color: '#4CAF50' },
  { key: 'orange', name: '橘盤 Orange', price: 70, color: '#FF9800' },
  { key: 'red', name: '紅盤 Red', price: 90, color: '#F44336' },
  { key: 'white', name: '白盤 White', price: 110, color: '#E0E0E0' }, // slightly off-white for charts
  { key: 'black', name: '黑盤 Black', price: 130, color: '#212121' },
  { key: 'blue', name: '藍盤 Blue', price: 150, color: '#2196F3' }
];

export default function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('store_manager');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Active Tab: 'daily' | 'monthly' | 'history'
  const [activeTab, setActiveTab] = useState('daily');

  // Daily report states
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().substring(0, 10));
  const [dailyData, setDailyData] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Monthly report states
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().toISOString().substring(0, 7));
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // History states
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Waiter management states
  const [waiterList, setWaiterList] = useState([]);
  const [newWaiterName, setNewWaiterName] = useState('');
  const [waitersLoading, setWaitersLoading] = useState(false);

  // Edit modal state
  const [editingTx, setEditingTx] = useState(null);
  const [editPlates, setEditPlates] = useState({});
  const [editTable, setEditTable] = useState(1);
  const [editLoading, setEditLoading] = useState(false);

  // Check initial login token
  useEffect(() => {
    const token = localStorage.getItem('sushi_admin_token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  // Fetch reports or history on changes
  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeTab === 'daily') fetchDailyReport();
    if (activeTab === 'monthly') fetchMonthlyReport();
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'waiters') fetchWaiters();
  }, [isLoggedIn, activeTab, dailyDate, monthlyMonth]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await api.adminLogin(username, password);
      setIsLoggedIn(true);
      setPassword('');
    } catch (err) {
      setLoginError(err.message || '登入失敗，請檢查帳號密碼');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setAdminToken(null);
    setIsLoggedIn(false);
  };

  // 1. Fetch Daily Report
  const fetchDailyReport = async () => {
    setDailyLoading(true);
    try {
      const data = await api.getDailyReport(dailyDate);
      setDailyData(data);
    } catch (err) {
      console.error(err);
      if (!localStorage.getItem('sushi_admin_token')) setIsLoggedIn(false);
    } finally {
      setDailyLoading(false);
    }
  };

  // 2. Fetch Monthly Report
  const fetchMonthlyReport = async () => {
    setMonthlyLoading(true);
    try {
      const data = await api.getMonthlyReport(monthlyMonth);
      setMonthlyData(data);
    } catch (err) {
      console.error(err);
      if (!localStorage.getItem('sushi_admin_token')) setIsLoggedIn(false);
    } finally {
      setMonthlyLoading(false);
    }
  };

  // 3. Fetch Transaction History
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getDailyReport(new Date().toISOString().substring(0, 10)); // default or get all transactions
      // To get ALL historical transactions, we use the custom admin endpoint
      const token = localStorage.getItem('sushi_admin_token');
      const res = await fetch('http://localhost:5001/api/admin/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setHistoryList(list);
      } else {
        throw new Error('Fetch failed');
      }
    } catch (err) {
      console.error(err);
      if (!localStorage.getItem('sushi_admin_token')) setIsLoggedIn(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Waiters management API triggers
  const fetchWaiters = async () => {
    setWaitersLoading(true);
    try {
      const list = await api.getWaiters();
      setWaiterList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setWaitersLoading(false);
    }
  };

  const handleAddWaiter = async (e) => {
    e.preventDefault();
    if (!newWaiterName.trim()) return;
    try {
      await api.addWaiter(newWaiterName.trim());
      alert('已成功新增服務生！');
      setNewWaiterName('');
      fetchWaiters();
    } catch (err) {
      alert('新增失敗：' + err.message);
    }
  };

  const handleDeleteWaiter = async (name) => {
    if (!window.confirm(`確定要刪除服務生 "${name}" 嗎？`)) return;
    try {
      await api.deleteWaiter(name);
      alert('已成功刪除服務生！');
      fetchWaiters();
    } catch (err) {
      alert('刪除失敗：' + err.message);
    }
  };

  // Edit dialog helpers
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
    // Recalculate totals
    const totalPlates = Object.values(editPlates).reduce((a, b) => a + b, 0);
    const totalAmount = PLATE_CONFIGS.reduce((sum, item) => sum + ((editPlates[item.key] || 0) * item.price), 0);

    try {
      await api.editTransaction(editingTx.id, {
        table_number: editTable,
        plates: editPlates,
        total_plates: totalPlates,
        total_amount: totalAmount
      });
      alert('交易紀錄修改成功！');
      closeEditModal();
      // Reload current tab
      if (activeTab === 'daily') fetchDailyReport();
      if (activeTab === 'history') fetchHistory();
    } catch (err) {
      alert('修改失敗：' + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Delete transaction
  const handleDelete = async (id) => {
    if (!window.confirm('確定要「廢除/刪除」此筆結算紀錄嗎？刪除後將自動從營業報表中扣除金額。')) return;
    try {
      await api.deleteTransaction(id);
      alert('已成功廢除該交易紀錄。');
      if (activeTab === 'daily') fetchDailyReport();
      if (activeTab === 'history') fetchHistory();
    } catch (err) {
      alert('刪除失敗：' + err.message);
    }
  };

  // Login Panel Render
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto p-4 pt-12 animate-fade-in">
        <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-yellow-400/10 rounded-full flex items-center justify-center border border-yellow-400/35">
            <Lock className="text-yellow-400" size={30} />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">後端管理系統</h1>
            <p className="text-xs text-white/50 mt-1">需輸入店長/管理者密碼登入</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase mb-1.5">管理者帳號</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#1e3e27] border border-white/20 rounded-xl px-4 py-2.5 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase mb-1.5">管理密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="預設: admin123"
                className="w-full bg-[#1e3e27] border border-white/20 rounded-xl px-4 py-2.5 text-white"
                required
              />
            </div>

            {loginError && (
              <p className="text-rose-400 text-xs font-semibold text-center">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              {loginLoading ? <RefreshCw className="animate-spin" size={18} /> : null}
              登入管理後台
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Compute daily waiter statistics
  const getDailyWaiterStats = () => {
    if (!dailyData || !dailyData.transactions) return [];
    const stats = {};
    dailyData.transactions.forEach(tx => {
      const waiter = tx.waiter_id || '未知';
      if (!stats[waiter]) {
        stats[waiter] = { name: waiter, count: 0, revenue: 0 };
      }
      stats[waiter].count += 1;
      stats[waiter].revenue += tx.total_amount;
    });
    return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
  };
  const dailyWaiterStats = getDailyWaiterStats();

  // Dashboard Header & Tabs Navigation
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fade-in pb-20">
      {/* Top Navbar */}
      <div className="flex justify-between items-center bg-black/25 p-4 rounded-2xl border border-white/10 shadow-md">
        <div>
          <span className="block text-lg font-bold">管理後台 (Admin Panel)</span>
          <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
            歡迎店長 Store Manager
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
        >
          <LogOut size={14} />
          登出
        </button>
      </div>

      {/* Tabs Menu */}
      <div className="flex bg-black/20 p-1.5 rounded-2xl border border-white/5 gap-1.5">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'daily' ? 'bg-[#1e3e27] text-white shadow-md border border-white/10' : 'text-white/60 hover:text-white'
          }`}
        >
          <Calendar size={16} />
          當日營收報表
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'monthly' ? 'bg-[#1e3e27] text-white shadow-md border border-white/10' : 'text-white/60 hover:text-white'
          }`}
        >
          <TrendingUp size={16} />
          每月趨勢分析
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'history' ? 'bg-[#1e3e27] text-white shadow-md border border-white/10' : 'text-white/60 hover:text-white'
          }`}
        >
          <Layers size={16} />
          歷史交易維護
        </button>
        <button
          onClick={() => setActiveTab('waiters')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'waiters' ? 'bg-[#1e3e27] text-white shadow-md border border-white/10' : 'text-white/60 hover:text-white'
          }`}
        >
          <User size={16} />
          服務生管理
        </button>
      </div>

      {/* --- TAB 1: DAILY REPORT --- */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <Calendar className="text-emerald-400" />
              指定日期營收分析
            </h2>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="bg-[#1e3e27] border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {dailyLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-white/40" size={36} /></div>
          ) : dailyData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Daily KPI summary */}
              <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                <h3 className="text-sm font-bold text-white/50 tracking-wider uppercase">當日營業指標</h3>
                <div>
                  <span className="text-[10px] text-white/40 block">總營業收入 (Revenue)</span>
                  <span className="text-3xl font-black text-emerald-300">${dailyData.summary.total_revenue} <span className="text-xs font-normal text-white">TWD</span></span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block">已銷售總盤數 (Total Plates)</span>
                  <span className="text-3xl font-black text-yellow-300">{dailyData.summary.total_plates} <span className="text-xs font-normal text-white">盤</span></span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block">成交筆數 (Orders)</span>
                  <span className="text-xl font-extrabold">{dailyData.transactions.length} 筆</span>
                </div>
              </div>

              {/* Plates breakdown */}
              <div className="glass-card p-6 rounded-2xl border border-white/10 md:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-white/50 tracking-wider uppercase flex items-center gap-1.5"><PieIcon size={16} /> 各色盤子銷量統計</h3>
                
                {/* Horizontal progress bar breakdown */}
                <div className="space-y-3.5">
                  {PLATE_CONFIGS.map(plate => {
                    const count = dailyData.summary.plates[plate.key] || 0;
                    const revenue = count * plate.price;
                    const maxPlates = Math.max(...Object.values(dailyData.summary.plates), 1);
                    const percentage = (count / maxPlates) * 100;

                    return (
                      <div key={plate.key} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="flex items-center gap-1.5">
                            <span style={{ backgroundColor: plate.color }} className="w-3 h-3 rounded-full border border-white/15"></span>
                            {plate.name} (${plate.price})
                          </span>
                          <span className="text-white/80">{count} 盤 / <span className="text-emerald-300">${revenue}</span></span>
                        </div>
                        <div className="w-full bg-black/30 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ backgroundColor: plate.color, width: `${percentage}%` }}
                            className="h-full rounded-full transition-all duration-500"
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Waiter Statistics (Full width below daily charts) */}
              <div className="glass-card p-6 rounded-2xl border border-white/10 md:col-span-3 space-y-4 shadow-xl">
                <h3 className="text-sm font-bold text-white/50 tracking-wider uppercase flex items-center gap-1.5">
                  <User size={16} className="text-emerald-400" /> 服務生結單業績統計
                </h3>
                
                {dailyWaiterStats.length === 0 ? (
                  <p className="text-sm text-white/40">當日無任何結單資料。</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-xs font-semibold text-white/60">
                          <th className="py-2.5">服務生姓名</th>
                          <th className="py-2.5 text-center">結單筆數</th>
                          <th className="py-2.5 text-right">結單總金額</th>
                          <th className="py-2.5 pl-8 hidden sm:table-cell">業績佔比</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dailyWaiterStats.map(stat => {
                          const totalDailyRevenue = dailyData.summary.total_revenue || 1;
                          const sharePercentage = Math.round((stat.revenue / totalDailyRevenue) * 100);
                          return (
                            <tr key={stat.name} className="hover:bg-white/5">
                              <td className="py-3 font-bold text-base text-yellow-300">{stat.name}</td>
                              <td className="py-3 text-center font-semibold">{stat.count} 筆</td>
                              <td className="py-3 text-right font-extrabold text-emerald-400">${stat.revenue} TWD</td>
                              <td className="py-3 pl-8 hidden sm:table-cell w-1/3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-black/30 h-2 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${sharePercentage}%` }}
                                      className="bg-emerald-500 h-full rounded-full"
                                    ></div>
                                  </div>
                                  <span className="text-xs font-bold text-white/60 w-8">{sharePercentage}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* --- TAB 2: MONTHLY TRENDS --- */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <TrendingUp className="text-emerald-400" />
              月份營業趨勢與比例
            </h2>
            <input
              type="month"
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(e.target.value)}
              className="bg-[#1e3e27] border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {monthlyLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-white/40" size={36} /></div>
          ) : monthlyData ? (
            <div className="space-y-6">
              {/* Monthly KPI card */}
              <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-wrap gap-8 justify-around text-center">
                <div>
                  <span className="text-xs text-white/50 block">月總營收 (Monthly Revenue)</span>
                  <span className="text-3xl font-black text-emerald-300">${monthlyData.summary.total_revenue} TWD</span>
                </div>
                <div className="w-px bg-white/10 self-stretch"></div>
                <div>
                  <span className="text-xs text-white/50 block">月銷售盤數 (Monthly Plates)</span>
                  <span className="text-3xl font-black text-yellow-300">{monthlyData.summary.total_plates} 盤</span>
                </div>
              </div>

              {/* Chart Line graph for daily trend */}
              <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                <h3 className="text-sm font-bold text-white/50 tracking-wider uppercase flex items-center gap-1.5"><BarIcon size={16} /> 每日營業趨勢圖</h3>
                {monthlyData.daily_trend.length === 0 ? (
                  <div className="h-60 flex items-center justify-center text-white/40 text-sm">此月份尚無任何交易數據。</div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData.daily_trend} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" tickFormatter={(val) => val.substring(8, 10)} tick={{ fontSize: 11 }} />
                        <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e3e27', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}
                          labelFormatter={(label) => `日期: ${label}`}
                          formatter={(value) => [`$${value} TWD`, '營收']}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#34D399" strokeWidth={3} dot={{ r: 4, stroke: '#34D399', strokeWidth: 1, fill: '#1e3e27' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* --- TAB 3: TRANSACTION LOGS MAINTENANCE --- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <Layers className="text-emerald-400" />
            歷史交易修改與廢除
          </h2>

          {historyLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-white/40" size={36} /></div>
          ) : historyList.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-2xl text-white/40 text-sm">目前無任何歷史交易。</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-lg">
              <table className="w-full text-left border-collapse bg-black/10">
                <thead>
                  <tr className="bg-black/25 border-b border-white/10 text-xs font-semibold text-white/70 uppercase">
                    <th className="p-4">桌號</th>
                    <th className="p-4">時間</th>
                    <th className="p-4">服務生</th>
                    <th className="p-4">總盤數</th>
                    <th className="p-4">總金額</th>
                    <th className="p-4 text-center">操作 / 狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {historyList.map((tx) => (
                    <tr key={tx.id} className={`hover:bg-white/5 transition-colors ${tx.is_deleted ? 'opacity-40 line-through bg-rose-950/10' : ''}`}>
                      <td className="p-4 font-bold text-base text-yellow-300">#{tx.table_number}</td>
                      <td className="p-4 text-xs font-mono">{new Date(tx.created_at).toLocaleString('zh-TW')}</td>
                      <td className="p-4">{tx.waiter_id}</td>
                      <td className="p-4 font-semibold">{tx.total_plates} 盤</td>
                      <td className="p-4 font-semibold text-emerald-400">${tx.total_amount} TWD</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          {tx.is_deleted ? (
                            <span className="text-xs bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-md font-semibold">已廢除</span>
                          ) : (
                            <>
                              <button
                                onClick={() => openEditModal(tx)}
                                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              >
                                <Edit3 size={12} />
                                修改
                              </button>
                              <button
                                onClick={() => handleDelete(tx.id)}
                                className="flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              >
                                <Trash size={12} />
                                刪除
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: WAITERS STAFF ACCOUNT MAINTENANCE --- */}
      {activeTab === 'waiters' && (
        <div className="space-y-6">
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <User className="text-emerald-400" />
            服務生管理與帳號維護
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Add Waiter form */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white/50 tracking-wider uppercase">新增服務生 (Add Waiter)</h3>
              <form onSubmit={handleAddWaiter} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase mb-1.5">服務生姓名</label>
                  <input
                    type="text"
                    value={newWaiterName}
                    onChange={(e) => setNewWaiterName(e.target.value)}
                    placeholder="例如: 小張"
                    className="w-full bg-[#1e3e27] border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2.5 rounded-xl transition-all shadow-md"
                >
                  新增服務生
                </button>
              </form>
            </div>

            {/* Waiter list */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white/50 tracking-wider uppercase">現有服務生名冊</h3>
              
              {waitersLoading ? (
                <div className="flex justify-center py-6"><RefreshCw className="animate-spin text-white/40" size={24} /></div>
              ) : waiterList.length === 0 ? (
                <p className="text-sm text-white/40">目前無任何登記之服務生。</p>
              ) : (
                <div className="divide-y divide-white/5 max-h-60 overflow-y-auto pr-1">
                  {waiterList.map(name => (
                    <div key={name} className="py-2.5 flex items-center justify-between">
                      <span className="font-bold text-base">{name}</span>
                      <button
                        onClick={() => handleDeleteWaiter(name)}
                        className="flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Trash size={12} />
                        刪除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT TRANSACTION LOG MODAL --- */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card w-full max-w-md rounded-3xl border border-white/15 p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold">修改結算交易資料</h3>
              <button onClick={closeEditModal} className="p-1 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>

            {/* Modal Body content */}
            <div className="space-y-4">
              {/* Table selection */}
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

              {/* Plates adjustments */}
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

            {/* Modal Actions */}
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
