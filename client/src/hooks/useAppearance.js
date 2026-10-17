import { useSyncExternalStore } from 'react';
import { getAppearance, subscribeAppearance } from '../styles/appearance';

// 当前生效的外观 { theme: 'light' | 'dark', style }，外观变化时组件自动重新渲染
export function useAppearance() {
  return useSyncExternalStore(subscribeAppearance, getAppearance);
}
