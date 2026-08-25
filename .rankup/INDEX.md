# Rankup 项目索引

- 项目：Wedding Crest Design
- 最近更新：2026-08-25
- 当前阶段：0（已有项目事实对账；尚未完成上线后技术 SEO 闸门）
- 上一个完成的关卡：`pnpm exec tsc --noEmit`、`pnpm lint` 与 `pnpm build` 已完成；构建无错误但有配置与 lint 警告。
- 下一步动作：先修正生产 URL 与 Crest 数量文案，再补线上域名、站点地图、分析与 AI Agent 基线。
- 当前阻塞：`.env.local` 的 `NEXT_PUBLIC_APP_URL` 仍为 localhost，尚无可供 Rankup 实时核验的生产 URL。

## 推荐读取顺序

1. `PROJECT.md`
2. `audit.md`
3. `plan.md`
4. `architecture.md` / `infrastructure.md`

## 文件状态

| 文件 | 内容 | 最近核对 | 状态 |
|---|---|---:|---|
| `PROJECT.md` | 产品目标与边界 | 2026-08-25 | current |
| `architecture.md` | 应用、数据与服务边界 | 2026-08-25 | current |
| `infrastructure.md` | 部署与环境事实 | 2026-08-25 | incomplete |
| `integrations.md` | 平台接入看板 | 2026-08-25 | pending live verification |
| `audit.md` | 当前问题、证据与优先级 | 2026-08-25 | current |
| `plan.md` | 当前迭代计划 | 2026-08-25 | current |

