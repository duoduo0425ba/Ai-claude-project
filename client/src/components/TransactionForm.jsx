import { useState } from 'react';
import CategoryPicker from './CategoryPicker';
import TagPicker from './TagPicker';
import { addTransaction } from '../api';
import { formatLocalDate } from '../utils/date';

export default function TransactionForm({ onSuccess }) {
  const today = formatLocalDate();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [emoji, setEmoji] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState([]);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      onSuccess?.('请输入有效金额 😅', 'error');
      return;
    }
    if (!category) {
      onSuccess?.('请选择分类 🐱', 'error');
      return;
    }

    setLoading(true);
    try {
      await addTransaction({
        type,
        amount: parseFloat(amount),
        category,
        emoji,
        note,
        tags,
        date,
      });
      // 成功，重置表单
      setAmount('');
      setCategory('');
      setEmoji('');
      setNote('');
      setTags([]);
      setDate(today);
      onSuccess?.('记账成功啦~ 🎉', 'success');
    } catch (err) {
      onSuccess?.(err.message || '保存失败 😢', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card section-gap animate-slide-up">
      <h3 style={{ fontSize: '0.95rem', marginBottom: '16px', textAlign: 'center' }}>
        ✨ 快速记账
      </h3>

      {/* 收入/支出切换 */}
      <div className="type-toggle section-gap">
        <button
          className={type === 'expense' ? 'active-expense' : ''}
          onClick={() => { setType('expense'); setCategory(''); setEmoji(''); }}
          id="toggle-expense"
        >
          💸 支出
        </button>
        <button
          className={type === 'income' ? 'active-income' : ''}
          onClick={() => { setType('income'); setCategory(''); setEmoji(''); }}
          id="toggle-income"
        >
          💰 收入
        </button>
      </div>

      {/* 分类选择 */}
      <div className="form-group">
        <label>分类</label>
        <CategoryPicker
          type={type}
          selected={category}
          onSelect={(cat) => { setCategory(cat.name); setEmoji(cat.emoji); }}
        />
      </div>

      {/* 金额输入 */}
      <div className="form-group">
        <label>金额 (¥)</label>
        <input
          type="number"
          className="input-field"
          placeholder="请输入金额..."
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0"
          step="0.01"
          id="input-amount"
        />
      </div>

      {/* 备注 */}
      <div className="form-group">
        <label>备注</label>
        <input
          type="text"
          className="input-field"
          placeholder="写点什么吧..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          id="input-note"
        />
      </div>

      {/* 标签 */}
      <div className="form-group">
        <label>标签 (可选)</label>
        <TagPicker value={tags} onChange={setTags} />
      </div>

      {/* 日期 */}
      <div className="form-group">
        <label>日期</label>
        <input
          type="date"
          className="input-field"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          id="input-date"
        />
      </div>

      {/* 提交按钮 */}
      <button
        className={`btn ${type === 'income' ? 'btn-income' : 'btn-expense'}`}
        style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}
        onClick={handleSubmit}
        disabled={loading}
        id="btn-submit"
      >
        {loading ? '保存中...' : `记一笔 ${type === 'income' ? '收入' : '支出'} ✨`}
      </button>
    </div>
  );
}
