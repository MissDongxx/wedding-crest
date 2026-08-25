# 基础设施

## 当前已核对事实（2026-08-25）

- 本地应用配置：`NEXT_PUBLIC_APP_URL=http://localhost:3000`。
- 数据库 provider：PostgreSQL；连接配置存在于本地环境文件，真实值不记录在此。
- Next 配置使用 standalone 输出；仓库提供 `open-next.config.ts` 和 `wrangler.toml.example`。
- 仓库根目录当前没有已配置的 `wrangler.toml`，Cloudflare Worker/D1/R2 生产资源待确认。
- 线上生产域名、Cloudflare zone、Worker 名称、绑定和部署环境待确认。

## 待核验

1. 生产域名及 DNS/Cloudflare 状态。
2. 生产环境的 `NEXT_PUBLIC_APP_URL`、数据库和对象存储绑定。
3. 真实线上 `robots.txt`、`sitemap.xml`、首页和 `/create` 响应。

