import { respData, respErr } from '@/shared/lib/resp';
import {
  getWeddingAccountAccess,
  getWeddingGenerationAllowance,
} from '@/shared/models/wedding';
import {
  getWeddingActor,
  getWeddingPurchaseOwner,
} from '@/shared/models/wedding-actor';
import { getWeddingReceiptState } from '@/shared/models/wedding-checkout';

export async function GET() {
  try {
    const actor = await getWeddingActor({ createGuest: true });
    const ownerId = await getWeddingPurchaseOwner(actor);
    if (!ownerId) return respErr('Purchase your image pack to continue.', 402);
    // Internal entitlement only; the UI never displays project counts.
    const [access, allowance, receipt] = await Promise.all([
      getWeddingAccountAccess(ownerId),
      getWeddingGenerationAllowance(ownerId),
      getWeddingReceiptState(ownerId),
    ]);
    return respData({
      ...access,
      ...receipt,
      allowance,
      signedIn: Boolean(actor.user),
      identityScope: ownerId === actor.user?.id ? 'account' : 'guest',
    });
  } catch (error) {
    return respErr(
      error instanceof Error
        ? error.message
        : 'Could not load generation access'
    );
  }
}
