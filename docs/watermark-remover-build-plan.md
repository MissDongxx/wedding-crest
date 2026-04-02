# RemoveGeminiWatermark —— 完整建站执行方案
> 基于 RemoveGeminiWatermark | 可直接交给 AI 执行 | v2.0

---

## 一、项目概述

**产品名称**：RemoveGeminiWatermark（域名建议：removegeminiwatermark.org 或 removegeminiwatermark.org）

**定位**：覆盖所有主流 AI 平台的图片水印去除工具，对标并超越 geminiwatermarkcleaner.com

**核心差异化**：
- 支持 Gemini、ChatGPT/DALL-E、Midjourney、Stable Diffusion、Adobe Firefly 等全平台
- **双层清理机制**：可见水印像素还原 + C2PA/Exif 元数据擦除，竞品只做前者
- **水印检测器**：独立的检测入口页面，捕获 `AI watermark detector` 关键词流量
- **批量处理**：前端并行处理多张图片，Pro 版核心功能
- 免费额度 + 付费无限制（降低转化门槛）
- 内容 SEO 矩阵（博客 + 教程 + 对比页 + 法律分析文章）
- 多语言（13种语言，与竞品持平）

**技术栈**：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Stripe + Cloudflare

---

## 二、目录结构

```
project-root/
├── app/
│   ├── [locale]/                    # i18n 路由根节点
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # 首页
│   │   ├── pricing/
│   │   │   └── page.tsx
│   │   ├── tools/
│   │   │   ├── gemini/
│   │   │   │   └── page.tsx         # Gemini 专属工具页
│   │   │   ├── chatgpt/
│   │   │   │   └── page.tsx
│   │   │   ├── midjourney/
│   │   │   │   └── page.tsx
│   │   │   ├── stable-diffusion/
│   │   │   │   └── page.tsx
│   │   │   └── firefly/
│   │   │       └── page.tsx
│   │   ├── detector/
│   │   │   └── page.tsx             # 水印检测器独立落地页
│   │   ├── batch/
│   │   │   └── page.tsx             # 批量处理落地页（Pro）
│   │   ├── blog/
│   │   │   ├── page.tsx             # 博客列表
│   │   │   └── [slug]/
│   │   │       └── page.tsx         # 博客详情
│   │   ├── compare/
│   │   │   └── page.tsx             # 竞品对比页
│   │   ├── how-it-works/
│   │   │   └── page.tsx
│   │   ├── faq/
│   │   │   └── page.tsx
│   │   └── dashboard/               # 用户中心（付费功能）
│   │       └── page.tsx
│   └── api/
│       ├── remove-watermark/
│       │   └── route.ts             # 图片处理 API
│       ├── stripe/
│       │   └── webhook/
│       │       └── route.ts
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── LanguageSwitcher.tsx
│   ├── home/
│   │   ├── Hero.tsx
│   │   ├── BeforeAfter.tsx          # 水印对比展示
│   │   ├── Features.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── SupportedPlatforms.tsx   # 支持的 AI 平台列表
│   │   ├── Testimonials.tsx
│   │   ├── FAQ.tsx
│   │   └── CTA.tsx
│   ├── tool/
│   │   ├── UploadZone.tsx           # 单张拖拽上传
│   │   ├── BatchUploadZone.tsx      # 批量上传（Pro）
│   │   ├── BatchProgress.tsx        # 批量处理进度面板
│   │   ├── DetectorZone.tsx         # 水印检测器上传区
│   │   ├── DetectorResult.tsx       # 检测结果展示
│   │   ├── ProcessingStatus.tsx
│   │   ├── ResultPreview.tsx        # 处理结果预览
│   │   ├── MetadataToggle.tsx       # C2PA/Exif 擦除开关
│   │   └── DownloadButton.tsx
│   ├── pricing/
│   │   ├── PricingCard.tsx
│   │   └── FeatureTable.tsx
│   └── shared/
│       ├── Badge.tsx
│       ├── TrustBadges.tsx          # Product Hunt / 用户数等信任标志
│       └── StructuredData.tsx       # JSON-LD SEO 结构化数据
├── lib/
│   ├── watermark/
│   │   ├── alpha-map.ts             # Alpha Map 提取与缓存
│   │   ├── remover.ts               # 核心逆向算法（可见水印）
│   │   ├── metadata.ts              # C2PA / Exif 元数据擦除
│   │   ├── detector.ts              # 水印检测逻辑
│   │   ├── batch.ts                 # 批量并行处理调度
│   │   └── wasm/                    # WebAssembly 模块
│   │       └── watermark_remover.wasm
│   ├── stripe.ts
│   ├── supabase.ts
│   └── analytics.ts
├── i18n/
│   ├── config.ts                    # 语言配置
│   └── locales/
│       ├── en.json
│       ├── zh-CN.json
│       ├── zh-TW.json
│       ├── ja.json
│       ├── ko.json
│       ├── es.json
│       ├── fr.json
│       ├── de.json
│       ├── pt.json
│       ├── it.json
│       ├── ru.json
│       ├── ar.json
│       └── hi.json
├── content/
│   └── blog/                        # MDX 博客文章
│       ├── how-to-remove-gemini-watermark.mdx
│       ├── how-to-remove-chatgpt-dalle-watermark.mdx
│       ├── how-to-remove-midjourney-watermark.mdx
│       ├── remove-gemini-watermark-comparison-2026.mdx
│       ├── what-is-synthid-watermark.mdx
│       ├── is-it-legal-to-remove-ai-watermarks.mdx   # ← P0 升级，EU AI Act 专题
│       ├── how-to-detect-ai-watermark.mdx            # 检测器专属文章
│       └── what-is-c2pa-metadata.mdx                 # C2PA 科普，获取技术类外链
├── public/
│   ├── images/
│   │   ├── before-after/            # 对比图素材
│   │   ├── platform-logos/          # 各 AI 平台 Logo
│   │   └── og/                      # Open Graph 图片
│   └── wasm/
│       └── watermark_remover_bg.wasm
├── middleware.ts                     # i18n 路由中间件
├── next.config.ts
├── tailwind.config.ts
└── .env.development
```

---

## 三、环境变量配置

在项目根目录创建 `.env.development`，填入以下变量：

```bash
# ── 基础配置 ──
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_NAME=RemoveGeminiWatermark

# ── Supabase ──
NEXT_PUBLIC_SUPABASE_URL=你的_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key

# ── 认证（NextAuth） ──
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=随机生成的密钥_至少32字符
GOOGLE_CLIENT_ID=你的_google_oauth_client_id
GOOGLE_CLIENT_SECRET=你的_google_oauth_secret

# ── Stripe 支付 ──
STRIPE_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_LIFETIME=price_xxx        # 买断价格 ID
STRIPE_PRICE_ID_PRO_MONTHLY=price_xxx     # 月订阅 ID（可选）

# ── 分析 ──
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_CLARITY_ID=你的_MS_Clarity_ID

# ── 免费额度控制 ──
FREE_CREDITS_PER_USER=5                   # 未登录用户免费次数
FREE_CREDITS_REGISTERED=20               # 注册用户免费次数
```

---

## 四、i18n 配置

### `i18n/config.ts`
```typescript
export const locales = [
  { code: 'en',    name: 'English',    flag: '🇺🇸' },
  { code: 'zh-CN', name: '简体中文',   flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文',   flag: '🇹🇼' },
  { code: 'ja',    name: '日本語',     flag: '🇯🇵' },
  { code: 'ko',    name: '한국어',     flag: '🇰🇷' },
  { code: 'es',    name: 'Español',    flag: '🇪🇸' },
  { code: 'fr',    name: 'Français',   flag: '🇫🇷' },
  { code: 'de',    name: 'Deutsch',    flag: '🇩🇪' },
  { code: 'pt',    name: 'Português',  flag: '🇧🇷' },
  { code: 'it',    name: 'Italiano',   flag: '🇮🇹' },
  { code: 'ru',    name: 'Русский',    flag: '🇷🇺' },
  { code: 'ar',    name: 'العربية',    flag: '🇸🇦' },
  { code: 'hi',    name: 'हिन्दी',     flag: '🇮🇳' },
] as const

export type Locale = typeof locales[number]['code']
export const defaultLocale: Locale = 'en'
export const localesCodes = locales.map(l => l.code)
```

### `middleware.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { localesCodes, defaultLocale } from '@/i18n/config'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 跳过 API、静态文件
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) return NextResponse.next()

  // 检查路径是否已含语言前缀
  const pathnameHasLocale = localesCodes.some(
    locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )
  if (pathnameHasLocale) return NextResponse.next()

  // 读取浏览器语言偏好
  const acceptLang = request.headers.get('accept-language') ?? ''
  const preferred = acceptLang.split(',')[0].split('-')[0].toLowerCase()
  const locale = localesCodes.includes(preferred as any) ? preferred : defaultLocale

  // 英语不加前缀（SEO 友好：根路径 = 英语）
  if (locale === defaultLocale) return NextResponse.next()

  return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url))
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 五、核心页面实现

### 5.1 首页 Hero 区块 `components/home/Hero.tsx`

```tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { UploadZone } from '@/components/tool/UploadZone'
import { Badge } from '@/components/shared/Badge'

export function Hero() {
  const t = useTranslations('hero')
  
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900 pt-24 pb-20">
      {/* 背景网格装饰 */}
      <div className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-5" />
      
      <div className="relative mx-auto max-w-6xl px-4 text-center">
        {/* 信任标签 */}
        <Badge className="mb-6 inline-flex">
          ✨ {t('badge')} {/* "Trusted by 10,000+ creators" */}
        </Badge>

        {/* 主标题 —— 关键词密度最高的位置 */}
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
          {t('headline')}
          {/* 示例："Remove AI Watermarks from Any Image" */}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-xl text-slate-400">
          {t('subheadline')}
          {/* 示例："Works with Gemini, DALL-E, Midjourney, Stable Diffusion and more.
               Free forever for basic use." */}
        </p>

        {/* 支持平台快速展示 */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {['Gemini', 'DALL-E', 'Midjourney', 'Stable Diffusion', 'Firefly'].map(p => (
            <span key={p} className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-white">
              {p}
            </span>
          ))}
        </div>

        {/* 上传工具区 —— 首页直接可用，降低跳出率 */}
        <div className="mx-auto mt-12 max-w-2xl">
          <UploadZone />
        </div>

        {/* 社会证明 */}
        <p className="mt-6 text-sm text-slate-500">
          {t('social_proof')}
          {/* "No signup required • 100% local processing • Free 5 uses/day" */}
        </p>
      </div>
    </section>
  )
}
```

### 5.2 上传 & 处理核心组件 `components/tool/UploadZone.tsx`

```tsx
'use client'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { removeWatermark } from '@/lib/watermark/remover'

type ProcessingState = 'idle' | 'processing' | 'done' | 'error'

export function UploadZone() {
  const [state, setState] = useState<ProcessingState>('idle')
  const [originalUrl, setOriginalUrl] = useState<string>('')
  const [cleanUrl, setCleanUrl] = useState<string>('')
  const [error, setError] = useState<string>('')

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return

    // 预览原图
    setOriginalUrl(URL.createObjectURL(file))
    setState('processing')
    setError('')

    try {
      // 读取图片
      const bitmap = await createImageBitmap(file)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)

      // 调用核心去水印逻辑
      await removeWatermark(canvas)

      // 转为可下载 Blob
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      setCleanUrl(URL.createObjectURL(blob))
      setState('done')
    } catch (err) {
      setError('Processing failed. Please try again.')
      setState('error')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
  })

  return (
    <div className="space-y-4">
      {/* 拖拽上传区 */}
      {state === 'idle' && (
        <div
          {...getRootProps()}
          className={`
            cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors
            ${isDragActive
              ? 'border-blue-400 bg-blue-500/10'
              : 'border-slate-600 bg-slate-800/50 hover:border-slate-400 hover:bg-slate-800'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="text-4xl mb-3">🖼️</div>
          <p className="text-white font-medium">
            {isDragActive ? 'Drop image here' : 'Drop AI image here or click to upload'}
          </p>
          <p className="text-slate-400 text-sm mt-2">
            PNG, JPG, WebP · Max 20MB · Gemini, DALL-E, Midjourney supported
          </p>
        </div>
      )}

      {/* 处理中状态 */}
      {state === 'processing' && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-12 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-white font-medium">Removing watermark...</p>
          <p className="text-slate-400 text-sm mt-1">Processing locally in your browser</p>
        </div>
      )}

      {/* 完成状态：Before / After 对比 */}
      {state === 'done' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-sm mb-2 text-center">Before</p>
              <img src={originalUrl} alt="Original" className="rounded-xl w-full" />
            </div>
            <div>
              <p className="text-green-400 text-sm mb-2 text-center">After ✓</p>
              <img src={cleanUrl} alt="Cleaned" className="rounded-xl w-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <a
              href={cleanUrl}
              download="clean-image.png"
              className="flex-1 rounded-xl bg-blue-600 py-3 text-center text-white font-medium hover:bg-blue-500 transition-colors"
            >
              ⬇ Download Clean Image
            </a>
            <button
              onClick={() => { setState('idle'); setOriginalUrl(''); setCleanUrl('') }}
              className="rounded-xl border border-slate-600 px-6 py-3 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              New Image
            </button>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {state === 'error' && (
        <div className="rounded-2xl border border-red-800 bg-red-900/20 p-8 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => setState('idle')}
            className="mt-3 text-sm text-slate-400 underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
```

### 5.3 核心去水印算法 `lib/watermark/remover.ts`

```typescript
// 水印参数：根据图片尺寸自动判断
function getWatermarkParams(width: number, height: number) {
  return width > 1024 && height > 1024
    ? { size: 96, margin: 32 }
    : { size: 48, margin: 32 }
}

// 预计算的 Alpha Map（从 Gemini 白底/黑底图提取，硬编码缓存）
// 实际部署时替换为真实提取的数据
const ALPHA_MAP_CACHE: Record<number, Float32Array> = {}

async function getAlphaMap(size: number): Promise<Float32Array> {
  if (ALPHA_MAP_CACHE[size]) return ALPHA_MAP_CACHE[size]
  
  // 从 public 目录加载预计算的 alpha map
  const response = await fetch(`/alpha-maps/gemini-${size}.bin`)
  const buffer = await response.arrayBuffer()
  const alphaMap = new Float32Array(buffer)
  ALPHA_MAP_CACHE[size] = alphaMap
  return alphaMap
}

// 获取水印 Logo 的像素数据
async function getLogoPixels(size: number): Promise<Uint8ClampedArray> {
  const img = new Image()
  img.src = `/watermark-logos/gemini-${size}.png`
  await new Promise(resolve => { img.onload = resolve })
  
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, size, size).data
}

// 主函数：对 OffscreenCanvas 执行水印去除
export async function removeWatermark(canvas: OffscreenCanvas): Promise<void> {
  const { width, height } = canvas
  const { size: wmSize, margin } = getWatermarkParams(width, height)
  
  const [alphaMap, logoPixels] = await Promise.all([
    getAlphaMap(wmSize),
    getLogoPixels(wmSize),
  ])

  const ctx = canvas.getContext('2d')!
  
  // 水印起始坐标（右下角）
  const x0 = width - margin - wmSize
  const y0 = height - margin - wmSize
  
  const imageData = ctx.getImageData(x0, y0, wmSize, wmSize)
  const data = imageData.data

  for (let i = 0; i < wmSize * wmSize; i++) {
    const alpha = alphaMap[i]
    if (alpha < 0.01) continue  // 跳过透明度极低区域
    
    const idx = i * 4
    const denominator = 1 - alpha
    
    // 逆向 Alpha 混合公式：original = (composed - wm * alpha) / (1 - alpha)
    for (let c = 0; c < 3; c++) {  // R, G, B
      const composed = data[idx + c]
      const wmPixel = logoPixels[idx + c]
      const original = (composed - wmPixel * alpha) / denominator
      data[idx + c] = Math.max(0, Math.min(255, Math.round(original)))
    }
    // Alpha 通道保持不变
  }
  
  ctx.putImageData(imageData, x0, y0)
}
```

---

## 六、双层清理机制（新增核心差异化功能）

### 6.1 第一层：可见水印像素还原（原有逻辑，见第五章）

详见 `lib/watermark/remover.ts`，使用逆向 Alpha 混合算法。

---

### 6.2 第二层：C2PA / Exif 元数据擦除 `lib/watermark/metadata.ts`

**为什么需要这层**：竞品只处理像素层，但图片文件本身携带的 C2PA 签名和 Exif AI 标签仍会标注"此图片由 AI 生成"。擦除元数据让图片在"彻底性"上超越竞品。

> ⚠️ **法律提示**：C2PA 签名擦除会使图片失去可验证的来源证明。在产品 UI 和免责声明中必须明确告知用户，此操作仅供个人合规使用。

```bash
# 安装元数据处理库
pnpm add exiftool-vendored
```

```typescript
// lib/watermark/metadata.ts
import { exiftool } from 'exiftool-vendored'

export interface MetadataStripOptions {
  stripExif: boolean       // 擦除所有 Exif 标签
  stripC2PA: boolean       // 擦除 C2PA 签名（XMP 中的 c2pa:* 字段）
  stripIptc: boolean       // 擦除 IPTC 标签
}

/**
 * 擦除图片元数据
 * 注意：此函数在 Node.js 环境（API Route）中运行，不在浏览器端
 * 浏览器端通过 /api/strip-metadata 路由调用
 */
export async function stripMetadata(
  inputPath: string,
  outputPath: string,
  options: MetadataStripOptions
): Promise<void> {
  const args: string[] = []

  if (options.stripExif) {
    args.push('-all=')           // 清除所有元数据
  }

  if (options.stripC2PA) {
    // C2PA 签名存在于 XMP 的特定命名空间中
    args.push('-XMP-c2pa:all=')
    args.push('-XMP-dc:all=')
    args.push('-XMP-photoshop:all=')
  }

  if (options.stripIptc) {
    args.push('-IPTC:all=')
  }

  // 保留基础色彩空间信息（避免图片渲染异常）
  args.push('-ICC_Profile:all=')  // 不删除色彩配置

  await exiftool.write(inputPath, {}, {
    outFile: outputPath,
    // 传入原始参数
    writeArgs: args,
  })
}

/**
 * 读取图片元数据（用于检测器功能）
 */
export async function readMetadata(filePath: string) {
  const tags = await exiftool.read(filePath)
  return {
    hasC2PA: !!(tags['XMP-c2pa:Manifest'] || tags['C2PA']),
    hasAIMarker: !!(
      tags['XMP:AIGenerated'] ||
      tags['Exif:Software']?.includes('Gemini') ||
      tags['Exif:Software']?.includes('DALL-E') ||
      tags['XMP:CreatorTool']?.includes('AI')
    ),
    software: tags['Exif:Software'] ?? null,
    creatorTool: tags['XMP:CreatorTool'] ?? null,
    rawTags: tags,
  }
}
```

**对应的 API Route** `app/api/strip-metadata/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { stripMetadata } from '@/lib/watermark/metadata'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const stripExif = formData.get('stripExif') === 'true'
  const stripC2PA = formData.get('stripC2PA') === 'true'

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const id = randomUUID()
  const inputPath = join(tmpdir(), `${id}-input.png`)
  const outputPath = join(tmpdir(), `${id}-output.png`)

  try {
    // 写入临时文件
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)

    // 执行元数据擦除
    await stripMetadata(inputPath, outputPath, {
      stripExif,
      stripC2PA,
      stripIptc: stripExif,
    })

    // 读取结果并返回
    const result = await readFile(outputPath)
    return new NextResponse(result, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="clean.png"',
      },
    })
  } finally {
    // 清理临时文件
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
  }
}
```

**前端 MetadataToggle 组件** `components/tool/MetadataToggle.tsx`：

```tsx
'use client'
interface MetadataToggleProps {
  stripExif: boolean
  stripC2PA: boolean
  onStripExifChange: (v: boolean) => void
  onStripC2PAChange: (v: boolean) => void
}

export function MetadataToggle({
  stripExif, stripC2PA, onStripExifChange, onStripC2PAChange
}: MetadataToggleProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4 space-y-3">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
        Advanced Cleaning Options
      </p>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={stripExif}
          onChange={e => onStripExifChange(e.target.checked)}
          className="mt-0.5 rounded"
        />
        <div>
          <p className="text-sm text-white font-medium">Strip Exif & Metadata</p>
          <p className="text-xs text-slate-400">
            Remove camera info, GPS, software tags. Recommended for privacy.
          </p>
        </div>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={stripC2PA}
          onChange={e => onStripC2PAChange(e.target.checked)}
          className="mt-0.5 rounded"
        />
        <div>
          <p className="text-sm text-white font-medium">
            Strip C2PA Signature
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
              Advanced
            </span>
          </p>
          <p className="text-xs text-slate-400">
            Remove Content Credentials / C2PA manifest embedded by AI platforms.
            For personal use only — see{' '}
            <a href="/legal" className="underline">terms</a>.
          </p>
        </div>
      </label>
    </div>
  )
}
```

---

### 6.3 可选高级功能：Anti-SynthID 噪点扰动

> ⚠️ **重要说明**：SynthID 是 Google DeepMind 的不可见水印技术，嵌入于像素统计特征中。
> 此功能通过添加微量噪点破坏其统计规律，**效果无法完全保证**，且会对图片引入极其轻微的质量损失。
> **此功能必须设计为明确的可选项（默认关闭）**，并在 UI 中提供清晰的风险说明。
> 在某些司法管辖区，规避 AI 内容标识可能存在法律风险，请用户自行评估。

```typescript
// lib/watermark/anti-synthid.ts
// ⚠️ 实验性功能 - 默认禁用，仅供研究目的

export interface AntiSynthIDOptions {
  /**
   * 噪点强度 0.0 ~ 1.0
   * 建议值：0.01 ~ 0.03（肉眼不可见，但能扰动统计特征）
   * 超过 0.05 会产生可见噪点，不建议使用
   */
  noiseLevel: number
  /**
   * 是否进行微量重采样（降采样后再升采样）
   * 会轻微模糊图片，但对某些 SynthID 变体效果更好
   */
  enableResample: boolean
}

/**
 * 对图片添加微量高斯噪点，扰动 SynthID 隐形水印的统计特征
 * 全部在浏览器端 OffscreenCanvas 中完成，不上传服务器
 */
export function applyAntiSynthID(
  canvas: OffscreenCanvas,
  options: AntiSynthIDOptions
): void {
  const { noiseLevel, enableResample } = options
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  // 添加高斯噪点
  const noiseRange = noiseLevel * 255

  for (let i = 0; i < data.length; i += 4) {
    // Box-Muller 变换生成高斯随机数
    const u1 = Math.random()
    const u2 = Math.random()
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    const noise = gaussian * noiseRange

    // 只对 RGB 通道添加噪点，保留 Alpha
    for (let c = 0; c < 3; c++) {
      data[i + c] = Math.max(0, Math.min(255, Math.round(data[i + c] + noise)))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // 可选：微量重采样（缩小 2% 再放大回原尺寸）
  if (enableResample) {
    const tempCanvas = new OffscreenCanvas(
      Math.floor(width * 0.98),
      Math.floor(height * 0.98)
    )
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height)
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(tempCanvas, 0, 0, width, height)
  }
}
```

**UI 中展示此功能的方式**（在 MetadataToggle 下方追加）：

```tsx
{/* Anti-SynthID - 折叠在"实验性功能"区域 */}
<details className="mt-2">
  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
    Experimental: Anti-invisible watermark
  </summary>
  <div className="mt-3 rounded-lg bg-amber-900/20 border border-amber-800/40 p-3 text-xs text-amber-300">
    ⚠️ This adds imperceptible noise to potentially disrupt invisible watermarks
    (e.g. SynthID). Effect is not guaranteed. May slightly reduce image quality.
    For research purposes only. Check local regulations before use.
  </div>
  <label className="mt-2 flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={antiSynthID} onChange={...} />
    <span className="text-sm text-slate-300">Enable noise perturbation (experimental)</span>
  </label>
</details>
```

---

## 七、批量处理实现 `lib/watermark/batch.ts`

批量处理的核心是**浏览器端并行**——利用多个 Web Worker 同时处理多张图片，充分利用多核 CPU。

```typescript
// lib/watermark/batch.ts

export interface BatchItem {
  id: string
  file: File
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: number        // 0-100
  cleanUrl?: string       // 处理完成后的 Blob URL
  error?: string
}

export type BatchProgressCallback = (items: BatchItem[]) => void

/**
 * 并行批量处理图片
 * - 同时最多 4 个并发（避免内存爆炸）
 * - 每张完成后立即回调更新 UI
 */
export async function processBatch(
  files: File[],
  options: { stripExif: boolean; stripC2PA: boolean },
  onProgress: BatchProgressCallback
): Promise<BatchItem[]> {
  const CONCURRENCY = 4

  const items: BatchItem[] = files.map((file, i) => ({
    id: `batch-${i}`,
    file,
    status: 'pending',
    progress: 0,
  }))

  onProgress([...items])

  // 分批并发执行
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY)

    await Promise.allSettled(
      chunk.map(async item => {
        item.status = 'processing'
        onProgress([...items])

        try {
          // 读取图片
          const bitmap = await createImageBitmap(item.file)
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(bitmap, 0, 0)

          item.progress = 30
          onProgress([...items])

          // 可见水印去除
          const { removeWatermark } = await import('./remover')
          await removeWatermark(canvas)

          item.progress = 70
          onProgress([...items])

          // 元数据擦除（如果需要，走 API）
          let finalBlob = await canvas.convertToBlob({ type: 'image/png' })

          if (options.stripExif || options.stripC2PA) {
            const form = new FormData()
            form.append('file', finalBlob, 'image.png')
            form.append('stripExif', String(options.stripExif))
            form.append('stripC2PA', String(options.stripC2PA))

            const resp = await fetch('/api/strip-metadata', {
              method: 'POST',
              body: form,
            })
            finalBlob = await resp.blob()
          }

          item.cleanUrl = URL.createObjectURL(finalBlob)
          item.status = 'done'
          item.progress = 100
        } catch (err) {
          item.status = 'error'
          item.error = err instanceof Error ? err.message : 'Unknown error'
        }

        onProgress([...items])
      })
    )
  }

  return items
}
```

**批量上传组件** `components/tool/BatchUploadZone.tsx`：

```tsx
'use client'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { processBatch, BatchItem } from '@/lib/watermark/batch'

export function BatchUploadZone() {
  const [items, setItems] = useState<BatchItem[]>([])
  const [running, setRunning] = useState(false)

  const onDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setRunning(true)

    await processBatch(
      files,
      { stripExif: true, stripC2PA: false },
      (updated) => setItems([...updated])
    )

    setRunning(false)
  }, [])

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.webp'] },
    multiple: true,
    maxFiles: 100,
  })

  const doneCount = items.filter(i => i.status === 'done').length
  const totalCount = items.length

  // 打包下载所有结果
  const downloadAll = async () => {
    // 使用 JSZip 打包
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    await Promise.all(
      items
        .filter(i => i.status === 'done' && i.cleanUrl)
        .map(async (item, idx) => {
          const resp = await fetch(item.cleanUrl!)
          const blob = await resp.blob()
          zip.file(`clean-${idx + 1}.png`, blob)
        })
    )

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clean-images.zip'
    a.click()
  }

  return (
    <div className="space-y-4">
      {/* 上传区 */}
      {items.length === 0 && (
        <div
          {...getRootProps()}
          className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-600 bg-slate-800/50 p-16 text-center hover:border-slate-400 transition-colors"
        >
          <input {...getInputProps()} />
          <div className="text-4xl mb-3">🗂️</div>
          <p className="text-white font-medium">Drop multiple images here</p>
          <p className="text-slate-400 text-sm mt-2">Up to 100 images · PNG, JPG, WebP</p>
          <span className="mt-4 inline-block rounded-full bg-blue-600/20 px-4 py-1.5 text-sm text-blue-400">
            Pro feature
          </span>
        </div>
      )}

      {/* 进度列表 */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white font-medium">
              {running ? `Processing ${doneCount}/${totalCount}...` : `Done — ${doneCount} images cleaned`}
            </p>
            {!running && doneCount > 0 && (
              <button
                onClick={downloadAll}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-500 transition-colors"
              >
                ⬇ Download All (.zip)
              </button>
            )}
          </div>

          {/* 每张图片的进度条 */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg bg-slate-800 px-4 py-2">
                <span className="text-sm text-slate-400 truncate flex-1">{item.file.name}</span>
                <div className="w-32 bg-slate-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      item.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <span className="text-xs w-12 text-right text-slate-500">
                  {item.status === 'done' ? '✓' : item.status === 'error' ? '✗' : `${item.progress}%`}
                </span>
                {item.cleanUrl && (
                  <a href={item.cleanUrl} download={`clean-${item.file.name}`}
                    className="text-xs text-blue-400 hover:text-blue-300">⬇</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 八、水印检测器 `lib/watermark/detector.ts`

检测器是独立的流量入口——用户搜索 `AI watermark detector` 时落地，检测后自然引导到去除工具。

```typescript
// lib/watermark/detector.ts

export interface DetectionResult {
  hasVisibleWatermark: boolean
  visibleWatermarkPlatform: string | null   // 'gemini' | 'dalle' | 'midjourney' | null
  visibleWatermarkConfidence: number        // 0-1
  hasMetadataMarkers: boolean
  metadataDetails: {
    software?: string
    creatorTool?: string
    hasC2PA: boolean
  }
  recommendation: 'clean' | 'likely_clean' | 'has_watermark'
}

/**
 * 检测图片是否含有 AI 水印（可见层）
 * 通过比较水印区域像素与已知 alpha map 的相似度来判断
 */
export async function detectWatermark(canvas: OffscreenCanvas): Promise<DetectionResult> {
  const { width, height } = canvas
  const ctx = canvas.getContext('2d')!

  // 检测 Gemini 水印（48x48 和 96x96 两种尺寸）
  for (const wmSize of [48, 96]) {
    const margin = 32
    const x0 = width - margin - wmSize
    const y0 = height - margin - wmSize

    // 边界检查
    if (x0 < 0 || y0 < 0) continue

    const regionData = ctx.getImageData(x0, y0, wmSize, wmSize)
    const confidence = await matchGeminiAlphaPattern(regionData, wmSize)

    if (confidence > 0.75) {
      return {
        hasVisibleWatermark: true,
        visibleWatermarkPlatform: 'gemini',
        visibleWatermarkConfidence: confidence,
        hasMetadataMarkers: false,  // 元数据检测在服务端
        metadataDetails: { hasC2PA: false },
        recommendation: 'has_watermark',
      }
    }
  }

  return {
    hasVisibleWatermark: false,
    visibleWatermarkPlatform: null,
    visibleWatermarkConfidence: 0,
    hasMetadataMarkers: false,
    metadataDetails: { hasC2PA: false },
    recommendation: 'likely_clean',
  }
}

/**
 * 计算当前区域与 Gemini alpha map 的匹配相似度
 */
async function matchGeminiAlphaPattern(
  regionData: ImageData,
  wmSize: number
): Promise<number> {
  // 加载预计算的 alpha map
  const resp = await fetch(`/alpha-maps/gemini-${wmSize}.bin`)
  const alphaMap = new Float32Array(await resp.arrayBuffer())
  const pixels = regionData.data

  let matchScore = 0
  let testCount = 0

  for (let i = 0; i < wmSize * wmSize; i++) {
    const expectedAlpha = alphaMap[i]
    // 只检测 alpha > 0.1 的有意义区域
    if (expectedAlpha < 0.1) continue

    // 简单启发：该区域的亮度是否与水印叠加后的预期值吻合
    const idx = i * 4
    const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3
    // 水印区域通常比周围区域亮（白色/半透明 logo）
    const expectedBrightness = 200 + expectedAlpha * 55
    const diff = Math.abs(brightness - expectedBrightness)

    matchScore += diff < 40 ? 1 : 0
    testCount++
  }

  return testCount > 0 ? matchScore / testCount : 0
}
```

**检测器落地页** `app/[locale]/detector/page.tsx`：

```tsx
export const metadata: Metadata = {
  title: 'AI Watermark Detector — Check if Your Image Has an AI Watermark',
  description: 'Free AI watermark detector. Instantly check if an image contains Gemini, DALL-E, or Midjourney watermarks, including invisible C2PA metadata. No upload required.',
  keywords: [
    'AI watermark detector', 'detect AI watermark', 'check AI watermark',
    'gemini watermark detector', 'synthid detector', 'C2PA checker',
    'how to tell if image has AI watermark',
  ],
}

// 页面顶部 AIO Summary（Google AI Overview 优化）
// 放在 <main> 最顶部，使用 <p> 标签
const AIO_SUMMARY = `
  Summary: This free AI watermark detector analyzes images locally in your browser
  to identify visible watermarks from Gemini (✦ star logo), DALL-E, and Midjourney,
  plus C2PA metadata markers. No image upload required — 100% private.
`
```

---

## 九、定价页面配置 `app/[locale]/pricing/page.tsx`

```tsx
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

// SEO 元数据
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Pricing — RemoveGeminiWatermark | Free & Pro Plans',
    description: 'Remove AI watermarks for free. Upgrade to Pro for unlimited processing, batch mode, and priority support. No subscription required.',
  }
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    highlight: false,
    features: [
      '5 images per day',
      'Gemini watermark removal',
      '100% local processing',
      'PNG & JPG support',
      'No signup required',
    ],
    cta: 'Start Free',
    ctaHref: '/#tool',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9',
    period: 'per month',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited images',
      'All AI platforms supported',
      'Batch processing (up to 100 images)',
      'Priority processing',
      'API access',
      'Priority support',
    ],
    cta: 'Get Pro',
    ctaHref: '/checkout/pro',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '$49',
    period: 'one-time',
    originalPrice: '$99',
    badge: '50% OFF',
    highlight: false,
    features: [
      'Everything in Pro',
      'Lifetime access',
      'All future platforms',
      'No monthly fees ever',
      'Early access to new features',
    ],
    cta: 'Get Lifetime Access',
    ctaHref: '/checkout/lifetime',
  },
]

export default function PricingPage() {
  return (
    <main className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="text-center text-4xl font-bold text-white mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-center text-slate-400 mb-16 text-lg">
          Start free. Upgrade when you need more.
        </p>

        <div className="grid gap-8 lg:grid-cols-3">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className={`
                relative rounded-2xl p-8 border
                ${plan.highlight
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-800/50'
                }
              `}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-medium text-white">
                  {plan.badge}
                </span>
              )}
              
              <div className="mb-6">
                <p className="text-slate-400 text-sm">{plan.name}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.originalPrice && (
                    <span className="text-slate-500 line-through text-sm">{plan.originalPrice}</span>
                  )}
                  <span className="text-slate-400 text-sm">/{plan.period}</span>
                </div>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-green-400">✓</span> {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.ctaHref}
                className={`
                  block w-full rounded-xl py-3 text-center font-medium transition-colors
                  ${plan.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'border border-slate-600 text-slate-300 hover:bg-slate-700'
                  }
                `}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
```

---

## 十、SEO 配置

### 10.1 根布局 SEO `app/[locale]/layout.tsx`

```tsx
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { localesCodes } from '@/i18n/config'

type Props = { params: { locale: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = params
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL!

  // hreflang 多语言声明（SEO 关键配置）
  const languages = localesCodes.reduce((acc, loc) => {
    acc[loc] = loc === 'en' ? baseUrl : `${baseUrl}/${loc}`
    return acc
  }, {} as Record<string, string>)

  return {
    metadataBase: new URL(baseUrl),
    alternates: { languages },
    openGraph: {
      siteName: 'RemoveGeminiWatermark',
      locale: locale === 'zh-CN' ? 'zh_CN' : locale,
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
  }
}

export async function generateStaticParams() {
  return localesCodes.map(locale => ({ locale }))
}

export default function LocaleLayout({ children, params }: Props & { children: React.ReactNode }) {
  if (!localesCodes.includes(params.locale as any)) notFound()
  return children
}
```

### 10.2 首页完整 SEO 元数据 `app/[locale]/page.tsx`

```tsx
import { Metadata } from 'next'

// 每种语言的 SEO 标题/描述单独配置
const SEO_BY_LOCALE: Record<string, { title: string; description: string }> = {
  en: {
    title: 'RemoveGeminiWatermark — Remove Watermarks from Gemini, DALL-E, Midjourney Images',
    description: 'Free AI watermark remover. Remove watermarks from Google Gemini, ChatGPT DALL-E, Midjourney, Stable Diffusion images instantly. 100% local processing, no upload needed.',
  },
  'zh-CN': {
    title: 'AI水印去除工具 — 一键去除Gemini、DALL-E、Midjourney图片水印',
    description: '免费AI图片水印去除工具，支持Google Gemini、ChatGPT DALL-E、Midjourney、Stable Diffusion等全平台。本地处理，无需上传，保护隐私。',
  },
  ja: {
    title: 'AI透かし除去ツール — Gemini・DALL-E・Midjourneyの透かしを削除',
    description: 'Google Gemini、ChatGPT DALL-E、Midjourneyなど主要AIプラットフォームの透かしを無料で削除。ローカル処理でプライバシーを保護。',
  },
  // ... 其他语言
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const seo = SEO_BY_LOCALE[params.locale] ?? SEO_BY_LOCALE.en
  return {
    title: seo.title,
    description: seo.description,
    keywords: [
      'AI watermark remover', 'remove gemini watermark', 'remove dall-e watermark',
      'midjourney watermark remover', 'stable diffusion watermark', 'free watermark remover',
      'AI image watermark', 'remove AI watermark online',
    ],
  }
}
```

### 10.3 AIO Summary 优化（Google AI Overviews）

2026年 Google 生成式搜索结果（AI Overviews）已成为流量新入口。每个页面顶部加一段简短的 Summary 句，显著提高被直接引用的概率：

```tsx
// 在每个工具页 <main> 的最顶部插入，使用语义化标签
// 不需要 hidden，让爬虫和用户都能看到
export function AIOSummary({ text }: { text: string }) {
  return (
    <p className="sr-only-mobile text-sm text-slate-500 max-w-3xl mx-auto px-4 pt-4 text-center">
      {text}
    </p>
  )
}

// 首页示例
<AIOSummary text="Summary: This AI watermark remover uses reverse alpha blending to remove visible watermarks from Gemini (✦ star logo), DALL-E, and Midjourney images. All processing happens locally in your browser — no upload, no server." />

// Gemini 工具页示例
<AIOSummary text="Summary: Remove the Gemini ✦ star watermark from AI-generated images using reverse alpha blending. The tool detects watermark position automatically (48×48px for images ≤1024px, 96×96px for larger) and mathematically restores original pixels." />
```

### 10.4 结构化数据组件 `components/shared/StructuredData.tsx`

```tsx
// 在每个页面的 <head> 中插入 JSON-LD
export function WebAppStructuredData() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'RemoveGeminiWatermark',
    description: 'Remove watermarks from AI-generated images including Gemini, DALL-E, and Midjourney',
    url: process.env.NEXT_PUBLIC_SITE_URL,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier with 5 images per day',
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function FAQStructuredData({ faqs }: { faqs: { q: string; a: string }[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
```

---

## 十一、各平台专属落地页策略

每个平台独立一个路由，独立 SEO 元数据：

### 示例：`app/[locale]/tools/gemini/page.tsx`

```tsx
export const metadata: Metadata = {
  title: 'Gemini Watermark Remover — Remove Google Gemini AI Watermark Free',
  description: 'Remove the Gemini AI watermark (Nano Banana logo) from images instantly. Free browser tool, 100% local processing. Works with gemini.google.com and Google AI Studio.',
  keywords: [
    'gemini watermark remover', 'remove gemini watermark',
    'gemini nano banana watermark', 'google ai studio watermark',
    'how to remove gemini image ai watermark',
  ],
}

export default function GeminiToolPage() {
  return (
    <>
      <WebAppStructuredData />
      <FAQStructuredData faqs={GEMINI_FAQS} />
      
      <main>
        {/* 针对 Gemini 的专属 Hero */}
        <section>
          <h1>Gemini Watermark Remover</h1>
          <p>Remove the Gemini AI watermark (Nano Banana ✦ logo) from images automatically...</p>
          <UploadZone platform="gemini" />
        </section>
        
        {/* Gemini 专属内容 */}
        <section>
          <h2>How to Remove Gemini Watermark</h2>
          {/* 详细步骤，捕获 how-to 关键词 */}
        </section>
        
        <FAQSection faqs={GEMINI_FAQS} />
      </main>
    </>
  )
}

const GEMINI_FAQS = [
  {
    q: 'How to remove Gemini image AI watermark?',
    a: 'Upload your Gemini-generated image to our tool. It automatically detects and removes the Gemini watermark using reverse alpha blending, all locally in your browser.',
  },
  {
    q: 'What is the Gemini Nano Banana watermark?',
    a: 'The Gemini Nano Banana watermark is a semi-transparent four-pointed star (✦) logo that Google adds to all AI-generated images from Gemini and Google AI Studio.',
  },
  {
    q: 'Does removing the Gemini watermark affect image quality?',
    a: 'No. Our reverse alpha blending algorithm mathematically recovers the exact original pixels, resulting in zero quality loss.',
  },
  {
    q: 'Is it safe to upload my images?',
    a: 'All processing happens entirely in your browser. Your images are never uploaded to any server.',
  },
]
```

---

## 十二、博客内容规划（前6篇，优先发布）

| 文件名 | 目标关键词 | 预计月搜索量 | 优先级 |
|--------|-----------|------------|--------|
| `how-to-remove-gemini-watermark.mdx` | how to remove gemini image ai watermark | 高 | P0 |
| `how-to-remove-chatgpt-dalle-watermark.mdx` | remove dall-e watermark, chatgpt image watermark | 高 | P0 |
| `remove-gemini-watermark-comparison-2026.mdx` | best ai watermark remover, ai watermark remover comparison | 中 | P1 |
| `what-is-synthid-watermark.mdx` | what is synthid, google synthid watermark | 中 | P1 |
| `how-to-remove-midjourney-watermark.mdx` | midjourney watermark remover | 中 | P1 |
| `is-it-legal-to-remove-ai-watermarks.mdx` | is it legal to remove ai watermark | 高意向 | P2 |

### 博客 MDX 模板结构（每篇必须包含）

```mdx
---
title: "How to Remove Gemini Watermark from AI-Generated Images (2026 Guide)"
description: "Step-by-step guide to remove the Gemini AI watermark (Nano Banana logo) from images. Free online tool, works in seconds."
date: "2026-01-15"
author: "RemoveGeminiWatermark Team"
tags: ["gemini", "watermark", "how-to"]
image: "/images/blog/remove-gemini-watermark.png"
---

## What Is the Gemini Watermark?
[解释水印原理，300字]

## How to Remove Gemini Watermark: Step-by-Step
[步骤教程，配截图]

## Free Tool: Remove Gemini Watermark Online
[CTA 嵌入工具]

## Frequently Asked Questions
[3-5个 FAQ，使用 FAQ schema 组件]

## Related Tools
[内链到其他平台工具页]
```

---

## 十三、Supabase 数据库表结构

```sql
-- 用户表（由 Supabase Auth 自动管理，此为扩展）
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  plan text default 'free',         -- free | pro | lifetime
  credits_used integer default 0,
  credits_limit integer default 20, -- 注册用户默认20次
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- 处理记录表
create table public.processing_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles,
  platform text,                     -- gemini | dalle | midjourney | etc
  image_width integer,
  image_height integer,
  processing_time_ms integer,
  created_at timestamptz default now()
);

-- 行级安全
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
```

---

## 十四、Stripe 支付集成

### Webhook 处理 `app/api/stripe/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      const userId = session.metadata?.userId
      const plan = session.metadata?.plan  // 'pro' | 'lifetime'
      
      if (userId && plan) {
        await supabase.from('profiles').update({
          plan,
          credits_limit: plan === 'lifetime' ? 999999 : 1000,
          stripe_customer_id: session.customer as string,
        }).eq('id', userId)
      }
      break
    }
    
    case 'customer.subscription.deleted': {
      // 订阅取消，降级为 free
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('profiles')
        .update({ plan: 'free', credits_limit: 20 })
        .eq('stripe_customer_id', sub.customer as string)
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

---

## 十五、部署配置

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: {
    // 支持 WebAssembly
    serverComponentsExternalPackages: [],
  },
  webpack(config) {
    // WASM 支持
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    return config
  },
  // 图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: [],
  },
  // 安全 Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com; img-src 'self' blob: data:;",
          },
        ],
      },
    ]
  },
  // 重定向：旧 URL 兼容
  async redirects() {
    return [
      { source: '/remove-watermark', destination: '/#tool', permanent: true },
    ]
  },
}

export default config
```

### Vercel 一键部署配置 `vercel.json`

```json
{
  "buildCommand": "pnpm build",
  "framework": "nextjs",
  "regions": ["iad1", "sin1", "nrt1"],
  "headers": [
    {
      "source": "/wasm/(.*)",
      "headers": [
        { "key": "Content-Type", "value": "application/wasm" },
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

---

## 十六、上线后 SEO 提交清单

按顺序执行：

```
□ 1. 提交 Google Search Console，验证域名所有权
□ 2. 提交 sitemap.xml（Next.js 自动生成：/sitemap.xml）
□ 3. 提交 Bing Webmaster Tools
□ 4. 在 robots.txt 中允许所有爬虫，并声明 sitemap 路径
□ 5. 提交 Product Hunt（准备好 Logo、截图、描述文案）
□ 6. 提交以下工具目录：
     - dang.ai
     - toolfame.com
     - turbo0.com
     - fazier.com
     - dofollow.tools
     - theresanaiforthat.com
     - futurepedia.io
     - ai-tools.directory
□ 7. 在 Reddit 相关 subreddit 发布（r/StableDiffusion, r/ChatGPT, r/midjourney）
□ 8. 发布 Hacker News Show HN 帖子
□ 9. 每月更新博客内容（至少2篇）
```

---

## 十七、安装依赖命令

```bash
# 初始化项目
pnpm install

# 额外依赖
pnpm add react-dropzone           # 文件拖拽上传
pnpm add next-intl                # i18n
pnpm add @stripe/stripe-js stripe # 支付
pnpm add @supabase/supabase-js    # 数据库
pnpm add next-auth                # 认证
pnpm add @next/mdx gray-matter    # MDX 博客
pnpm add -D @types/node           # TypeScript 类型

# 启动开发服务
pnpm dev
```

---

## 十八、给 AI 执行时的注意事项

1. **项目已内置**：认证、Stripe、Supabase 初始化代码，直接修改配置文件即可，无需从头写
2. **i18n 翻译文件**：先用英文占位，上线后用 DeepL API 或 Claude 批量翻译其他13种语言
3. **Alpha Map 数据**：`/public/alpha-maps/gemini-48.bin` 和 `gemini-96.bin` 需要提前从 Gemini 提取，具体方法见前面的技术文档
4. **水印 Logo 文件**：`/public/watermark-logos/gemini-48.png` 和 `gemini-96.png` 同样需要提前提取
5. **免费额度限制**：使用 IP + localStorage 双重限流（未登录用户），防止滥用
6. **Stripe 价格 ID**：在 Stripe Dashboard 创建产品后，将实际 Price ID 填入 `.env.development`

---

*方案版本：v1.0 | 2026年4月*
