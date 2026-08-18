'use client';

import dynamic from 'next/dynamic';

const UploadZone = dynamic(
  () =>
    import('@/shared/components/watermark/UploadZone').then(
      (m) => m.UploadZone
    ),
  { ssr: false }
);

export default function UploadZoneClient() {
  return <UploadZone />;
}
