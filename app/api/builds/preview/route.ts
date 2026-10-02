import { z } from 'zod';
import { route, bad } from '@/lib/api';
import { getVersion } from '@/lib/services/builds';
import { TEMPLATES } from '@/lib/robot/defaults';
import { derive } from '@/lib/robot/derive';
import { PROGRAM_LABEL } from '@/lib/robot/spec';

export const runtime = 'nodejs';

const Body = z.object({
  name: z.string().trim().max(60).default('New Robot'),
  program: z.enum(['V5RC', 'VEXU', 'VAIRC', 'Practice']).default('V5RC'),
  start: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('template'), template: z.string() }),
    z.object({ kind: z.literal('duplicate'), buildId: z.string() }),
    z.object({ kind: z.literal('import'), spec: z.unknown() }),
  ]),
});

/** Review step of the New Build wizard: metrics + rule checks without saving anything. */
export const POST = route({ body: Body }, async ({ body }) => {
  let spec: Record<string, unknown>;
  if (body.start.kind === 'template') spec = (TEMPLATES[body.start.template] ?? TEMPLATES['competition-base']).spec(body.name || 'New Robot') as unknown as Record<string, unknown>;
  else if (body.start.kind === 'duplicate') {
    const v = await getVersion(body.start.buildId);
    if (!v) throw bad('That build has no design yet.');
    spec = v.spec;
  } else spec = (body.start.spec ?? {}) as Record<string, unknown>;
  spec = { ...spec, meta: { ...(spec.meta as object), name: body.name || 'New Robot', program: body.program } };
  let d;
  try { d = derive(spec); } catch (e) { throw bad(`That design could not be used: ${(e as Error).message}`); }
  const m = d.metrics;
  return {
    program: PROGRAM_LABEL[d.spec.meta.program],
    metrics: [
      ['Starting size', `${m.startSize.length} × ${m.startSize.width} × ${m.startSize.height} in`],
      ['Weight (est.)', `${m.weightLb} lb`],
      ['Top speed', `${m.topSpeedFtPerS} ft/s`],
      ['Motors', `${m.motors11W} × 11W${m.motors55W ? ` + ${m.motors55W} × 5.5W` : ''}`],
      ['Motor power', `${m.motorPowerW} W`],
      ['Parts', `${m.partCount}`],
    ],
    subsystems: d.spec.subsystems.map((s) => s.name),
    checks: d.ruleChecks.map((c) => ({ id: c.id, severity: c.severity, pass: c.pass, title: c.title, detail: c.detail, ruleRef: c.ruleRef ?? null })),
    notes: d.normalizeReport.map((n) => n.reason),
  };
});
