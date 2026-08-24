import { respData, respErr } from '@/shared/lib/resp';
import { listWeddingFrames } from '@/shared/models/wedding';

// Public read of active wedding frames. The wizard uses this to populate
// the "choose a border" step. Optional `?style=` filter so the picker can
// scope tiles to the style the user picked in step 2.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const style = url.searchParams.get('style') ?? undefined;
    const rows = await listWeddingFrames({ style, activeOnly: true });
    return respData({ items: rows });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to list frames'
    );
  }
}
