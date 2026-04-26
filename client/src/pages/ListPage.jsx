import { useState, useEffect, useRef } from 'react';
import { getTransactions, deleteTransaction, batchImport, getCategories } from '../api';
import { importFromExcel, exportToExcel } from '../utils/excel';
import TransactionCard from '../components/TransactionCard';
import EditTransactionForm from '../components/EditTransactionForm';
import ToastContainer from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatLocalDate } from '../utils/date';

const ITEMS_PER_PAGE = 30;

export default function ListPage() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useLocalStorage('listPageCategory', '全部');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [initialBalance, setInitialBalance] = useState('');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState([{ name: '全部', emoji: '🌈' }]);
  const { toasts, showToast } = useToast();

  const refresh = () => setRefreshKey((k) => k + 1);

  // 服务端分页数据拉取
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = { page: currentPage, pageSize: ITEMS_PER_PAGE };
        if (filterCategory !== '全部') params.category = filterCategory;
        if (keyword) params.keyword = keyword;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const res = await getTransactions(params, { signal: controller.signal });
        setTransactions(res.data);
        setTotal(res.total ?? 0);
      } catch (err) {
        if (err.name !== 'AbortError') showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [currentPage, filterCategory, keyword, startDate, endDate, refreshKey, showToast]);

  // 筛选条件变更时回到第一页
  const prevFilters = useRef({ filterCategory, keyword, startDate, endDate });
  useEffect(() => {
    const p = prevFilters.current;
    if (p.filterCategory !== filterCategory || p.keyword !== keyword ||
        p.startDate !== startDate || p.endDate !== endDate) {
      prevFilters.current = { filterCategory, keyword, startDate, endDate };
      setCurrentPage(1);
    }
  }, [filterCategory, keyword, startDate, endDate]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getCategories('expense'), getCategories('income')])
      .then(([expenseRes, incomeRes]) => {
        if (!isMounted) return;

        const merged = [{ name: '全部', emoji: '🌈' }];
        const seen = new Set(['全部']);

        [...expenseRes.data, ...incomeRes.data].forEach((cat) => {
          if (!seen.has(cat.name)) {
            seen.add(cat.name);
            merged.push({ name: cat.name, emoji: cat.emoji });
          }
        });

        setCategoryOptions(merged);
      })
      .catch(() => {
        if (isMounted) {
          setCategoryOptions([{ name: '全部', emoji: '🌈' }]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 快捷键支持 (Escape 关闭弹窗)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowEditModal(false);
        setShowBalanceModal(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setShowEditModal(true);
  };

  const handleEditSuccess = (msg, type) => {
    showToast(msg, type);
    if (type === 'success') {
      setShowEditModal(false);
      setEditingTransaction(null);
      refresh();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确认删除这条记录吗？')) return;
    try {
      await deleteTransaction(id);
      showToast('删除成功 🗑️');
      refresh();
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
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
    e.target.value = '';
  };

  // 导出时拉全量数据（不分页）
  const handleExport = async () => {
    try {
      const params = {};
      if (filterCategory !== '全部') params.category = filterCategory;
      if (keyword) params.keyword = keyword;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await getTransactions(params);
      if (!res.data.length) {
        showToast('没有数据可以导出 😅', 'warn');
        return;
      }
      exportToExcel(res.data);
      showToast('导出成功 📥');
    } catch (err) {
      showToast(err.message, 'error');
    }
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
        date: formatLocalDate(),
      }]);
      showToast('结余已添加 ✨');
      setShowBalanceModal(false);
      setInitialBalance('');
      refresh();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 按日期分组（server 已分页，直接用 transactions）
  const grouped = {};
  transactions.forEach((t) => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  return (
    <div className="page">
      <ToastContainer toasts={toasts} />

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

      {/* 日期范围筛选 */}
      <div className="date-range-filter section-gap" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
            开始日期
          </label>
          <input
            type="date"
            className="input-field"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            id="filter-start-date"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
            结束日期
          </label>
          <input
            type="date"
            className="input-field"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            id="filter-end-date"
          />
        </div>
        {(startDate || endDate) && (
          <button
            className="btn btn-ghost"
            onClick={() => { setStartDate(''); setEndDate(''); }}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            id="btn-clear-dates"
          >
            清除
          </button>
        )}
      </div>

      {/* 分类筛选 */}
      <div className="filter-row section-gap">
        {categoryOptions.map((cat) => (
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
      {loading ? (
        <div className="loading-state">加载中...</div>
      ) : sortedDates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🐱</div>
          {(filterCategory !== '全部' || keyword || startDate || endDate) ? (
            <>
              <p>没有符合条件的记录呢</p>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setFilterCategory('全部');
                  setKeyword('');
                  setStartDate('');
                  setEndDate('');
                }}
                style={{ marginTop: '12px' }}
              >
                清除筛选
              </button>
            </>
          ) : (
            <p>还没有记录哦，去记一笔吧~</p>
          )}
        </div>
      ) : (
        <>
          {sortedDates.map((date) => {
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
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      style={{ animationDelay: `${i * 0.05}s` }}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* 分页 */}
          {total > ITEMS_PER_PAGE && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ◀ 上一页
              </button>
              <span className="pagination-info">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= totalPages}
              >
                下一页 ▶
              </button>
            </div>
          )}
        </>
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

      {/* 编辑记录弹窗 */}
      {showEditModal && editingTransaction && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <EditTransactionForm
              transaction={editingTransaction}
              onSuccess={handleEditSuccess}
              onCancel={() => setShowEditModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
