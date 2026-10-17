import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getToken, saveSession, clearSession, getCurrentUser } from './session';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// 按 JWT 的格式拼一个 Token：载荷是 base64url 编码的 UTF-8 JSON（签名部分前端不校验）
function fakeToken(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const base64url = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${base64url}.signature`;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  vi.stubGlobal('sessionStorage', fakeStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('登录状态', () => {
  it('saveSession 保存 Token，并记住账号的界面风格', () => {
    saveSession({ token: 'abc', uiStyle: 'space' });
    expect(getToken()).toBe('abc');
    expect(localStorage.getItem('uiStyle')).toBe('space');
  });

  it('后端返回不认识的风格时按二次元记住', () => {
    saveSession({ token: 'abc', uiStyle: 'hello' });
    expect(localStorage.getItem('uiStyle')).toBe('anime');
  });

  it('clearSession 只清 Token，风格缓存留给登录页用', () => {
    saveSession({ token: 'abc', uiStyle: 'classic' });
    clearSession();
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('uiStyle')).toBe('classic');
  });
});

describe('getCurrentUser', () => {
  it('能读出英文用户名和角色', () => {
    sessionStorage.setItem('token', fakeToken({ userId: 1, username: 'admin', role: 'admin' }));
    expect(getCurrentUser()).toEqual({ userId: 1, username: 'admin', role: 'admin' });
  });

  it('中文用户名不会变成乱码', () => {
    sessionStorage.setItem('token', fakeToken({ userId: 7, username: '小美', role: 'user' }));
    expect(getCurrentUser().username).toBe('小美');
  });

  it('载荷里出现 base64url 特有的 - 和 _ 也能解开', () => {
    // 这个用户名编码后恰好含有 - 和 _，普通 atob 解不了
    const token = fakeToken({ userId: 9, username: '>>>???~~~' });
    expect(token.split('.')[1]).toMatch(/[-_]/);
    sessionStorage.setItem('token', token);
    expect(getCurrentUser().username).toBe('>>>???~~~');
  });

  it('没登录或 Token 格式坏了返回 null', () => {
    expect(getCurrentUser()).toBeNull();
    sessionStorage.setItem('token', 'not-a-jwt');
    expect(getCurrentUser()).toBeNull();
  });
});
