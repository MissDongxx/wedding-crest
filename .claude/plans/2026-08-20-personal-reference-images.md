# Personal 步骤：参考图上传 + 主体提取注入 crest

## 目标

用户在 wizard 第 4 步（Personal）可上传图片（宠物、首饰、有意义的物件、风景等），生成 crest 时：
1. 用 Gemini 视觉模型把图片主体转成一句英文描述，注入生成 prompt（风格化插画元素）；
2. 同时把图片 URL 作为 `referenceImages` 传给 Runware（当 provider/model 支持时），双重引导生成。

## 已确认的事实（无迁移、少改动）

- `weddingProjectElement` 是通用 `{projectId, type, value}` 表 → 参考图存为 `type='reference_image'`、`value=JSON({url, subject})`，**不需要 DB 迁移**。
- `/api/storage/upload-image` 已存在（md5 去重、返回公开 URL），直接复用。
- Gemini provider 已有 `image_input` 先例（fetch URL → base64 inlineData）。
- result 页通过 `{...rawProject, ...rawProject.input}` 归一化，`buildInput` 加字段后自动可见。
- 当前默认模型 `runware:Flux-Schnell@1` 不一定支持 referenceImages → 需要"提交失败自动降级重试"。

## 实现步骤

### 1. 数据层
- `src/shared/wedding/types.ts`：`WeddingProjectInput` 增加 `referenceImages?: { url: string; subject: string }[]`；新增 `WEDDING_MAX_REFERENCE_IMAGES = 2`。
- `src/shared/models/wedding.ts`：`createWeddingProject` 写入 `reference_image` 元素（value 为 JSON）；`buildInput` 解析回 `input.referenceImages`（JSON parse 失败安全跳过，截断到上限）。
- `src/app/api/projects/route.ts`：createSchema 增加
  `referenceImages: z.array(z.object({ url: z.string().url(), subject: cleanText(200) })).max(2).optional()`。

### 2. 主体提取 API（新文件）
- `src/app/api/wedding/extract-subject/route.ts`，POST `{imageUrl}`：
  - SSRF 防护：仅 https、拒绝 localhost/内网 IP 段。
  - fetch 图片（Content-Length 上限 ~10MB），转 base64。
  - 从 `getAllConfigs()` 读 `gemini_api_key`；直接 REST 调 `generateContent`（模型常量 `gemini-2.5-flash`，TEXT 输出）。
  - 提取 prompt：一句话英文主体描述（≤25 词，含主体类型、颜色、可辨识特征），无引号无前缀。
  - 无 key / 调用失败 → `respErr`（前端降级为手动输入）。

### 3. Wizard UI（`wedding-wizard.tsx` step 4）
- 状态：`referenceImages: { url, subject, extracting, error }[]`。
- 上传：`accept="image/*"`、≤8MB 前端校验 → `/api/storage/upload-image` → 成功后自动调 extract-subject。
- 缩略图（~56px）+ 删除 ×；每张下方一个可编辑 Input 显示/修正 subject（extracting 时显示 loading 文案；失败时提示手动输入）。
- 上限 2 张，超限 toast（复用 `max_items` 模式）。
- Review（step 6）摘要增加参考图行（缩略图 + subject）。
- `submit()` 的 POST body 带 `referenceImages`（subject 为空时服务端按 `'a personal photo keepsake'` 兜底）。

### 4. Prompt 编译 + 版本
- `src/shared/wedding/prompt-compiler.ts`：有 subjects 时追加一行
  `Personal subjects (render as stylized crest motifs integrated into the arrangement, not photographic copies): ...`（空 subject 用兜底文案）。
- `src/shared/wedding/config.ts`：`WEDDING_PROMPT_VERSION` → `wedding-illustration-v2`。

### 5. Runware referenceImages（`src/extensions/ai/runware.ts`）
- `generate()`：`options.referenceImages?.length` 时
  `task.referenceImages = urls.map(imageURL => ({ imageURL }))`。
- 提交返回 400 且错误信息含 `unsupportedParameter`/`referenceImages` 时，去掉 referenceImages 重试一次（文字 prompt 仍带主体描述，优雅降级）。
- `AIGenerateParams.options` 本就是 `any`，在 `types.ts` 注释说明 `referenceImages?: string[]` 约定即可。

### 6. Generate 路由
- `src/app/api/projects/[id]/generate/route.ts`：把 `project.input.referenceImages?.map(r => r.url)` 放进 `provider.generate` 的 `options.referenceImages`（provider 不识别则忽略）。

### 7. Result 页（`wedding-result.tsx`）
- `ProjectData` 增加 `referenceImages?: { url, subject }[]`；design brief 区域（personalElements 展示处附近）加一行缩略图。

### 8. i18n（8 个 locale 的 `pages/create.json`）
- 新 key：`upload_reference_title` / `upload_reference_hint` / `subject_extracting` / `subject_failed` / `subject_placeholder` / `remove_reference_image` / `max_items_references` / `reference_images_summary`（review 摘要标签）。
- 翻译 en/zh/de/fr/it/ko/pt-BR/th。

## 验证
- `pnpm lint`、`pnpm build:fast`。
- `pnpm dev` 手动：上传宠物照 → 看 subject 提取 → 生成 → crest 含风格化主体；再验一次不上传图片的旧流程不受影响。

## 不做（本次）
- subject 提取结果缓存（上传时提取一次，随 project 持久化即可）。
- composer 实时预览不渲染参考图（与现有 flowers/personalElements 行为一致，预览仅排版层）。
- admin 配置项（vision 模型名用常量）。
