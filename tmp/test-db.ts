import { db } from './src/core/db';
import { user } from './src/config/db/schema';
import { count } from 'drizzle-orm';

async function testDelta() {
  const start = Date.now();
  console.log('Starting DB query...');
  try {
    const [result] = await db().select({ count: count() }).from(user);
    const end = Date.now();
    console.log(`DB query took ${end - start}ms`);
    console.log(`User count: ${result.count}`);
  } catch (error) {
    console.error('DB query failed:', error);
  }
}

testDelta();
