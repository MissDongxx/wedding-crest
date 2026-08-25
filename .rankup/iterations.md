# 迭代记录

## 2026-08-25：首次 Rankup 项目审计

- 假设：项目已有 Crest 主流程，但优化优先级需要从代码、构建和 SEO 事实重新建立。
- 动作：运行 Rankup review、读取项目路由/配置、执行 TypeScript、ESLint 和 production build。
- 结果：构建通过；发现输出数量文案冲突、生产 URL 未配置、首页 Style 数据覆盖不全、首页 bundle 偏大、256 条 lint warnings、Next config/workspace 警告。
- 被证伪假设：不能把首页“六种 Style”的文案当作实际六张卡片，也不能把“Get 3 Crests”当作当前真实输出。
- 下一轮唯一改进：先完成 P0 的数量与生产 URL 对账，再处理首页性能。

## 2026-08-25：P0 产品事实与首页 SEO 修复

- 动作：将生产默认 URL 统一到 `https://weddingcrestdesign.com`，保留 `.env.local` 的 localhost 覆盖；production DB stale config 不再覆盖为 localhost/旧域名。
- 动作：将 8 个 locale 的首页主标题、description、H1、Style 描述、流程、FAQ、Pricing、Design 和 SEO FAQ 统一到单 Crest 输出。
- 动作：首页新增 `pages.index.metadata` 生成逻辑，主关键词为 `wedding crest design`；同步清理核心品牌 metadata、联系邮箱、admin brand、package/README/license。
- 验证：TypeScript、目标 ESLint、locale JSON、diff check、production build 均通过；本地首页 HTTP 200，title/H1/description/单 Crest pricing 文案匹配，旧 3-candidate pricing 文案不再出现。
- 未完成：独立 watermark legacy 路由/shortcut/历史外链的迁移或 noindex 决策；生产域名需部署后复核。
