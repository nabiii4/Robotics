// Runs before `npm run dev` / `npm start`: apply migrations and seed an empty database.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
  const { runMigrations } = await import('./migrate');
  await runMigrations();
  const { getDb, schema } = await import('../lib/db/client');
  const existing = await getDb().select().from(schema.users).limit(1);
  if (existing.length) return;
  const want = (process.env.SEED_SCENARIO || 'B').toUpperCase();
  if (want === 'CLEAN') {
    const { seedClean } = await import('../lib/seed/clean');
    console.log('First run: creating the team and the admin account…');
    await seedClean();
    return;
  }
  const { seed } = await import('../lib/seed');
  const scenario = want === 'A' ? 'A' : 'B';
  console.log('First run: creating the database with demo data…');
  await seed(scenario);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
