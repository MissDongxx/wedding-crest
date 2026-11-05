'use client';

import { type ReactNode, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { HUMAN_DESIGN_PRODUCT_ID } from '@/shared/wedding/config';
import { WEDDING_PACK_PRICING } from '@/shared/wedding/pricing';
import { requestWeddingCheckout, stableWeddingRequestId } from '@/shared/wedding/purchase-client';

/** Equal-weight alternatives, not an add-on form. Both CTAs choose a product. */
export function HumanDesignPurchase({ brief, projectId, aiAction, aiIncluded = false }: { brief: string; projectId?: string; aiAction: ReactNode; aiIncluded?: boolean }) {
  const t = useTranslations('pages.create.human_design');
  const locale = useLocale();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <section id="purchase-options" aria-labelledby={`${id}-title`} className="space-y-4">
    <h3 id={`${id}-title`} className="font-serif text-xl">{t('compare_title')}</h3>
    <div className="grid items-stretch gap-4 md:grid-cols-2">
      <article data-design-option="ai" className="bg-background flex h-full flex-col rounded-2xl border p-5">
        <h4 className="min-h-14 font-serif text-xl">{t('ai_title')}</h4>
        <p className="mt-3 text-3xl font-semibold">{aiIncluded ? t('included') : <>{WEDDING_PACK_PRICING.price} <span className="text-muted-foreground text-xs font-normal">USD</span></>}</p>
        <p className="text-muted-foreground mt-1 text-xs">{t('one_time')}</p>
        <ul className="my-5 flex-1 space-y-3 text-sm leading-relaxed"><li>{t('ai_speed')}</li><li>{t('ai_process')}</li><li>{t('ai_access')}</li></ul>
        <div className="[&_button]:w-full [&_button]:whitespace-normal">{aiAction}</div>
      </article>
      <article id="human-design" data-design-option="human" className="bg-background flex h-full flex-col rounded-2xl border p-5">
        <h4 className="min-h-14 font-serif text-xl">{t('title')}</h4>
        <p className="mt-3 text-3xl font-semibold">$30 <span className="text-muted-foreground text-xs font-normal">USD</span></p>
        <p className="text-muted-foreground mt-1 text-xs">{t('one_time')}</p>
        <ul className="my-5 flex-1 space-y-3 text-sm leading-relaxed"><li>{t('human_speed')}</li><li>{t('human_process')}</li><li>{t('after_payment')}</li></ul>
        {error && <p role="alert" className="text-destructive mb-3 text-sm">{t('checkout_error')}</p>}
        <Button size="lg" className="min-h-12 w-full whitespace-normal" disabled={busy} onClick={async () => {
          if (busy) return;
          setBusy(true); setError(false);
          const key = `wedding_human_checkout:${projectId || 'wizard'}`;
          try {
            const fingerprintKey = `${key}:fingerprint`;
            if (localStorage.getItem(fingerprintKey) !== brief) { localStorage.removeItem(key); localStorage.setItem(fingerprintKey, brief); }
            const { response, body } = await requestWeddingCheckout(async () => fetch('/api/payment/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-wedding-checkout-id': await stableWeddingRequestId(localStorage, key), ...(projectId && localStorage.getItem('wedding_guest_id') ? { 'x-wedding-guest-id': localStorage.getItem('wedding_guest_id')! } : {}) },
              body: JSON.stringify({ product_id: HUMAN_DESIGN_PRODUCT_ID, locale, metadata: { ...(projectId ? { project_id: projectId } : {}), human_design: { brief } } }),
            }), () => localStorage.removeItem(key));
            if (!response.ok || body.code !== 0 || !body.data?.checkoutUrl) { if (body.data?.reasonCode === 'checkout_ended') localStorage.removeItem(key); throw new Error('checkout failed'); }
            window.location.assign(body.data.checkoutUrl);
          } catch { setError(true); } finally { setBusy(false); }
        }}>{t(busy ? 'loading' : 'buy')}</Button>
      </article>
    </div>
  </section>;
}
