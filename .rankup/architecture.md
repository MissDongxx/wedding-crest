# 当前架构

## 应用层

- Next.js 15 App Router + React 19 + TypeScript。
- `next-intl` 提供 8 个 locale：`en`、`zh`、`pt-BR`、`it`、`de`、`fr`、`ko`、`th`。
- `src/app/[locale]/(landing)` 承载首页、创建流程、结果页、Examples 和 Style SEO 页面。
- `src/themes/default/blocks` 承载首页与 Wedding Crest UI；`src/shared/wedding` 承载纯数据配置、Prompt compiler 与 SVG composer。

## 数据与服务

- Drizzle ORM；当前环境配置为 PostgreSQL，业务 schema 为 `wedding-crest`。
- `wedding_project`、`wedding_generation`、`wedding_asset` 保存用户生成链路。
- `wedding_example` 保存首页真实 Crest Example；`wedding_frame` 保存后台管理的 Frame library。
- AI 生成、支付、上传、鉴权和分析通过 `src/extensions` 与 `src/shared/services` 适配。

## SEO/增长边界

- `src/app/robots.ts`、`src/app/sitemap.ts` 提供 robots 与 sitemap。
- `src/shared/lib/seo.ts` 生成 canonical、Open Graph、Twitter 和 locale alternates。
- 首页额外输出 Organization、BreadcrumbList、FAQ JSON-LD。
- 尚未建立 `.rankup` 之前的线上性能、索引和分析基线。

