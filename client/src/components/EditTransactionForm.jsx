import { useState, useEffect } from 'react';
import CategoryPicker from './CategoryPicker';
import TagPicker from './TagPicker';
import { updateTransaction } from '../api';

export default function EditTransactionForm({ transaction, onSuccess, onCancel }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [emoji, setEmoji] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount);
      setCategory(transaction.category);
      setEmoji(transaction.emoji);
      setNote(transaction.note || '');
      setTags(transaction.tags || []);
      setDate(transaction.date);
    }
  }, [transaction]);

  // 快捷键支持 (Escape 关闭)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

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
      await updateTransaction(transaction.id, {
        type,
        amount: parseFloat(amount),
        category,
        emoji,
        note,
        tags, // PUT 是全量替换：漏传会清空该笔交易的标签
        date,
      });
      onSuccess?.('更新成功 ✨', 'success');
      onCancel?.();
    } catch (err) {
      onSuccess?.(err.message || '更新失败 😢', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '0.95rem', marginBottom: '16px', textAlign: 'center' }}>
        ✏️ 编辑记录
      </h3>

      {/* 收入/支出切换 */}
      <div className="type-toggle section-gap">
        <button
          className={type === 'expense' ? 'active-expense' : ''}
          onClick={() => { setType('expense'); setCategory(''); setEmoji(''); }}
          id="edit-toggle-expense"
        >
          💸 支出
        </button>
        <button
          className={type === 'income' ? 'active-income' : ''}
          onClick={() => { setType('income'); setCategory(''); setEmoji(''); }}
          id="edit-toggle-income"
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
          id="edit-input-amount"
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
          id="edit-input-note"
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
          id="edit-input-date"
        />
      </div>

      {/* 按钮 */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <button
          className="btn btn-ghost"
          style={{ flex: 1 }}
          onClick={onCancel}
          id="edit-btn-cancel"
        >
          取消
        </button>
        <button
          className={`btn ${type === 'income' ? 'btn-income' : 'btn-expense'}`}
          style={{ flex: 1 }}
          onClick={handleSubmit}
          disabled={loading}
          id="edit-btn-submit"
        >
          {loading ? '保存中...' : '保存修改'}
        </button>
      </div>
    </div>
  );
}
