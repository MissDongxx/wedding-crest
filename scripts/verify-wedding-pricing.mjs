import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tsImport } from 'tsx/esm/api';

const { applyWeddingPricing, createWeddingPackPricing, WEDDING_PACK_PRICING } =
  await tsImport('../src/shared/wedding/pricing.ts', import.meta.url).then(
    (module) => module.default ?? module
  );
const config = JSON.parse(fs.readFileSync('src/config/wedding-pricing.json'));
assert.equal(WEDDING_PACK_PRICING.amount, Math.round(config.priceUsd * 100));
for (const priceUsd of [2.9, 5.9, 7.99, 9.9, 12]) {
  const pricing = createWeddingPackPricing({ priceUsd, originalPriceUsd: 9.9 });
  for (const locale of ['en', 'zh', 'de', 'fr', 'it', 'ko', 'pt-BR', 'th']) {
    const dir = `src/config/locale/messages/${locale}/pages`;
    const source = JSON.parse(fs.readFileSync(`${dir}/pricing.json`));
    const before = JSON.stringify(source);
    assert.equal(
      source.page.sections.pricing.items[0].currency,
      'USD',
      'free plan currency stays present'
    );
    const page = applyWeddingPricing('pages/pricing', source, pricing);
    const design = applyWeddingPricing(
      'pages/design',
      JSON.parse(fs.readFileSync(`${dir}/design.json`)),
      pricing
    );
    const item = page.page.sections.pricing.items.find(
      (item) => item.product_id === 'wedding_identity_pack'
    );
    assert.equal(item.amount, Math.round(priceUsd * 100));
    assert.equal(item.currency, 'USD');
    assert.equal(item.price, `$${priceUsd}`);
    assert.ok(page.metadata.description.includes(item.price));
    assert.ok(design.unlock_cta.includes(item.price));
    assert.ok(design.preview.purchase_link.includes(item.price));
    assert.ok(!JSON.stringify([page, design]).includes('__WEDDING_'));
    assert.equal(
      JSON.stringify(source),
      before,
      'cached JSON must stay immutable'
    );
    assert.deepEqual(
      page.page.sections.pricing.items[0],
      source.page.sections.pricing.items[0]
    );
    if (priceUsd < 9.9) {
      assert.equal(item.original_price, '$9.9');
      assert.ok(item.tip.includes(pricing.savings));
      assert.ok(item.tip.includes(String(pricing.discountPercent)));
      assert.ok(design.unlock_savings.includes(pricing.savings));
    } else {
      assert.equal(item.original_price, '');
      assert.equal(item.label, '');
      assert.equal(design.unlock_savings, '');
      assert.equal(design.unlock_offer, '');
      assert.ok(!item.tip.includes('$0'));
    }
  }
  console.log(
    `PASS: one-number change ${priceUsd} USD -> ${pricing.amount} cents across 8 locales, metadata, CTAs, savings and sale visibility`
  );
}
for (const priceUsd of [0, -1, NaN, Infinity, 1.001]) {
  assert.throws(() =>
    createWeddingPackPricing({ priceUsd, originalPriceUsd: 9.9 })
  );
}
const unrelated = { amount: 123, price: '$1.23' };
assert.equal(applyWeddingPricing('pages/create', unrelated), unrelated);
console.log(
  'PASS: invalid prices rejected; unrelated messages/products and cached originals unchanged'
);
