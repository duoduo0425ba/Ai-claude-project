import { useEffect } from 'react';
import { getMe } from '../api';
import { applyStyle } from '../styles/appearance';

// 登录后的页面加载时，向后端确认一次当前账号的风格。
// 平时登录响应已经带了风格，这里只处理边角情况：刷新页面时缓存被清掉、或在别的设备上改过风格。
// 失败一律忽略（Token 失效时 api 层会自己跳转到登录页）
export default function StyleSync() {
  useEffect(() => {
    const controller = new AbortController();
    getMe({ signal: controller.signal })
      .then((res) => applyStyle(res.data.uiStyle))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return null;
}
