import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

import {
  countsTowardDailyImages,
  weddingAccess,
  weddingGenerationAllowance,
} from '../src/shared/wedding/access';

// Execute the actual model functions with deterministic transaction/ORM fixtures.
// No database, credentials or external provider are used.
const source = readFileSync('src/shared/models/wedding.ts', 'utf8');
const functions = source.slice(
  source.indexOf('async function readWeddingAccess('),
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
    {
      get: (obj, key) => (key === 'name' ? obj.name : `${name}.${String(key)}`),
    }
  );
const weddingProject = table('projects'),
  weddingGeneration = table('generations'),
  order = table('orders'),
  weddingProjectElement = table('elements');
let data: Record<string, Row[]>;
const field = (row: Row, key: string) => {
  const [table, column] = key.split('.');
  if (table === 'projects' && row.projectId)
    return data.projects.find((p) => p.id === row.projectId)?.[column];
  return row[column];
};
const eq = (key: string, value: any) => (row: Row) => field(row, key) === value;
const isNull = (key: string) => (row: Row) => field(row, key) == null;
const and =
  (...predicates: any[]) =>
  (row: Row) =>
    predicates.every((p) => p(row));
const or =
  (...predicates: any[]) =>
  (row: Row) =>
    predicates.some((p) => p(row));
const inArray = (key: string, values: any[]) => (row: Row) =>
  values.includes(field(row, key));
const locks = new Map<string, Promise<void>>();
const executor = () => {
  const releases: (() => void)[] = [];
  const query = (kind: string, initialTable?: any) => {
    let name = initialTable?.name,
      predicate: (row: Row) => boolean = () => true,
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
      orderBy: () => builder,
      innerJoin: () => builder,
      onConflictDoNothing: () => builder,
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
              data[name].push(
                ...(Array.isArray(values) ? values : [values]).map(
                  (v: Row) => ({ createdAt: new Date(), ...v })
                )
              );
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
  weddingProjectElement,
  order,
  getUuid: () => crypto.randomUUID(),
  weddingPalettes: [{ colors: ['#ffffff'] }],
  loadWeddingProject: async (_tx: any, id: string) =>
    data.projects.find((p) => p.id === id),
  eq,
  asc: (field: string) => field,
  isNull,
  and,
  or,
  inArray,
  sql: (_parts: any, value: string) => value,
  OrderStatus: { PAID: 'paid' },
  WEDDING_PACK_PRODUCT_ID: 'pack',
  weddingAccess,
  weddingGenerationAllowance,
  countsTowardDailyImages,
  db: executor,
  withDb: async (work: any) => work(executor()),
  canAccessWeddingProject: async ({ id, userId, guestId }: any) =>
    data.projects.some(
      (p) =>
        p.id === id && (p.userId ? p.userId === userId : p.guestId === guestId)
    ),
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
const createSource = source.slice(
  source.indexOf('export async function createWeddingProject('),
  source.indexOf('/** Update project status')
);
vm.runInContext(
  ts.transpileModule(
    createSource.replace('export async function', 'async function'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  context
);
const createProject = context.createWeddingProject as any;
const downloadPolicy = source.slice(
  source.indexOf('export async function hasPaidWeddingOrder('),
  source.indexOf(
    '/* -------------------------------------------------------------------------- */',
    source.indexOf('export async function hasPaidWeddingOrder(')
  )
);
vm.runInContext(
  ts.transpileModule(
    downloadPolicy.replace('export async function', 'async function'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  context
);
const hasPaid = context.hasPaidWeddingOrder as any;

const reserve = context.reserveWeddingGenerationBatch as any;
const settle = context.settleFailedWeddingReservation as any;

const reset = (paid = true) => {
  data = {
    elements: [],
    projects: ['a', 'b'].map((id) => ({ id, userId: 'user', status: 'draft' })),
    generations: [],
    orders: paid
      ? [
          {
            id: 'o1',
            userId: 'user',
            productId: 'pack',
            status: 'paid',
            paidAt: new Date(),
            createdAt: new Date(),
          },
        ]
      : [],
  };
  locks.clear();
};
const request = (projectId: string, id: string) => ({
  projectId,
  userId: 'user',
  candidates: [{ id, projectId, cost: 0 }],
});
async function main() {
  reset(false);
  assert.equal(
    (await reserve(request('a', 'unpaid'))).reasonCode,
    'payment_required'
  );
  assert.equal(data.generations.length, 0);
  console.log('PASS actual reservation: unpaid denied before rows/provider');
  reset();
  const same = await Promise.all([
    reserve(request('a', 'one')),
    reserve(request('a', 'two')),
  ]);
  assert.equal(same.filter((r: any) => r.allowed).length, 1);
  console.log(
    'PASS actual reservation: duplicate same-project clicks create one image task'
  );
  reset();
  const sameKey = await Promise.all([
    reserve(request('a', 'same-initial-key')),
    reserve(request('a', 'same-initial-key')),
  ]);
  assert.equal(
    sameKey.every((r: any) => r.allowed),
    true
  );
  assert.equal(sameKey.filter((r: any) => r.existing).length, 1);
  assert.equal(data.generations.length, 1);
  console.log(
    'PASS actual atomic initial request replay: same candidate id returns existing, exactly one reservation/provider owner'
  );
  reset();
  data.generations = Array.from({ length: 9 }, (_, i) => ({
    id: String(i),
    projectId: 'a',
    status: 'complete',
    cost: 0,
    createdAt: new Date(),
  }));
  const cross = await Promise.all([
    reserve(request('a', 'ten')),
    reserve(request('b', 'eleven')),
  ]);
  assert.equal(cross.filter((r: any) => r.allowed).length, 1);
  assert.equal(cross.find((r: any) => !r.allowed).reasonCode, 'daily_limit');
  assert.equal(data.generations.length, 10);
  console.log(
    'PASS actual reservation: account lock serializes cross-project race at 9/10; exactly one accepted'
  );
  reset();
  const syntheticOwner = 'wedding_guest_fixture';
  data.projects.forEach((row) => (row.userId = syntheticOwner));
  data.orders[0].userId = syntheticOwner;
  data.generations = Array.from({ length: 9 }, (_, i) => ({
    id: `guest-${i}`,
    projectId: 'a',
    status: 'complete',
    cost: 0,
    createdAt: new Date(),
  }));
  const guestRace = await Promise.all([
    reserve({ ...request('a', 'guest-ten'), userId: syntheticOwner }),
    reserve({ ...request('b', 'guest-eleven'), userId: syntheticOwner }),
  ]);
  assert.equal(guestRace.filter((r: any) => r.allowed).length, 1);
  assert.equal(data.generations.length, 10);
  const replayAtTen = await reserve({
    ...request('a', 'guest-ten'),
    userId: syntheticOwner,
  });
  assert.equal(replayAtTen.allowed, true);
  assert.equal(replayAtTen.existing, true);
  console.log(
    'PASS synthetic guest shares the account-wide atomic daily limit; replay of tenth candidate survives exhausted quota'
  );

  reset();
  data.orders[0].paidAt = new Date(Date.now() - 8 * 86400000);
  assert.equal(
    (await reserve(request('a', 'expired'))).reasonCode,
    'access_expired'
  );
  console.log('PASS actual reservation: expired paid account denied');
  reset();
  await reserve(request('a', 'reserved'));
  await settle(['reserved'], false);
  assert.equal(data.generations.length, 0);
  await reserve(request('b', 'unknown'));
  await settle(['unknown'], true);
  assert.equal(data.generations[0].cost, -1);
  assert.equal(data.generations[0].status, 'failed');
  console.log(
    'PASS actual settlement: pre-provider failure releases slot; unknown attempt retains reservation'
  );
  reset();
  data.generations = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    projectId: 'a',
    status: 'complete',
    cost: 0,
    createdAt: new Date(Date.now() - 86400000),
  }));
  assert.equal((await reserve(request('b', 'tomorrow'))).allowed, true);
  data.generations[data.generations.length - 1].status = 'failed';
  data.generations[data.generations.length - 1].cost = 0;
  assert.equal((await reserve(request('b', 'after-failure'))).allowed, true);
  console.log(
    'PASS actual reservation: previous day images excluded; confirmed failures release quota'
  );
  reset(false);
  const details = {
    userId: 'user',
    partner1: 'Emma',
    partner2: 'James',
    style: 'botanical_watercolor',
    layout: 'oval',
    palette: ['#ffffff'],
  };
  await assert.rejects(createProject({ ...details, id: 'unpaid' }), /Purchase/);
  reset();
  data.projects = ['a', 'b', 'c', 'd'].map((id) => ({ id, userId: 'user' }));
  const projects = await Promise.allSettled([
    createProject({ ...details, id: 'fifth' }),
    createProject({ ...details, id: 'sixth' }),
  ]);
  assert.equal(projects.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(data.projects.length, 5);
  assert.equal(data.orders[0].projectId, 'fifth');
  await createProject({ ...details, id: 'fifth' });
  assert.equal(data.projects.length, 5);
  console.log(
    'PASS actual project creation: unpaid denied, concurrent fifth/sixth bounded at five, idempotent retry does not consume another project'
  );
  data.orders.push({
    id: 'o2',
    userId: 'user',
    productId: 'pack',
    status: 'paid',
    paidAt: new Date(),
    createdAt: new Date(),
  });
  for (let i = 0; i < 5; i++)
    await createProject({ ...details, id: 'repurchase-' + i });
  assert.equal(data.projects.length, 10);
  assert.equal(data.orders[0].projectId, 'fifth');
  assert.equal(data.orders[1].projectId, 'repurchase-0');
  console.log(
    'PASS prepaid receipt attribution: first owned draft binds unlinked paid order once; repurchase links independently without consuming extra project rights'
  );
  await assert.rejects(
    createProject({ ...details, id: 'eleventh-project' }),
    /Purchase/
  );
  console.log(
    'PASS actual project creation: second purchase adds exactly five new projects, eleventh requires purchase'
  );
  reset(false);
  data.orders.push({
    id: 'other',
    userId: 'other-user',
    productId: 'pack',
    status: 'paid',
    paidAt: new Date(),
    createdAt: new Date(),
  });
  assert.equal((await reserve(request('a', 'foreign-order'))).allowed, false);
  console.log('PASS foreign account purchases grant no entitlement');
  reset();
  data.orders[0].paidAt = new Date(Date.now() - 30 * 86400000);
  assert.equal(await hasPaid('user', 'b'), true);
  assert.equal(await hasPaid('other-user', 'b'), false);
  data.orders[0].userId = 'guest-billing-identity';
  data.orders[0].projectId = 'a';
  assert.equal(await hasPaid('user', 'a'), true);
  assert.equal(
    (await reserve(request('a', 'expired-legacy'))).reasonCode,
    'access_expired'
  );
  console.log(
    'PASS actual download policy: expired account keeps downloads; foreign owner denied; claimed legacy guest purchase keeps paid downloads'
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
