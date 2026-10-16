import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

import { decideGenerationAllowance } from '../src/shared/wedding/config';

// Execute the actual model functions with deterministic transaction/ORM fixtures.
// No database, credentials or external provider are used.
const source = readFileSync('src/shared/models/wedding.ts', 'utf8');
const functions = source.slice(
  source.indexOf('export async function reserveWeddingGenerationBatch('),
  source.indexOf('export async function createWeddingGeneration(')
);
const js = ts.transpileModule(
  functions.replaceAll('export async function', 'async function'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText;
type Row = Record<string, any>;
const table = (name: string) =>
  new Proxy(
    { name },
    { get: (obj, key) => (key === 'name' ? obj.name : String(key)) }
  );
const weddingProject = table('projects'),
  weddingGeneration = table('generations'),
  order = table('orders');
let data: Record<string, Row[]>;
const eq = (key: string, value: any) => (row: Row) => row[key] === value;
const isNull = (key: string) => (row: Row) => row[key] == null;
const and =
  (...predicates: any[]) =>
  (row: Row) =>
    predicates.every((p) => p(row));
const or =
  (...predicates: any[]) =>
  (row: Row) =>
    predicates.some((p) => p(row));
const inArray = (key: string, values: any[]) => (row: Row) =>
  values.includes(row[key]);
const locks = new Map<string, Promise<void>>();
const executor = () => {
  const releases: (() => void)[] = [];
  const query = (kind: string, initialTable?: any) => {
    let name = initialTable?.name,
      predicate = (_row: Row) => true,
      values: any,
      limit = Infinity;
    const builder: any = {
      from: (t: any) => {
        name = t.name;
        return builder;
      },
      where: (p: any) => {
        predicate = p;
        return builder;
      },
      for: () => builder,
      limit: (n: number) => {
        limit = n;
        return builder;
      },
      values: (v: any) => {
        values = v;
        return builder;
      },
      set: (v: any) => {
        values = v;
        return builder;
      },
      then: (resolve: any, reject: any) =>
        Promise.resolve()
          .then(() => {
            if (kind === 'insert') {
              data[name].push(...values);
              return [];
            }
            if (kind === 'update') {
              data[name]
                .filter(predicate)
                .forEach((row) => Object.assign(row, values));
              return [];
            }
            if (kind === 'delete') {
              data[name] = data[name].filter((row) => !predicate(row));
              return [];
            }
            return data[name]
              .filter(predicate)
              .slice(0, limit)
              .map((row) => ({ ...row }));
          })
          .then(resolve, reject),
    };
    return builder;
  };
  return {
    select: () => query('select'),
    insert: (t: any) => query('insert', t),
    update: (t: any) => query('update', t),
    delete: (t: any) => query('delete', t),
    execute: async (key: string) => {
      const previous = locks.get(key) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      locks.set(
        key,
        previous.then(() => current)
      );
      await previous;
      releases.push(release);
    },
    release: () => releases.reverse().forEach((release) => release()),
  };
};
const context = vm.createContext({
  envConfigs: { database_provider: 'postgresql' },
  weddingProject,
  weddingGeneration,
  order,
  eq,
  isNull,
  and,
  or,
  inArray,
  sql: (_parts: any, value: string) => value,
  OrderStatus: { PAID: 'paid' },
  WEDDING_PACK_PRODUCT_ID: 'pack',
  decideGenerationAllowance,
  db: executor,
  runInDbTransaction: async (work: any) => {
    const tx = executor();
    try {
      return await work(tx);
    } finally {
      tx.release();
    }
  },
});
vm.runInContext(js, context);
const reserve = context.reserveWeddingGenerationBatch as any;
const settle = context.settleFailedWeddingReservation as any;
const reset = (guest = false) => {
  data = {
    projects: ['a', 'b'].map((id) => ({
      id,
      userId: guest ? null : 'user',
      guestId: 'guest',
      status: 'draft',
    })),
    generations: [],
    orders: [],
  };
  locks.clear();
};
const request = (projectId: string, id: string, guest = false) => ({
  projectId,
  ...(guest ? { guestId: 'guest' } : { userId: 'user' }),
  candidates: [{ id, projectId, candidateIndex: 0, cost: 0 }],
});
async function main() {
  for (const guest of [false]) {
    reset(guest);
    const same = await Promise.all([
      reserve(request('a', '1', guest)),
      reserve(request('a', '2', guest)),
    ]);
    assert.equal(same.filter((result) => result.allowed).length, 1);
    assert.equal(data.generations.length, 1);
    console.log(
      `PASS same-project concurrent ${guest ? 'guest' : 'account'}: one reservation`
    );
    reset(guest);
    const cross = await Promise.all([
      reserve(request('a', '1', guest)),
      reserve(request('b', '2', guest)),
    ]);
    assert.equal(cross.filter((result) => result.allowed).length, 1);
    console.log(
      `PASS cross-project concurrent ${guest ? 'guest' : 'account'}: one free project`
    );
  }
  reset(true);
  const denied = await reserve(request('a', 'anonymous', true));
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /Sign in/);
  assert.equal(data.generations.length, 0);
  console.log('PASS unpaid guest reservation blocked before rows/provider');
  data.orders.push({ projectId: 'a', productId: 'pack', status: 'paid' });
  assert.equal(
    (await reserve(request('a', 'legacy-paid', true))).allowed,
    true
  );
  console.log('PASS legacy paid guest reservation preserved');
  reset(true);
  data.generations = Array.from({ length: 2 }, (_, i) => ({
    id: String(i),
    projectId: 'a',
    status: 'complete',
    cost: 0,
  }));
  data.projects[0].userId = 'user'; // Same project claimed at login, no quota reset.
  assert.equal((await reserve(request('a', 'third'))).allowed, true);
  data.generations.find((row) => row.id === 'third')!.status = 'complete';
  assert.equal((await reserve(request('a', 'fourth'))).allowed, false);
  console.log(
    'PASS claimed guest history retains exactly three total free generations'
  );
  reset();
  await reserve(request('a', '1'));
  await settle(['1'], false);
  assert.equal(data.generations.length, 0);
  assert.equal((await reserve(request('b', '2'))).allowed, true);
  console.log('PASS pre-provider failure releases reservation');

  reset();
  await reserve(request('a', 'marker'));
  Object.assign(data.generations[0], { status: 'generating', cost: -1 });
  await settle(['marker'], false);
  assert.equal(data.generations.length, 0);
  console.log(
    'PASS failed pre-call marker acknowledgement releases unsubmitted reservation'
  );

  reset();
  await reserve(request('a', '1'));
  Object.assign(data.generations[0], { status: 'generating', cost: -1 });
  await settle(['1'], true);
  assert.equal(data.generations[0].status, 'failed');
  assert.equal((await reserve(request('b', '2'))).allowed, false);
  console.log(
    'PASS ambiguous provider failure retains charged quota and terminates placeholder'
  );
  reset();
  await reserve(request('a', '1'));
  Object.assign(data.generations[0], {
    status: 'generating',
    providerTaskId: 'submitted',
  });
  await settle(['1'], true);
  assert.equal(data.generations[0].status, 'generating');
  assert.equal(data.generations[0].providerTaskId, 'submitted');
  console.log(
    'PASS submitted provider receipt preserved after bookkeeping failure'
  );
  reset();
  const partial = request('a', 'partial-1');
  partial.candidates.push({
    id: 'partial-2',
    projectId: 'a',
    candidateIndex: 1,
    cost: 0,
  });
  await reserve(partial);
  Object.assign(data.generations[0], {
    status: 'generating',
    providerTaskId: 'accepted',
  });
  await settle(['partial-1', 'partial-2'], true);
  assert.equal(data.generations.length, 2);
  assert.equal(data.generations[0].providerTaskId, 'accepted');
  assert.equal(data.generations[1].status, 'failed');
  assert.equal(data.generations[1].cost, -1);
  console.log(
    'PASS partial multi-candidate batch preserves receipt and full reserved quota'
  );
  reset();
  data.generations = Array.from({ length: 3 }, (_, i) => ({
    id: String(i),
    projectId: 'a',
    status: 'complete',
    cost: 0,
  }));
  assert.equal((await reserve(request('a', 'free-limit'))).allowed, false);
  data.orders.push({ projectId: 'a', productId: 'pack', status: 'paid' });
  for (let extra = 0; extra < 5; extra++) {
    const id = `paid-${extra}`;
    assert.equal((await reserve(request('a', id))).allowed, true);
    data.generations.find((row) => row.id === id)!.status = 'complete';
  }
  assert.equal((await reserve(request('a', 'paid-limit'))).allowed, false);
  console.log(
    'PASS free limit 3, five additional paid generations, total limit 8'
  );
  (context.envConfigs as any).database_provider = 'd1';
  await assert.rejects(reserve(request('a', 'd1')), /requires PostgreSQL/);
  console.log('PASS non-transactional dialect fails closed');

  // Run the route's literal catch body, not a reimplementation of it.
  const route = readFileSync(
    'src/app/api/projects/[id]/generate/route.ts',
    'utf8'
  );
  const catchStart =
    route.lastIndexOf('  } catch (error) {') + '  } catch (error) {'.length;
  const catchBody = route.slice(catchStart, route.lastIndexOf('\n  }\n}'));
  const statusWrites: string[] = [];
  let cleanupFails = false;
  const routeContext = vm.createContext({
    console: { error() {} },
    WEDDING_PACK_PRODUCT_ID: 'pack',
    settleFailedWeddingReservation: async () => {
      if (cleanupFails) throw new Error('cleanup failed');
    },
    updateWeddingProject: async (_id: string, status: string) => {
      statusWrites.push(status);
    },
    respData: (data: any) => ({ code: 0, data }),
    respErr: (message: string) => ({ code: -1, message }),
  });
  vm.runInContext(
    `async function routeCatch(submittedCandidateIds) {
    const error = new Error('bookkeeping failed');
    const projectId = 'a', projectMarkedGenerating = true;
    const reservationIds = ['receipt'], providerAttempted = true;
    const effectiveModel = 'fixture-model';
    ${catchBody}
  }`,
    routeContext
  );
  const runCatch = routeContext.routeCatch as any;
  const accepted = await runCatch(['receipt']);
  assert.equal(accepted.code, 0);
  assert.equal(accepted.data.jobId, 'a');
  assert.equal(accepted.data.candidates[0], 'receipt');
  assert.equal(statusWrites.pop(), 'generating');
  console.log(
    'PASS route bookkeeping failure returns successful polling job for persisted receipt'
  );
  const noReceipt = await runCatch([]);
  assert.equal(noReceipt.code, -1);
  assert.equal(statusWrites.pop(), 'failed');
  console.log('PASS route no-receipt failure returns error and failed project');
  cleanupFails = true;
  const acceptedAfterCleanupError = await runCatch(['receipt']);
  assert.equal(acceptedAfterCleanupError.code, 0);
  assert.equal(statusWrites.pop(), 'generating');
  console.log('PASS route cleanup error still preserves accepted-task polling');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
