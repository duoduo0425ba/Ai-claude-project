import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { STYLE_IDS, DEFAULT_STYLE, resolveStyle } from './registry';

describe('resolveStyle', () => {
  it('认识的风格原样返回', () => {
    for (const id of STYLE_IDS) expect(resolveStyle(id)).toBe(id);
  });

  it('不认识的值、空值都回退到二次元', () => {
    expect(DEFAULT_STYLE).toBe('anime');
    for (const bad of ['hello', '', null, undefined, 'ANIME']) {
      expect(resolveStyle(bad)).toBe('anime');
    }
  });
});

describe('前后端的风格清单', () => {
  it('与 server/routes/auth.js 的 UI_STYLES 完全一致', () => {
    const source = readFileSync(new URL('../../../server/routes/auth.js', import.meta.url), 'utf8');
    const match = source.match(/const UI_STYLES = \[([^\]]*)\]/);
    expect(match).not.toBeNull();
    const serverIds = match[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
    expect(serverIds).toEqual(STYLE_IDS);
  });
});
