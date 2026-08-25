# 基线（2026-08-25）

## 代码质量

- `pnpm exec tsc --noEmit --pretty false`：exit 0。
- `pnpm lint`：exit 0，0 errors、256 warnings。
- `pnpm build`：exit 0；编译、类型检查、静态页面生成均完成。
- 构建警告：`next.config.mjs` 中有 2 个未识别配置项；Next.js 检测到 workspace 外层存在另一个 lockfile。

## 构建体积

- 首页路由 `/[locale]` First Load JS：约 924 kB。
- `/create` First Load JS：约 198 kB。
- 共享 JS：约 107 kB。

## 线上数据

- 生产 URL：待确认。
- 流量、收录、CWV、转化、收入：待生产域名和分析/GSC 权限后测量。

