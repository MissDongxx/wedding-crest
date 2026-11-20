import Image from 'next/image';
import Link from 'next/link';

import { weddingCrestGuide as guide } from '@/shared/content/wedding-crest-guide';

export function WeddingBlog() {
  return (
    <section
      id="blog"
      aria-labelledby="wedding-blog-heading"
      className="bg-muted/25 border-y px-5 py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground mb-3 text-xs tracking-[0.2em] uppercase">
              The wedding design journal
            </p>
            <h2
              id="wedding-blog-heading"
              className="font-serif text-3xl md:text-4xl"
            >
              A little guidance. A crest that’s yours.
            </h2>
          </div>
          <Link href="/blog" className="text-sm underline underline-offset-4">
            Visit the blog →
          </Link>
        </div>
        <Link
          href={guide.path}
          className="group bg-background grid overflow-hidden rounded-2xl border transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 md:grid-cols-[.8fr_1.2fr]"
        >
          <div className="flex items-center justify-center bg-white p-6">
            <Image
              src={guide.image}
              alt={guide.imageAlt}
              width={1254}
              height={1254}
              sizes="(max-width: 768px) 90vw, 400px"
              className="aspect-square w-full max-w-72 object-contain"
            />
          </div>
          <div className="flex flex-col justify-center p-7 md:p-12">
            <p className="text-muted-foreground text-xs tracking-widest uppercase">
              Step-by-step guide
            </p>
            <h3 className="mt-4 font-serif text-3xl leading-tight md:text-4xl">
              How to Create a Wedding Crest
            </h3>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Choose meaningful symbols, follow the seven design steps, and
              check your artwork before print. A practical tutorial with real
              examples and creator screenshots.
            </p>
            <span className="mt-6 text-sm font-medium underline underline-offset-4">
              Read the guide <span aria-hidden>→</span>
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
