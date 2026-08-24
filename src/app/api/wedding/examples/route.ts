import { respData, respErr } from '@/shared/lib/resp';
import {
  getWeddingExample,
  listWeddingExamples,
  type WeddingExampleRow,
} from '@/shared/models/wedding';
import { isWeddingExampleStyle } from '@/shared/wedding/types';

// Public read of active wedding examples. The home page uses this for the
// "real product photos" carousel and the wizard uses it for the
// "make a similar crest" picker. Optional `?style=` filter; pass `?id=`
// to fetch a single active example by id (used by exampleId deep links).
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const row = await getWeddingExample(id);
      if (
        !row ||
        !row.isActive ||
        !isWeddingExampleStyle(row.style as string)
      ) {
        return respData({ items: [] });
      }
      return respData({ items: [row] });
    }
    const style = url.searchParams.get('style') ?? undefined;
    const rows = (await listWeddingExamples({ style, activeOnly: true }) as WeddingExampleRow[]).filter(
      (row) => isWeddingExampleStyle(row.style as string)
    );
    return respData({ items: rows });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to list examples'
    );
  }
}
