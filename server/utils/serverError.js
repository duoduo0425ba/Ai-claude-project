// 500 错误的统一出口：详细错误只打印到服务端日志，响应里只给通用提示。
// SQLite 的原始报错会暴露表名、列名和参数绑定细节，绝不能原样返回给前端。
module.exports = function serverError(res, err) {
  console.error(err);
  res.status(500).json({ success: false, error: '服务器错误' });
};
