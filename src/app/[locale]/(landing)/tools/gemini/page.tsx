import { Metadata } from 'next';

import { UploadZone } from '@/shared/components/watermark/UploadZone';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Gemini Watermark Remover — Remove Google Gemini AI Watermark Free',
    description:
      'Remove the Gemini AI watermark (✦ star logo) from images instantly. Free browser-based tool with 100% local processing. No upload required, your data never leaves your device.',
    keywords: [
      'gemini watermark remover',
      'remove gemini watermark',
      'google gemini watermark',
      'gemini ai watermark',
      'gemini image watermark',
      'remove ai watermark',
      'gemini star logo',
      'ai watermark cleaner',
    ],
    openGraph: {
      title: 'Gemini Watermark Remover — Free AI Watermark Removal Tool',
      description:
        'Remove the Gemini AI watermark from images instantly. 100% local processing, no upload required.',
      type: 'website',
    },
  };
}

// FAQ data for structured data and display
const faqItems = [
  {
    question: 'How does the Gemini watermark remover work?',
    answer:
      'Our tool uses reverse alpha blending to mathematically remove the semi-transparent Gemini star (✦) watermark from your images. It analyzes the watermark region in the bottom-right corner and recovers the original pixel values with zero quality loss.',
  },
  {
    question: 'Is my image uploaded to a server?',
    answer:
      'No! All processing happens 100% locally in your browser using the Canvas API. Your image data never leaves your device. This ensures complete privacy and security.',
  },
  {
    question: 'What image formats are supported?',
    answer:
      'We support PNG, JPEG, and WebP formats up to 20MB. The processed image is always saved as PNG to preserve quality.',
  },
  {
    question: 'How many images can I process for free?',
    answer:
      'You can process up to 5 images per day for free. For unlimited processing, upgrade to our Pro plan at just $9/month.',
  },
  {
    question: 'Does it remove the invisible SynthID watermark too?',
    answer:
      'The current version removes the visible star (✦) logo watermark. SynthID is an invisible watermark embedded in the pixel data — support for this is planned for a future update.',
  },
  {
    question: 'Will removing the watermark affect image quality?',
    answer:
      'For the visible watermark, our reverse alpha blending algorithm recovers the original pixels mathematically, resulting in zero quality loss in the watermark region.',
  },
];

export default function GeminiToolPage() {
  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Gemini Watermark Remover',
    description:
      'Free tool to remove Google Gemini AI watermarks from images',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Remove Gemini star watermark',
      '100% browser-based processing',
      'No image upload required',
      'PNG, JPG, WebP support',
      'Free tier with 5 images/day',
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="pt-24 pb-16 md:pt-36">
        {/* Hero Section */}
        <div className="mx-auto mb-12 max-w-3xl px-4 text-center">
          <div className="bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium">
            <span>✦</span>
            <span>Gemini Watermark Remover</span>
          </div>

          <h1 className="text-foreground mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Remove{' '}
            <span className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-transparent">
              Gemini AI Watermark
            </span>{' '}
            Instantly
          </h1>

          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Remove the Google Gemini star (✦) watermark from AI-generated images.
            100% local processing — your images never leave your device.
          </p>
        </div>

        {/* Upload Zone */}
        <div className="mx-auto max-w-4xl px-4">
          <UploadZone />
        </div>

        {/* How It Works */}
        <div className="mx-auto mt-24 max-w-4xl px-4">
          <h2 className="text-foreground mb-12 text-center text-3xl font-bold">
            How It Works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Upload Image',
                description:
                  'Drag & drop or click to upload your Gemini AI-generated image. Supports PNG, JPG, and WebP.',
              },
              {
                step: '02',
                title: 'Auto-Remove',
                description:
                  'Our algorithm detects and removes the watermark locally in your browser. No server processing.',
              },
              {
                step: '03',
                title: 'Download Clean',
                description:
                  'Download your clean image instantly. Original quality preserved with no artifacts.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group relative rounded-xl border p-6 transition-colors hover:border-primary/30"
              >
                <span className="text-primary/20 text-5xl font-bold">
                  {item.step}
                </span>
                <h3 className="text-foreground mt-2 text-lg font-semibold">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mx-auto mt-24 max-w-3xl px-4">
          <h2 className="text-foreground mb-12 text-center text-3xl font-bold">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqItems.map((item, idx) => (
              <details
                key={idx}
                className="border-border group rounded-xl border"
              >
                <summary className="text-foreground cursor-pointer px-6 py-4 font-medium transition-colors hover:text-primary">
                  {item.question}
                </summary>
                <p className="text-muted-foreground px-6 pb-4 text-sm leading-relaxed">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mx-auto mt-24 max-w-2xl px-4 text-center">
          <h2 className="text-foreground mb-4 text-2xl font-bold">
            Ready to remove more watermarks?
          </h2>
          <p className="text-muted-foreground mb-6">
            Upgrade to Pro for unlimited processing across all AI platforms.
          </p>
          <a
            href="/pricing"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
          >
            View Pricing Plans →
          </a>
        </div>
      </div>
    </>
  );
}
