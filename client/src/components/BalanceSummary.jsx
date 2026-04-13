import { useEffect, useState } from 'react';
import { getTotalBalance } from '../api';

export default function BalanceSummary() {
  const [balance, setBalance] = useState({ initialBalance: 0, totalIncome: 0, totalExpense: 0, netBalance: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    getTotalBalance()
      .then((res) => {
        setBalance(res.data);
        setError(null);
      })
      .catch((err) => setError(err.message || '加载总余额失败'));
  }, []);

  return (
    <div className="glass-card section-gap animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', textAlign: 'center' }}>
        💰 总余额
      </h3>
      {error ? (
        <div style={{ color: 'var(--expense-color)', fontSize: '0.9rem', textAlign: 'center', padding: '12px 0' }}>
          ⚠️ {error}
        </div>
      ) : (
        <div className="balance-summary">
          <div className="balance-item">
            <div className="label">总收入</div>
            <div className="value income">+¥{balance.totalIncome.toFixed(2)}</div>
          </div>
          <div className="balance-item">
            <div className="label">总支出</div>
            <div className="value expense">-¥{balance.totalExpense.toFixed(2)}</div>
          </div>
          <div className="balance-item">
            <div className="label">净余额</div>
            <div className="value net">¥{balance.netBalance.toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
