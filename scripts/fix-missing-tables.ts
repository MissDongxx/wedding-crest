import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const c = postgres(url, { prepare: false, max: 1 });

async function main() {
  await c`
    CREATE TABLE IF NOT EXISTS "wedding-crest"."wedding_example" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "style" text NOT NULL,
      "image_url" text NOT NULL,
      "alt_text" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `;
  console.log('wedding_example ok');

  await c`
    CREATE TABLE IF NOT EXISTS "wedding-crest"."wedding_frame" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "style" text NOT NULL,
      "url" text NOT NULL,
      "thumbnail_url" text,
      "alt_text" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `;
  console.log('wedding_frame ok');

  await c`CREATE INDEX IF NOT EXISTS "idx_wedding_example_active_style" ON "wedding-crest"."wedding_example" USING btree ("style","is_active");`;
  await c`CREATE INDEX IF NOT EXISTS "idx_wedding_frame_active_style" ON "wedding-crest"."wedding_frame" USING btree ("style","is_active");`;
  console.log('indexes ok');

  const rows = await c`SELECT table_name FROM information_schema.tables WHERE table_schema='wedding-crest' AND table_name IN ('wedding_example','wedding_frame') ORDER BY table_name`;
  console.log('present:', rows.map((r) => r.table_name).join(','));
  await c.end();
}

main().catch((e) => {
  console.error('err:', e.message);
  process.exit(1);
});
