import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

import { getWeddingInitialGenerationIds } from '../src/shared/wedding/generation-request';
import * as identity from '../src/shared/wedding/guest-identity';

async function main() {
  const token = identity.createWeddingGuestToken();
  assert.equal(identity.isWeddingGuestToken(token), true);
  assert.notEqual(identity.createWeddingGuestToken(), token);
  assert.equal(identity.isWeddingGuestToken('client-selected-id'), false);
  assert.equal(identity.isWeddingGuestToken('A'.repeat(64)), false);
  await assert.rejects(identity.getWeddingGuestBuyerId('client-selected-id'));
  const owner = await identity.getWeddingGuestBuyerId(token);
  assert.match(owner, /^wedding_guest_[0-9a-f]{64}$/);
  assert.equal(owner, await identity.getWeddingGuestBuyerId(token));
  assert.notEqual(
    owner,
    await identity.getWeddingGuestBuyerId(identity.createWeddingGuestToken())
  );
  console.log(
    'PASS guest token: server random 256 bits, strict validation, stable SHA-256 billing owner'
  );

  let realUser: { id: string } | null = null;
  const jar = new Map<string, string>();
  const writes: { name: string; value: string; options: any }[] = [];
  const access = new Map<string, { active: boolean; purchased: boolean }>();
  let scheme = 'https';
  let site = 'same-origin';
  const exports: Record<string, any> = {};
  const context = vm.createContext({
    exports,
    process: { env: {} },
    require: (name: string) => {
      if (name === 'next/headers')
        return {
          cookies: async () => ({
            get: (name: string) =>
              jar.has(name) ? { value: jar.get(name) } : undefined,
            set: (name: string, value: string, options: any) => {
              jar.set(name, value);
              writes.push({ name, value, options });
            },
          }),
          headers: async () =>
            new Headers({
              'x-forwarded-proto': scheme,
              'sec-fetch-site': site,
              'x-wedding-guest-id': 'forged-client-owner',
            }),
        };
      if (name.endsWith('/user')) return { getUserInfo: async () => realUser };
      if (name.endsWith('/wedding'))
        return {
          getWeddingAccountAccess: async (id: string) =>
            access.get(id) ?? { active: false, purchased: false },
        };
      if (name.endsWith('/guest-identity')) return identity;
      throw new Error(`unexpected dependency ${name}`);
    },
  });
  vm.runInContext(
    ts.transpileModule(
      readFileSync('src/shared/models/wedding-actor.ts', 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }
    ).outputText,
    context
  );
  let actor = await exports.getWeddingActor();
  assert.equal(actor.ownerId, undefined);
  assert.equal(actor.user, null);
  assert.equal(writes.length, 0);
  actor = await exports.getWeddingActor({ createGuest: true });
  assert.equal(actor.user, null);
  assert.equal(actor.ownerId, actor.guestOwnerId);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].options.httpOnly, true);
  assert.equal(writes[0].options.sameSite, 'lax');
  assert.equal(writes[0].options.path, '/');
  assert.equal(writes[0].options.secure, true);
  assert.ok(writes[0].options.maxAge >= 7 * 86400);
  const guestOwner = actor.guestOwnerId;
  assert.equal((await exports.getWeddingActor()).guestOwnerId, guestOwner);
  realUser = { id: 'real-account' };
  actor = await exports.getWeddingActor();
  assert.equal(actor.ownerId, 'real-account');
  assert.equal(
    identity.getWeddingProjectOwner(actor, { userId: guestOwner }),
    guestOwner
  );
  assert.equal(
    identity.getWeddingProjectOwner(actor, { userId: 'real-account' }),
    'real-account'
  );
  assert.equal(
    identity.getWeddingProjectOwner(actor, { userId: 'other-account' }),
    undefined
  );
  assert.equal(
    identity.getWeddingProjectOwner(actor, { userId: null }),
    undefined
  );
  console.log(
    'PASS actor: HttpOnly capability, HTTPS Secure, read-only SSR, no forged header authority, real session stays separate'
  );

  access.set(guestOwner, { active: true, purchased: true });
  assert.equal(await exports.getWeddingPurchaseOwner(actor), guestOwner);
  access.set('real-account', { active: false, purchased: true });
  assert.equal(await exports.getWeddingPurchaseOwner(actor), guestOwner);
  access.set('real-account', { active: true, purchased: true });
  assert.equal(await exports.getWeddingPurchaseOwner(actor), 'real-account');
  access.set('real-account', { active: false, purchased: true });
  access.set(guestOwner, { active: false, purchased: true });
  assert.equal(await exports.getWeddingPurchaseOwner(actor), 'real-account');
  console.log(
    'PASS purchase owner: active account, active browser guest, then historical account/guest purchase'
  );

  realUser = null;
  jar.clear();
  actor = await exports.getWeddingActor();
  assert.equal(actor.ownerId, undefined);
  assert.equal(
    identity.getWeddingProjectOwner(actor, { userId: guestOwner }),
    undefined
  );
  jar.set(identity.WEDDING_GUEST_COOKIE, 'tampered');
  assert.equal((await exports.getWeddingActor()).guestOwnerId, undefined);
  scheme = 'http';
  assert.notEqual(
    (await exports.getWeddingActor({ createGuest: true })).guestOwnerId,
    guestOwner
  );
  assert.equal(writes.at(-1)!.options.secure, false);
  console.log(
    'PASS missing/tampered/wrong guest cookie never recovers another buyer; no email-based identity or login'
  );
  jar.clear();
  site = 'cross-site';
  const writesBeforeCrossSite = writes.length;
  await assert.rejects(
    exports.getWeddingActor({ createGuest: true }),
    /same-site/
  );
  assert.equal(writes.length, writesBeforeCrossSite);
  site = 'same-origin';
  console.log(
    'PASS cross-site bootstrap cannot issue or rotate the guest cookie'
  );

  const key = '01a19b43-91ab-7803-9705-3bfd251ae323';
  const ids = await getWeddingInitialGenerationIds('project-one', key, 2);
  assert.deepEqual(
    ids,
    await getWeddingInitialGenerationIds('project-one', key, 2)
  );
  assert.notEqual(ids[0], ids[1]);
  assert.notDeepEqual(
    ids,
    await getWeddingInitialGenerationIds('project-two', key, 2)
  );
  await assert.rejects(
    getWeddingInitialGenerationIds('project-one', 'invalid', 1)
  );
  console.log(
    'PASS initial generation ids: stable same project/key; distinct projects/candidates; invalid key rejected'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
