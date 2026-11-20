import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

import {
  isWeddingLetteringPatch,
  normalizeWeddingProject,
} from '../src/shared/wedding/result-data';

function source(path: string) {
  return readFileSync(path, 'utf8');
}
function declaration(path: string, name: string): string {
  const text = source(path);
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find((item) =>
    ts.isFunctionDeclaration(item)
      ? item.name?.text === name
      : ts.isVariableStatement(item) &&
        item.declarationList.declarations.some(
          (decl) => decl.name.getText(ast) === name
        )
  );
  assert.ok(node, `${path}: ${name}`);
  return node.getText(ast).replace(/^export /, '');
}
function evaluate(text: string, globals: Record<string, unknown>) {
  const context = vm.createContext(globals);
  vm.runInContext(
    ts.transpileModule(text, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
    context
  );
  return context;
}
async function main() {
  const model = 'src/shared/models/wedding.ts';
  const row = {
    partner1: 'Emma',
    partner2: 'James',
    initials: 'EJ',
    palette: '[]',
  };
  const context = evaluate(
    `${declaration(model, 'buildInput')}\nglobalThis.buildInput = buildInput;`,
    {
      parseInitials: () => ['E', 'J'],
      parsePalette: () => [],
    }
  );
  const buildInput = context.buildInput as (
    row: unknown,
    elements: unknown[]
  ) => { showLocation: boolean };
  assert.equal(buildInput(row, []).showLocation, false);
  assert.equal(
    buildInput(row, [{ type: 'show_location', value: 'true' }]).showLocation,
    true
  );
  assert.equal(
    buildInput(row, [{ type: 'show_location', value: 'false' }]).showLocation,
    false
  );
  assert.equal(
    buildInput(row, [{ type: 'show_location', value: 'garbage' }]).showLocation,
    false
  );
  console.log(
    'PASS actual model input: legacy and invalid flag default false; explicit true round-trips'
  );

  let deleted = 0;
  const inserted: { type: string; value: string }[] = [];
  const tx = {
    delete: () => ({
      where: async () => {
        deleted++;
      },
    }),
    insert: () => ({
      values: async (values: { type: string; value: string }[]) => {
        inserted.push(...values);
      },
    }),
  };
  const patchContext = evaluate(
    `${declaration(model, 'updateWeddingProjectElements')}\nglobalThis.patch = updateWeddingProjectElements;`,
    {
      getUuid: () => 'uuid',
      weddingProjectElement: { projectId: 'projectId', type: 'type' },
      and: (...args: unknown[]) => args,
      eq: (...args: unknown[]) => args,
      runInDbTransaction: async (callback: (db: unknown) => unknown) =>
        callback(tx),
    }
  );
  const patch = patchContext.patch as (
    id: string,
    values: unknown
  ) => Promise<void>;
  await patch('project', {});
  assert.equal(deleted, 0);
  await patch('project', { showLocation: true });
  assert.equal(deleted, 1);
  assert.deepEqual(
    inserted.map(({ type, value }) => ({ type, value })),
    [{ type: 'show_location', value: 'true' }]
  );
  await patch('project', { showLocation: false });
  assert.equal(deleted, 2);
  assert.equal(inserted.length, 1);
  console.log(
    'PASS actual element update: undefined untouched, true stored, false removed in transaction'
  );

  for (const [path, name] of [
    ['src/app/api/projects/route.ts', 'createSchema'],
    ['src/app/api/projects/[id]/route.ts', 'patchSchema'],
  ] as const) {
    const text =
      name === 'createSchema'
        ? `${declaration(path, 'hexColor')}\n${declaration(path, 'cleanText')}\n${declaration(path, name)}`
        : declaration(path, name);
    const schemaContext = evaluate(`${text}\nglobalThis.schema = ${name};`, {
      z,
      HEX_COLOR: /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
      WEDDING_MAX_FLOWERS: 3,
      WEDDING_MAX_PALETTE_COLORS: 3,
      WEDDING_MAX_PERSONAL_ELEMENTS: 2,
    });
    const schema = schemaContext.schema as z.ZodObject<{
      showLocation: z.ZodOptional<z.ZodBoolean>;
    }>;
    const flag = schema.shape.showLocation;
    assert.equal(flag.parse(undefined), undefined);
    assert.equal(flag.parse(true), true);
    assert.equal(flag.parse(false), false);
    assert.equal(flag.safeParse('true').success, false);
  }
  console.log(
    'PASS actual POST/PATCH schemas: optional strict boolean; no string coercion'
  );

  assert.equal(
    normalizeWeddingProject<{ id: string; showLocation?: boolean }>({
      id: 'legacy',
    }).showLocation,
    false
  );
  assert.equal(
    normalizeWeddingProject<{ id: string; showLocation?: boolean }>({
      id: 'p',
      input: { showLocation: true },
    }).showLocation,
    true
  );
  assert.equal(
    normalizeWeddingProject({
      id: 'p',
      showLocation: true,
      input: { showLocation: false },
    }).showLocation,
    false
  );
  assert.equal(
    isWeddingLetteringPatch({ showLocation: true }, { showLocation: false }),
    true
  );
  assert.equal(
    isWeddingLetteringPatch({ showLocation: false }, { showLocation: true }),
    false
  );
  assert.equal(
    isWeddingLetteringPatch(
      { location: 'Como', venue: 'Villa' },
      { showLocation: true }
    ),
    true
  );
  assert.equal(
    isWeddingLetteringPatch({ location: 'Como' }, { showLocation: false }),
    false
  );
  assert.equal(
    isWeddingLetteringPatch(
      { location: 'Como', showLocation: true },
      { showLocation: false }
    ),
    false
  );
  assert.equal(
    isWeddingLetteringPatch(
      { venue: 'Villa', showLocation: false },
      { showLocation: true }
    ),
    false
  );
  assert.equal(
    isWeddingLetteringPatch({ frameId: 'frame' }, { showLocation: true }),
    false
  );
  assert.equal(
    isWeddingLetteringPatch({ layout: 'arch' }, { showLocation: true }),
    false
  );
  console.log(
    'PASS client normalization and edit classification: print wording/on preserve artwork; scene/off/layout/mixed changes redesign'
  );

  for (const locale of ['en', 'zh', 'de', 'fr', 'it', 'ko', 'pt-BR', 'th']) {
    for (const page of ['create', 'design']) {
      const messages = JSON.parse(
        source(`src/config/locale/messages/${locale}/pages/${page}.json`)
      );
      for (const key of [
        'location_usage',
        'location_inspiration',
        'location_print',
        'location_usage_hint',
        ...(page === 'design' ? ['edit_location', 'edit_venue'] : []),
      ]) {
        assert.equal(
          typeof messages[key],
          'string',
          `${locale}/${page}/${key}`
        );
        assert.ok(messages[key].length > 0);
      }
    }
  }
  const wizard = source('src/themes/default/blocks/wedding-wizard.tsx');
  assert.ok(wizard.includes('showLocation: boolean;'));
  assert.ok(wizard.includes('persisted.showLocation === true'));
  assert.equal(
    (wizard.match(/typeof saved.showLocation === 'boolean'/g) ?? []).length,
    2
  );
  assert.ok(wizard.includes('setShowLocation(input.showLocation === true)'));
  assert.ok(wizard.includes('location_usage'));
  assert.ok(
    source('src/app/api/projects/route.ts').includes(
      'showLocation: body.showLocation === true'
    )
  );
  assert.ok(
    source('src/app/api/projects/[id]/route.ts').includes(
      'elementPatch.showLocation = body.showLocation'
    )
  );
  const result = source('src/themes/default/blocks/wedding-result.tsx');
  const styleFlagStart = result.indexOf(
    '          if (params.fieldPatch.typography !== undefined) {'
  );
  const styleFlagEnd = result.indexOf(
    '          const response = await fetch',
    styleFlagStart
  );
  assert.ok(styleFlagStart > 0 && styleFlagEnd > styleFlagStart);
  const flagSource = result.slice(styleFlagStart, styleFlagEnd);
  for (const fieldPatch of [
    {},
    { location: 'Como' },
    { typography: 'editorial_rose' },
  ]) {
    const editBody: { replaceLetteringStyle?: boolean } = {};
    evaluate(flagSource, { params: { fieldPatch }, editBody });
    assert.equal(
      editBody.replaceLetteringStyle,
      'typography' in fieldPatch ? true : undefined
    );
  }
  console.log(
    'PASS actual result request flag: typography change opts in; names/location leave lettering style intact'
  );
  console.log(
    'PASS 8 locales, wizard hydration/draft mapping and POST/PATCH flag plumbing'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
