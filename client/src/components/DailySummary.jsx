import { useEffect, useState } from 'react';
import { getDailySummary } from '../api';

export default function DailySummary({ date, refreshKey }) {
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });

  useEffect(() => {
    getDailySummary(date)
      .then((res) => setSummary(res.data))
      .catch(() => {});
  }, [date, refreshKey]);

  return (
    <div className="glass-card section-gap animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', textAlign: 'center' }}>
        📝 今日收支
      </h3>
      <div className="daily-summary">
        <div className="summary-item">
          <div className="label">收入</div>
          <div className="value income">+¥{summary.income.toFixed(2)}</div>
        </div>
        <div className="summary-item">
          <div className="label">支出</div>
          <div className="value expense">-¥{summary.expense.toFixed(2)}</div>
        </div>
        <div className="summary-item">
          <div className="label">结余</div>
          <div className="value balance">¥{summary.balance.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
