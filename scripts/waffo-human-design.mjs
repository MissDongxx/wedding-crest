/** Run from project root: node scripts/waffo-human-design.mjs [--verify-only|--deactivate] */
import fs from 'node:fs';
import { ProductVersionStatus, WaffoPancake } from '@waffo/pancake-ts';
import dotenv from 'dotenv';
import postgres from 'postgres';

const env = {
  ...dotenv.parse(fs.readFileSync('.env.local')),
  ...dotenv.parse(fs.readFileSync('.dev.vars')),
};
const sql = postgres(env.DATABASE_URL, {
  max: 1,
  connect_timeout: 15,
  prepare: false,
});
const table = `${env.DB_SCHEMA || 'wedding-crest'}.config`;
const key = 'wedding_human_design';
try {
  const rows =
    await sql`select name,value from ${sql(table)} where name like 'waffo%'`;
  const config = Object.fromEntries(
    rows.map(({ name, value }) => [name, value])
  );
  if (
    !config.waffo_merchant_id ||
    !config.waffo_private_key ||
    !config.waffo_store_id
  )
    throw new Error('Missing Waffo configuration');
  const client = new WaffoPancake({
    merchantId: config.waffo_merchant_id,
    privateKey: config.waffo_private_key,
    environment: config.waffo_environment === 'prod' ? 'prod' : 'test',
  });
  if (process.argv.includes('--schema')) {
    console.log(
      JSON.stringify(
        await client.graphql.query({
          query:
            '{ __type(name: "CurrencyPrice") { fields { name type { name kind ofType { name kind } } } } }',
        }),
        null,
        2
      )
    );
    process.exit(0);
  }
  const mapping = JSON.parse(config.waffo_product_ids || '{}');
  let id = mapping[key];
  if (process.argv.includes('--deactivate')) {
    if (!id) throw new Error('No mapped product');
    const { product } = await client.onetimeProducts.updateStatus({
      id,
      status: ProductVersionStatus.Inactive,
    });
    console.log(JSON.stringify({ id: product.id, status: product.status }));
  } else {
    if (!id && !process.argv.includes('--verify-only')) {
      const { product } = await client.onetimeProducts.create(
        {
          storeId: config.waffo_store_id,
          name: 'Human-designed Wedding Crest',
          description:
            'A real designer reviews your brief and creates your wedding crest. Email response within 8 hours of payment. Separate from the AI image pack.',
          prices: {
            USD: {
              amount: '30.00',
              taxCategory: config.waffo_tax_category || 'digital_goods',
            },
          },
          metadata: {
            local_product_id: key,
            fulfillment: 'human_design',
            response_hours: 8,
          },
        },
        { idempotencyKey: 'wedding-human-design-usd30-v1' }
      );
      id = product.id;
      // create uses the configured environment directly; publish is only for test-to-prod promotion.
      // Lock and merge the latest mapping: preserve other products and currencies.
      await sql.begin(async (tx) => {
        const [latest] =
          await tx`select value from ${sql(table)} where name='waffo_product_ids' for update`;
        const updated = { ...JSON.parse(latest?.value || '{}'), [key]: id };
        await tx`insert into ${sql(table)} (name,value) values ('waffo_product_ids',${JSON.stringify(updated)}) on conflict (name) do update set value=excluded.value`;
      });
    }
    if (!id) throw new Error('No mapped product');
    const result = await client.graphql.query({
      query:
        'query ($id: String!) { onetimeProduct(id: $id) { id name prices { currency priceInfo { amount taxCategory } } status metadata } }',
      variables: { id },
    });
    if (result.errors?.length || !result.data?.onetimeProduct)
      throw new Error(JSON.stringify(result.errors || result));
    const product = result.data.onetimeProduct;
    if (
      Number(
        product.prices?.find((price) => price.currency === 'USD')?.priceInfo
          ?.amount
      ) !== 30
    )
      throw new Error('Product price mismatch');
    const [mapped] =
      await sql`select value from ${sql(table)} where name='waffo_product_ids'`;
    if (JSON.parse(mapped.value)[key] !== id)
      throw new Error('Mapping mismatch');
    console.log(
      JSON.stringify(
        {
          environment: config.waffo_environment,
          product,
          mappingVerified: true,
        },
        null,
        2
      )
    );
  }
} finally {
  await sql.end();
}
