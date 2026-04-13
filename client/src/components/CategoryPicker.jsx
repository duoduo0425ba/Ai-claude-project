import { useState, useEffect } from 'react';
import { getCategories } from '../api';

const EXPENSE_CATEGORIES = [
  { name: '餐饮', emoji: '🍜' },
  { name: '零食', emoji: '🍡' },
  { name: '文具', emoji: '📚' },
  { name: '交通', emoji: '🚌' },
  { name: '娱乐', emoji: '🎮' },
  { name: '礼物', emoji: '🎁' },
  { name: '服饰', emoji: '👗' },
  { name: '其他', emoji: '✨' },
];

const INCOME_CATEGORIES = [
  { name: '零花钱', emoji: '💰' },
  { name: '红包', emoji: '🧧' },
  { name: '劳动所得', emoji: '💪' },
  { name: '奖励', emoji: '🏆' },
  { name: '其他', emoji: '🌟' },
];

export default function CategoryPicker({ type, selected, onSelect }) {
  const [categories, setCategories] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fallback = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    getCategories(type)
      .then((res) => {
        if (isMounted) {
          // 转换 API 响应格式（忽略 id 和 is_default）
          const data = res.data.map((cat) => ({
            name: cat.name,
            emoji: cat.emoji,
          }));
          setCategories(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          // API 失败时使用硬编码列表
          setCategories(null); // 重置为null，使用fallback
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [type]);

  const items = categories || fallback;

  return (
    <div className="category-grid">
      {items.map((cat) => (
        <div
          key={cat.name}
          className={`category-item ${selected === cat.name ? 'selected' : ''}`}
          onClick={() => onSelect(cat)}
          id={`cat-${cat.name}`}
        >
          <span className="cat-emoji">{cat.emoji}</span>
          <span>{cat.name}</span>
        </div>
      ))}
    </div>
  );
}

export { EXPENSE_CATEGORIES, INCOME_CATEGORIES };
