'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { fetchWeddingAccess } from '@/shared/wedding/purchase-client';

/** Missing provider email never blocks paid artwork or creates an auth session. */
export function PurchaseReceiptContact({ namespace = 'pages.design', projectId, receiptEmailMissing }: { namespace?: 'pages.design' | 'pages.create'; projectId?: string; receiptEmailMissing?: boolean }) {
  const t = useTranslations(namespace);
  const [missing, setMissing] = useState(false);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (receiptEmailMissing !== undefined) {
      setMissing(receiptEmailMissing);
      return;
    }
    if (projectId) return;
    let cancelled = false;
    void fetchWeddingAccess().then((access) => {
      if (!cancelled) setMissing(access.purchased && access.receiptEmailMissing === true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [receiptEmailMissing, projectId]);
  if (!missing) return null;
  return (
    <aside className="bg-muted/40 my-4 rounded-xl border p-4 text-sm" aria-label={t('receipt_email_label')}>
      <p role="status">{saved ? t('receipt_email_saved') : t('receipt_email_missing')}</p>
      {!saved && <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true); setError(false);
        try {
          const response = await fetch('/api/wedding/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), ...(projectId ? { projectId } : {}) }) });
          const body = await response.json();
          if (!response.ok || body.code !== 0) throw new Error('receipt update failed');
          setSaved(true);
        } catch { setError(true); } finally { setSaving(false); }
      }}>
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor="wedding-contact-email">{t('receipt_email_label')}</Label>
          <Input id="wedding-contact-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
        </div>
        <Button type="submit" variant="outline" disabled={saving}>{t('receipt_email_save')}</Button>
        {error && <p role="alert" className="text-destructive w-full">{t('receipt_email_error')}</p>}
      </form>}
    </aside>
  );
}
