// 报表图表的配色和字体。Chart.js 画在 canvas 上，用不了 CSS 变量，
// 所以从 index.css 的 --chart-* 令牌读出具体颜色再交给它；切换深浅色或界面风格时重新读取。
import { getAppearance, subscribeAppearance } from './appearance';

const PIE_COLOR_COUNT = 10;

export function readChartTheme(root = document.documentElement) {
  const style = getComputedStyle(root);
  const token = (name) => style.getPropertyValue(`--${name}`).trim();
  return {
    income: token('chart-income'),
    incomeBg: token('chart-income-bg'),
    expense: token('chart-expense'),
    expenseBg: token('chart-expense-bg'),
    text: token('chart-text'),
    tick: token('chart-tick'),
    grid: token('chart-grid'),
    tooltipBg: token('chart-tooltip-bg'),
    tooltipText: token('chart-tooltip-text'),
    tooltipBorder: token('chart-tooltip-border'),
    pieBorder: token('chart-pie-border'),
    pie: Array.from({ length: PIE_COLOR_COUNT }, (_, i) => token(`chart-${i + 1}`)),
    font: token('font-main'),
  };
}

// 柱状图/折线图共用的 common，饼图用 pie
export function buildChartOptions(colors) {
  const font = (size) => (size ? { family: colors.font, size } : { family: colors.font });
  const tooltip = {
    backgroundColor: colors.tooltipBg,
    titleColor: colors.tooltipText,
    bodyColor: colors.tooltipText,
    borderColor: colors.tooltipBorder,
    borderWidth: 1,
  };
  const common = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { labels: { font: font(12), color: colors.text } },
      tooltip: {
        ...tooltip,
        titleFont: font(),
        bodyFont: font(),
        callbacks: {
          label: (ctx) => `¥${ctx.parsed.y?.toFixed(2) ?? ctx.parsed?.toFixed(2) ?? ctx.raw}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { font: font(11), color: colors.tick },
        grid: { display: false },
      },
      y: {
        ticks: { font: font(11), color: colors.tick, callback: (v) => `¥${v}` },
        grid: { color: colors.grid },
      },
    },
  };
  const pie = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position: 'bottom', labels: { font: font(12), color: colors.text, padding: 12 } },
      tooltip: {
        ...tooltip,
        bodyFont: font(),
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
  return { common, pie };
}

// 外观不变就复用同一个对象，图表不会无谓重绘
let cachedFor = null;
let cached = null;

export function getChartTheme() {
  const appearance = getAppearance();
  if (appearance !== cachedFor) {
    const colors = readChartTheme();
    cached = { colors, ...buildChartOptions(colors) };
    cachedFor = appearance;
  }
  return cached;
}

export { subscribeAppearance as subscribeChartTheme };
