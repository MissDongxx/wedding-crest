import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

import { weddingGenerationAllowance } from '../src/shared/wedding/access';
import { HUMAN_DESIGN_PRODUCT_ID, HUMAN_DESIGN_AMOUNT, isWeddingCheckoutProduct } from '../src/shared/wedding/config';

function routePrefix(
  path: string,
  end: string,
  globals: Record<string, unknown>
) {
  const source = readFileSync(path, 'utf8');
  const prefix = source.slice(
    source.indexOf('export async function POST('),
    source.indexOf(end)
  );
  const context = vm.createContext({ exports: {}, ...globals });
  vm.runInContext(
    ts.transpileModule(
      `${prefix}\nreturn {passed:true};\n}catch(error){throw error;}\n}`,
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }
    ).outputText,
    context
  );
  return (context.exports as any).POST;
}
async function main() {
  let user: any = { id: 'user', email: 'user@example.test' },
    owns = true;
  const checkout = routePrefix(
    'src/app/api/payment/checkout/route.ts',
    '    // get configs',
    {
      loadMessages: async () => ({
        page: {
          sections: {
            pricing: {
              items: [
                { product_id: 'wedding_identity_pack', amount: 590 },
                { product_id: 'other_product', amount: 100 },
              ],
            },
          },
        },
      }),
      URL,
      getWeddingActor: async () => ({
        user,
        ownerId: user?.id || 'guest-owner',
        guestOwnerId: 'guest-owner',
        guestToken: 'server-cookie',
      }),
      getWeddingProject: async () => ({ userId: user?.id || 'guest-owner' }),
      getWeddingProjectOwner: (actor: any) => actor.ownerId,
      canAccessWeddingProject: async () => owns,
      WEDDING_PACK_PRODUCT_ID: 'wedding_identity_pack',
      HUMAN_DESIGN_PRODUCT_ID,
      HUMAN_DESIGN_AMOUNT,
      isWeddingCheckoutProduct,
      respErr: (message: string, status: number) => ({ message, status }),
    }
  );
  const request = (
    projectId?: string,
    productId = 'wedding_identity_pack',
    origin?: string
  ) =>
    new Request('http://localhost/api/payment/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? { origin } : {}),
      },
      body: JSON.stringify({
        product_id: productId,
        metadata: projectId ? { project_id: projectId } : {},
      }),
    });
  assert.equal((await checkout(request())).passed, true);
  assert.equal(
    (await checkout(request('draft-with-zero-images'))).passed,
    true
  );
  owns = false;
  assert.equal((await checkout(request('other-owner'))).status, 404);
  owns = true;
  user = null;
  assert.equal((await checkout(request())).passed, true);
  assert.equal(
    (await checkout(request(undefined, 'other_product'))).status,
    401
  );
  assert.equal(
    (
      await checkout(
        request(undefined, 'wedding_identity_pack', 'https://foreign.test')
      )
    ).status,
    403
  );
  console.log(
    'PASS actual checkout prefix: signed-in and cookie guest can buy before any project/image; owned draft accepted; foreign project, cross-origin, anonymous unrelated product denied'
  );
  let paid = false,
    active = false,
    today = 0;
  const generate = routePrefix(
    'src/app/api/projects/[id]/generate/route.ts',
    '    // Bypass the 1-minute',
    {
      getWeddingActor: async () => ({ user: { id: 'user' }, ownerId: 'user' }),
      getWeddingProjectOwner: () => 'user',
      inputSchema: { parse: (body: any) => body },
      getWeddingProject: async () => ({ id: 'project', userId: 'user' }),
      canAccessWeddingProject: async () => true,
      getWeddingGenerationAllowance: async () =>
        weddingGenerationAllowance({ purchased: paid, active }, today),
      respErr: (message: string, status: number, data: any) => ({
        message,
        status,
        data,
      }),
    }
  );
  const req = new Request(
      'http://localhost/api/projects/project/generate?paid=1',
      { method: 'POST' }
    ),
    params = { params: Promise.resolve({ id: 'project' }) };
  assert.equal((await generate(req, params)).status, 402);
  paid = true;
  active = true;
  today = 9;
  assert.equal((await generate(req, params)).passed, true);
  today = 10;
  assert.equal((await generate(req, params)).status, 429);
  active = false;
  assert.equal((await generate(req, params)).data.reasonCode, 'access_expired');
  console.log(
    'PASS actual generation prefix: URL paid flag grants nothing; unpaid/expired 402; daily eleventh 429; paid tenth proceeds before provider work'
  );
  const generic = routePrefix(
    'src/app/api/ai/generate/route.ts',
    '    if (!provider || !mediaType || !model)',
    {
      AIMediaType: { IMAGE: 'image' },
      respErr: (message: string, status: number) => ({ message, status }),
    }
  );
  assert.equal(
    (
      await generic(
        new Request('http://localhost/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaType: 'image' }),
        })
      )
    ).status,
    400
  );
  console.log(
    'PASS retired generic image endpoint rejects image work before provider/credits, preventing paywall and daily quota bypass'
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
