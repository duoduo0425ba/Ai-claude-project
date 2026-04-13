import { useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings, getCategories, addCategory, deleteCategory } from '../api/index';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    monthly_income: 300,
    warn_threshold: 200,
    danger_threshold: 270,
    initial_balance: 0
  });
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // 分类管理
  const [categoryTab, setCategoryTab] = useState('expense');
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchCategories('expense');
  }, []);

  useEffect(() => {
    fetchCategories(categoryTab);
  }, [categoryTab]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await getSettings();
      setSettings(res.data);
      setHasChanges(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async (type) => {
    try {
      setLoadingCategories(true);
      const res = await getCategories(type);
      setCategories(res.data || []);
    } catch (err) {
      showToast(err.message, 'error');
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateSettings(settings);
      showToast('设置已保存', 'success');
      setHasChanges(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleReset = () => {
    fetchSettings();
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast('分类名称不能为空', 'error');
      return;
    }
    if (!newCategoryEmoji.trim()) {
      showToast('分类表情不能为空', 'error');
      return;
    }

    try {
      await addCategory({
        type: categoryTab,
        name: newCategoryName.trim(),
        emoji: newCategoryEmoji.trim()
      });
      showToast('分类已添加', 'success');
      setNewCategoryName('');
      setNewCategoryEmoji('');
      fetchCategories(categoryTab);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('确认删除此分类？')) return;
    try {
      await deleteCategory(id);
      showToast('分类已删除', 'success');
      fetchCategories(categoryTab);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="page">
      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      )}

      <div className="page-header">
        <h1>⚙️ 设置</h1>
        <p>个性化你的记账体验</p>
      </div>

      {loading ? (
        <div className="loading-state">
          <p>加载中...</p>
        </div>
      ) : (
        <div className="settings-container">
          {/* 基础设置 */}
          <div className="settings-group">
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '12px' }}>💰 预算设置</h2>
            <div className="setting-item">
              <label>月零花钱额度 (¥)</label>
              <input
                type="number"
                name="monthly_income"
                value={settings.monthly_income}
                onChange={handleInputChange}
                min="0"
                step="0.01"
              />
              <p className="setting-desc">用于计算预算进度和剩余金额</p>
            </div>

            <div className="setting-item">
              <label>预警阈值 (¥)</label>
              <input
                type="number"
                name="warn_threshold"
                value={settings.warn_threshold}
                onChange={handleInputChange}
                min="0"
                step="0.01"
              />
              <p className="setting-desc">花费达到此金额时显示预警</p>
            </div>

            <div className="setting-item">
              <label>危险阈值 (¥)</label>
              <input
                type="number"
                name="danger_threshold"
                value={settings.danger_threshold}
                onChange={handleInputChange}
                min="0"
                step="0.01"
              />
              <p className="setting-desc">花费达到此金额时显示危险提示</p>
            </div>

            <div className="setting-item">
              <label>初始结余 (¥)</label>
              <input
                type="number"
                name="initial_balance"
                value={settings.initial_balance}
                onChange={handleInputChange}
                step="0.01"
              />
              <p className="setting-desc">此金额将计入总余额计算，代表开始记账前的已有存款</p>
            </div>
          </div>

          <div className="settings-actions">
            {hasChanges && (
              <>
                <button className="btn-primary" onClick={handleSave}>
                  ✓ 保存设置
                </button>
                <button className="btn-secondary" onClick={handleReset}>
                  ↺ 取消
                </button>
              </>
            )}
            {!hasChanges && (
              <p className="no-changes-tip">无待保存的更改</p>
            )}
          </div>

          {/* 分类管理 */}
          <div className="settings-group">
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '12px' }}>📁 自定义分类</h2>

            <div className="category-tabs">
              <button
                className={`category-tab ${categoryTab === 'expense' ? 'active' : ''}`}
                onClick={() => setCategoryTab('expense')}
              >
                支出分类
              </button>
              <button
                className={`category-tab ${categoryTab === 'income' ? 'active' : ''}`}
                onClick={() => setCategoryTab('income')}
              >
                收入分类
              </button>
            </div>

            {loadingCategories ? (
              <div className="loading-state" style={{ fontSize: '0.9rem' }}>加载中...</div>
            ) : (
              <>
                <div className="category-list">
                  {categories.map((cat) => (
                    <div key={cat.id} className={`category-list-item ${cat.is_default ? 'default' : ''}`}>
                      <div>
                        <span className="emoji">{cat.emoji}</span>
                        <span className="name">{cat.name}</span>
                      </div>
                      {!cat.is_default && (
                        <button
                          className="btn btn-danger delete-btn"
                          onClick={() => handleDeleteCategory(cat.id)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="category-add-form">
                  <input
                    type="text"
                    placeholder="表情"
                    maxLength="2"
                    value={newCategoryEmoji}
                    onChange={(e) => setNewCategoryEmoji(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="分类名称"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <button onClick={handleAddCategory}>
                    + 添加
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
