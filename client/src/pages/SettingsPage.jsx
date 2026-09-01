import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSettings, updateSettings, getCategories, addCategory, deleteCategory,
  getRecurringTemplates, addRecurringTemplate, deleteRecurringTemplate, toggleRecurringTemplate, generateRecurring,
  getTransactions, batchImport, changePassword, getUsers, deleteUser,
  getCategoryBudgets, setCategoryBudget, deleteCategoryBudget,
} from '../api/index';
import { formatLocalDate } from '../utils/date';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function getCurrentUser() {
  const token = sessionStorage.getItem('token');
  if (!token) return null;
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');

  const handleThemeChange = (val) => {
    setTheme(val);
    localStorage.setItem('theme', val);
    if (val === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (val === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  };
  const [settings, setSettings] = useState({
    monthly_income: 300,
    warn_threshold: 200,
    danger_threshold: 270,
    initial_balance: 0
  });
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // 周期账单
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({
    type: 'expense', amount: '', category: '', emoji: '',
    note: '', frequency: 'monthly', day_of_month: '1', day_of_week: '0',
  });
  const [recurringCategories, setRecurringCategories] = useState([]);

  // 分类预算
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [budgetInputs, setBudgetInputs] = useState({});

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

  const fetchSettings = useCallback(async () => {
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
  }, [showToast]);

  const fetchBudgetData = useCallback(async () => {
    try {
      const [catsRes, budgetsRes] = await Promise.all([
        getCategories('expense'),
        getCategoryBudgets(),
      ]);
      const cats = catsRes.data || [];
      const savedBudgets = budgetsRes.data || [];
      setBudgetCategories(cats);
      const inputs = {};
      savedBudgets.forEach(b => { inputs[b.category] = String(b.amount); });
      setBudgetInputs(inputs);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  const fetchCategories = useCallback(async (type) => {
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
  }, [showToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchBudgetData();
  }, [fetchBudgetData]);

  useEffect(() => {
    fetchCategories(categoryTab);
  }, [categoryTab, fetchCategories]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        monthly_income: parseFloat(settings.monthly_income) || 0,
        warn_threshold: parseFloat(settings.warn_threshold) || 0,
        danger_threshold: parseFloat(settings.danger_threshold) || 0,
        initial_balance: parseFloat(settings.initial_balance) || 0,
      };
      await updateSettings(payload);
      showToast('设置已保存', 'success');
      setHasChanges(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleReset = () => {
    fetchSettings();
  };

  const handleSaveCategoryBudget = async (category) => {
    const val = parseFloat(budgetInputs[category]);
    if (!val || val <= 0) { showToast('请输入有效金额', 'error'); return; }
    try {
      await setCategoryBudget(category, val);
      showToast(`已设置「${category}」预算 ¥${val}`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleClearCategoryBudget = async (category) => {
    try {
      await deleteCategoryBudget(category);
      setBudgetInputs(prev => { const n = { ...prev }; delete n[category]; return n; });
      showToast(`已清除「${category}」预算`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ── 周期账单 ──────────────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await getRecurringTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    getCategories(newTemplate.type)
      .then(res => setRecurringCategories(res.data || []))
      .catch(() => setRecurringCategories([]));
  }, [newTemplate.type]);

  const handleAddTemplate = async () => {
    const { type, amount, category, emoji, note, frequency, day_of_month, day_of_week } = newTemplate;
    if (!category.trim()) { showToast('请选择分类', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0) { showToast('请填写有效金额', 'error'); return; }

    try {
      await addRecurringTemplate({
        type, amount, category: category.trim(), emoji: emoji.trim(), note: note.trim(),
        frequency,
        day_of_month: frequency === 'monthly' ? parseInt(day_of_month) : null,
        day_of_week: frequency === 'weekly' ? parseInt(day_of_week) : null,
      });
      showToast('周期账单已添加 🔄');
      setNewTemplate({ type: 'expense', amount: '', category: '', emoji: '', note: '', frequency: 'monthly', day_of_month: '1', day_of_week: '0' });
      fetchTemplates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('确认删除此周期账单？')) return;
    try {
      await deleteRecurringTemplate(id);
      showToast('已删除');
      fetchTemplates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 可逆操作，不弹 confirm（与删除不同）
  const handleToggleTemplate = async (t) => {
    try {
      await toggleRecurringTemplate(t.id, t.is_active ? 0 : 1);
      showToast(t.is_active ? '已暂停 ⏸️' : '已恢复 ▶️');
      fetchTemplates();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleManualGenerate = async () => {
    try {
      const res = await generateRecurring();
      showToast(res.generated > 0 ? `已生成 ${res.generated} 条记录 ✅` : '暂无需要生成的账单');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ── 数据备份 ──────────────────────────────────────────────────────────────

  const handleBackup = async () => {
    try {
      const [transRes, settingsRes] = await Promise.all([getTransactions({}), getSettings()]);
      const backup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        transactions: transRes.data,
        settings: settingsRes.data,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `零花钱备份_${formatLocalDate().replace(/-/g, '')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('备份成功 💾');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!Array.isArray(backup.transactions)) {
        showToast('备份文件格式无效', 'error');
        return;
      }
      if (!confirm(`将导入 ${backup.transactions.length} 条记录，确认继续？`)) return;
      const res = await batchImport(backup.transactions);
      if (backup.settings) await updateSettings(backup.settings);
      if (res.skippedCount) {
        showToast(`恢复完成，导入 ${res.imported} 条，跳过 ${res.skippedCount} 条格式有误的记录 ⚠️`, 'warn');
      } else {
        showToast(`恢复成功，导入 ${res.imported} 条记录 🎉`);
      }
      fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
    e.target.value = '';
  };

  // ── 账号管理 ──────────────────────────────────────────────────────────────

  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [users, setUsers] = useState([]);

  const fetchUsers = useCallback(async () => {
    if (currentUser?.role !== 'admin') return;
    try {
      const res = await getUsers();
      setUsers(res.data || []);
    } catch { /* 非 admin 时会 403，静默处理 */ }
  }, [currentUser?.role]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleChangePassword = async () => {
    if (pwForm.newPassword !== pwForm.confirm) {
      showToast('两次密码不一致', 'error'); return;
    }
    try {
      await changePassword({ oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword });
      showToast('密码已修改，请重新登录');
      setPwForm({ oldPassword: '', newPassword: '', confirm: '' });
      sessionStorage.removeItem('token');
      navigate('/login', { replace: true });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('确认删除该用户及其所有数据？此操作不可恢复！')) return;
    try {
      await deleteUser(id);
      showToast('用户已删除');
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
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
                type="text"
                inputMode="decimal"
                name="monthly_income"
                value={settings.monthly_income}
                onChange={handleInputChange}
              />
              <p className="setting-desc">用于计算预算进度和剩余金额</p>
            </div>

            <div className="setting-item">
              <label>预警阈值 (¥)</label>
              <input
                type="text"
                inputMode="decimal"
                name="warn_threshold"
                value={settings.warn_threshold}
                onChange={handleInputChange}
              />
              <p className="setting-desc">花费达到此金额时显示预警</p>
            </div>

            <div className="setting-item">
              <label>危险阈值 (¥)</label>
              <input
                type="text"
                inputMode="decimal"
                name="danger_threshold"
                value={settings.danger_threshold}
                onChange={handleInputChange}
              />
              <p className="setting-desc">花费达到此金额时显示危险提示</p>
            </div>

            <div className="setting-item">
              <label>初始结余 (¥)</label>
              <input
                type="text"
                inputMode="decimal"
                name="initial_balance"
                value={settings.initial_balance}
                onChange={handleInputChange}
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

          {/* 分类预算 */}
          <div className="settings-group">
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>🎯 分类预算</h2>
            <p className="setting-desc" style={{ marginBottom: '12px' }}>为支出分类单独设定月度预算上限，首页将显示各分类进度</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {budgetCategories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ minWidth: '90px', fontSize: '0.9rem' }}>{cat.emoji} {cat.name}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input-field"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.9rem' }}
                    placeholder="不限制"
                    value={budgetInputs[cat.name] || ''}
                    onChange={e => setBudgetInputs(prev => ({ ...prev, [cat.name]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveCategoryBudget(cat.name); }}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    onClick={() => handleSaveCategoryBudget(cat.name)}
                  >
                    保存
                  </button>
                  {budgetInputs[cat.name] && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                      onClick={() => handleClearCategoryBudget(cat.name)}
                    >
                      清除
                    </button>
                  )}
                </div>
              ))}
            </div>
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
                    className="category-emoji-input"
                    placeholder="表情"
                    maxLength="2"
                    value={newCategoryEmoji}
                    onChange={(e) => setNewCategoryEmoji(e.target.value)}
                  />
                  <input
                    type="text"
                    className="category-name-input"
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

          {/* 周期账单 */}
          <div className="settings-group">
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '12px' }}>🔄 周期账单</h2>

            {templates.length > 0 && (
              <div className="category-list" style={{ marginBottom: '12px' }}>
                {templates.map((t) => (
                  <div key={t.id} className={t.is_active ? 'category-list-item' : 'category-list-item paused'}>
                    <div style={{ flex: 1 }}>
                      <span>{t.emoji} {t.category}</span>
                      <span style={{ margin: '0 8px', color: t.type === 'expense' ? 'var(--expense-color)' : 'var(--income-color)' }}>
                        {t.type === 'expense' ? '-' : '+'}¥{t.amount}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {t.frequency === 'monthly' ? `每月 ${t.day_of_month} 号` : `每周${WEEKDAYS[t.day_of_week]}`}
                      </span>
                      {!t.is_active && (
                        <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>已暂停</span>
                      )}
                    </div>
                    <button className="btn btn-ghost delete-btn" onClick={() => handleToggleTemplate(t)}>
                      {t.is_active ? '暂停' : '恢复'}
                    </button>
                    <button className="btn btn-danger delete-btn" onClick={() => handleDeleteTemplate(t.id)}>删除</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              <select
                className="input-field"
                style={{ flex: '1 1 80px' }}
                value={newTemplate.type}
                onChange={(e) => setNewTemplate(p => ({ ...p, type: e.target.value, category: '', emoji: '' }))}
              >
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
              <input
                type="text" inputMode="decimal"
                className="input-field"
                style={{ flex: '2 1 80px' }}
                placeholder="金额"
                value={newTemplate.amount}
                onChange={(e) => setNewTemplate(p => ({ ...p, amount: e.target.value }))}
              />
              <select
                className="input-field"
                style={{ flex: '4 1 140px' }}
                value={newTemplate.category}
                onChange={(e) => {
                  const cat = recurringCategories.find(c => c.name === e.target.value);
                  setNewTemplate(p => ({ ...p, category: e.target.value, emoji: cat?.emoji || '' }));
                }}
              >
                <option value="">请选择分类</option>
                {recurringCategories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.emoji} {cat.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                className="input-field"
                style={{ flex: '1 1 120px' }}
                placeholder="备注（可选）"
                value={newTemplate.note}
                onChange={(e) => setNewTemplate(p => ({ ...p, note: e.target.value }))}
              />
              <select
                className="input-field"
                style={{ flex: '1 1 80px' }}
                value={newTemplate.frequency}
                onChange={(e) => setNewTemplate(p => ({ ...p, frequency: e.target.value }))}
              >
                <option value="monthly">每月</option>
                <option value="weekly">每周</option>
              </select>
              {newTemplate.frequency === 'monthly' ? (
                <input
                  type="text" inputMode="numeric"
                  className="input-field"
                  style={{ flex: '1 1 80px' }}
                  placeholder="几号(1-28)"
                  value={newTemplate.day_of_month}
                  onChange={(e) => setNewTemplate(p => ({ ...p, day_of_month: e.target.value }))}
                />
              ) : (
                <select
                  className="input-field"
                  style={{ flex: '1 1 80px' }}
                  value={newTemplate.day_of_week}
                  onChange={(e) => setNewTemplate(p => ({ ...p, day_of_week: e.target.value }))}
                >
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary" onClick={handleAddTemplate} style={{ flex: 1 }}>+ 添加周期账单</button>
              <button className="btn btn-ghost" onClick={handleManualGenerate}>立即检查生成</button>
            </div>
          </div>

          {/* 数据管理 */}
          <div className="settings-group">
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '12px' }}>💾 数据管理</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={handleBackup} style={{ flex: 1 }}>
                📤 备份为 JSON
              </button>
              <div className="file-input-wrapper" style={{ flex: 1 }}>
                <button className="btn btn-ghost" style={{ width: '100%' }}>📥 从 JSON 恢复</button>
                <input type="file" accept=".json" onChange={handleRestore} />
              </div>
            </div>
            <p className="setting-desc" style={{ marginTop: '8px' }}>
              备份包含所有交易记录和设置；恢复时会追加导入，不会删除现有数据
            </p>
          </div>

          {/* 外观 */}
          <div className="settings-group">
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '12px' }}>🎨 外观</h2>
            <div className="setting-item">
              <label>主题模式</label>
              <select
                className="input-field"
                value={theme}
                onChange={(e) => handleThemeChange(e.target.value)}
              >
                <option value="system">🌓 跟随系统</option>
                <option value="light">☀️ 浅色</option>
                <option value="dark">🌙 深色</option>
              </select>
              <p className="setting-desc">选择界面主题，立即生效</p>
            </div>
          </div>

          {/* 账号安全 */}
          <div className="settings-group">
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '12px' }}>🔐 账号安全</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              当前用户：<strong>{currentUser?.username}</strong>
              {currentUser?.role === 'admin' && <span style={{ marginLeft: '6px', fontSize: '0.8rem', background: 'var(--accent-primary)', color: '#fff', borderRadius: '4px', padding: '1px 6px' }}>管理员</span>}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input className="input-field" type="password" placeholder="旧密码"
                value={pwForm.oldPassword}
                onChange={(e) => setPwForm(p => ({ ...p, oldPassword: e.target.value }))} />
              <input className="input-field" type="password" placeholder="新密码（至少 6 位）"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm(p => ({ ...p, newPassword: e.target.value }))} />
              <input className="input-field" type="password" placeholder="确认新密码"
                value={pwForm.confirm}
                onChange={(e) => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={handleChangePassword} style={{ flex: 1 }}>修改密码</button>
                <button className="btn btn-ghost" onClick={handleLogout} style={{ flex: 1 }}>退出登录</button>
              </div>
            </div>
          </div>

          {/* 用户管理（仅 admin 可见） */}
          {currentUser?.role === 'admin' && (
            <div className="settings-group">
              <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '12px' }}>👥 用户管理</h2>
              <div className="category-list">
                {users.map(u => (
                  <div key={u.id} className="category-list-item">
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{u.username}</span>
                      {u.role === 'admin' && <span style={{ marginLeft: '6px', fontSize: '0.75rem', background: 'var(--accent-primary)', color: '#fff', borderRadius: '4px', padding: '1px 5px' }}>admin</span>}
                      <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.created_at?.slice(0, 10)}</span>
                    </div>
                    {u.role !== 'admin' && u.id !== currentUser?.userId && (
                      <button className="btn btn-danger delete-btn" onClick={() => handleDeleteUser(u.id)}>删除</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
