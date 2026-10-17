// 界面风格的清单。必须与后端 server/routes/auth.js 的 UI_STYLES 保持一致（registry.test.js 会检查）
export const STYLE_IDS = ['anime', 'space', 'classic'];

// 现有账号和未知值一律回退到二次元
export const DEFAULT_STYLE = 'anime';

export function resolveStyle(id) {
  return STYLE_IDS.includes(id) ? id : DEFAULT_STYLE;
}
