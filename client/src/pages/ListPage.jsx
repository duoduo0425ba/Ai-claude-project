import { useState, useEffect, useCallback } from 'react';
import { getTransactions, deleteTransaction, batchImport } from '../api';
import { importFromExcel, exportToExcel } from '../utils/excel';
import TransactionCard from '../components/TransactionCard';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../components/CategoryPicker';

const ALL_CATEGORIES = [
  { name: '全部', emoji: '🌈' },
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
];

export default function ListPage() {
  const [transactions, setTransactions] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState('全部');
  const [toasts, setToasts] = useState([]);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [initialBalance, setInitialBalance] = useState('');

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (filterCategory !== '全部') params.category = filterCategory;
      if (keyword) params.keyword = keyword;
      const res = await getTransactions(params);
      setTransactions(res.data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [filterCategory, keyword, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id) => {
    if (!confirm('确认删除这条记录吗？')) return;
    try {
      await deleteTransaction(id);
      showToast('删除成功 🗑️');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const records = await importFromExcel(file);
      if (records.length === 0) {
        showToast('没有解析到有效记录 😅', 'warn');
        return;
      }
      const res = await batchImport(records);
      showToast(`成功导入 ${res.imported} 条记录 🎉`);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
    e.target.value = '';
  };

  const handleExport = () => {
    if (transactions.length === 0) {
      showToast('没有数据可以导出 😅', 'warn');
      return;
    }
    exportToExcel(transactions);
    showToast('导出成功 📥');
  };

  const handleAddBalance = async () => {
    const amount = parseFloat(initialBalance);
    if (!amount || amount <= 0) {
      showToast('请输入有效金额', 'error');
      return;
    }
    try {
      await batchImport([{
        type: 'income',
        amount,
        category: '前期结余',
        emoji: '📦',
        note: '手动填入前期结余',
        date: new Date().toISOString().slice(0, 10),
      }]);
      showToast('结余已添加 ✨');
      setShowBalanceModal(false);
      setInitialBalance('');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 按日期分组
  const grouped = {};
  transactions.forEach((t) => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="page">
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      )}

      <div className="page-header">
        <h1>📋 账单列表</h1>
        <p>所有收支记录一目了然~</p>
      </div>

      {/* 搜索栏 */}
      <div className="search-bar section-gap">
        <input
          type="text"
          className="input-field"
          placeholder="🔍 搜索备注或分类..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          id="search-input"
        />
      </div>

      {/* 分类筛选 */}
      <div className="filter-row section-gap">
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            className={`filter-chip ${filterCategory === cat.name ? 'active' : ''}`}
            onClick={() => setFilterCategory(cat.name)}
          >
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>

      {/* 操作栏 */}
      <div className="action-bar section-gap">
        <div className="file-input-wrapper">
          <button className="btn btn-ghost" id="btn-import">📥 导入Excel</button>
          <input type="file" accept=".xlsx,.xls" onChange={handleImport} />
        </div>
        <button className="btn btn-ghost" onClick={handleExport} id="btn-export">
          📤 导出Excel
        </button>
        <button className="btn btn-ghost" onClick={() => setShowBalanceModal(true)} id="btn-balance">
          📦 填入结余
        </button>
      </div>

      {/* 账单列表 */}
      {sortedDates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🐱</div>
          <p>还没有记录哦，去记一笔吧~</p>
        </div>
      ) : (
        sortedDates.map((date) => {
          const items = grouped[date];
          const dayIncome = items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
          const dayExpense = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

          return (
            <div key={date} className="date-group">
              <div className="date-group-header">
                <span className="date-label">{date}</span>
                <span className="date-total">
                  收 +¥{dayIncome.toFixed(2)} &nbsp; 支 -¥{dayExpense.toFixed(2)}
                </span>
              </div>
              <div className="transaction-list">
                {items.map((t, i) => (
                  <TransactionCard
                    key={t.id}
                    transaction={t}
                    onDelete={handleDelete}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* 填入结余弹窗 */}
      {showBalanceModal && (
        <div className="modal-overlay" onClick={() => setShowBalanceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>📦 填入前期结余</h2>
            <div className="form-group">
              <label>结余金额 (¥)</label>
              <input
                type="number"
                className="input-field"
                placeholder="请输入前期结余金额..."
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                min="0"
                step="0.01"
                id="input-balance"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowBalanceModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleAddBalance}>
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
