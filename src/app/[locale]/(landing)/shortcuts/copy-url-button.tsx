'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

export function CopyUrlButton({
  url,
  copyLabel,
  copiedLabel,
}: {
  url: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button size="sm" variant="ghost" className="shrink-0" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="mr-1 h-4 w-4 text-green-500" />
          <span className="text-xs text-green-600">{copiedLabel}</span>
        </>
      ) : (
        <>
          <Copy className="mr-1 h-4 w-4" />
          <span className="text-xs">{copyLabel}</span>
        </>
      )}
    </Button>
  );
}
