import { useState, useCallback } from 'react';
import BudgetAlert from '../components/BudgetAlert';
import TransactionForm from '../components/TransactionForm';
import DailySummary from '../components/DailySummary';
import BalanceSummary from '../components/BalanceSummary';
import ToastContainer from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';

export default function HomePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toasts, showToast } = useToast();

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
