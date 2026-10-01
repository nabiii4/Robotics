import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { route, bad } from '@/lib/api';
import { getClient } from '@/lib/db/client';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

/** A consistent copy of the SQLite database (VACUUM INTO), for local deployments. */
export const GET = route({ role: 'admin' }, async () => {
  if (!env().DATABASE_URL.startsWith('file:')) throw bad('Backups are only available for a local SQLite database. Use your database provider’s backups.');
  const file = path.join(os.tmpdir(), `fdrhs-backup-${Date.now()}.db`);
  await getClient().execute({ sql: 'VACUUM INTO ?', args: [file] });
  const buf = fs.readFileSync(file);
  fs.rmSync(file, { force: true });
  return new Response(new Uint8Array(buf), { headers: { 'content-type': 'application/vnd.sqlite3', 'content-disposition': `attachment; filename="fdrhs-hub-${new Date().toISOString().slice(0, 10)}.db"` } });
});
