import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { migrate } from 'drizzle-orm/libsql/migrator';

export async function runMigrations() {
  const { getDb } = await import('../lib/db/client');
  await migrate(getDb(), { migrationsFolder: './drizzle' });
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations().then(() => { console.log('Migrations applied.'); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
}
