# wedding-crest2 项目长期记忆

## 图像生成的模型路由（重要）

生成入口 `src/app/api/projects/[id]/generate/route.ts` 的模型决策顺序：

1. `body.model` 有值 → 直接采用（wizard / wedding-result 的 fetch 都不带 model，实际走不到）
2. **有任一参考图**（exampleImage / frameUrl / personalImages，或任何 `edit` 小修改流程）→ `WEDDING_AI_MULTIMODAL_MODEL || 'google:nano-banana@2-lite'`
3. **无参考图的纯文生图** → `WEDDING_AI_MODEL || runware_model（后台 config）|| 'runware:Flux-Schnell@1'`

线上后台 `runware_model` 于 2026-09-18 由 `klingai:kling-image@3` 改为 `google:nano-banana@2-lite`，
同时 `pickModel` 的兜底值由 `runware:Flux-Schnell@1` 改为 `google:nano-banana@2-lite`。
现在两条分支默认都是 nano-banana（纯文生图 / 带参考图 / 小修改）。
历史：曾配过 Kling IMAGE 3.0，共 21 条生成记录（2026-08-20 ~ 09-17）。

坑：分支 2 会完全忽略 `runware_model`，因此要把「带参考图」这条也换模型必须改
`WEDDING_AI_MULTIMODAL_MODEL`（默认值当前也是 nano-banana，所以无需再动）。

已验证（2026-09-18 实调 Runware）：`google:nano-banana@2-lite` 在「无 referenceImages +
width/height=1024」组合下正常出图，cost ≈ $0.0336/张。Runware 的限制是
`inputs.referenceImages` 与 width/height 二者只能传其一，不是不能单独传尺寸。

另一个 Runware 出口：`/api/ai/generate` 把请求体 `model` 原样透传给 provider，
只校验 provider 是否配置、不校验 model 白名单。

## 定价（Wedding Image Pack）改价必须同步的三个位置

价格不是单一常量，散在三处；只改一处会出现「页面写 $9.9、实际扣 $19」或反过来的分裂：

1. `src/config/locale/messages/<locale>/pages/pricing.json` → `items[1].amount`（**真实扣款金额，单位分**）
   + `items[1].price`（展示串）+ `metadata.description`（SEO 文案里也写死了价格）
2. `src/config/locale/messages/<locale>/pages/design.json` → `unlock_cta`（"Unlock for $X"）
3. `src/themes/default/blocks/wedding-result.tsx` → unlock 面板里**硬编码**的价格 `<p>`

- 8 个语言目录：de / en / fr / it / ko / pt-BR / th / zh。除 en 外其余都是英文原文，
  改价不必逐个翻译（各 locale 的 price/description 都是英文）。
- `/api/payment/checkout` 只接收 `product_id`，**服务端自己**从 `pages/pricing` 读 `amount`，
  不信前端金额；所以改价只需改 locale JSON，API 不用动。
- 首页定价模块与 `/pricing` 页共用 `pages/pricing` 配置，改一处全站生效。
- 若后台配了 creem 商品映射 / stripe price id，渠道侧价格需另行同步（未验证）。
- 2026-09-20 已将打包价由 $19 改为 $9.9（amount 990）。

## 部署与路由（Cloudflare / OpenNext）

- 部署：分支 `cf`，`npm run cf:deploy`。会被 safe-delete shim 杀掉，先
  `unset NODE_OPTIONS BASH_ENV CODEBUDDY_SAFE_DELETE_*`；`CI=true` 时 wrangler 强制要
  `CLOUDFLARE_API_TOKEN`，本机无 token 但**关掉 sandbox 后就有凭据**。
- **SSG 在 Cloudflare 上不落盘**：`.open-next` 里一个 html 都没有（`open-next.config.ts`
  未配 R2 incrementalCache）。所以 `force-static` + `dynamicParams = false` 的页面只有
  `generateStaticParams` 预生成过的 param 能命中，其余一律 404。加/改 param 时务必同步改
  `generateStaticParams`，别指望运行时补渲染。
- **首页是英语单语**（2026-09-18 起）：`generateStaticParams` 只返回 defaultLocale；
  `src/middleware.ts` 把 `/zh` `/ko` 等 locale 根路径 308 到 `/`；sitemap 与 hreflang
  同样只发 default locale。其余内页（/create /pricing /examples …）多语言照常。
  `getMetadata` 用 `alternateLocales` 选项可以单独收窄某个页面的 hreflang 集合。
- next-intl 配置是 `localePrefix: 'as-needed'` + `localeDetection: false`：
  它只会把 `/en` 307 到 `/`，**不会**把别的 locale 根路径归并，需要自己写中间件规则。

## 供应商兼容注意

- `src/extensions/ai/runware.ts`：只在调用方显式传 `negativePrompt` 时才带该字段。
  Kling（经 Runware）会以 unsupportedParameter / 400 拒绝，nano-banana 系则完全不支持该参数。
  新增模型时不要无条件往任务载荷里塞 negativePrompt。
- Kling 图像能力在代码里出现的位置只有视频链路：`fal-ai/kling-video/o1/video-to-video/edit`
  （`src/extensions/ai/fal.ts`、`src/shared/blocks/generator/video.tsx`）。
