// 失败次数限流：同一个 key 在 15 分钟内失败 10 次后，后续请求一律返回 429，直到窗口结束。
// 内存实现，适合本项目这种单进程的本地应用；多进程部署需要换成 Redis 之类的共享存储。
//
// 只统计失败的请求（状态码 >= 400）。成功的请求既不计数，也不清零——
// 否则攻击者可以穿插一次自己账号的成功登录，把计数重置掉。

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const MAX_KEYS = 10000; // 同时记录的 key 数上限，防止大量不同的 key 撑爆内存

const stores = [];

function failureLimiter(keyOf) {
  const hits = new Map(); // key → { count, resetAt }
  stores.push(hits);

  function recordFailure(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (entry && entry.resetAt > now) {
      entry.count += 1;
      return;
    }
    if (hits.size >= MAX_KEYS) {
      for (const [k, e] of hits) if (e.resetAt <= now) hits.delete(k);
      // 清掉过期的之后仍然是满的，就淘汰最早的一条
      if (hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value);
    }
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
  }

  return (req, res, next) => {
    const key = keyOf(req);
    const entry = hits.get(key);
    const now = Date.now();
    if (entry && entry.resetAt > now && entry.count >= MAX_FAILURES) {
      const seconds = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(seconds));
      return res.status(429).json({
        success: false,
        error: `尝试次数过多，请 ${Math.ceil(seconds / 60)} 分钟后再试`,
      });
    }
    res.on('finish', () => {
      if (res.statusCode >= 400) recordFailure(key);
    });
    next();
  };
}

// 截断过长的用户名，避免超长输入把 key 撑大
const clip = (value) => String(value ?? '').slice(0, 64);

module.exports = {
  // 登录按「IP + 用户名」计数：一个账号被爆破，不影响其他账号登录
  loginLimiter: failureLimiter((req) => `${req.ip}|${clip(req.body?.username)}`),
  // 注册按 IP 计数：防止换着用户名批量探测哪些已被注册
  registerLimiter: failureLimiter((req) => req.ip),
  // 改密按「IP + 用户 id」计数，必须挂在 authMiddleware 之后
  changePasswordLimiter: failureLimiter((req) => `${req.ip}|${req.user.userId}`),
  // 仅供测试：清空所有计数
  resetRateLimits: () => stores.forEach((hits) => hits.clear()),
};
