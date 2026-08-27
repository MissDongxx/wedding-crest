'use client';

import { useState } from 'react';

import { useRouter } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';
import { toast } from 'sonner';

export function DeleteFrameButtonClient({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!confirm('Delete this frame?')) return;
    setBusy(true);
    try {
      const resp = await fetch(`/api/admin/wedding/frames/${id}`, {
        method: 'DELETE',
      });
      const json = (await resp.json()) as {
        code?: number;
        message?: string;
      };
      if (!resp.ok || json?.code !== 0) {
        throw new Error(json?.message || 'delete failed');
      }
      toast.success('Frame deleted');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="destructive" disabled={busy} onClick={onClick}>
      <SmartIcon name="RiDeleteBinLine" />
      {label}
    </Button>
  );
}
