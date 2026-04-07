import { Metadata } from 'next';

import { envConfigs } from '@/config';
import DetectorClient from './detector-client';

const baseUrl = envConfigs.app_url;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title:
      'AI Watermark Detector — Check if Your Image Has an AI Watermark',
    description:
      'Free AI watermark detector. Instantly check if an image contains Gemini, DALL-E, or Midjourney watermarks, including C2PA metadata. No upload required — 100% local processing.',
    keywords: [
      'AI watermark detector',
      'detect AI watermark',
      'check AI watermark',
      'gemini watermark detector',
      'synthid detector',
      'C2PA checker',
      'how to tell if image has AI watermark',
    ],
    openGraph: {
      title:
        'AI Watermark Detector — Check if Your Image Has an AI Watermark',
      description:
        'Free AI watermark detector. Instantly check if an image contains watermarks and AI metadata. 100% local processing.',
      type: 'website',
    },
  };
}

const faqItems = [
  {
    question: 'How does the AI watermark detector work?',
    answer:
      'Our detector analyzes the bottom-right corner of your image for known watermark patterns (like the Gemini star logo). It also checks the file\'s binary headers for Exif data, C2PA manifests, XMP metadata, and IPTC tags that indicate AI generation.',
  },
  {
    question: 'What types of watermarks can it detect?',
    answer:
      'The detector can identify visible Gemini watermarks (the ✦ star logo) and check for C2PA/Exif metadata markers that indicate an image was AI-generated. Support for DALL-E, Midjourney, and Stable Diffusion watermarks is coming soon.',
  },
  {
    question: 'Is my image uploaded to a server?',
    answer:
      'No! All detection happens 100% locally in your browser using the Canvas API and binary header analysis. Your image data never leaves your device.',
  },
  {
    question: 'What is C2PA metadata?',
    answer:
      'C2PA (Coalition for Content Provenance and Authenticity) is a standard that embeds provenance information in image files. Many AI tools like Adobe Firefly and some versions of DALL-E embed C2PA manifests that identify the image as AI-generated.',
  },
  {
    question: 'How accurate is the detection?',
    answer:
      'Visible watermark detection uses pixel-level pattern matching against known alpha maps, with confidence scores. Metadata detection is highly accurate as it reads the file\'s binary structure directly. Results show confidence levels so you can make informed decisions.',
  },
  {
    question: 'Can it detect invisible watermarks like SynthID?',
    answer:
      'Currently, our detector focuses on visible watermarks and metadata markers. SynthID is an invisible watermark embedded in pixel statistics — detecting it requires different techniques that we are researching for future updates.',
  },
];

export default function DetectorPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'AI Watermark Detector',
    description:
      'Free tool to detect AI watermarks and C2PA metadata in images',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Detect Gemini star watermark',
      'Check for C2PA metadata',
      'Analyze Exif and XMP data',
      '100% browser-based processing',
      'No image upload required',
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

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'AI Watermark Detector',
        item: `${baseUrl}/tools/detector`,
      },
    ],
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="pt-24 pb-16 md:pt-36">
        {/* Hero Section */}
        <div className="mx-auto mb-12 max-w-3xl px-4 text-center">
          <div className="bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium">
            <span>🔍</span>
            <span>AI Watermark Detector</span>
          </div>

          <h1 className="text-foreground mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Detect{' '}
            <span className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-transparent">
              AI Watermarks
            </span>{' '}
            in Any Image
          </h1>

          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Check if an image contains visible watermarks, C2PA signatures, or
            AI metadata markers. 100% local processing — your images never
            leave your device.
          </p>
        </div>

        {/* Detector Tool */}
        <div className="mx-auto max-w-4xl px-4">
          <DetectorClient />
        </div>

        {/* How Detection Works */}
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
                  'Drag & drop or click to upload any image. Supports PNG, JPG, and WebP up to 20MB.',
              },
              {
                step: '02',
                title: 'Analyze Patterns',
                description:
                  'Our detector checks for visible watermark patterns (Gemini star logo) and scans binary headers for AI metadata markers.',
              },
              {
                step: '03',
                title: 'View Results',
                description:
                  'Get a detailed report showing watermark confidence, C2PA status, Exif data, and metadata analysis.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group relative rounded-xl border border-border/40 bg-white/30 p-6 backdrop-blur-sm transition-colors hover:border-primary/20"
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

        {/* What We Detect */}
        <div className="mx-auto mt-24 max-w-4xl px-4">
          <h2 className="text-foreground mb-12 text-center text-3xl font-bold">
            What We Detect
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: 'Visible Watermarks',
                description:
                  'The Gemini ✦ star logo in the bottom-right corner of AI-generated images',
              },
              {
                title: 'C2PA Signatures',
                description:
                  'Content Credentials manifests that identify AI-generated content',
              },
              {
                title: 'Exif Metadata',
                description:
                  'Camera info, GPS data, software tags that may reveal AI generation',
              },
              {
                title: 'XMP & IPTC Data',
                description:
                  'Extended metadata including creator tool, descriptions, and AI markers',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border/40 p-5"
              >
                <h3 className="text-foreground font-semibold">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
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
            Need to remove a watermark?
          </h2>
          <p className="text-muted-foreground mb-6">
            Our free tool can remove the Gemini watermark from your images
            instantly.
          </p>
          <a
            href="/tools/gemini"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
          >
            Remove Watermark →
          </a>
        </div>
      </div>
    </>
  );
}
