# Rankup 技术与增长审计

审计日期：2026-08-25。证据来自当前工作树、Git 历史、生产构建、配置检查和本地首页 HTTP 验证；线上域名仍需部署环境最终确认。

## P0：上线前必须处理

### A-001 生产身份和 canonical 基地址未配置

- 证据：`.env.local` 的 `NEXT_PUBLIC_APP_URL` 为 `http://localhost:3000`；`src/app/robots.ts`、`src/app/sitemap.ts`、`src/shared/lib/seo.ts` 都使用 `envConfigs.app_url`。
- 影响：如果部署环境未覆盖该变量，canonical、OG URL、robots sitemap 地址会指向 localhost，直接影响抓取和分享。
- 修复：已将 `https://weddingcrestdesign.com` 写入 `.env.example`、`wrangler.toml.example`，并将代码默认值及 production stale-config fallback 指向该域名；`.env.local` 继续保留 localhost 作为本地开发覆盖。部署后仍需逐页检查首页、`/create`、`/examples`、Style 页、`robots.txt`、`sitemap.xml`。
- 状态：RESOLVED（域名基于现有 `support@weddingcrestdesign.com` 推断，部署前需确认）。

### A-002 产品文案仍承诺 3 个 Crest，但代码只生成 1 个

- 证据：`WEDDING_MAX_CANDIDATES = 1`；首页、Pricing、Design、FAQ 和多语言 SEO copy 已统一为单个 finished crest design。
- 影响：用户预期、付费价值和 SEO FAQ 与真实行为不一致，容易造成转化损失和信任问题。
- 修复：按当前代码行为保留单个输出；8 个 locale 的首页、Pricing、Design、SEO FAQ 均已更新，首页 metadata/H1 以 `wedding crest design` 为主关键词，并接入 homepage `generateMetadata`。
- 状态：RESOLVED。

## P1：第一轮优化

### A-003 首页 Style 覆盖由 Example 数据决定，当前不完整

- 证据：`src/themes/default/blocks/wedding-styles.tsx` 只渲染有 active Example 的 Style；当前数据库查询曾返回 5 个 Example，但仅属于 `italian_romance` 与 `vintage_engraving`。
- 影响：首页文案宣称六种 Style，实际卡片数量可能只有两种；四个 Style 没有入口和示例，降低 SEO 内链与选择信心。
- 修复：为其余 Style 配置至少一个高质量 Example，或将 Style 卡片与 Example 缩略图解耦，保持六张 Style 卡片并对缺图状态做明确设计。
- 状态：OPEN。

### A-004 首页首屏 JS 体积偏大

- 证据：`pnpm build` 输出首页 `/[locale]` First Load JS 约 924 kB；`/create` 约 198 kB；共享 JS 约 107 kB。
- 影响：移动端 LCP/INP、首屏转化和爬虫渲染成本有风险。
- 修复：分析首页 bundle，拆分非首页功能和 admin/chat 依赖，减少 client boundary，优先保证 hero 和首个 CTA 的加载路径。
- 状态：OPEN。

### A-005 Next 配置与 workspace 边界有警告

- 证据：构建提示 `turbopackFileSystemCacheForDev`、`reactCompiler` 是未识别配置；同时自动选择 `/Users/xumingyue/pnpm-lock.yaml` 为 workspace root，并发现项目内另一份 lockfile。
- 影响：配置可能被忽略，构建追踪边界和 CI 结果存在环境差异。
- 修复：按当前 Next 15.5.7 文档确认配置归属；设置 `outputFileTracingRoot` 或整理 lockfile/workspace 边界，并在 CI 重跑 build。
- 状态：OPEN。

### A-006 lint 警告基线过高

- 证据：`pnpm lint` exit 0，但报告 0 errors、256 warnings，包含大量未使用变量、Hook 依赖、`<img>` 性能与 alt 警告。
- 影响：真实回归信号被噪声淹没；Hook 依赖问题可能带来 stale state，`img` 使用影响 LCP/带宽，缺 alt 影响可访问性。
- 修复：先按首页、`/create`、结果页和 SEO 页面分批清零，再提高 CI 对新增 warning 的门槛；不要一次性全仓库机械 autofix。
- 状态：OPEN。

### A-007 品牌与 SEO 仍混有旧 watermark 产品残留

- 证据：核心 package/README/license、admin brand、contact、settings、auth fallback、Blog JSON-LD 和 Twitter metadata 已统一；独立 watermark 工具、shortcut 和历史外链仍保留，待决定迁移/noindex/移除。
- 影响：品牌信号、页面主题、结构化数据和搜索摘要可能互相稀释；仓库维护者也容易误判产品边界。
- 修复：已完成核心品牌入口清理；独立 legacy 路由暂不改动，避免把旧功能误当成 Wedding Crest Design 功能。
- 状态：PARTIAL（legacy 路由及历史外链待产品决策）。

## P2：增长与持续运营

### A-008 尚无可核验的生产 SEO、性能、索引和转化基线

- 证据：当前 URL 是 localhost；`.rankup/` 初始化前没有生产基线；GSC、Bing、IndexNow、Analytics、Clarity 和 is-agentic 均未完成线上实测记录。
- 影响：后续优化无法判断流量、收录、CWV、生成完成率和付费是否改善。
- 修复：确认生产域名后，依次记录 Lighthouse/CWV、全站 TDK/H1、robots/sitemap、GSC/Bing、分析 beacon、IndexNow 和 agentic 报告。
- 状态：OPEN。

### A-009 sitemap 的 `lastModified` 每次请求都使用当前时间

- 证据：`src/app/sitemap.ts` 每次构造 entry 都写 `lastModified: new Date()`。
- 影响：所有 URL 看起来每次都更新，降低更新时间信号的可信度并增加重复抓取机会。
- 修复：使用内容/代码实际更新时间，或删除没有可靠来源的 `lastModified`。
- 状态：OPEN。

## 已通过的机械门禁

- TypeScript：通过。
- ESLint：通过但有 256 条 warning。
- Production build：通过；静态页面 35/35 生成完成。
- Homepage runtime：本地首页 HTTP 200，验证 title、description、H1、单 Crest 文案和无旧 3-candidate pricing copy。
- Git 工作树：保留原有业务改动；本轮新增 P0 配置、文案和 Rankup 记录。
