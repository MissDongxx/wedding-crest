# Maker / Founder Profile — Draft

四个小节与表单字段一一对应，可直接复制粘贴。
**【】内是我无法从项目里确认、需要你补填或确认的内容。** 凡是没标【】的，都是已从仓库 / 线上 / 项目矩阵中核实过的事实。

---

## 1. Professional background & experience

### Short version（约 40 词，适合表单里的小输入框）

> I'm an independent product developer who designs, ships, and operates AI-powered consumer web products end to end — from product and front-end to payments, infrastructure, and SEO. My work focuses on turning AI models into dependable, self-serve tools people actually pay for.

### Standard version（约 130 词，适合 About 页 / 申请表长文本框）

> I'm an independent product developer and the sole builder behind Wedding Crest Design. I work across the entire stack of a consumer product: product design and front-end, payment and subscription infrastructure, database and edge deployment, and SEO-driven distribution.
>
> Over the past 【X】 years I've shipped and operated a portfolio of AI-powered web products — including NailShapes (thenailshapes.com), an AI nail-discovery and virtual try-on platform, and Product Hunt Opportunity Radar, an internal research tool that pairs a Chrome extension with a Cloudflare Worker to collect market data at scale.
>
> My focus is the unglamorous half of AI products: making generation reliable and affordable, making the output actually usable (crisp typography, print-ready files), and making the whole thing self-serve so a customer can go from idea to finished asset in minutes without talking to me.

### Capabilities（可选的技能清单，表单里如果需要就附上）

- **Product**: solo 0→1 shipping, positioning, pricing, self-serve onboarding
- **Front-end**: Next.js (App Router), React, TypeScript, Tailwind
- **Back-end & data**: Postgres/Supabase, Prisma, better-auth, Cloudflare D1
- **Edge & infra**: Cloudflare Workers, OpenNext, wrangler, CI/CD deploys
- **AI**: image generation pipelines (Google Gemini "Nano Banana" via Runware), reference-image conditioning, provider fallbacks
- **Payments & compliance**: Stripe, Creem, Waffo; checkout, webhooks, subscription lifecycle, KYC/AUP compliance
- **Growth**: multilingual sites (8 locales), programmatic SEO, sitemap/hreflang, browser-extension data tooling

### 【待确认】

- 从业年限（我写的占位是 "over 【X】 years"）
- 此前是否有公司/机构任职经历。如果有雇主，这段要改成"职业经历 + 独立开发"双线；如果一直是独立开发者，把 last 段提上来即可。

---

## 2. LinkedIn / Twitter / GitHub profiles

| Profile | Link |
| --- | --- |
| GitHub | https://github.com/MissDongxx |
| LinkedIn | 【待填，或写 "Not available — contact: support@weddingcrestdesign.com"】 |
| X (Twitter) | 【待填，同上】 |

Notes:

- GitHub 是从本仓库 remote 里读到的（`github.com/MissDongxx/wedding-crest`），确认一下是不是你希望对外展示的账号。
- 仓库目前是 **public 还是 private** 需要你确认。如果表单方要去核验代码，最好挑一个能公开的代表性仓库（或把 wedding-crest 改成 public）。
- 如果 LinkedIn / Twitter 确实没有：**不要留空**。写作上建议统一成一句——"No public LinkedIn/X presence; I ship under the brand and can be reached at support@weddingcrestdesign.com." 空白栏在人工审查里比"没有"更可疑。

---

## 3. Previous projects or companies

### 建议提交的核心三项

| Project | What it is | Link | Status |
| --- | --- | --- | --- |
| **Wedding Crest Design** | Custom wedding crest, monogram and stationery identity kits: AI-illustrated crest artwork composed with programmatically set typography, delivered as print-ready files in minutes. | weddingcrestdesign.com | Live, current focus |
| **NailShapes** | AI nail-discovery and virtual try-on platform: analyses a hand photo, returns two nail-shape recommendations, generates colour previews on the user's own photo. Full accounts, credits, billing and an operations console. | thenailshapes.com | Live |
| **Product Hunt Opportunity Radar** | Research tooling: daily Product Hunt candidate discovery, browser-extension data collection at scale (traffic, channels, organic keywords) into Cloudflare D1, domain-age enrichment via RDAP. | 【是否公开？private repo 就写 "Internal tool, not publicly available"】 | In use |

### 早期 / 实验性项目（按需选 1–2 个附在后面，别全列）

- **Remove Gemini Watermark** — utility for cleaning up watermark artefacts from Google Gemini generated images
- **FaceShapes / RoofCost / Era Calculator / Coloring / MLB Optimizer** — 一批小型 AI 与计算工具，用于验证分发和转化假设

> 写法建议：核心三项写成表格或三段，早期项目一句话带过。审查方在意的是"这个人能持续把产品做出来并且是活的"，不是项目数量。

---

## 4. Why you're building this product

### One-liner（表单里只有一行时用）

> Because a personalised crest should take minutes and cost less than a bouquet — not three weeks and a designer's deposit.

### Paragraph version（约 120 词，推荐主用）

> Couples want one thing that is unmistakably *theirs* — a crest for the invitation, the welcome sign, the wax seal. The traditional route is an illustrator on Etsy: $150–500, one to three weeks, several rounds of revisions, and you don't see anything until you've paid a deposit. Meanwhile generic AI image tools get you halfway there: the ornamental artwork is beautiful, but the lettering is garbled — and names, initials and dates are exactly the part that has to be perfect.
>
> So I built the product I wanted to exist: AI handles the illustration, deterministic code handles the typography, and the output is print-ready. A couple types their names, picks a direction, and has a finished crest for $9.9 in minutes — no email thread, no deposit, no waiting.

### 如果你的真实动机更个人化，把下面这段换进去（二者选一）

> 【可选】I started building this around my own 【wedding / a friend's wedding / the moment I saw how much a monogram cost】. What stuck with me wasn't the design work — it was how many couples gave up on having a crest at all because the process was slow and opaque. That's a solvable problem, and it's the kind of problem I like working on: AI does the creative part, code does the part that has to be exact.

### 一句话可验证的产品事实（需要"证据"时附上）

- 交付时间：分钟级，生成后即可下载（无需人工介入）
- 价格：$9.9 一次性（对应 Wedding Image Pack）
- 输出：AI 生成的纹章图形 + 程序化排版的文字，印刷可用
- 生成模型：Google Gemini 图像模型（"Nano Banana"，经 Runware 调用），已在隐私政策与 AUP 中披露

---

## 5. Products and platform details

> 对应字段："Describe what you're selling: features, pricing model, and target customers"。
> 下面每个数字都是从 `src/config/locale/messages/en/pages/pricing.json`、`index.json`、`create.json`
> 里核出来的，不是概括说法——审查方要的就是这种颗粒度。

### Short version（约 110 词，适合中等长度的文本框）

> I sell **Wedding Crest Design** (weddingcrestdesign.com), a self-serve web app that turns a couple's
> names, date and story into a finished wedding crest — the illustrated emblem used across invitations,
> signage, menus and favors. Couples design and preview for free; a one-time **$9.90 Wedding Image Pack**
> unlocks watermark-free, source-quality image files. There is no subscription and no recurring billing.
> The product serves engaged couples planning a wedding, particularly DIY and budget-conscious couples who
> don't want to pay an illustrator $150–500 for a weeks-long email thread. The app runs in 8 languages,
> is hosted on Cloudflare, and accepts payment via Stripe, PayPal, Creem and Waffo.

### What I'm selling（结构化版，适合有子字段的表单）

**Product:** Wedding Crest Design — a browser-based design studio that generates a custom wedding crest
(monogram + illustrated emblem) and delivers it as downloadable, print-ready image files.

**Category:** one-time digital goods / AI-assisted design tool. **Not** a subscription, **not** a
marketplace, **not** physical goods.

### Features（key features and use cases）

**Design inputs**

- 6 illustrated crest styles, 12 layouts, 7 curated wedding palettes, 8 typography pairings
- Custom hex colours (up to 3 per crest) to match existing stationery exactly
- Illustration detail levels: minimal / balanced / rich
- Personalisation: couple's names, wedding date, location, venue, flowers & foliage, and up to 2 personal
  motifs (a pet, a family crest, a monogram) plus up to 2 reference photos painted into the crest
- Optionally start from any gallery example and swap in your own names and colours

**Generation and iteration**

- AI renders artwork, border, names, initials and date together as one cohesive image
  (Google's Gemini image models — "Nano Banana" family — accessed via Runware)
- Free live preview while designing; no account required to try
- Edits and regenerations: change lettering, layout, palette, flowers, motifs or border and re-render
- Generation history per project

**Delivery**

- Download the selected original crest plus every completed variation, watermark-free, in their original
  PNG / JPEG / WebP format
- A usage guide with the exact palette values used
- Commercial use permitted for the buyer's own wedding

**Platform**

- Web app (Next.js), no install, desktop and mobile browsers
- Account area with a saved-project library (`/my-designs`)
- Free tier includes 1 saved project and 5 total generations

**Use cases:** invitations and save-the-dates, ceremony programs, dinner menus, welcome signage, favor
tags, wax seals, wedding websites — one mark tying the whole celebration together.

### Pricing model（specific pricing tiers）

| Tier | Price | Billing | What's included |
| --- | --- | --- | --- |
| **Free** | **$0** | free forever, no credit card | Design and preview: 1 saved project, 1 finished crest per generation, 5 total generations, all 6 styles/layouts/palettes, watermarked previews |
| **Wedding Image Pack** | **$9.90 one-time** | single payment, no auto-renew | Everything in Free, plus: watermark-free source-quality files, 3 regenerations, the selected original crest **and** every completed variation, original PNG/JPEG/WebP files, usage guide with palette values, commercial use for your wedding |

- **No subscription.** One purchase, no recurring billing, no renewal, no per-seat pricing.
- All prices in **USD**, shown at checkout.
- Digital product delivered immediately → sales are final and non-refundable except where required by law
  (stated in the Terms of Service, with refunds and chargebacks handled via the original payment method).
- Payment methods: **Stripe, PayPal, Creem, Waffo**. Card data is handled entirely by the providers; we
  never receive or store full card details.

### Target customers（who buys this）

**Primary — engaged couples planning a wedding**

- Typically 6–18 months out from the date, actively assembling their wedding identity
- DIY and budget-conscious couples who want a cohesive crest but won't pay an illustrator $150–500 and
  wait one to three weeks
- Micro-weddings, elopements and destination weddings, where couples want something personal and fast
- Couples matching an existing stationery suite — they bring their own hex codes

**Secondary**

- Wedding planners and stationers who need a fast concept or placeholder crest for a client's moodboard
- Design-minded couples who want to iterate on several directions before committing

**Explicitly out of scope / licence limits**

- Not licensed for resale: the commercial-use grant covers the buyer's own wedding, not a stationery
  business reselling crests to clients. 【如果实际打算开放给商家，这句要改，且定价逻辑也得改】

---

## 待你确认的清单（按重要度排序）

1. 这四个字段是**提交给谁**的？（支付渠道合规审查 / 项目申请 / Product Hunt maker 主页 / 官网 About）—— 决定篇幅和"公司 vs 个人"的口径。
2. 身份口径：**纯独立开发者**，还是有**公司主体 / 团队**？有主体的话第一段要重写。
3. LinkedIn / Twitter 链接（没有的话我按上面那条"统一话术"改写）。
4. 从业年限，以及是否有前雇主需要写进去。
5. "Why you're building this" 用**通用版**还是**个人动机版**（需要你给真实动因，我不编）。
6. **产品命名前后不一致**：定价卡写 **"Wedding Image Pack"**，而首页 FAQ 和结果页 unlock 面板写
   **"Wedding Identity Pack"**，`product_id` 又是 `wedding_identity_pack`。对外提交材料里两边都会出现，
   审查方顺着看会发现，建议先统一成一个名字（我建议以定价卡为准，因为它是扣款配置）。
7. **法务页只有 en / zh 两份**，但 footer 在 8 个语言里都链了 `/acceptable-use`、`/privacy-policy`、
   `/terms-of-service` —— 即 `/de/acceptable-use`、`/ko/privacy-policy` 这类链接**点进去是 404**。
   合规审查最容易点到的就是这里。两条路：给每个语言补 `.xx.mdx`，或给 `getLocalPage()` 加英语回退
   （`source.config.ts` 的 `defineDocs` 目前没配 fallbackLanguage，不会自动回退）。
8. 第 5 节末尾那条**授权范围**：现在写的是 "Commercial use for your wedding"（仅限买家自己的婚礼）。
   如果实际想放给婚庆/文具商家商用，这段和我写的"out of scope"都要改，定价逻辑也得跟着变。
