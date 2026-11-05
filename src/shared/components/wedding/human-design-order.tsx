'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

export function HumanDesignOrder() {
  const t = useTranslations('pages.create.human_design');
  const params = useSearchParams();
  const orderNo = params.get('order_no');
  const id = useId();
  const [paid, setPaid] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    if (!orderNo) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/wedding/human-design?order_no=${encodeURIComponent(orderNo)}`, { cache: 'no-store' });
      const body = await response.json();
      const confirmed = response.ok && body.code === 0 && body.data?.paid === true;
      setPaid(confirmed);
      if (confirmed) {
        setSubmitted(body.data.submitted === true);
        setEmail(body.data.contactEmail || '');
        setNotes(body.data.notes || '');
        try { for (const key of Object.keys(localStorage)) if (key.startsWith('wedding_human_checkout:')) localStorage.removeItem(key); } catch { /* Contact form still works without local storage. */ }
      }
    } catch { setPaid(false); } finally { setBusy(false); }
  }, [orderNo]);
  useEffect(() => { setPaid(false); setSubmitted(false); void refresh(); }, [refresh]);
  return <main className="mx-auto max-w-2xl px-5 py-14 md:py-20">
    <h1 className="font-serif text-3xl">{t('order_title')}</h1>
    <p role="status" className="my-5 leading-relaxed">{t(submitted ? 'details_saved' : paid ? 'paid' : 'pending')}</p>
    {orderNo && <p className="text-muted-foreground mb-6 break-all text-xs">{t('order_number')}: {orderNo}</p>}
    {paid && !submitted && <section className="bg-background rounded-2xl border p-5 sm:p-7" aria-labelledby={`${id}-details`}>
      <h2 id={`${id}-details`} className="font-serif text-xl">{t('details_title')}</h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{t('details_intro')}</p>
      <form className="mt-5 space-y-4" onSubmit={async event => {
        event.preventDefault(); if (sending || !orderNo) return; setSending(true); setError(false);
        try {
          const response = await fetch('/api/wedding/human-design', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNo, email: email.trim(), notes: notes.trim() }) });
          const body = await response.json();
          if (!response.ok || body.code !== 0 || body.data?.submitted !== true) throw new Error('details pending');
          setSubmitted(true);
        } catch { setError(true); } finally { setSending(false); }
      }}>
        <div className="space-y-1.5"><Label htmlFor={`${id}-email`}>{t('email')}</Label><Input id={`${id}-email`} type="email" autoComplete="email" required maxLength={254} value={email} disabled={sending} onChange={event => setEmail(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor={`${id}-notes`}>{t('notes')}</Label><textarea id={`${id}-notes`} className="bg-background min-h-32 w-full rounded-md border p-3 text-sm" maxLength={2000} value={notes} disabled={sending} onChange={event => setNotes(event.target.value)} /></div>
        {error && <p role="alert" className="text-destructive text-sm">{t('details_error')}</p>}
        <Button type="submit" size="lg" disabled={sending} className="w-full whitespace-normal">{t(sending ? 'submitting_details' : 'submit_details')}</Button>
      </form>
    </section>}
    {!paid && <Button disabled={busy} onClick={() => void refresh()}>{t('refresh')}</Button>}
    <p className="text-muted-foreground mt-6 text-sm"><a className="underline underline-offset-4" href="mailto:support@weddingcrestdesign.com">support@weddingcrestdesign.com</a></p>
  </main>;
}
