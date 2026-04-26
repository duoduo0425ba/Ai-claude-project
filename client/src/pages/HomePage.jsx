import { useState, useCallback, useEffect } from 'react';
import BudgetAlert from '../components/BudgetAlert';
import TransactionForm from '../components/TransactionForm';
import DailySummary from '../components/DailySummary';
import BalanceSummary from '../components/BalanceSummary';
import ToastContainer from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
import { formatLocalDate } from '../utils/date';
import { generateRecurring } from '../api';

export default function HomePage() {
  const today = formatLocalDate();
  const [refreshKey, setRefreshKey] = useState(0);
  const { toasts, showToast } = useToast();

  // 每次打开首页时检查并生成到期的周期账单
  useEffect(() => {
    generateRecurring()
      .then((res) => {
        if (res.generated > 0) {
          showToast(`已自动生成 ${res.generated} 条周期账单 🔄`);
          setRefreshKey((k) => k + 1);
        }
      })
      .catch(() => {}); // 静默失败，不影响主流程
  }, [showToast]);

  const handleSuccess = useCallback((msg, type) => {
    showToast(msg, type);
    if (type === 'success') {
      setRefreshKey((k) => k + 1);
    }
  }, [showToast]);

  return (
    <div className="page">
      <ToastContainer toasts={toasts} />

      <div className="page-header">
        <h1>🌸 零花钱记账</h1>
        <p>每一笔都是成长的记录~</p>
      </div>

      <BudgetAlert key={refreshKey} />
      <DailySummary date={today} refreshKey={refreshKey} />
      <BalanceSummary key={refreshKey} />
      <TransactionForm onSuccess={handleSuccess} />
    </div>
  );
}
