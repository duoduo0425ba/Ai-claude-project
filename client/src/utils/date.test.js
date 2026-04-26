import { describe, it, expect } from 'vitest';
import { formatLocalDate } from './date';

describe('formatLocalDate', () => {
  it('正确格式化给定日期', () => {
    const date = new Date(2026, 3, 26); // 2026年4月26日
    expect(formatLocalDate(date)).toBe('2026-04-26');
  });

  it('月份和日期补零', () => {
    const date = new Date(2026, 0, 5); // 2026年1月5日
    expect(formatLocalDate(date)).toBe('2026-01-05');
  });

  it('不传参数时返回 YYYY-MM-DD 格式', () => {
    const result = formatLocalDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('月末最后一天格式正确', () => {
    const date = new Date(2026, 1, 28); // 2026年2月28日
    expect(formatLocalDate(date)).toBe('2026-02-28');
  });
});
