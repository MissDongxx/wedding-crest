import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

import * as image from '../src/extensions/ai/openai-image';
import { AIMediaType, AITaskStatus } from '../src/extensions/ai/types';

const source =
  process.env.WEDDING_QA_SOURCE ??
  'src/app/api/projects/[id]/generate/route.ts';

async function run({
  error,
  status = 429,
  reference = false,
  enabled = true,
  key = true,
  runwareKey = true,
}: {
  error?: string;
  status?: number;
  reference?: boolean;
  enabled?: boolean;
  key?: boolean;
  runwareKey?: boolean;
} = {}) {
  const calls: string[] = [];
  const config = {
    app_url: 'https://fixture.invalid',
    openai_api_key: key ? 'fixture-key' : '',
    openai_image_enabled: String(enabled),
    openai_image_quality: 'medium',
  };
  const crest = 'https://fixture.invalid/crest.png';
  const output = {
    data: [{ b64_json: Buffer.from('fixture PNG bytes').toString('base64') }],
  };
  const row: Record<string, unknown> = { id: 'candidate' };
  const tasks: Record<string, unknown>[] = [];
  const runware = {
    name: 'runware',
    configs: { model: 'fixture:runware' },
    generate: async ({ params }: any) => {
      calls.push('Runware');
      assert.equal(params.model, 'fixture:runware');
      assert.equal(params.options.width, reference ? undefined : 1024);
      return { taskId: 'runware-receipt', taskStatus: AITaskStatus.PENDING };
    },
  };
  const modules: Record<string, unknown> = {
    zod: { z },
    '@/extensions/ai': { AIMediaType, AITaskStatus },
    '@/extensions/ai/openai-image': {
      ...image,
      OpenAIImageProvider: class extends image.OpenAIImageProvider {
        constructor(
          config: ConstructorParameters<typeof image.OpenAIImageProvider>[0],
          store: ConstructorParameters<typeof image.OpenAIImageProvider>[1]
        ) {
          super(config, store, async (url, init) => {
            calls.push(String(url).split('/').at(-1)!);
            const body = JSON.parse(String(init?.body));
            assert.equal(body.model, 'gpt-image-2.5-flare');
            assert.equal(body.quality, 'medium');
            assert.equal(body.size, '1024x1024');
            assert.deepEqual(
              body.images,
              reference
                ? [{ image_url: 'https://fixture.invalid/reference.png' }]
                : undefined
            );
            return error
              ? Response.json({ error: { code: error } }, { status })
              : Response.json(output, {
                  headers: { 'x-request-id': 'openai-receipt' },
                });
          });
        }
      },
    },
    '@/shared/lib/hash': { getUuid: () => 'fixture-id' },
    '@/shared/lib/pure-image': {
      normalizeCheckerboardTransparency: (bytes: Buffer) => {
        assert.equal(bytes.toString(), 'fixture PNG bytes');
        return { buffer: bytes };
      },
    },
    '@/shared/lib/resp': {
      respData: (data: unknown) => ({ code: 0, data }),
      respErr: (message: string) => ({ code: -1, message }),
    },
    '@/shared/models/ai_task': {
      createAITask: async (task: Record<string, unknown>) => {
        tasks.push(task);
        return task;
      },
    },
    '@/shared/models/config': {
      getAllConfigs: async () => config,
      invalidateConfigsCache: () => {},
    },
    '@/shared/models/wedding': {
      getWeddingProject: async () => ({ input: {}, style: 'coastal' }),
      canAccessWeddingProject: async () => true,
      getWeddingGenerationAllowance: async () => ({ allowed: true }),
      getActiveWeddingPromptTemplate: async () => ({ template: 'prompt' }),
      reserveWeddingGenerationBatch: async ({ candidates }: any) => {
        Object.assign(row, candidates[0]);
        return { allowed: true };
      },
      updateWeddingGeneration: async (
        _id: string,
        changes: Record<string, unknown>
      ) => Object.assign(row, changes),
      updateWeddingProject: async () => {},
      settleFailedWeddingReservation: async () => {},
    },
    '@/shared/models/wedding-actor': {
      getWeddingActor: async () => ({ user: { id: 'fixture-user' } }),
      getWeddingProjectOwner: () => 'fixture-user',
    },
    '@/shared/services/ai': {
      getAIService: async () => ({
        getProvider: () => (runwareKey ? runware : undefined),
        getDefaultProvider: () => (runwareKey ? runware : undefined),
      }),
    },
    '@/shared/services/storage': {
      getStorageService: async () => ({
        getProviderNames: () => ['fixture'],
        uploadFile: async () => ({ success: true, url: crest }),
      }),
    },
    '@/shared/wedding/config': { WEDDING_MAX_CANDIDATES: 1 },
    '@/shared/wedding/edit-plan': { editPlanSchema: z.any() },
    '@/shared/wedding/generation-request': {},
    '@/shared/wedding/prompt-compiler': {
      compileWeddingPrompt: () => 'prompt',
      getWeddingReferenceImages: () => (reference ? ['/reference.png'] : []),
      getWeddingVersions: () => ({}),
    },
  };
  const context = vm.createContext({
    exports: {},
    URL,
    process: { env: {} },
    console: { error: () => {} },
    require: (id: string) => {
      assert.ok(id in modules, `Unexpected dependency: ${id}`);
      return modules[id];
    },
  });
  const js = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  vm.runInContext(js, context);
  const response = await context.exports.POST(
    new Request('https://fixture.invalid/api/projects/fixture/generate', {
      method: 'POST',
      body: '{}',
    }),
    { params: Promise.resolve({ id: 'fixture' }) }
  );
  return { response, row, calls, tasks, crest };
}

async function main() {
  const success = await run();
  if (process.argv.includes('--baseline')) {
    assert.deepEqual(success.calls, ['Runware']);
    assert.equal(success.row.provider, 'runware');
    console.log(
      'Baseline: configured OpenAI is ignored; Runware receives the generation'
    );
    return;
  }
  assert.deepEqual(success.calls, ['generations']);
  assert.equal(success.response.code, 0);
  assert.equal(success.row.provider, 'openai');
  assert.equal(success.row.sourceImageUrl, success.crest);
  assert.equal(success.tasks[0].status, AITaskStatus.SUCCESS);
  console.log('OpenAI first: generations → stored PNG → OpenAI receipt');
  const edit = await run({ reference: true });
  assert.deepEqual(edit.calls, ['edits']);
  assert.equal(edit.response.code, 0);
  console.log(
    'Reference input: edits endpoint accepts the absolute reference URL'
  );
  for (const [error, status] of [
    ['insufficient_quota', 429],
    ['credit_balance_exhausted', 429],
    ['billing_hard_limit_reached', 400],
  ] as const) {
    const fallback = await run({ error, status, reference: true });
    assert.deepEqual(fallback.calls, ['edits', 'Runware']);
    assert.equal(fallback.response.code, 0);
    assert.equal(fallback.row.provider, 'runware');
    assert.equal(fallback.row.model, 'fixture:runware');
    assert.equal(fallback.row.providerTaskId, 'runware-receipt');
    assert.equal(fallback.tasks[0].provider, 'runware');
    console.log(
      `Quota (${status} ${error}): OpenAI → Runware; Runware receipt saved`
    );
  }
  for (const [error, status] of [
    ['rate_limit_exceeded', 429],
    ['invalid_api_key', 401],
    ['moderation_blocked', 400],
    ['server_error', 500],
  ] as const) {
    const failure = await run({ error, status });
    assert.deepEqual(failure.calls, ['generations']);
    assert.equal(failure.response.code, -1);
    console.log(`Non-quota (${status} ${error}): no Runware request`);
  }
  assert.deepEqual((await run({ enabled: false })).calls, ['Runware']);
  assert.deepEqual((await run({ key: false })).calls, ['Runware']);
  const noFallback = await run({
    error: 'insufficient_quota',
    runwareKey: false,
  });
  assert.deepEqual(noFallback.calls, ['generations']);
  assert.equal(noFallback.response.code, -1);
  console.log(
    'Disabled/missing OpenAI key: Runware; exhausted OpenAI without Runware: error'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
