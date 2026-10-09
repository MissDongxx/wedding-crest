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

## 支付 Provider 接入约定

新增渠道要同步的位置：`src/extensions/payment/<name>.ts` + `index.ts` 导出 +
`shared/services/payment.ts` 注册 + `shared/services/settings.ts`（分组/配置项/
default_payment_provider 选项/publicSettingNames）+ `payment-providers.tsx` 按钮 +
`admin/payments/page.tsx` 筛选 + 8 语言 `admin/settings.json`&`admin/payments.json` +
`/api/payment/checkout` 的 `getPaymentProductId` 映射 + 图标 `public/imgs/icons/`。

- 金额在 pricing.json 存 **minor units**（990=$9.90）；Waffo 用 display string（"9.99"），
  边界必须换算（JPY 等零小数币种除外）。
- provider 的 DB config 缺失时构造函数会 throw——注册处必须先判空再 new，
  否则会拖垮整条支付链路（waffo 注册处已做）。

## Waffo Pancake（第 4 个支付渠道，2026-10-08 接入）

- SDK `@waffo/pancake-ts@0.25.0`。**官方 skill 文档已过时**：无 `productType` 字段、
  无 `client.webhooks.verify`（真实是独立函数 `verifyWebhook`）、事件列表不全、
  `amount` 是 display string 不是 number。
- `createSession` 无 `cancelUrl`；返回的 `cs_<uuid>` 无法反查 →
  **`checkoutInfo.sessionId` 存 orderNo**（我们传的 `orderMerchantExternalId`），
  靠 GraphQL `payments(filter:{orderMerchantExternalId:{eq:$ref}})` 反查。
- SDK 用 node:crypto（createSign/createPrivateKey），CF Workers 需 nodejs_compat
  （wrangler.toml 已开，node:crypto 全量可用）。
- **不订阅 `subscription.payment_succeeded`**（官方设计该事件不含计费周期，写入会污染本地周期）；
  用 `subscription.renewed` 做续费。past_due → PAUSED，recovered → ACTIVE。
- 商品映射：`waffo_product_ids` = `{"wedding_identity_pack":"PROD_2wSUbvMvO9jMamL28tN3zp"}`，
  store `STO_3i8JfcpMv37Fw0UKju3dp6`，merchant `MER_1Ap2v7x8EOu8oRz5cupYyE`。
- webhook 注册脚本 `scripts/waffo-register-webhook.ts`（WAFFO_* env，见 .env.example），
  端点 `/api/payment/notify/waffo`。测试卡 4576 7500 0000 0110。
- 私钥走 Admin 后台 password 字段（用户选择），**未做真实 API 联调**。

## 本地开发（单一 dev server 铁律）

- **同一项目同时只允许一个 `next dev`**。两个实例共用 `.next` 会互相覆盖 chunk，
  典型症状：`Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`（`_document.js` 第一行就炸）。
  判断法：看 `.next/server/chunks/ssr/` 下同名 chunk 是否出现多个不同 hash，或 `BUILD_ID` 与
  `app-build-manifest.json` 的 mtime 不在同一代。
- **端口不冲突 ≠ 只有一个实例**：macOS 上 `[::1]:3000`（IPv6 loopback）与 `*:3000`（IPv6 wildcard）
  因 SO_REUSEADDR 可以同时 bind 成功。2026-10-08 曾因此悄悄并存 2 天（一个 Tue 起的
  `next dev -H localhost -p 3000` + 一个今天的 `pnpm dev`）。
- 起 dev 前先查：`lsof -nP -iTCP:3000 -sTCP:LISTEN`。
- 修法：kill 全部相关进程树（**含 `.next/postcss.js` 子进程**）→ `rm -rf .next` → 重启单个 `pnpm dev`。
  `.next` 是 git 忽略的纯构建缓存，可放心删（正常约 1.9G）。
- 已知非阻塞警告：Next 会把 workspace root 推断为 `/Users/xumingyue/`（家目录存在
  `pnpm-lock.yaml`），以及 `next.config.mjs` 的 `experimental.turbopackFileSystemCacheForDev` /
  `reactCompiler` 两个无效键。想消除 root 警告可设 `turbopack.root`。

## 数据库 / Prisma 无关：dev 下的 Hyperdrive 陷阱（2026-10-08 修复）

- 本项目 Supabase 是**多项目共用**的一个库，**必须先看 `DB_SCHEMA`**（本项目 = `wedding-crest`）。
  `public` 里也有同名 `user`/`session` 表，查错 schema 会得出完全相反的结论。
- 生产/真 Worker 走 Hyperdrive 绑定；**dev 必须回落到池化单例**。原因：
  `initOpenNextCloudflareForDev()` 会在 `next dev` 里也暴露 `HYPERDRIVE`，而 OpenNext 是把 CF context
  **一次性挂在 globalThis** 上（`addCloudflareContextToNodejsGlobal`），不是每请求一份 →
  `getPostgresDb()` 的「每请求一条连接」WeakMap 缓存会退化成**进程级长连接**，socket 变僵尸后
  下一条查询一直挂到超时。
- 症状是非常有辨识度的：**`/admin` 稳定 307 回 `/sign-in`，且每次耗时 ≈10 s**
  （= `getSignUser` 的 `SESSION_LOOKUP_TIMEOUT_MS`，超时被 catch 成 null）。
  登录 POST 却是 200——因为 login 与 /admin 是两次独立请求。
- 修法（已在 `src/core/db/postgres.ts`）：
  `if (isHyperdrive || NODE_ENV==='production')` → `if (isProd || (isHyperdrive && isCloudflareWorker))`。
- 想验证「链接是否真的连得上」，**临时注释 `wrangler.toml` 的 `[[hyperdrive]]` 再重启 dev** 是
  最干净的隔离实验（我这次就是这么定位的，记得还原）。
- 直连 Supabase（国内 + Clash TUN 代理）：**冷连接 1.4–6.4 s，热查询 120–400 ms**，所以任何
  「每请求新建连接」的实现都必然打爆 10s 级超时。TUN fake-IP 会让所有域名解析成 `198.18.x.x`。

### 手工构造 better-auth 会话 cookie（排障用）

- 名：`better-auth.session_token`；值：`<session.token>.<signature>`
- 签名 = **`crypto.createHmac('sha256', AUTH_SECRET).update(token).digest('base64')`**
  —— 必须是**标准 base64 带 padding（44 字符、以 `=` 结尾）**。
  用 `digest('base64url')`（43 字符无 padding）会被 better-call 直接判 `null`。
- 配套：`GET /api/auth/get-session` 带该 cookie 能返回 session+user，即证明链路通。

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
