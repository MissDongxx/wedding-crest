'use client';

import dynamic from 'next/dynamic';

const DetectorZone = dynamic(
  () =>
    import('@/shared/components/watermark/DetectorZone').then(
      (m) => m.DetectorZone
    ),
  { ssr: false }
);

export default function DetectorClient() {
  return <DetectorZone />;
}
