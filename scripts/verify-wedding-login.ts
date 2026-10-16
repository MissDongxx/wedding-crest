import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

import { decideGenerationAllowance } from '../src/shared/wedding/config';

// Execute literal route prefixes up to the first provider/schema operation.
// Tests assert guest denial happens before parsing input, configuration or AI work.
const fixtures = [
  {
    path: 'src/app/api/projects/route.ts',
    end: '    const body = createSchema.parse',
    guestPaid: false,
    method: 'POST',
  },
  {
    path: 'src/app/api/projects/[id]/generate/route.ts',
    end: '    const body = inputSchema.parse',
    guestPaid: true,
    method: 'POST',
  },
  {
    path: 'src/app/api/projects/[id]/edit-assistant/route.ts',
    end: '    const body = requestSchema.parse',
    guestPaid: true,
    method: 'POST',
  },
  {
    path: 'src/app/api/projects/[id]/route.ts',
    end: '    const body = patchSchema.parse',
    guestPaid: true,
    method: 'PATCH',
  },
];
async function main() {
  for (const fixture of fixtures) {
    const route = readFileSync(fixture.path, 'utf8');
    const prefix = route.slice(
      route.indexOf(`export async function ${fixture.method}(`),
      route.indexOf(fixture.end)
    );
    const js = ts.transpileModule(
      `${prefix}\nreturn { passed: true };\n} catch (error) { throw error; }\n}`,
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
        },
      }
    ).outputText;
    let user: { id: string } | null = null;
    let paid = false;
    let claims = 0;
    let canAccess = true;
    let project: { id: string; userId: string | null; guestId: string } | null =
      { id: 'a', userId: null, guestId: 'guest' };
    const context = vm.createContext({
      exports: {},
      getUserInfo: async () => user,
      getWeddingProject: async () => project,
      canAccessWeddingProject: async () => canAccess,
      guestIdFrom: (request: Request) =>
        request.headers.get('x-wedding-guest-id'),
      hasPaidWeddingOrder: async () => paid,
      claimWeddingProject: async () => {
        claims++;
      },
      respErr: (message: string, status: number) => ({ message, status }),
    });
    vm.runInContext(js, context);
    const post = (context.exports as any)[fixture.method];
    const req = new Request('http://localhost/api/projects/a/generate', {
      method: 'POST',
      headers: { 'x-wedding-guest-id': 'guest' },
    });
    const params = { params: Promise.resolve({ id: 'a' }) };
    if (fixture.method === 'PATCH') canAccess = false;
    const denied = await post(req, params);
    assert.equal(denied.status, 401);
    assert.match(denied.message, /Sign in/);
    assert.equal(claims, 0);
    canAccess = true;
    if (fixture.guestPaid) {
      paid = true;
      assert.equal((await post(req, params)).passed, true);
    }
    user = null;
    canAccess = false;
    project = { id: 'a', userId: 'prior-session-owner', guestId: 'guest' };
    const expired = await post(req, params);
    assert.equal(expired.status, 401);
    assert.match(expired.message, /Sign in/);
    project = null;
    const missing = await post(req, params);
    assert.equal(missing.status, 401);
    assert.equal(missing.message, expired.message);
    project = { id: 'a', userId: null, guestId: 'guest' };
    canAccess = true;
    user = { id: 'user' };
    assert.equal((await post(req, params)).passed, true);
    console.log(
      `PASS ${fixture.path}: unpaid guest 401, authenticated pass${fixture.guestPaid ? ', legacy paid guest pass' : ''}`
    );
  }
  for (let used = 0; used < 3; used++) {
    assert.equal(
      decideGenerationAllowance({
        batches: used,
        paid: false,
        isGuest: false,
        projectsWithGenerations: used ? 1 : 0,
      }).allowed,
      true
    );
    assert.equal(
      decideGenerationAllowance({
        batches: used,
        paid: false,
        isGuest: true,
        projectsWithGenerations: 0,
      }).allowed,
      false
    );
  }
  assert.equal(
    decideGenerationAllowance({
      batches: 3,
      paid: false,
      isGuest: false,
      projectsWithGenerations: 1,
    }).allowed,
    false
  );
  console.log(
    'PASS three authenticated free batches retained; no anonymous free batch at any usage count'
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

  const wizard = readFileSync(
    'src/themes/default/blocks/wedding-wizard.tsx',
    'utf8'
  );
  for (const name of ['response', 'generateResponse']) {
    const marker = `      if (${name}.status === 401) {`;
    const start = wizard.indexOf(marker);
    assert.ok(start > 0);
    const block = wizard.slice(start, wizard.indexOf('      }', start) + 7);
    let prompts = 0;
    const expiryContext = vm.createContext({
      [name]: { status: 401 },
      requestSignIn: () => {
        prompts++;
      },
    });
    vm.runInContext(
      `function handle() { ${block} throw new Error('fell through'); } handle();`,
      expiryContext
    );
    assert.equal(prompts, 1);
  }
  console.log(
    'PASS wizard save and generate 401 each reopen login and stop error fallthrough'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
