# 密钥登记

只登记名称、用途和保管位置，不记录真实值。

| 名称 | 用途 | 保管位置 | 状态 |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接 | 本地/部署环境 Secret | 已配置本地，生产待确认 |
| `AUTH_SECRET` | Better Auth 会话 | 本地/部署环境 Secret | 待核验 |
| AI provider keys | Crest 图像生成 | Admin settings 或部署 Secret | 待核验 |
| Payment provider keys | 订阅/支付 | Admin settings 或部署 Secret | 待核验 |
| Analytics IDs | GA/Clarity/Plausible 等 | Admin settings | 待核验 |

