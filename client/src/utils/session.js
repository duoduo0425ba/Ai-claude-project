// 登录状态。Token 存在 sessionStorage，关闭浏览器即失效（有意为之）
import { applyStyle } from '../styles/appearance';

const TOKEN_KEY = 'token';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

// 登录、注册成功后调用：保存 Token，并立即切换到这个账号的界面风格
export function saveSession({ token, uiStyle }) {
  sessionStorage.setItem(TOKEN_KEY, token);
  applyStyle(uiStyle);
}

// 退出登录只清 Token；风格缓存保留，登录页沿用上次的风格，下次登录会被该账号的风格覆盖
export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// 从 JWT 载荷里读出当前用户，只用于界面显示，权限一律以后端为准。
// 载荷是 base64url 编码的 UTF-8 JSON：直接 atob 会让中文用户名变成乱码
export function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
