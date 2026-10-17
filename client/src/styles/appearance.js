// 界面外观的唯一入口：明暗主题 + 界面风格，都体现为 <html> 上的属性。
//   data-theme：永远是解析后的 light / dark（「跟随系统」在这里按系统设置换算）
//   data-style：anime / space / classic
// index.html 里有一段内联脚本在 CSS 生效前做同样的事，防止首屏闪烁；两边逻辑要保持一致。
import { resolveStyle } from './registry';

const THEME_KEY = 'theme';     // 存用户选的档位：system / light / dark
const STYLE_KEY = 'uiStyle';   // 存上次登录账号的风格，登录页和刷新时沿用
const THEME_PREFS = ['system', 'light', 'dark'];

const hasDocument = typeof document !== 'undefined';
const darkQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

// 隐私模式、存储被禁用时 localStorage 会抛错，读不到就当没有
function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* 存不了不影响当前页面 */ }
}

export function resolveTheme(pref, systemIsDark) {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemIsDark ? 'dark' : 'light';
}

export function getThemePref() {
  const pref = readStorage(THEME_KEY);
  return THEME_PREFS.includes(pref) ? pref : 'system';
}

function applyTheme() {
  if (!hasDocument) return;
  document.documentElement.setAttribute('data-theme', resolveTheme(getThemePref(), darkQuery?.matches));
}

export function setThemePref(pref) {
  writeStorage(THEME_KEY, THEME_PREFS.includes(pref) ? pref : 'system');
  applyTheme();
}

export function getStyleId() {
  return resolveStyle(readStorage(STYLE_KEY));
}

// persist: false 用于注册页的实时预览——只换外观，不记住
export function applyStyle(id, { persist = true } = {}) {
  const styleId = resolveStyle(id);
  if (persist) writeStorage(STYLE_KEY, styleId);
  if (hasDocument) document.documentElement.setAttribute('data-style', styleId);
  return styleId;
}

let listening = false;

// main.jsx 在 React 渲染前调用
export function initAppearance() {
  applyTheme();
  applyStyle(getStyleId(), { persist: false });
  if (darkQuery && !listening) {
    // 选了「跟随系统」时，系统切换深浅色立即生效
    darkQuery.addEventListener('change', applyTheme);
    listening = true;
  }
}
