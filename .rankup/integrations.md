# 平台接入看板

状态以 2026-08-25 的代码检查为准；由于当前应用 URL 是 localhost，所有线上状态仍需用生产域名复核。

| 平台/能力 | 状态 | 证据或下一步 |
|---|---|---|
| Cloudflare Web Analytics | ⬜ | 有 provider 代码，但未完成线上 HTML 实测。 |
| GA4 | ⬜ | 可在 Admin Settings 配置，未核实生产页面 beacon。 |
| Microsoft Clarity | ⬜ | 可在 Admin Settings 配置，未核实生产页面 beacon。 |
| Ahrefs Site Explorer | ⬜ | 未提供生产域名/项目证据。 |
| Ahrefs Web Analytics | ⬜ | 未核实线上脚本。 |
| Google Search Console | ⬜ | 未核实 property 与 sitemap 状态。 |
| Bing Webmaster | ⬜ | 未核实站点与 sitemap 状态。 |
| Yandex Webmaster | ⬜ | 未核实验证标签。 |
| Naver Search Advisor | ⬜ | 未核实验证标签。 |
| IndexNow | ⬜ | 仓库没有密钥文件或提交证据。 |
| sitemap 提交 | ⬜ | 代码有 `src/app/sitemap.ts`，平台提交待确认。 |
| favicon / icons | ✅ | `public/favicon.webp`、`public/apple-touch-icon.webp` 存在；生产 HTTP 状态待核验。 |
| title / description / robots / OG | ⬜ | 代码路径存在；因无生产域名暂未做线上逐 URL 实测。 |
| JSON-LD | ✅ | 首页输出 Organization、BreadcrumbList、FAQ；Style/Examples 页面需线上抽检。 |
| is-agentic | ⬜ | 没有生产域名，暂不运行线上扫描。 |
| hreflang / `<html lang>` | ✅ | 代码实现存在；生产页面值待核验。 |

