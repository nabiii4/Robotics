// A @libsql/client look-alike on top of sql.js, so drizzle's libsql driver and the raw-SQL services run unchanged.
// The sql.js database is opened by the service worker (store.ts) before any request is handled.
import type { Database, SqlValue } from 'sql.js';

type Value = null | string | number | bigint | ArrayBuffer;
type InArg = Value | boolean | Date | Uint8Array | undefined;
type InStatement = string | { sql: string; args?: InArg[] | Record<string, InArg> };

export interface ResultSet {
  columns: string[];
  columnTypes: string[];
  rows: Record<string | number, Value>[];
  rowsAffected: number;
  lastInsertRowid: bigint | undefined;
  toJSON(): unknown;
}

const g = globalThis as unknown as { __sqljsDb?: Database; __sqljsDirty?: boolean };
const conn = () => {
  if (!g.__sqljsDb) throw new Error('The browser database is not open yet.');
  return g.__sqljsDb;
};

function toSql(v: InArg): SqlValue {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) return v.getTime();
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  return v as SqlValue;
}

function bindArgs(args: InArg[] | Record<string, InArg> | undefined) {
  if (!args) return [];
  if (Array.isArray(args)) return args.map(toSql);
  const o: Record<string, SqlValue> = {};
  for (const [k, v] of Object.entries(args)) o[/^[:@$]/.test(k) ? k : `:${k}`] = toSql(v);
  return o;
}

// same row shape as libsql: numeric indexes (hidden) plus enumerable column names
function makeRow(values: SqlValue[], columns: string[]) {
  const row: Record<string | number, Value> = {};
  Object.defineProperty(row, 'length', { value: values.length });
  values.forEach((raw, i) => {
    const v: Value = raw instanceof Uint8Array ? raw.slice().buffer : raw;
    Object.defineProperty(row, i, { value: v });
    const col = columns[i];
    if (!Object.prototype.hasOwnProperty.call(row, col)) Object.defineProperty(row, col, { value: v, enumerable: true, configurable: true, writable: true });
  });
  return row;
}

const READ_ONLY = /^\s*(select|pragma\s+table_info|explain)\b/i;
const CHANGES = /^\s*(insert|update|delete|replace)\b/i;

function run(stmt: InStatement): ResultSet {
  const sql = typeof stmt === 'string' ? stmt : stmt.sql;
  const args = typeof stmt === 'string' ? undefined : stmt.args;
  const db = conn();
  const s = db.prepare(sql);
  try {
    s.bind(bindArgs(args) as SqlValue[]);
    const columns = s.getColumnNames();
    const rows: ResultSet['rows'] = [];
    while (s.step()) rows.push(makeRow(s.get(), columns));
    if (!READ_ONLY.test(sql)) g.__sqljsDirty = true;
    const writes = CHANGES.test(sql);
    const rowsAffected = writes ? db.getRowsModified() : 0;
    const lastInsertRowid = writes && /^\s*insert/i.test(sql) ? BigInt((db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] as number) ?? 0) : undefined;
    return { columns, columnTypes: columns.map(() => ''), rows, rowsAffected, lastInsertRowid, toJSON() { return { columns, rows, rowsAffected } } };
  } finally {
    s.free();
  }
}

function inTransaction<T>(fn: () => T): T {
  const db = conn();
  db.run('BEGIN');
  try {
    const out = fn();
    db.run('COMMIT');
    return out;
  } catch (e) {
    try { db.run('ROLLBACK'); } catch { /* already rolled back */ }
    throw e;
  }
}

function makeTransaction() {
  conn().run('BEGIN');
  let open = true;
  const end = (sql: string) => { if (open) { open = false; conn().run(sql); } };
  return {
    execute: async (s: InStatement) => run(s),
    batch: async (stmts: InStatement[]) => stmts.map(run),
    executeMultiple: async (sql: string) => { conn().exec(sql); },
    commit: async () => end('COMMIT'),
    rollback: async () => end('ROLLBACK'),
    close: () => { try { end('ROLLBACK'); } catch { /* ignore */ } },
    get closed() { return !open; },
  };
}

// same signature as @libsql/client; the config (url, token) doesn't apply to the in-browser database
export function createClient() {
  return {
    protocol: 'file',
    closed: false,
    execute: async (s: InStatement, args?: InArg[]) => run(typeof s === 'string' && args ? { sql: s, args } : s),
    batch: async (stmts: InStatement[]) => inTransaction(() => stmts.map(run)),
    migrate: async (stmts: InStatement[]) => inTransaction(() => stmts.map(run)),
    transaction: async () => makeTransaction(),
    executeMultiple: async (sql: string) => { conn().exec(sql); g.__sqljsDirty = true; },
    sync: async () => undefined,
    close: () => undefined,
  };
}
export type Client = ReturnType<typeof createClient>;
export type Config = Record<string, unknown>;
