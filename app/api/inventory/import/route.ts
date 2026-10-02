import { z } from 'zod';
import { route, bad } from '@/lib/api';
import { importRows, parseCsv } from '@/lib/services/inventoryItems';

export const runtime = 'nodejs';

const Body = z.object({ csv: z.string().max(2_000_000), mapping: z.record(z.string(), z.number().int().min(0)).optional(), hasHeader: z.boolean().default(true), dryRun: z.boolean().default(true) });

/** Step 1 (no mapping): returns the header and a guessed mapping. Step 2: dry run preview. Step 3: dryRun=false imports. */
export const POST = route({ body: Body }, async ({ body, user }) => {
  const rows = parseCsv(body.csv);
  if (!rows.length) throw bad('That CSV is empty.');
  const header = body.hasHeader ? rows[0] : rows[0].map((_, i) => `Column ${i + 1}`);
  const data = body.hasHeader ? rows.slice(1) : rows;
  if (data.length > 5000) throw bad('Import up to 5000 rows at a time.');
  const guess: Record<string, number> = {};
  const fields = ['name', 'sku', 'category', 'subcategory', 'unit', 'qty_on_hand', 'min_qty', 'location', 'supplier', 'url', 'notes'];
  header.forEach((h, i) => {
    const k = h.toLowerCase().trim().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
    const f = fields.find((x) => x === k) ?? (/(qty|quantity|on_hand|count)/.test(k) && !/min/.test(k) ? 'qty_on_hand' : /min/.test(k) ? 'min_qty' : /part|item|name/.test(k) ? 'name' : /cat/.test(k) ? 'category' : null);
    if (f && guess[f] == null) guess[f] = i;
  });
  const mapping = body.mapping ?? guess;
  const r = await importRows(data, mapping as never, user.id, body.dryRun);
  return { header, mapping, rows: data.length, ...r };
});
