# 当前优化计划

## P0：先统一产品事实与生产身份

1. 已确认 Crest 输出数量为 1，并保留现有 4/3 次 regeneration 配额。
2. 已全 locale 修正文案、FAQ、Pricing、Design 和 SEO copy。
3. 已配置生产 URL 默认值，并核对首页 metadata、canonical/OG 代码链路；线上域名仍需部署环境确认。

验收：代码中的输出数量、页面文案、API 行为一致；生产默认 URL 不再是 localhost，本地环境仍可通过 `.env.local` 使用 localhost。

## P1：修正首页发现与性能

1. 为 6 个 Style 配置至少一个 active Example，或改为六卡片固定展示。
2. 拆分首页 client bundle，目标是显著降低 `/[locale]` 的 924 kB First Load JS。
3. 清理 Next config 警告与 lockfile root 警告。
4. 先清理首页/Create/Result 相关 lint warnings。

验收：六种 Style 的首页入口与 Example 状态符合产品决定；构建警告减少；关键页面无新增 lint warning。

## P2：建立增长闭环

1. 确认主市场与关键词，补齐 `keywords.md` 的 KD/SERP/意图证据。
2. 接通并实测分析、GSC/Bing、IndexNow。
3. 跑 Lighthouse、全站 TDK/H1、agentic 基线，建立可比较的实验记录。
