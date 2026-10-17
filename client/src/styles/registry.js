// 界面风格的清单。必须与后端 server/routes/auth.js 的 UI_STYLES 保持一致（registry.test.js 会检查）
export const STYLE_IDS = ['anime', 'space', 'classic'];

// 现有账号和未知值一律回退到二次元
export const DEFAULT_STYLE = 'anime';

// 风格选择卡片上显示的名字、一句话介绍和三个色块（色块用该风格浅色的代表色）
export const STYLES = {
  anime: { emoji: '🌸', name: '二次元', tagline: '粉嫩可爱', preview: ['#FFB7C5', '#C8A2C8', '#98D8C8'] },
  space: { emoji: '🚀', name: '星际探索', tagline: '酷炫星空', preview: ['#070B1A', '#4FD1FF', '#8B7CF6'] },
  classic: { emoji: '📒', name: '经典账本', tagline: '简洁稳重', preview: ['#F6F1E4', '#2F6B4F', '#A23B3B'] },
};

export function resolveStyle(id) {
  return STYLE_IDS.includes(id) ? id : DEFAULT_STYLE;
}
