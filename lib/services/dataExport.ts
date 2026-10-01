import 'server-only';
import { getClient } from '../db/client';
import { bad } from '../api';

// raw-SQL export/import so every column round-trips exactly (timestamps stay epoch ms, JSON stays text)
const EXPORT_SKIP = new Set(['sessions', 'rate_limits', '__drizzle_migrations']);
const IMPORT_SKIP = new Set(['users', 'sessions', 'rate_limits', 'team', '__drizzle_migrations']);
const DROP_COLS: Record<string, string[]> = { users: ['password_hash'], memories: ['embedding'], knowledge_chunks: ['embedding'] };

async function tables() {
  const r = await getClient().execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return r.rows.map((x) => String(x.name));
}

export async function exportAll() {
  const c = getClient();
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const t of await tables()) {
    if (EXPORT_SKIP.has(t)) continue;
    const r = await c.execute(`SELECT * FROM "${t}"`);
    out[t] = r.rows.map((row) => {
      const o: Record<string, unknown> = {};
      r.columns.forEach((col, i) => { if (!DROP_COLS[t]?.includes(col)) { const v = row[i]; o[col] = v instanceof ArrayBuffer || ArrayBuffer.isView(v) ? null : typeof v === 'bigint' ? Number(v) : v; } });
      return o;
    });
  }
  return { format: 'fdrhs-hub-export', version: 1, exportedAt: new Date().toISOString(), tables: out };
}

/** Replace team content with an export file. Users, sessions and the team record are kept as they are. */
export async function importAll(data: unknown) {
  const d = data as { format?: string; tables?: Record<string, Record<string, unknown>[]> };
  if (d?.format !== 'fdrhs-hub-export' || !d.tables) throw bad('That isn’t an FDRHS Robotics Hub export file.');
  const known = new Set(await tables());
  const c = getClient();
  const stmts: { sql: string; args: (string | number | null)[] }[] = [];
  const counts: Record<string, number> = {};
  for (const [t, rows] of Object.entries(d.tables)) {
    if (!known.has(t) || IMPORT_SKIP.has(t) || !Array.isArray(rows)) continue;
    const info = await c.execute(`PRAGMA table_info("${t}")`);
    const cols = new Set(info.rows.map((x) => String(x.name)));
    stmts.push({ sql: `DELETE FROM "${t}"`, args: [] });
    for (const row of rows) {
      const keys = Object.keys(row).filter((k) => cols.has(k));
      if (!keys.length) continue;
      stmts.push({ sql: `INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, args: keys.map((k) => { const v = row[k]; return v == null ? null : typeof v === 'object' ? JSON.stringify(v) : (v as string | number); }) });
    }
    counts[t] = rows.length;
  }
  await c.batch(stmts, 'write');
  return counts;
}
