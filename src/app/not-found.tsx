import Image from 'next/image';
import Link from 'next/link';

import { envConfigs } from '@/config';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';
import { getPublicConfigs } from '@/shared/models/config';

export default async function NotFoundPage() {
  const configs = await getPublicConfigs();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      {configs.app_logo ? (
        <Image
          src={configs.app_logo}
          alt={configs.app_name || envConfigs.app_name}
          width={80}
          height={80}
          unoptimized={configs.app_logo.startsWith('http')}
        />
      ) : null}
      <h1 className="text-2xl font-normal">Page not found</h1>
      <Button asChild>
        <Link href="/" className="mt-4">
          <SmartIcon name="ArrowLeft" />
          <span>Back to Home</span>
        </Link>
      </Button>
    </div>
  );
}
