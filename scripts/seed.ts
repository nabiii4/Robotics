import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const force = process.argv.includes('--force');
  const url = process.env.DATABASE_URL || 'file:./data/fdrhs.db';
  if (force) {
    if (!url.startsWith('file:')) throw new Error('--force only works with a local SQLite file database.');
    const file = path.resolve(url.slice(5));
    for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
    const up = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
    if (fs.existsSync(up)) fs.rmSync(up, { recursive: true });
  }
  const { runMigrations } = await import('./migrate');
  await runMigrations();
  const { getDb, schema } = await import('../lib/db/client');
  const existing = await getDb().select().from(schema.users).limit(1);
  if (existing.length) { console.log('Database already has data — use `npm run reset` to start over.'); return; }
  const { seed } = await import('../lib/seed');
  const scenario = (process.env.SEED_SCENARIO || 'B').toUpperCase() === 'A' ? 'A' : 'B';
  await seed(scenario);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
