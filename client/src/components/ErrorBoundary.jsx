import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-primary, #FAFBFF)', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }}>😿</div>
          <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>页面出了点小问题</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {this.state.error.message || '发生了意外错误，请尝试刷新'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ marginTop: '8px' }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
