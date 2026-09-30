import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../db/client';

export const READY_CATS = [
  { key: 'mechanical', label: 'Mechanical' }, { key: 'electronics', label: 'Electronics' }, { key: 'code', label: 'Code' }, { key: 'testing', label: 'Testing' },
] as const;

export async function targetCompetition() {
  return db.query.competitions.findFirst({ where: eq(schema.competitions.isTarget, true) });
}

export async function readiness(competitionId?: string | null) {
  const comp = competitionId ? await db.query.competitions.findFirst({ where: eq(schema.competitions.id, competitionId) }) : await targetCompetition();
  let tasks;
  if (comp) tasks = await db.select().from(schema.tasks).where(eq(schema.tasks.competitionId, comp.id));
  else {
    const b = await db.query.builds.findFirst({ where: and(eq(schema.builds.isTeamActive, true), isNull(schema.builds.deletedAt)) });
    tasks = b ? await db.select().from(schema.tasks).where(eq(schema.tasks.buildId, b.id)) : [];
  }
  const counted = tasks.filter((t) => t.category !== 'notebook');
  const total = counted.reduce((s, t) => s + t.weight, 0);
  const done = counted.filter((t) => t.status === 'done').reduce((s, t) => s + t.weight, 0);
  const categories = READY_CATS.map((c) => {
    const ts = counted.filter((t) => t.category === c.key);
    const d = ts.filter((t) => t.status === 'done').length;
    const state = ts.length && d === ts.length ? 'complete' : d > 0 || ts.some((t) => t.status === 'doing') ? 'in_progress' : 'not_started';
    return { key: c.key, label: c.label, state, done: d, total: ts.length };
  });
  return {
    percent: total ? Math.round((100 * done) / total) : 0,
    categories,
    target: comp ? { id: comp.id, name: comp.name, shortName: comp.shortName, startDate: comp.startDate } : null,
    tasks,
  };
}
