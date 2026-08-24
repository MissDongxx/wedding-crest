# Frames/Examples 站点展示重构

## 背景

- Admin 已可配置 frames（`/admin/wedding/frames`）和 examples（`/admin/wedding/examples`），但站点几乎没有消费这些数据。
- 用户决定：
  1. **frames** 只出现在 `/create` wizard 的 step 2（border 步骤），从网格改成横向轮播图，不上首页。
  2. **examples** 从首页 "Crests From Real Weddings"（`wedding-examples` block）挪到 "Find Your Style"（`wedding-styles` block）：每个 style 下展示 0-3 个 example 缩略图，点击跳 `/create?style=X&exampleId=Y`，图片上不要 name 浮层。
  3. 原 "Crests From Real Weddings" 区块保留但 `disabled: true`。

## 改动清单

### 1. `src/shared/wedding/types.ts` — 扩展 example style 白名单到 6 个

`weddingExampleStyles` 目前只有 3 个 style（minimal_line_art / italian_romance / vintage_engraving），导致 admin 无法给其余 3 个 style 配 example。改成全 6 个（id 取自 `weddingStyles`，name 用 `weddingStyles.name`）：

```ts
export const weddingExampleStyles = [
  { id: 'botanical_watercolor', name: 'Botanical Watercolor' },
  { id: 'minimal_line_art', name: 'Minimal Line Art' },
  { id: 'vintage_engraving', name: 'Vintage Engraving' },
  { id: 'italian_romance', name: 'Italian Romance' },
  { id: 'coastal', name: 'Coastal' },
  { id: 'classic_luxury', name: 'Classic Luxury' },
] as const;
```

自动受益（无需改动）：admin add/edit 表单的 style 下拉、`isWeddingExampleStyle` 校验、公开 API 过滤。旧数据（3 个旧 id 都在新列表中）不受影响。

### 2. `src/themes/default/blocks/wedding-styles.tsx` — Find Your Style 内嵌 examples

- 改为 async server component。
- `listWeddingExamples({ activeOnly: true })` 拉一次，按 `style` 分组，每组取前 3 个（sortOrder 已排序）。
- 卡片结构从"整卡一个 Link"改为：外层 div 卡片 → 上半部分 Link（原有 style preview + name/tagline/description，跳 `/create?style=X`）→ 下方 examples 行（`grid-cols-3`，每个缩略图是独立 Link 跳 `/create?style=X&exampleId=Y`）。
- example 缩略图直接渲染 `example.imageUrl` 原图（`<img>` + eslint-disable，与 wizard frames 一致），**不加 name 文案浮层**，仅 `alt`/`title` 用 `altText ?? name`。
- 0 个 example 的 style 不渲染 examples 行（无空态）。

### 3. `src/app/api/wedding/examples/route.ts` — 支持 `?id=` 单条查询

wizard 深链需要按 id 取单条 example。GET 增加 `id` 参数分支：命中且 `isActive` 且 style 合法时返回 `{ items: [row] }`，否则 `{ items: [] }`。

### 4. `src/themes/default/blocks/wedding-wizard.tsx` — exampleId 深链 + frames 轮播

**a) exampleId 深链（新增 useEffect）**：读 `searchParams.get('exampleId')`，fetch `/api/wedding/examples?id=`，成功后：
- `example.name.split('&')` 拆出 partner1/partner2 预填名字。
- 若 URL 没有 `style` 参数，则用 example 的 style 预选（有 style 参数时交给现有 style effect，避免竞态覆盖）。

**b) step 2（border）网格 → 轮播**：用现成 shadcn/embla `Carousel`（`@/shared/components/ui/carousel`，未被使用过但依赖已装）：
- `framesLoading` / `frames.length === 0` 时：保持"No border"虚线按钮 + 提示文案（现状行为）。
- 有 frames 时：`<Carousel opts={{ align: 'start', dragFree: true }}>`，首滑为 "No border" 按钮，其余每滑一个 frame（`<img thumbnailUrl ?? url>` + name 小标签）。`CarouselItem` 用 `basis-1/2 sm:basis-1/3 lg:basis-1/4`。
- 前后箭头改 `left-1/right-1` 内嵌定位（wizard 控制列约 700px 宽，默认的 `-left-12/-right-12` 外悬会溢出）。
- 选中态逻辑不变（`frameId === frame.id` 高亮）。

### 5. 8 个 locale 的 `pages/index.json` — 禁用旧区块

`de/en/fr/it/ko/pt-BR/th/zh` 的 `sections.examples` 加 `"disabled": true`（内容保留，`show_sections` 不动，随时可删掉 disabled 恢复）。`dynamic-page.tsx` 已支持 `section.disabled === true` 跳过渲染，无需改代码。

### 6. Admin 写库后即时刷新首页（修"配置了不显示"的缓存根因）

首页 `revalidate = 3600`，admin 保存后最长 1 小时才生效。在 example 的增/改/删入口加 `revalidatePath('/', 'layout')`（同时覆盖所有 locale 前缀的首页）：
- `admin/wedding/examples/add/page.tsx`（server action handler）
- `admin/wedding/examples/[id]/edit/page.tsx`（server action handler）
- `api/admin/wedding/examples/[id]/route.ts`（DELETE handler）

frames 只影响 wizard（force-dynamic + 客户端 fetch），无需 revalidate。

## 不改的部分

- `/examples` 专题页与 `/examples/[slug]`：仍是静态 gallery（用户没要求动）。
- `wedding-examples.tsx` block 代码：保留（disabled 状态下不渲染）。
- admin frames 增删改、`/api/wedding/frames`：逻辑不动。

## 验证

1. `pnpm build`（或 dev）过类型/lint。
2. Admin 添加各 style 的 example → 首页 Find Your Style 对应卡片下方出现 ≤3 缩略图，无 name 浮层，点击进 `/create?style=...&exampleId=...` 且名字已预填。
3. 首页不再出现 "Crests From Real Weddings"。
4. `/create` step 2：frames 以轮播展示，可拖动/点箭头，选择后 preview 边框生效。
5. Admin 删除 example → 首页（refresh 后）立即消失。
