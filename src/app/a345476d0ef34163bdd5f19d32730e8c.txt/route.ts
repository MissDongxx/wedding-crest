import { INDEXNOW_KEY } from '@/shared/lib/indexnow';

export const dynamic = 'force-static';

export function GET() {
  return new Response(`${INDEXNOW_KEY}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
