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
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="category-grid">
      {categories.map((cat) => (
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
