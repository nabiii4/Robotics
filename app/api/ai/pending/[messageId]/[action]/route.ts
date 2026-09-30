import { z } from 'zod';
import { and, eq, inArray, like } from 'drizzle-orm';
import { route, notFound, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { createVersion } from '@/lib/services/builds';
import { createPrintJob } from '@/lib/services/printJobs';
import { withDefaults, TEMPLATE_BY_ID } from '@/lib/printing/templates';
import { messageView } from '@/lib/ai/mentor';
import { logActivity } from '@/lib/services/activity';
import type { EnvelopeT } from '@/lib/ai/envelope';

export const runtime = 'nodejs';
const Body = z.object({ index: z.number().int().min(0).max(10).default(0) });
type P = { messageId: string; action: string };

export const POST = route<P, typeof Body>({ body: Body }, async ({ user, params, body }) => {
  const m = await db.query.chatMessages.findFirst({ where: eq(schema.chatMessages.id, params.messageId) });
  const thread = m ? await db.query.chatThreads.findFirst({ where: eq(schema.chatThreads.id, m.threadId) }) : null;
  if (!m || !thread || thread.userId !== user.id) throw notFound('Message not found');
  const envl = (m.envelope ?? {}) as unknown as EnvelopeT;
  const applied = (m.applied ?? {}) as { previousVersionId?: string; notApplied?: { spec: unknown } };
  const buildId = thread.buildId;
  const key = `${params.action}:${body.index}`;
  const done = { ...(m.pendingDone ?? {}) };
  let result: Record<string, unknown> = {};
  switch (params.action) {
    case 'apply-code': {
      const cs = envl.codeSuggestion;
      if (!cs || !buildId) throw bad('No code suggestion to apply.');
      const p = cs.path.replace(/^\/+/, '').replace(/\.\.+/g, '');
      if (!/^(src|include)\/[\w./-]+\.(cpp|h|hpp)$/.test(p)) throw bad('Code suggestions can only change files in src/ or include/.');
      const f = await db.query.codeFiles.findFirst({ where: and(eq(schema.codeFiles.buildId, buildId), eq(schema.codeFiles.path, p)) });
      const now = new Date();
      if (f?.generated) throw bad(`${p} is generated from the build — change the build instead.`);
      let fileId = f?.id;
      if (f) await db.update(schema.codeFiles).set({ content: cs.code, updatedAt: now, updatedBy: user.id }).where(eq(schema.codeFiles.id, f.id));
      else { fileId = newId(); await db.insert(schema.codeFiles).values({ id: fileId, buildId, path: p, content: cs.code, generated: false, updatedBy: user.id, updatedAt: now }); }
      await db.insert(schema.codeVersions).values({ id: newId(), fileId: fileId!, content: cs.code, authorId: user.id, message: 'applied mentor suggestion', createdAt: now });
      result = { fileId, path: p };
      break;
    }
    case 'add-part': {
      const cp = envl.customParts?.[body.index];
      if (!cp || !buildId) throw bad('No printed part proposal to add.');
      const template = TEMPLATE_BY_ID[cp.template] ? cp.template : 'u-bracket';
      const id = newId();
      const b = await db.query.builds.findFirst({ where: eq(schema.builds.id, buildId) });
      await db.insert(schema.customParts).values({ id, buildId, name: cp.name, template, params: withDefaults(template, cp.params), material: cp.material, color: cp.color, defaultQty: cp.quantity, purpose: cp.purpose, legality: b?.program === 'VEXU' || b?.program === 'VAIRC' ? 'vexu_vai_only' : 'practice', createdBy: user.id, createdAt: new Date(), updatedAt: new Date() });
      done[`part:${body.index}`] = true;
      result = { partId: id };
      (done as Record<string, unknown>)[`partId:${body.index}`] = id as unknown as boolean;
      break;
    }
    case 'send-to-printer': {
      const partId = (m.pendingDone as Record<string, unknown>)?.[`partId:${body.index}`] as string | undefined;
      let customPartId = partId;
      let qty = envl.customParts?.[body.index]?.quantity ?? 1;
      if (!customPartId && envl.printActions?.[body.index] && buildId) {
        const pa = envl.printActions[body.index];
        const p = await db.query.customParts.findFirst({ where: and(eq(schema.customParts.buildId, buildId), like(schema.customParts.name, `%${pa.partName}%`)) });
        customPartId = p?.id; qty = pa.qty;
      }
      if (!customPartId) throw bad('Add the part to the build first.');
      const part = await db.query.customParts.findFirst({ where: eq(schema.customParts.id, customPartId) });
      if (!part) throw bad('That part no longer exists.');
      const r = await createPrintJob({ userId: user.id, customPartId, material: part.material, color: part.color, layerHeightMm: 0.2, infillPct: 30, quantity: qty });
      result = { jobId: r.id };
      break;
    }
    case 'reserve':
    case 'order': {
      const ia = envl.inventoryActions?.[body.index];
      if (!ia) throw bad('No inventory action here.');
      const items = await db.select().from(schema.inventoryItems);
      const item = items.find((i) => i.name.toLowerCase() === ia.item.toLowerCase()) ?? items.find((i) => i.name.toLowerCase().includes(ia.item.toLowerCase()) || ia.item.toLowerCase().includes(i.name.toLowerCase()));
      if (ia.type === 'reserve') {
        if (!item || !buildId) throw bad(`Could not find “${ia.item}” in inventory.`);
        await db.insert(schema.inventoryReservations).values({ id: newId(), itemId: item.id, buildId, qty: ia.qty, createdBy: user.id, createdAt: new Date() });
      } else {
        await db.insert(schema.orders).values({ id: newId(), itemId: item?.id ?? null, name: item?.name ?? ia.item, sku: item?.sku ?? null, qty: ia.qty, status: 'requested', requestedBy: user.id, createdAt: new Date(), updatedAt: new Date() });
      }
      result = { ok: true };
      break;
    }
    case 'apply-practice': {
      const spec = applied.notApplied?.spec as { meta?: Record<string, unknown> } | null;
      if (!spec || !buildId) throw bad('Nothing to apply.');
      const v = await createVersion({ buildId, specInput: { ...spec, meta: { ...(spec.meta ?? {}), program: 'Practice' } }, source: 'ai', authorId: user.id, messageId: m.id, changeSummary: ['Applied as a Practice design'] });
      await db.update(schema.builds).set({ program: 'Practice' }).where(eq(schema.builds.id, buildId));
      result = { versionId: v.id, version: v.version };
      break;
    }
    case 'undo': {
      if (!applied.previousVersionId || !buildId) throw bad('Nothing to undo.');
      const prev = await db.query.buildVersions.findFirst({ where: eq(schema.buildVersions.id, applied.previousVersionId) });
      if (!prev) throw bad('The previous version is gone.');
      const v = await createVersion({ buildId, specInput: prev.spec, source: 'restore', authorId: user.id, changeSummary: [`Undid AI change — restored v${prev.version}`] });
      result = { versionId: v.id, version: v.version };
      break;
    }
    case 'undo-memory': {
      const notes = (envl as unknown as { memoryNotes?: { id: string }[] }).memoryNotes ?? [];
      const ids = notes.map((n) => n.id);
      if (ids.length) await db.delete(schema.memories).where(and(eq(schema.memories.userId, user.id), inArray(schema.memories.id, ids)));
      break;
    }
    default: throw bad('Unknown action.');
  }
  done[key] = true;
  await db.update(schema.chatMessages).set({ pendingDone: done }).where(eq(schema.chatMessages.id, m.id));
  if (params.action === 'apply-code' && buildId) await logActivity({ type: 'code.updated', actorId: user.id, entityType: 'file', entityId: String(result.fileId), data: { label: String(result.path).split('/').pop()?.replace(/\.(h|cpp)$/, '') } });
  return { ...result, message: await messageView(m.id) };
});
