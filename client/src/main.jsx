import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initAppearance } from './styles/appearance'

// 在 React 挂载前应用已保存的明暗主题和界面风格，并开始跟随系统深浅色变化
initAppearance();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
