import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api';
import { saveSession } from '../utils/session';
import { applyStyle, getStyleId } from '../styles/appearance';
import StylePicker from '../components/StylePicker';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uiStyle, setUiStyle] = useState(getStyleId);
  const registered = useRef(false);

  // 选风格时整页立即换上看效果，但不记住；没注册就离开页面，恢复成进来时的风格
  useEffect(() => {
    const original = getStyleId();
    return () => {
      if (!registered.current) applyStyle(original, { persist: false });
    };
  }, []);

  const handlePickStyle = (id) => {
    setUiStyle(id);
    applyStyle(id, { persist: false });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const res = await register({ username: form.username, password: form.password, uiStyle });
      registered.current = true;
      saveSession(res.data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--bg-card)', backdropFilter: 'var(--blur-lg)', WebkitBackdropFilter: 'var(--blur-lg)', borderRadius: 'var(--radius-lg)', padding: '36px 28px', width: '100%', maxWidth: '380px', boxShadow: 'var(--shadow-card)' }}>
        <h1 style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '8px' }}>🌸 零花钱记账</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '28px' }}>创建新账号</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名（至少 3 个字符）</label>
            <input
              className="input-field"
              type="text"
              placeholder="请输入用户名"
              value={form.username}
              onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label>密码（至少 6 个字符）</label>
            <input
              className="input-field"
              type="password"
              placeholder="请输入密码"
              value={form.password}
              onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-group">
            <label>确认密码</label>
            <input
              className="input-field"
              type="password"
              placeholder="再次输入密码"
              value={form.confirm}
              onChange={(e) => setForm(p => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-group">
            <label id="register-style-label">界面风格（以后可以在设置里换）</label>
            <StylePicker value={uiStyle} onChange={handlePickStyle} labelledBy="register-style-label" />
          </div>
          {error && <p style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          已有账号？<Link to="/login" style={{ color: 'var(--accent-dark)' }}>立即登录</Link>
        </p>
      </div>
    </div>
  );
}
