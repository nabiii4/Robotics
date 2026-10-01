import { z } from 'zod';
import { route } from '@/lib/api';
import { adjustItem, logInventoryActivity } from '@/lib/services/inventoryItems';

export const runtime = 'nodejs';

export const POST = route<{ id: string }, z.ZodTypeAny>({ body: z.object({ delta: z.number().int().min(-100000).max(100000).refine((v) => v !== 0, 'Change by at least 1'), reason: z.string().max(200).optional() }) }, async ({ params, body, user }) => {
  const b = body as { delta: number; reason?: string };
  const r = await adjustItem(params.id, b.delta, b.reason || null, user.id);
  await logInventoryActivity(user.id, params.id, b.delta, r.item.name, r.item.subcategory);
  return { qtyOnHand: r.qtyOnHand };
});
