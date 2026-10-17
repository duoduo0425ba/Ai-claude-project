import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexCss, tokensOf } from '../test-utils/cssTokens';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const root = tokensOf(':root');
const animeDark = tokensOf('html[data-style="anime"][data-theme="dark"]');

// 递归列出 src 下的 .js / .jsx 源文件（不含测试）
function sourceFiles(dir = SRC) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.jsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

describe('样式令牌', () => {
  it('深色块只覆盖 :root 里已有的令牌，不能凭空新增', () => {
    const extra = Object.keys(animeDark).filter((name) => !(name in root));
    expect(extra).toEqual([]);
  });

  it('CSS 和组件里用到的每个 var(--x) 都在 :root 里有定义', () => {
    const texts = [indexCss, ...sourceFiles().map((f) => readFileSync(f, 'utf8'))];
    const used = new Set(texts.flatMap((t) => [...t.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])));
    const undefinedVars = [...used].filter((name) => !(name in root));
    expect(undefinedVars).toEqual([]);
  });

  it('组件样式里没有写死的颜色，颜色只出现在令牌块里', () => {
    const rules = indexCss
      .replace(/:root\s*\{[^}]*\}/, '')
      .replace(/html\[data-style="[\w-]+"\](\[data-theme="dark"\])?\s*\{[^}]*\}/g, '');
    // white/black 只算颜色值，不算 white-space 这类属性名
    const literals = rules.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?<![-\w])(white|black)(?![-\w])/g) || [];
    expect(literals).toEqual([]);
  });

  it('旧的色板名（樱花粉、薰衣草、薄荷）不再出现', () => {
    expect(indexCss).not.toMatch(/sakura-pink|lavender|--mint/);
  });

  it('深浅色由 JS 解析成 data-theme，CSS 里不再用 prefers-color-scheme', () => {
    expect(indexCss).not.toMatch(/prefers-color-scheme/);
  });

  it('图表令牌都是 Chart.js 认得的 hex 或 rgb(a) 写法', () => {
    const chartTokens = Object.entries({ ...root, ...animeDark }).filter(([name]) => name.startsWith('--chart-'));
    expect(chartTokens.length).toBeGreaterThan(10);
    for (const [name, value] of chartTokens) {
      expect({ name, ok: /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,]+\))$/.test(value) }).toEqual({ name, ok: true });
    }
  });
});
