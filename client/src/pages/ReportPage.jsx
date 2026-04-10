import { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { getWeeklyStats, getMonthlyStats, getYearlyStats, getTransactions } from '../api';
import { exportToExcel } from '../utils/excel';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CHART_COLORS = {
  income: 'rgba(107, 196, 168, 0.8)',
  incomeBg: 'rgba(107, 196, 168, 0.2)',
  expense: 'rgba(232, 134, 155, 0.8)',
  expenseBg: 'rgba(232, 134, 155, 0.2)',
  pieColors: [
    '#FFB7C5', '#C8A2C8', '#98D8C8', '#FFD93D',
    '#A8E6CF', '#DDA0DD', '#87CEEB', '#F0E68C',
    '#FFA07A', '#E0BBE4',
  ],
};

const commonOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      labels: {
        font: { family: "'ZCOOL KuaiLe', sans-serif", size: 12 },
        color: '#7A6B7A',
      },
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      titleColor: '#4A3B4A',
      bodyColor: '#4A3B4A',
      borderColor: '#E0CDE0',
      borderWidth: 1,
      titleFont: { family: "'ZCOOL KuaiLe', sans-serif" },
      bodyFont: { family: "'ZCOOL KuaiLe', sans-serif" },
      callbacks: {
        label: (ctx) => `¥${ctx.parsed.y?.toFixed(2) ?? ctx.parsed?.toFixed(2) ?? ctx.raw}`,
      },
    },
  },
  scales: {
    x: {
      ticks: {
        font: { family: "'ZCOOL KuaiLe', sans-serif", size: 11 },
        color: '#A89BA8',
      },
      grid: { display: false },
    },
    y: {
      ticks: {
        font: { family: "'ZCOOL KuaiLe', sans-serif", size: 11 },
        color: '#A89BA8',
        callback: (v) => `¥${v}`,
      },
      grid: { color: 'rgba(200, 162, 200, 0.1)' },
    },
  },
};

const pieOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        font: { family: "'ZCOOL KuaiLe', sans-serif", size: 12 },
        color: '#7A6B7A',
        padding: 12,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      titleColor: '#4A3B4A',
      bodyColor: '#4A3B4A',
      borderColor: '#E0CDE0',
      borderWidth: 1,
      bodyFont: { family: "'ZCOOL KuaiLe', sans-serif" },
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
          return `${ctx.label}: ¥${ctx.raw.toFixed(2)} (${pct}%)`;
        },
      },
    },
  },
};

export default function ReportPage() {
  const now = new Date();
  const [tab, setTab] = useState('weekly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [weeklyData, setWeeklyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [yearlyData, setYearlyData] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    if (tab === 'weekly') {
      getWeeklyStats(now.toISOString().slice(0, 10))
        .then((res) => setWeeklyData(res.data))
        .catch(() => {});
    } else if (tab === 'monthly') {
      getMonthlyStats(year, month)
        .then((res) => setMonthlyData(res.data))
        .catch(() => {});
    } else {
      getYearlyStats(year)
        .then((res) => setYearlyData(res.data))
        .catch(() => {});
    }
  }, [tab, year, month]);

  const handleExport = async () => {
    try {
      const res = await getTransactions({});
      if (res.data.length === 0) {
        showToast('没有数据可以导出 😅', 'warn');
        return;
      }
      exportToExcel(res.data, `零花钱记账_${year}`);
      showToast('导出成功 📥');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ===== 渲染函数 =====
  const renderWeekly = () => {
    if (!weeklyData) return null;
    const data = {
      labels: weeklyData.map((d) => d.dayLabel),
      datasets: [
        {
          label: '收入',
          data: weeklyData.map((d) => d.income),
          backgroundColor: CHART_COLORS.income,
          borderRadius: 8,
          borderSkipped: false,
        },
        {
          label: '支出',
          data: weeklyData.map((d) => d.expense),
          backgroundColor: CHART_COLORS.expense,
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    };

    const totalIncome = weeklyData.reduce((s, d) => s + d.income, 0);
    const totalExpense = weeklyData.reduce((s, d) => s + d.expense, 0);

    return (
      <div className="animate-fade-in">
        <div className="report-summary section-gap">
          <div className="report-summary-item">
            <div className="label">本周收入</div>
            <div className="value" style={{ color: 'var(--income-color)' }}>
              +¥{totalIncome.toFixed(2)}
            </div>
          </div>
          <div className="report-summary-item">
            <div className="label">本周支出</div>
            <div className="value" style={{ color: 'var(--expense-color)' }}>
              -¥{totalExpense.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="chart-container section-gap">
          <h3>📊 本周每日收支</h3>
          <Bar data={data} options={commonOptions} />
        </div>
      </div>
    );
  };

  const renderMonthly = () => {
    if (!monthlyData) return null;

    const lineData = {
      labels: monthlyData.daily.map((d) => `${d.day}日`),
      datasets: [
        {
          label: '收入',
          data: monthlyData.daily.map((d) => d.income),
          borderColor: CHART_COLORS.income,
          backgroundColor: CHART_COLORS.incomeBg,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: '支出',
          data: monthlyData.daily.map((d) => d.expense),
          borderColor: CHART_COLORS.expense,
          backgroundColor: CHART_COLORS.expenseBg,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
      ],
    };

    const pieData = {
      labels: monthlyData.categories.map((c) => `${c.emoji} ${c.category}`),
      datasets: [
        {
          data: monthlyData.categories.map((c) => c.total),
          backgroundColor: CHART_COLORS.pieColors.slice(0, monthlyData.categories.length),
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };

    return (
      <div className="animate-fade-in">
        <div className="period-nav">
          <button onClick={() => {
            if (month === 1) { setMonth(12); setYear(y => y - 1); }
            else setMonth(m => m - 1);
          }}>◀</button>
          <span className="period-label">{year}年{month}月</span>
          <button onClick={() => {
            if (month === 12) { setMonth(1); setYear(y => y + 1); }
            else setMonth(m => m + 1);
          }}>▶</button>
        </div>

        <div className="report-summary section-gap">
          <div className="report-summary-item">
            <div className="label">月收入</div>
            <div className="value" style={{ color: 'var(--income-color)' }}>
              +¥{monthlyData.totalIncome.toFixed(2)}
            </div>
          </div>
          <div className="report-summary-item">
            <div className="label">月支出</div>
            <div className="value" style={{ color: 'var(--expense-color)' }}>
              -¥{monthlyData.totalExpense.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="chart-container section-gap">
          <h3>📈 每日收支趋势</h3>
          <Line data={lineData} options={commonOptions} />
        </div>

        {monthlyData.categories.length > 0 && (
          <div className="chart-container section-gap">
            <h3>🍰 支出分类占比</h3>
            <div style={{ maxWidth: '300px', margin: '0 auto' }}>
              <Pie data={pieData} options={pieOptions} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderYearly = () => {
    if (!yearlyData) return null;

    const data = {
      labels: yearlyData.map((d) => d.label),
      datasets: [
        {
          label: '收入',
          data: yearlyData.map((d) => d.income),
          backgroundColor: CHART_COLORS.income,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: '支出',
          data: yearlyData.map((d) => d.expense),
          backgroundColor: CHART_COLORS.expense,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };

    const totalIncome = yearlyData.reduce((s, d) => s + d.income, 0);
    const totalExpense = yearlyData.reduce((s, d) => s + d.expense, 0);

    return (
      <div className="animate-fade-in">
        <div className="period-nav">
          <button onClick={() => setYear((y) => y - 1)}>◀</button>
          <span className="period-label">{year}年</span>
          <button onClick={() => setYear((y) => y + 1)}>▶</button>
        </div>

        <div className="report-summary section-gap">
          <div className="report-summary-item">
            <div className="label">年收入</div>
            <div className="value" style={{ color: 'var(--income-color)' }}>
              +¥{totalIncome.toFixed(2)}
            </div>
          </div>
          <div className="report-summary-item">
            <div className="label">年支出</div>
            <div className="value" style={{ color: 'var(--expense-color)' }}>
              -¥{totalExpense.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="chart-container section-gap">
          <h3>📊 {year}年每月收支汇总</h3>
          <Bar data={data} options={commonOptions} />
        </div>
      </div>
    );
  };

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
        <h1>📊 报表统计</h1>
        <p>看看你的小金库吧~</p>
      </div>

      {/* Tab 切换 */}
      <div className="report-tabs section-gap">
        {[
          { key: 'weekly', label: '📅 周报' },
          { key: 'monthly', label: '📆 月报' },
          { key: 'yearly', label: '📋 年报' },
        ].map((t) => (
          <button
            key={t.key}
            className={`report-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
            id={`tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 图表内容 */}
      {tab === 'weekly' && renderWeekly()}
      {tab === 'monthly' && renderMonthly()}
      {tab === 'yearly' && renderYearly()}

      {/* 导出按钮 */}
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <button className="btn btn-primary" onClick={handleExport} id="btn-export-report">
          📥 导出为 Excel
        </button>
      </div>
    </div>
  );
}
