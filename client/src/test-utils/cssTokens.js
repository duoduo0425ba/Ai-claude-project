// 测试用：读取样式文件，按选择器取出令牌块。只给 *.test.js 用，应用代码不要引用
import { existsSync, readFileSync } from 'node:fs';

// 读 src 下的 CSS 文件并去掉注释（免得注释里的字眼干扰检查）；文件不存在返回 null
export function readCss(pathFromSrc) {
  const url = new URL(`../${pathFromSrc}`, import.meta.url);
  if (!existsSync(url)) return null;
  return readFileSync(url, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

export const indexCss = readCss('index.css');

const escape = (s) => s.replace(/[[\]().*+?^$|\\]/g, '\\$&');

// 取出某个选择器（必须完全一致）下的全部令牌：{ '--accent': '#FFB7C5', ... }
export function tokensOf(selector, css = indexCss) {
  const match = css.match(new RegExp(`(?:^|[;}])\\s*${escape(selector)}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`找不到选择器：${selector}`);
  return Object.fromEntries([...match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

// 去掉所有令牌块（:root 和 html[data-style=…] 开头的块），剩下的就是组件样式
export function componentRules(css) {
  return css
    .replace(/:root\s*\{[^}]*\}/g, '')
    .replace(/html\[data-style="[\w-]+"\](\[data-theme="dark"\])?\s*\{[^}]*\}/g, '');
}
