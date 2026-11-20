import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

import { weddingGenerationAllowance } from '../src/shared/wedding/access';
import { getWeddingInitialGenerationIds } from '../src/shared/wedding/generation-request';
import { getWeddingProjectOwner } from '../src/shared/wedding/guest-identity';

// Execute the actual route guard code; provider/configuration work is outside each slice.
const fixtures = [
  {
    path: 'src/app/api/projects/[id]/generate/route.ts',
    end: '    // Bypass the 1-minute',
    method: 'POST',
    paidGate: true,
  },
  {
    path: 'src/app/api/projects/[id]/edit-assistant/route.ts',
    end: '    const body = requestSchema.parse',
    method: 'POST',
    paidGate: true,
  },
  {
    path: 'src/app/api/projects/[id]/route.ts',
    end: '    const body = patchSchema.parse',
    method: 'PATCH',
    paidGate: false,
  },
  {
    path: 'src/app/api/projects/[id]/route.ts',
    end: '    const paid =',
    method: 'GET',
    paidGate: false,
  },
  {
    path: 'src/app/api/projects/[id]/select/route.ts',
    end: '    const selected =',
    method: 'POST',
    paidGate: false,
  },
  {
    path: 'src/app/api/projects/[id]/download/route.ts',
    end: '    const downloadable =',
    method: 'GET',
    paidGate: true,
  },
  {
    path: 'src/app/api/jobs/[id]/route.ts',
    end: '    const paid =',
    method: 'GET',
    paidGate: false,
  },
];
async function main() {
  for (const fixture of fixtures) {
    const source = readFileSync(fixture.path, 'utf8');
    const start = source.indexOf(`export async function ${fixture.method}(`);
    const end = source.indexOf(fixture.end, start);
    assert.ok(start >= 0 && end > start, fixture.path);
    let actor: any = {
      user: null,
      guestOwnerId: 'guest-owner',
      ownerId: 'guest-owner',
    };
    let paid = false;
    let active = false;
    let used = 0;
    let project: any = { id: 'a', userId: 'guest-owner', guestId: 'legacy' };
    let existing: any = null;
    const owners: (string | undefined)[] = [];
    const context = vm.createContext({
      exports: {},
      getWeddingActor: async () => actor,
      getWeddingProjectOwner,
      getWeddingProject: async () => project,
      canAccessWeddingProject: async ({ userId, guestId }: any) =>
        !!project &&
        ((userId && userId === project.userId) ||
          (!project.userId && guestId === project.guestId)),
      guestIdFrom: (request: Request) =>
        request.headers.get('x-wedding-guest-id'),
      hasPaidWeddingOrder: async (ownerId: string | undefined) => {
        owners.push(ownerId);
        return paid;
      },
      getWeddingGenerationAllowance: async (ownerId: string | undefined) => {
        owners.push(ownerId);
        return weddingGenerationAllowance({ purchased: paid, active }, used);
      },
      inputSchema: { parse: (body: any) => body },
      z: {
        object: () => ({ parse: () => ({ generationId: 'g' }) }),
        string: () => ({ min: () => ({}) }),
      },
      getWeddingGeneration: async () => existing,
      getWeddingInitialGenerationIds,
      WEDDING_MAX_CANDIDATES: 1,
      WEDDING_PACK_PRODUCT_ID: 'wedding_identity_pack',
      respData: (data: any) => ({ data }),
      respErr: (message: string, status: number, data?: any) => ({
        message,
        status,
        data,
      }),
    });
    vm.runInContext(
      ts.transpileModule(
        `${source.slice(start, end)}\nreturn {passed:true};\n}catch(error){throw error;}\n}`,
        {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
          },
        }
      ).outputText,
      context
    );
    const invoke = (
      headers: Record<string, string> = { 'x-wedding-guest-id': 'legacy' }
    ) =>
      (context.exports as any)[fixture.method](
        new Request('http://localhost/api/projects/a', {
          method: fixture.method,
          headers,
          ...(fixture.method === 'POST' ? { body: '{}' } : {}),
        }),
        { params: Promise.resolve({ id: 'a' }) }
      );
    assert.equal(
      fixture.paidGate ? (await invoke()).status : (await invoke()).passed,
      fixture.paidGate ? 402 : true
    );
    paid = active = true;
    assert.equal((await invoke()).passed, true);
    if (fixture.paidGate) assert.equal(owners.at(-1), 'guest-owner');
    actor = {
      user: { id: 'new-login' },
      ownerId: 'new-login',
      guestOwnerId: 'guest-owner',
    };
    assert.equal(
      (await invoke()).passed,
      true,
      'login must retain cookie-owned purchase'
    );
    actor = { user: null, guestOwnerId: 'other-guest', ownerId: 'other-guest' };
    assert.equal(
      (await invoke()).status,
      404,
      'wrong cookie never opens project'
    );
    actor = { user: null };
    assert.equal(
      (await invoke()).status,
      404,
      'missing cookie cannot use legacy header on owned project'
    );
    project = { id: 'a', userId: 'expired-session-owner', guestId: 'legacy' };
    assert.equal(
      (await invoke()).status,
      404,
      'expired session never opens claimed account project'
    );
    project = null;
    assert.equal((await invoke()).status, 404);
    project = { id: 'a', userId: null, guestId: 'legacy' };
    assert.equal(
      (await invoke()).passed,
      true,
      'unclaimed legacy paid header remains compatible'
    );
    assert.equal(
      (await invoke({ 'x-wedding-guest-id': 'wrong-legacy' })).status,
      404
    );
    if (fixture.path.includes('/generate/')) {
      project = { id: 'a', userId: 'guest-owner' };
      actor = {
        user: null,
        ownerId: 'guest-owner',
        guestOwnerId: 'guest-owner',
      };
      const key = '01a19b43-91ab-7803-9705-3bfd251ae323';
      used = 10;
      existing = {
        id: 'existing',
        status: 'generating',
        providerTaskId: 'submitted',
      };
      assert.equal(
        (await invoke({ 'x-wedding-generation-id': key })).data.resumed,
        true
      );
      existing = null;
      assert.equal((await invoke()).status, 429);
      active = false;
      assert.equal((await invoke()).data.reasonCode, 'access_expired');
    }
    console.log(
      `PASS ${fixture.path} ${fixture.method}: paid cookie, login continuity, missing/wrong cookie, expired session, legacy and cross-project guards`
    );
  }
  // The creation prefix rejects unpaid identities before any draft/example parsing;
  // the real transaction guard is tested separately by verify-wedding-access-reservation.ts.
  const create = readFileSync('src/app/api/projects/route.ts', 'utf8');
  const createPrefix = create.slice(
    create.indexOf('export async function POST('),
    create.indexOf('    const body = createSchema.parse')
  );
  let purchased = false;
  let replayOwner: string | null = null;
  const createContext = vm.createContext({
    exports: {},
    crypto,
    TextEncoder,
    getWeddingProject: async (id: string) =>
      replayOwner ? { id, userId: replayOwner } : null,
    respData: (data: any) => ({ data }),
    getWeddingActor: async () => ({
      user: null,
      ownerId: 'guest-owner',
      guestOwnerId: 'guest-owner',
    }),
    getWeddingPurchaseOwner: async () => 'guest-owner',
    getWeddingAccountAccess: async () => ({ canCreateProject: purchased }),
    respErr: (message: string, status: number) => ({ message, status }),
  });
  vm.runInContext(
    ts.transpileModule(
      `${createPrefix}\nreturn {passed:true};\n}catch(error){throw error;}\n}`,
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }
    ).outputText,
    createContext
  );
  assert.equal(
    (await (createContext.exports as any).POST(new Request('http://localhost')))
      .status,
    402
  );
  purchased = true;
  assert.equal(
    (await (createContext.exports as any).POST(new Request('http://localhost')))
      .passed,
    true
  );
  for (let used = 0; used <= 10; used++)
    assert.equal(
      weddingGenerationAllowance({ purchased: false, active: false }, used)
        .allowed,
      false
    );
  console.log(
    'PASS create: paid guest proceeds, unpaid guest 402; no free generations regardless of login'
  );
  purchased = false; // Fifth slot already consumed; replay must return the existing owned draft.
  replayOwner = 'guest-owner';
  const replayRequest = () =>
    new Request('http://localhost', {
      headers: {
        'x-wedding-request-id': '01a19b43-91ab-7803-9705-3bfd251ae323',
      },
    });
  assert.equal(
    (await (createContext.exports as any).POST(replayRequest())).data.project
      .userId,
    'guest-owner'
  );
  replayOwner = 'other-owner';
  assert.equal(
    (await (createContext.exports as any).POST(replayRequest())).status,
    402
  );
  console.log(
    'PASS project replay at exhausted quota returns only the same owned project; foreign project never returned'
  );

  const app = readFileSync('src/shared/contexts/app.tsx', 'utf8');
  const closeStart = app.indexOf('  const setIsShowSignModal = useCallback(');
  const closeSource = app.slice(
    closeStart,
    app.indexOf('  }, []);', closeStart) + '  }, []);'.length
  );
  let shown = false;
  let callback: string | undefined = '/create?exampleId=sample';
  const closeContext = vm.createContext({
    useCallback: (fn: unknown) => fn,
    setIsShowSignModalState: (value: boolean) => {
      shown = value;
    },
    setSignInCallbackUrl: (value: string | undefined) => {
      callback = value;
    },
  });
  vm.runInContext(
    ts.transpileModule(
      closeSource + '\n globalThis.toggle = setIsShowSignModal;',
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
    ).outputText,
    closeContext
  );
  (closeContext.toggle as any)(true);
  assert.equal(shown, true);
  assert.equal(callback, '/create?exampleId=sample');
  (closeContext.toggle as any)(false);
  assert.equal(shown, false);
  assert.equal(callback, undefined);
  console.log(
    'PASS modal callback retained while open and cleared on every close'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
