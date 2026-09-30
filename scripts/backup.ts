import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL || 'file:./data/fdrhs.db';
if (!url.startsWith('file:')) { console.error('Backups of remote databases: use the admin Data tab export.'); process.exit(1); }
const src = path.resolve(url.slice(5));
const dir = path.resolve('data/backups');
fs.mkdirSync(dir, { recursive: true });
const dest = path.join(dir, `fdrhs-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
fs.copyFileSync(src, dest);
console.log(`Backup written to ${dest}`);
