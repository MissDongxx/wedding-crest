# 项目说明

## 定位

Wedding Crest Design 是一个 AI 婚礼 Crest / Monogram 生成器：用户输入双方姓名、婚礼日期与偏好，选择风格、布局、配色和字体，生成可用于婚礼物料的 Crest 与 SVG identity kit。

## 当前产品事实（2026-08-25）

- 生成器内置 6 个 Style、12 个 Layout、8 个 Typography pairing、7 个 Palette。
- 当前代码配置 `WEDDING_MAX_CANDIDATES = 1`，每个生成 batch 输出 1 个 Crest。
- 首页 Example 区块依赖数据库中的 active `wedding_example`；没有 Example 的 Style 不渲染卡片。
- 当前 `.env.local` 的应用 URL 是 `http://localhost:3000`，生产域名待确认。

## 目标用户

准备婚礼、希望快速获得统一视觉标识但没有完整设计能力的情侣，以及需要婚礼纸品/标牌视觉素材的小型婚礼服务团队。

## 商业目标

让用户从首页进入创建流程，完成一次可感知的 Crest 生成，再通过高清下载、SVG identity pack 或额外 regeneration 产生付费转化。

## 非目标

- 本轮不重构现有 Next.js / next-intl / DB 架构。
- 本轮不把旧的 watermark 工具业务继续扩展到 Crest 主漏斗。

