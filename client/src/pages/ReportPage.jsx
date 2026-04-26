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
import { formatLocalDate } from '../utils/date';
import ToastContainer from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';

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
  const [today] = useState(() => new Date());
  const [tab, setTab] = useState('weekly');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeklyData, setWeeklyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [yearlyData, setYearlyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeError, setActiveError] = useState('');
  const { toasts, showToast } = useToast();

  // 计算周偏移后的日期
  const getWeekDate = useCallback((offset = weekOffset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset * 7);
    return formatLocalDate(d);
  }, [today, weekOffset]);

  useEffect(() => {
    let isMounted = true;

    if (tab === 'weekly') {
      getWeeklyStats(getWeekDate())
        .then((res) => {
          if (!isMounted) return;
          setWeeklyData(Array.isArray(res.data) ? res.data : []);
        })
        .catch((err) => {
          if (!isMounted) return;
          setWeeklyData([]);
          setActiveError(err.message || '加载周报失败');
          showToast(err.message || '加载周报失败', 'error');
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    } else if (tab === 'monthly') {
      getMonthlyStats(year, month)
        .then((res) => {
          if (!isMounted) return;
          setMonthlyData(res.data || null);
        })
        .catch((err) => {
          if (!isMounted) return;
          setMonthlyData(null);
          setActiveError(err.message || '加载月报失败');
          showToast(err.message || '加载月报失败', 'error');
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    } else {
      getYearlyStats(year)
        .then((res) => {
          if (!isMounted) return;
          setYearlyData(res.data || null);
        })
        .catch((err) => {
          if (!isMounted) return;
          setYearlyData(null);
          setActiveError(err.message || '加载年报失败');
          showToast(err.message || '加载年报失败', 'error');
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [getWeekDate, month, showToast, tab, year]);

  const handleExport = async () => {
    try {
      let params = {};
      let filename = '零花钱记账';

      if (tab === 'weekly') {
        const weekDate = getWeekDate();
        const d = new Date(weekDate);
        const monday = new Date(d);
        monday.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        params.startDate = formatLocalDate(monday);
        params.endDate = formatLocalDate(sunday);
        filename = `零花钱记账_${params.startDate}_to_${params.endDate}`;
      } else if (tab === 'monthly') {
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        params.startDate = monthStart;
        params.endDate = monthEnd;
        filename = `零花钱记账_${year}-${String(month).padStart(2, '0')}`;
      } else {
        params.startDate = `${year}-01-01`;
        params.endDate = `${year}-12-31`;
        filename = `零花钱记账_${year}`;
      }

      const res = await getTransactions(params);
      if (res.data.length === 0) {
        showToast('没有数据可以导出 😅', 'warn');
        return;
      }
      exportToExcel(res.data, filename);
      showToast('导出成功 📥');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ===== 渲染函数 =====
  const renderWeekly = () => {
    if (!weeklyData || weeklyData.length === 0) {
      return <div className="empty-state"><p>这一周还没有数据哦~</p></div>;
    }
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

    // 计算周范围标签
    const firstDay = weeklyData[0];
    const lastDay = weeklyData[weeklyData.length - 1];
    const weekStartDate = firstDay?.date ? new Date(firstDay.date) : null;
    const weekEndDate = lastDay?.date ? new Date(lastDay.date) : null;
    const weekLabel = weekStartDate && weekEndDate
      ? `${weekStartDate.getMonth() + 1}月${weekStartDate.getDate()}日 - ${weekEndDate.getMonth() + 1}月${weekEndDate.getDate()}日`
      : '本周';

    return (
      <div className="animate-fade-in">
        <div className="period-nav section-gap" style={{ marginBottom: '0' }}>
          <button onClick={() => {
            setLoading(true);
            setActiveError('');
            setWeekOffset((w) => w - 1);
          }}>◀</button>
          <span className="period-label">{weekLabel}</span>
          <button onClick={() => {
            setLoading(true);
            setActiveError('');
            setWeekOffset((w) => w + 1);
          }}>▶</button>
        </div>
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
    if (!monthlyData) {
      return <div className="empty-state"><p>这个月的报表暂时不可用</p></div>;
    }

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

    const incomePieData = {
      labels: monthlyData.incomeCategories.map((c) => `${c.emoji} ${c.category}`),
      datasets: [
        {
          data: monthlyData.incomeCategories.map((c) => c.total),
          backgroundColor: CHART_COLORS.pieColors.slice(0, monthlyData.incomeCategories.length),
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };

    const daysInMonth = monthlyData.daily?.length || 0;
    const dailyExpenseAvg = daysInMonth > 0 ? monthlyData.totalExpense / daysInMonth : 0;

    return (
      <div className="animate-fade-in">
        <div className="period-nav">
          <button onClick={() => {
            setLoading(true);
            setActiveError('');
            if (month === 1) { setMonth(12); setYear(y => y - 1); }
            else setMonth(m => m - 1);
          }}>◀</button>
          <span className="period-label">{year}年{month}月</span>
          <button onClick={() => {
            setLoading(true);
            setActiveError('');
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
          <div className="report-summary-item">
            <div className="label">日均支出</div>
            <div className="value" style={{ color: 'var(--expense-color)' }}>
              ¥{dailyExpenseAvg.toFixed(2)}
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

        {monthlyData.incomeCategories && monthlyData.incomeCategories.length > 0 && (
          <div className="chart-container section-gap">
            <h3>🍰 收入分类占比</h3>
            <div style={{ maxWidth: '300px', margin: '0 auto' }}>
              <Pie data={incomePieData} options={pieOptions} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderYearly = () => {
    if (!yearlyData) {
      return <div className="empty-state"><p>这一年的报表暂时不可用</p></div>;
    }

    const months = yearlyData.months || yearlyData; // 兼容旧数据格式
    if (!Array.isArray(months) || months.length === 0) {
      return <div className="empty-state"><p>这一年还没有数据哦~</p></div>;
    }
    const data = {
      labels: months.map((d) => d.label),
      datasets: [
        {
          label: '收入',
          data: months.map((d) => d.income),
          backgroundColor: CHART_COLORS.income,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: '支出',
          data: months.map((d) => d.expense),
          backgroundColor: CHART_COLORS.expense,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    };

    const totalIncome = months.reduce((s, d) => s + d.income, 0);
    const totalExpense = months.reduce((s, d) => s + d.expense, 0);
    const avgMonthlyExpense = totalExpense / 12;
    return (
      <div className="animate-fade-in">
        <div className="period-nav">
          <button onClick={() => {
            setLoading(true);
            setActiveError('');
            setYear((y) => y - 1);
          }}>◀</button>
          <span className="period-label">{year}年</span>
          <button onClick={() => {
            setLoading(true);
            setActiveError('');
            setYear((y) => y + 1);
          }}>▶</button>
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
          <div className="report-summary-item">
            <div className="label">月均支出</div>
            <div className="value" style={{ color: 'var(--expense-color)' }}>
              ¥{avgMonthlyExpense.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="chart-container section-gap">
          <h3>📊 {year}年每月收支汇总</h3>
          <Bar data={data} options={commonOptions} />
        </div>

        {yearlyData.expenseCategories && yearlyData.expenseCategories.length > 0 && (
          <div className="chart-container section-gap">
            <h3>🏆 年度支出分类 TOP 8</h3>
            <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {yearlyData.expenseCategories.map((cat, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <span>{cat.emoji} {cat.category}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--expense-color)' }}>¥{cat.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {yearlyData.incomeCategories && yearlyData.incomeCategories.length > 0 && (
          <div className="chart-container section-gap">
            <h3>🏆 年度收入分类 TOP 8</h3>
            <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {yearlyData.incomeCategories.map((cat, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <span>{cat.emoji} {cat.category}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--income-color)' }}>¥{cat.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <ToastContainer toasts={toasts} />

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
            onClick={() => {
              setLoading(true);
              setActiveError('');
              setTab(t.key);
            }}
            id={`tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 图表内容 */}
      {loading ? (
        <div className="loading-state">加载中...</div>
      ) : activeError ? (
        <div className="empty-state">
          <p>{activeError}</p>
        </div>
      ) : (
        <>
          {tab === 'weekly' && renderWeekly()}
          {tab === 'monthly' && renderMonthly()}
          {tab === 'yearly' && renderYearly()}
        </>
      )}

      {/* 导出按钮 */}
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <button className="btn btn-primary" onClick={handleExport} id="btn-export-report">
          📥 导出为 Excel
        </button>
      </div>
    </div>
  );
}
