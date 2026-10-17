import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexCss, readCss, tokensOf, componentRules } from '../test-utils/cssTokens';
import { STYLE_IDS, DEFAULT_STYLE } from './registry';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const root = tokensOf(':root');
const animeDark = tokensOf('html[data-style="anime"][data-theme="dark"]');
const OTHER_STYLES = STYLE_IDS.filter((id) => id !== DEFAULT_STYLE);
const styleCss = Object.fromEntries(OTHER_STYLES.map((id) => [id, readCss(`styles/${id}.css`)]));
const allCss = [indexCss, readCss('styles/fonts.css'), ...Object.values(styleCss)].filter(Boolean);

// 递归列出 src 下的 .js / .jsx 源文件（不含测试）
function sourceFiles(dir = SRC) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.jsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

const missingFrom = (block, required) => Object.keys(required).filter((name) => !(name in block));
const extraIn = (block) => Object.keys(block).filter((name) => !(name in root));

describe('样式令牌', () => {
  it('二次元深色块只覆盖 :root 里已有的令牌，不能凭空新增', () => {
    expect(extraIn(animeDark)).toEqual([]);
  });

  it('CSS 和组件里用到的每个 var(--x) 都在 :root 里有定义', () => {
    const texts = [...allCss, ...sourceFiles().map((f) => readFileSync(f, 'utf8'))];
    const used = new Set(texts.flatMap((t) => [...t.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])));
    expect([...used].filter((name) => !(name in root))).toEqual([]);
  });

  it('组件样式里没有写死的颜色，颜色只出现在令牌块里', () => {
    for (const css of allCss) {
      // white/black 只算颜色值，不算 white-space 这类属性名
      const literals = componentRules(css).match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?<![-\w])(white|black)(?![-\w])/g) || [];
      expect(literals).toEqual([]);
    }
  });

  it('旧的色板名（樱花粉、薰衣草、薄荷）不再出现', () => {
    expect(indexCss).not.toMatch(/sakura-pink|lavender|--mint/);
  });

  it('深浅色由 JS 解析成 data-theme，CSS 里不再用 prefers-color-scheme', () => {
    for (const css of allCss) expect(css).not.toMatch(/prefers-color-scheme/);
  });

  it('图表令牌都是 Chart.js 认得的 hex 或 rgb(a) 写法', () => {
    const blocks = [root, animeDark, ...OTHER_STYLES.flatMap((id) => [
      tokensOf(`html[data-style="${id}"]`, styleCss[id]),
      tokensOf(`html[data-style="${id}"][data-theme="dark"]`, styleCss[id]),
    ])];
    for (const block of blocks) {
      for (const [name, value] of Object.entries(block).filter(([n]) => n.startsWith('--chart-'))) {
        expect({ name, ok: /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,]+\))$/.test(value) }).toEqual({ name, ok: true });
      }
    }
  });
});

describe.each(OTHER_STYLES)('风格 %s', (id) => {
  it('有自己的样式文件，并在 index.css 里引入', () => {
    expect(styleCss[id]).not.toBeNull();
    expect(indexCss).toContain(`@import './styles/${id}.css';`);
  });

  it('浅色块写全了 :root 的所有令牌，没有多出 :root 里没有的', () => {
    // 漏写的令牌会沿用二次元的值，比如星际风格里冒出粉色
    const light = tokensOf(`html[data-style="${id}"]`, styleCss[id]);
    expect(missingFrom(light, root)).toEqual([]);
    expect(extraIn(light)).toEqual([]);
  });

  it('深色块至少覆盖二次元深色会变的那些令牌，没有多出 :root 里没有的', () => {
    const dark = tokensOf(`html[data-style="${id}"][data-theme="dark"]`, styleCss[id]);
    expect(missingFrom(dark, animeDark)).toEqual([]);
    expect(extraIn(dark)).toEqual([]);
  });
});

describe('首屏防闪烁脚本', () => {
  it('index.html 内联脚本认识所有非默认风格', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    for (const id of OTHER_STYLES) expect(script).toContain(`'${id}'`);
  });
});
