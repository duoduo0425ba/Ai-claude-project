import { useEffect, useState } from 'react';
import { getBudgetStatus, getCategoryBudgetStatus } from '../api';

export default function BudgetAlert() {
  const [budget, setBudget] = useState(null);
  const [catBudgets, setCatBudgets] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    Promise.all([
      getBudgetStatus(y, m),
      getCategoryBudgetStatus(y, m),
    ])
      .then(([b, c]) => {
        setBudget(b.data);
        setCatBudgets(c.data || []);
      })
      .catch((err) => setError(err.message || '加载预算信息失败'));
  }, []);

  if (error) {
    return (
      <div className="budget-card animate-slide-up section-gap" style={{ borderColor: 'var(--expense-color)', background: 'rgba(232, 134, 155, 0.1)' }}>
        <div style={{ color: 'var(--expense-color)', fontSize: '0.9rem', textAlign: 'center', padding: '12px 0' }}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  if (!budget) return null;

  return (
    <div className="budget-card animate-slide-up section-gap">
      <div className="budget-header">
        <h3>🐱 本月预算</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          月零花钱 ¥{budget.monthlyIncome}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="budget-amount" style={{
          color: budget.status === 'danger' ? 'var(--expense-color)' :
                 budget.status === 'warn'   ? '#c67700' : 'var(--income-color)'
        }}>
          ¥{budget.totalExpense.toFixed(2)}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          / ¥{budget.monthlyIncome}
        </span>
      </div>

      <div className="budget-progress">
        <div className={`budget-progress-bar ${budget.status}`} style={{ width: `${budget.progress}%` }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span>已花: ¥{budget.totalExpense.toFixed(2)}</span>
        <span>剩余: ¥{Math.max(budget.remaining, 0).toFixed(2)}</span>
      </div>

      <div className={`budget-message ${budget.status}`}>
        {budget.message}
      </div>

      {/* 分类预算进度条 */}
      {catBudgets.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {catBudgets.map((cb) => (
            <div key={cb.category}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span>{cb.emoji} {cb.category}</span>
                <span style={{
                  color: cb.status === 'danger' ? 'var(--expense-color)' :
                         cb.status === 'warn'   ? '#c67700' : 'var(--text-muted)'
                }}>
                  ¥{cb.spent.toFixed(2)} / ¥{cb.budgetAmount}
                </span>
              </div>
              <div className="budget-progress" style={{ height: '6px' }}>
                <div
                  className={`budget-progress-bar ${cb.status}`}
                  style={{ width: `${cb.progress}%` }}
                />
              </div>
              {cb.status === 'danger' && (
                <div style={{ fontSize: '0.72rem', color: 'var(--expense-color)', marginTop: '2px' }}>
                  已超支 ¥{(cb.spent - cb.budgetAmount).toFixed(2)} 🔴
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
