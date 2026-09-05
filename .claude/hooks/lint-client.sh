#!/bin/bash
# 编辑 client/src 下的前端文件后，自动用 ESLint 检查这一个文件

# Claude Code 从标准输入传入 JSON，取出被编辑的文件路径
file=$(jq -r '.tool_input.file_path // empty')

# 只管 client/src 下的 js/jsx，其他文件直接放行
case "$file" in
  */client/src/*.js|*/client/src/*.jsx) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR/client" || exit 0

# 只检查这一个文件，不是整个项目——快得多
if ! output=$(npx eslint "$file" 2>&1); then
  echo "ESLint 检查未通过：" >&2
  echo "$output" >&2
  exit 2   # 退出码 2 = 把上面的内容反馈给 Claude，让它修
fi

exit 0
