import { respData, respErr } from '@/shared/lib/resp';
import { getPublicConfigs } from '@/shared/models/config';

export async function POST(req: Request) {
  try {
    const configs = await getPublicConfigs();

    return respData(configs);
  } catch (e: any) {
    return respErr(e.message);
  }
}
