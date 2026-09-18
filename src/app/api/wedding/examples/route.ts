import { respData, respErr } from '@/shared/lib/resp';
import {
  getWeddingExample,
  listWeddingExamples,
  listWeddingExamplesSafe,
  type WeddingExampleRow,
} from '@/shared/models/wedding';
import { weddingHomeExampleFallbacks } from '@/shared/wedding/home-examples';
import { isWeddingExampleStyle } from '@/shared/wedding/types';

const HOME_EXAMPLES_PER_STYLE = 3;
type HomeExampleRow = Pick<
  WeddingExampleRow,
  'id' | 'name' | 'style' | 'imageUrl' | 'altText'
>;

function getHomeExamples(rows: HomeExampleRow[]) {
  const byStyle = new Map<string, HomeExampleRow[]>();
  for (const row of rows) {
    if (!isWeddingExampleStyle(row.style)) continue;
    const list = byStyle.get(row.style) ?? [];
    if (list.length < HOME_EXAMPLES_PER_STYLE) {
      list.push(row);
      byStyle.set(row.style, list);
    }
  }

  return Array.from(byStyle.values())
    .flat()
    .map(({ id, name, style, imageUrl, altText }) => ({
      id,
      name,
      style,
      imageUrl,
      altText,
    }));
}

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
    const isHomeSurface = url.searchParams.get('surface') === 'home';
    const rows = (
      (await (isHomeSurface
        ? listWeddingExamplesSafe({ style, activeOnly: true }, 2500)
        : listWeddingExamples({
            style,
            activeOnly: true,
          }))) as WeddingExampleRow[]
    ).filter((row) => isWeddingExampleStyle(row.style as string));
    if (isHomeSurface) {
      const homeRows: HomeExampleRow[] =
        rows.length === 0 && !style ? weddingHomeExampleFallbacks : rows;
      const response = respData({ items: getHomeExamples(homeRows) });
      const cacheControl =
        'public, max-age=60, s-maxage=600, stale-while-revalidate=3600';
      response.headers.set('Cache-Control', cacheControl);
      response.headers.set('CDN-Cache-Control', cacheControl);
      response.headers.set('Cloudflare-CDN-Cache-Control', cacheControl);
      return response;
    }
    return respData({ items: rows });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : 'failed to list examples'
    );
  }
}
