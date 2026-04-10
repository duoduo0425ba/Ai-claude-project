import { useState, useCallback } from 'react';
import BudgetAlert from '../components/BudgetAlert';
import TransactionForm from '../components/TransactionForm';
import DailySummary from '../components/DailySummary';

export default function HomePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const handleSuccess = useCallback((msg, type) => {
    showToast(msg, type);
    if (type === 'success') {
      setRefreshKey((k) => k + 1);
    }
  }, [showToast]);

  return (
    <div className="page">
      {/* Toasts */}
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
        <h1>🌸 零花钱记账</h1>
        <p>每一笔都是成长的记录~</p>
      </div>

      <BudgetAlert key={refreshKey} />
      <DailySummary date={today} refreshKey={refreshKey} />
      <TransactionForm onSuccess={handleSuccess} />
    </div>
  );
}
