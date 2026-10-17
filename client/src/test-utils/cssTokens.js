// 测试用：读取 index.css，按选择器取出令牌块。只给 *.test.js 用，应用代码不要引用
import { readFileSync } from 'node:fs';

export const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ''); // 去掉注释，免得注释里的字眼干扰检查

const escape = (s) => s.replace(/[[\]().*+?^$|\\]/g, '\\$&');

// 取出某个选择器（必须完全一致）下的全部令牌：{ '--accent': '#FFB7C5', ... }
export function tokensOf(selector) {
  const match = indexCss.match(new RegExp(`(?:^|[;}])\\s*${escape(selector)}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`index.css 里找不到选择器：${selector}`);
  return Object.fromEntries([...match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
