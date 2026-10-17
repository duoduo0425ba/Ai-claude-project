import { describe, it, expect, afterEach, vi } from 'vitest';
import { readChartTheme, buildChartOptions } from './chartTheme';
import { tokensOf } from '../test-utils/cssTokens';

afterEach(() => {
  vi.unstubAllGlobals();
});

// 用 index.css 里的真实令牌值模拟 getComputedStyle（浏览器返回的值前面常带空格）
function stubComputedStyle(tokens) {
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (name) => (name in tokens ? ` ${tokens[name]}` : '') }));
}

describe('readChartTheme', () => {
  it('浅色二次元：读出的值和原来写死在 ReportPage 里的完全一样', () => {
    stubComputedStyle(tokensOf(':root'));
    const colors = readChartTheme({});
    expect(colors).toMatchObject({
      income: 'rgba(107, 196, 168, 0.8)',
      incomeBg: 'rgba(107, 196, 168, 0.2)',
      expense: 'rgba(232, 134, 155, 0.8)',
      expenseBg: 'rgba(232, 134, 155, 0.2)',
      text: '#7A6B7A',
      tick: '#A89BA8',
      grid: 'rgba(200, 162, 200, 0.1)',
      tooltipBg: 'rgba(255, 255, 255, 0.9)',
      tooltipText: '#4A3B4A',
      tooltipBorder: '#E0CDE0',
      pieBorder: '#FFFFFF',
    });
    expect(colors.pie).toEqual(['#FFB7C5', '#C8A2C8', '#98D8C8', '#FFD93D', '#A8E6CF',
      '#DDA0DD', '#87CEEB', '#F0E68C', '#FFA07A', '#E0BBE4']);
    expect(colors.font).toContain('ZCOOL KuaiLe');
  });

  it('深色二次元：文字、网格、提示框、饼图描边换成深色配色，其余沿用浅色', () => {
    stubComputedStyle({ ...tokensOf(':root'), ...tokensOf('html[data-style="anime"][data-theme="dark"]') });
    const colors = readChartTheme({});
    expect(colors.text).toBe('#B8B8C8');
    expect(colors.tooltipBg).toBe('rgba(35, 35, 41, 0.95)');
    expect(colors.pieBorder).toBe('#232329');
    expect(colors.income).toBe('rgba(107, 196, 168, 0.8)');
  });

  it('每个字段都能读到值（令牌改名或漏写时这里会失败）', () => {
    stubComputedStyle(tokensOf(':root'));
    const colors = readChartTheme({});
    const empty = Object.entries(colors).filter(([, v]) => v === '' || (Array.isArray(v) && v.includes('')));
    expect(empty).toEqual([]);
  });
});

describe('buildChartOptions', () => {
  const colors = {
    income: 'I', incomeBg: 'IB', expense: 'E', expenseBg: 'EB', text: 'T', tick: 'K', grid: 'G',
    tooltipBg: 'TB', tooltipText: 'TT', tooltipBorder: 'TO', pieBorder: 'P', pie: [], font: 'F',
  };
  const { common, pie } = buildChartOptions(colors);

  it('柱状图、折线图的图例、刻度、网格、提示框都用传入的配色和字体', () => {
    expect(common.plugins.legend.labels).toEqual({ font: { family: 'F', size: 12 }, color: 'T' });
    expect(common.scales.x.ticks).toEqual({ font: { family: 'F', size: 11 }, color: 'K' });
    expect(common.scales.y.ticks.color).toBe('K');
    expect(common.scales.y.grid.color).toBe('G');
    expect(common.plugins.tooltip).toMatchObject({ backgroundColor: 'TB', titleColor: 'TT', bodyColor: 'TT', borderColor: 'TO' });
    expect(common.scales.y.ticks.callback(50)).toBe('¥50');
  });

  it('饼图图例在下方，提示框显示金额和占比', () => {
    expect(pie.plugins.legend).toMatchObject({ position: 'bottom', labels: { color: 'T', padding: 12 } });
    const label = pie.plugins.tooltip.callbacks.label({ dataset: { data: [1, 3] }, raw: 1, label: '餐饮' });
    expect(label).toBe('餐饮: ¥1.00 (25.0%)');
  });
});
