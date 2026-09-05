---
description: 跑测试和 lint，可选限定 server 或 client
argument-hint: server 或 client（留空跑全部）
allowed-tools: Bash, Read, Grep
---

对这个项目做一次检查。检查范围由参数 `$ARGUMENTS` 决定：

- 没传参数：下面三项全跑
- `server`：只跑第 1 项
- `client`：只跑第 2、3 项

1. 后端测试：`cd server && npm test`
2. 前端测试：`cd client && npm test`
3. 前端代码检查：`cd client && npm run lint`

范围内的每一项都要跑完，不要因为某一项失败就停下——我需要知道各自的状态。

汇报要求：

- 全部通过：一句话说明通过，带上测试通过的数量
- 有失败：指出是哪一项失败、贴出关键报错、定位到具体文件和行号
- 只报告结果，不要自动修复。需要改动时先告诉我问题在哪，等我确认
