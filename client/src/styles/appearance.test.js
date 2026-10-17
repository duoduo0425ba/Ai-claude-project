import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveTheme, getThemePref, setThemePref, getStyleId, applyStyle } from './appearance';

// 测试环境是 node，没有浏览器存储，用一个 Map 模拟
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveTheme', () => {
  it('选了浅色或深色就照用，不管系统设置', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('跟随系统时按系统设置换算', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('明暗档位', () => {
  it('没存过或存了奇怪的值，按「跟随系统」处理', () => {
    expect(getThemePref()).toBe('system');
    localStorage.setItem('theme', 'purple');
    expect(getThemePref()).toBe('system');
  });

  it('设置后能读回来', () => {
    setThemePref('dark');
    expect(getThemePref()).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});

describe('界面风格', () => {
  it('applyStyle 默认记住风格，下次 getStyleId 读到它', () => {
    expect(applyStyle('space')).toBe('space');
    expect(getStyleId()).toBe('space');
  });

  it('persist: false 只换外观，不改记住的风格（注册页预览用）', () => {
    applyStyle('classic');
    applyStyle('space', { persist: false });
    expect(getStyleId()).toBe('classic');
  });

  it('未知风格按二次元处理', () => {
    expect(applyStyle('hello')).toBe('anime');
    expect(getStyleId()).toBe('anime');
  });

  it('浏览器禁用存储时不报错，按默认值处理', () => {
    const broken = () => { throw new Error('存储不可用'); };
    vi.stubGlobal('localStorage', { getItem: broken, setItem: broken, removeItem: broken });
    expect(() => applyStyle('space')).not.toThrow();
    expect(getStyleId()).toBe('anime');
    expect(getThemePref()).toBe('system');
  });
});
