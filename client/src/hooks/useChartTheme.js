import { useSyncExternalStore } from 'react';
import { getChartTheme, subscribeChartTheme } from '../styles/chartTheme';

// 返回 { colors, common, pie }：当前外观下的图表配色和 Chart.js 配置，切换深浅色时自动更新
export function useChartTheme() {
  return useSyncExternalStore(subscribeChartTheme, getChartTheme);
}
