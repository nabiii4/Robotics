import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { testPrinter } from '@/lib/printing/adapters';

export const runtime = 'nodejs';

export const POST = route<{ id: string }>({ role: 'admin' }, async ({ params }) => {
  const p = await db.query.printers.findFirst({ where: eq(schema.printers.id, params.id) });
  if (!p) throw notFound('That printer doesn’t exist.');
  const r = await testPrinter(p);
  if (p.adapter !== 'simulated') await db.update(schema.printers).set({ online: r.ok, lastSeenAt: r.ok ? new Date() : p.lastSeenAt }).where(eq(schema.printers.id, p.id));
  return r;
});
