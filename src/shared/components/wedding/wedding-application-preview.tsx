'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import styles from './wedding-application-preview.module.css';

interface Props {
  imageUrl: string;
  partner1: string;
  partner2: string;
  date: string | null;
  palette: string[];
  paid: boolean;
}

/** Deterministic stationery compositions; no AI generation or download entitlement. */
export function WeddingApplicationPreview({ imageUrl, partner1, partner2, date, palette, paid }: Props) {
  const t = useTranslations('pages.design.preview');
  const locale = useLocale();
  const [scene, setScene] = useState<'invitation' | 'welcome' | 'thanks'>('invitation');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setDimensions(null); setImageFailed(false); }, [imageUrl]);
  // Only valid hex colors enter CSS, and text remains dark for legibility.
  const accent = palette.find((color) => /^#[0-9a-f]{6}$/i.test(color)) || '#b9b29c';
  let dateLabel = '';
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
  }
  return (
    <section className="overflow-hidden rounded-2xl border" aria-labelledby="application-preview-title">
      <div className="p-5 sm:p-6">
        <p className="text-muted-foreground mb-2 text-xs tracking-[0.18em] uppercase">{t('eyebrow')}</p>
        <h2 id="application-preview-title" className="font-serif text-2xl">{t('title')}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{t('intro')}</p>
        <div className="mt-5 flex flex-wrap gap-2" aria-label={t('choose')}>
          {(['invitation', 'welcome', 'thanks'] as const).map((key) => (
            <Button key={key} variant={scene === key ? 'default' : 'outline'} size="sm" aria-pressed={scene === key} onClick={() => setScene(key)}>{t(key)}</Button>
          ))}
        </div>
      </div>
      <div className={`${styles.stage} ${styles[scene]}`} style={{ '--stationery-accent': accent } as import('react').CSSProperties}>
        <div className={styles.fabric} aria-hidden="true" />
        {scene !== 'welcome' && <div className={styles.envelope} aria-hidden="true"><div className={styles.envelopeFlap} /><span className={styles.seal}>&amp;</span></div>}
        {scene === 'welcome' && <div className={styles.easel} aria-hidden="true" />}
        <div className={styles.paper}>
          <div className={styles.paperBorder} aria-hidden="true" />
          {scene === 'welcome' && <p className={styles.welcomeHeading}>{t('welcome_heading')}</p>}
          {scene === 'thanks' && <h3 className={styles.thanksHeading}>{t('thanks_heading')}</h3>}
          <div className={styles.crest}>
            {/* Whole original artwork is retained; no background removal or re-generation. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={imageUrl} src={imageUrl} alt={t('image_alt')} loading="lazy" className={styles.crestImage} onLoad={(event) => { const img = event.currentTarget; setDimensions({ width: img.naturalWidth, height: img.naturalHeight }); }} onError={() => setImageFailed(true)} />
            {!paid && <div aria-hidden="true" className={styles.watermark}>{Array.from({ length: 9 }, (_, index) => <span key={index}>Wedding Crest · Preview</span>)}</div>}
          </div>
          {scene === 'invitation' && <p className={styles.overline}>{t('invitation_heading')}</p>}
          <div className={styles.names}>
            <span>{partner1}</span><span className={styles.ampersand}>&amp;</span><span>{partner2}</span>
          </div>
          {scene !== 'thanks' && dateLabel && <p className={styles.date}>{dateLabel}</p>}
          <div className={styles.rule} aria-hidden="true" />
          <p className={styles.body}>{t(`${scene}_body`)}</p>
        </div>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <p className="text-muted-foreground text-xs leading-relaxed">{t('disclaimer')}</p>
        {imageFailed && <p role="status" className="text-destructive text-sm">{t('image_error')}</p>}
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">{t('delivery_title')}</summary>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm">
            <li>{t('delivery_files')}</li>
            <li>{t('delivery_guide')}</li>
            <li>{dimensions ? t('dimensions', dimensions) : t('dimensions_pending')}</li>
            <li>{t('original_note')}</li>
          </ul>
        </details>
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">{t('how_title')}</summary>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{t('how_body')}</p>
          <p className="text-muted-foreground mt-2 text-xs">{t('print_note')}</p>
        </details>
        <a href="#wedding-pricing" className="text-primary inline-block text-sm font-medium underline underline-offset-4">{paid ? t('download_link') : t('purchase_link')}</a>
      </div>
    </section>
  );
}
