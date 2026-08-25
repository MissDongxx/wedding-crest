# 决策记录

## D-001：生成结果按当前代码输出 1 个 Crest

- 日期：2026-08-25
- 决定：以 `src/shared/wedding/config.ts` 的 `WEDDING_MAX_CANDIDATES = 1` 作为当前产品事实。
- 原因：生成 API、结果页和 quota 逻辑已按单个 candidate 运行。
- 复查条件：产品重新恢复多候选输出时，必须同步修改 API、结果 UI、文案、quota 和下载包测试。

## D-002：首页 Style 卡片由 active Example 驱动

- 日期：2026-08-25
- 决定：保留 `WeddingStyles` 只展示有 active `wedding_example` 的 Style 的现状，直到每个 Style 都有可用 Example 或产品明确要求显示空卡片。
- 原因：当前实现避免显示没有图片的 ghost card，但会造成首页 Style 覆盖不完整。
- 复查条件：四个缺失 Style 补齐 Example 后，或首页需要展示完整六风格时重新评估。

