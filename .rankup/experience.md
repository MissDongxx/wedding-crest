- **[2026-08-25] Crest 输出数量必须同时核对配置、API、结果页和文案**

  `WEDDING_MAX_CANDIDATES = 1`，但首页与 SEO 多语言文案仍承诺 3 个 Crest/candidates。单看构建不会暴露这类产品事实漂移，后续每次改变 candidate 数量都要全局搜索文案并运行生成流程验证。

- **[2026-08-25] 首页 Style 数量不是静态配置数量**

  `weddingStyles` 有 6 个生成器 Style，但 `WeddingStyles` 只渲染有 active `wedding_example` 的 Style。首页 SEO 文案和实际卡片数量必须分别核对，不能只读 `types.ts` 得出首页展示数量。

- **[2026-08-25] 构建通过不代表生产 SEO 已经可用**

  canonical、OG、robots 和 sitemap 都依赖 `envConfigs.app_url`；当前本地环境仍是 localhost。必须在生产环境逐 URL 实测，而不是把本地 build 当作线上 SEO 证据。

