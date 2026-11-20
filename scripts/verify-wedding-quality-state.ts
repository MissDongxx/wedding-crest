import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual GET handler with deterministic DB/provider/storage doubles.
// No image provider, database, or payment service is contacted.
async function main() {
  const sourcePath =
    process.env.WEDDING_QA_SOURCE || 'src/app/api/jobs/[id]/route.ts';
  const legacy = process.argv.includes('--legacy');
  const writes: Record<string, unknown>[] = [];
  const reviews: unknown[] = [];
  const assets: unknown[] = [];
  const generations = [
    {
      id: 'new',
      status: 'generating',
      provider: 'fixture',
      model: 'fixture',
      sourceImageUrl: 'https://fixture.invalid/crest.png',
      qaScore: null as number | null,
      candidateIndex: 0,
      createdAt: new Date('2026-11-02T00:00:00Z'),
    },
    {
      id: 'historical',
      status: 'complete',
      provider: 'fixture',
      model: 'fixture',
      sourceImageUrl: 'https://fixture.invalid/old.png',
      qaScore: 900,
      candidateIndex: 1,
      createdAt: new Date('2026-11-01T00:00:00Z'),
    },
  ];
  const project = {
    id: 'project',
    userId: 'user',
    guestId: null,
    status: 'generating',
    generations,
  };
  const modules: Record<string, unknown> = {
    '@/shared/lib/pure-image': {
      normalizeCheckerboardTransparency: () => {
        throw new Error('not used');
      },
    },
    '@/shared/lib/resp': {
      respData: (data: unknown) => ({ code: 0, data }),
      respErr: (message: string) => {
        throw new Error(message);
      },
    },
    '@/shared/models/user': { getUserInfo: async () => ({ id: 'user' }) },
    '@/shared/models/wedding-actor': {
      getWeddingActor: async () => ({ user: { id: 'user' }, ownerId: 'user' }),
      getWeddingProjectOwner: (
        actor: { user: { id: string } },
        project: { userId: string }
      ) => (actor.user.id === project.userId ? actor.user.id : undefined),
    },
    '@/shared/models/wedding-checkout': {
      getWeddingReceiptState: async () => ({
        receiptEmailMissing: false,
        hasReceiptEmail: true,
      }),
    },
    '@/shared/models/wedding': {
      canAccessWeddingProject: async () => true,
      claimWeddingProject: async () => {
        throw new Error('unexpected claim');
      },
      createWeddingReview: async (review: unknown) => reviews.push(review),
      getWeddingGenerationAllowance: async () => ({ allowed: true }),
      getWeddingProject: async () => project,
      hasPaidWeddingOrder: async () => true,
      saveWeddingAssets: async (_id: string, saved: unknown[]) =>
        assets.push(...saved),
      updateWeddingGeneration: async (
        id: string,
        update: Record<string, unknown>
      ) => {
        writes.push(update);
        Object.assign(
          generations.find((generation) => generation.id === id)!,
          update
        );
      },
      updateWeddingProject: async (_id: string, status: string) => {
        project.status = status;
      },
    },
    '@/shared/services/ai': {
      getAIService: async () => ({ getProvider: () => ({ name: 'fixture' }) }),
    },
    '@/shared/services/storage': {
      getStorageService: async () => {
        throw new Error('not used');
      },
    },
    '@/shared/wedding/config': {
      decideReview: (score: number) => (score >= 8 ? 'accept' : 'reject'),
    },
  };
  const context = vm.createContext({
    exports: {},
    Request,
    Response,
    Buffer,
    Date,
    fetch: async () => {
      throw new Error('fixture: optional storage unavailable');
    },
    require: (id: string) => {
      assert.ok(id in modules, `Unexpected dependency: ${id}`);
      return modules[id];
    },
  });
  const js = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  vm.runInContext(js, context);
  const get = (
    context.exports as {
      GET: (
        request: Request,
        context: unknown
      ) => Promise<{
        code: number;
        data: {
          status: string;
          generations: {
            id: string;
            reviewScore: number | null;
            reviewStatus?: string;
            reviewNotes: string | null;
          }[];
        };
      }>;
    }
  ).GET;
  const response = await get(new Request('http://localhost/api/jobs/project'), {
    params: Promise.resolve({ id: 'project' }),
  });
  assert.equal(response.code, 0);
  assert.equal(response.data.status, 'complete');
  assert.equal(generations[0].status, 'complete');
  assert.equal(assets.length, 1);
  assert.equal(writes.length, 1);
  assert.equal(
    generations[1].qaScore,
    900,
    'Historical DB data is not rewritten'
  );
  if (legacy) {
    assert.equal(generations[0].qaScore, 900);
    assert.equal(reviews.length, 1);
    assert.ok(
      response.data.generations.every(
        (generation) => generation.reviewScore === 9
      )
    );
    console.log(
      'BASELINE CONFIRMED: provider completion persisted synthetic 900, created one fabricated review, exposed 9 for new and historical images.'
    );
  } else {
    assert.equal(generations[0].qaScore, null);
    assert.equal(reviews.length, 0);
    for (const generation of response.data.generations) {
      assert.equal(generation.reviewScore, null);
      assert.equal(generation.reviewStatus, 'unreviewed');
      assert.equal(generation.reviewNotes, null);
    }
    console.log(
      'PASS: new completion has null QA and no fabricated review; historical scores hidden without DB rewrite; complete images/assets remain available.'
    );
    // Polling again must not manufacture reviews or duplicate completion/assets.
    await get(new Request('http://localhost/api/jobs/project'), {
      params: Promise.resolve({ id: 'project' }),
    });
    assert.equal(writes.length, 1);
    assert.equal(assets.length, 1);
    assert.equal(reviews.length, 0);
    console.log(
      'PASS: repeated completed-job polling performs no extra completion, review, or asset writes.'
    );
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
