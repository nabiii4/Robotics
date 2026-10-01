import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { hashPassword } from '../auth/password';
import { env } from '../env';
import { SEASONS } from '../robot/seasons';
import { SEED_SPEC, TEMPLATES } from '../robot/defaults';
import { createVersion } from '../services/builds';
import { SEED_FILES } from '../vexcode/generate';
import { scenarioInventory } from './inventory';
import { sha256 } from '../crypto';
import { writeUploadBytes } from '../services/uploads';

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const AV = { blue: '#1B67C6', red: '#C11A0E', green: '#1C9E4B', purple: '#643DBC', orange: '#EA8111', teal: '#0E7490', pink: '#C2185B', admin: '#171D22' };

const pw = () => crypto.randomBytes(9).toString('base64url');
const joinCode = () => `COUGAR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export const DEFAULT_RESOURCES = [
  { title: 'VEX Library', url: 'https://kb.vex.com', description: 'Official VEX knowledge base: builds, sensors, programming.' },
  { title: 'VEX V5 C++ API', url: 'https://api.vex.com/v5/home/cpp', description: 'Every VEXcode V5 C++ class and function.' },
  { title: 'V5RC Override Game Manual & Q&A', url: 'https://events.vex.com', description: 'The rules. Always confirm with the current manual and official Q&A.' },
  { title: 'RobotEvents', url: 'https://www.robotevents.com', description: 'Find and register for competitions, see results and skills rankings.' },
  { title: 'VEX Forum', url: 'https://www.vexforum.com', description: 'Community discussion, build ideas, and help from other teams.' },
  { title: 'Purdue SIGBots Wiki', url: 'https://wiki.purduesigbots.com', description: 'Deep guides on mechanisms, PID, odometry, and design.' },
  { title: 'RECF Knowledge Base', url: 'https://kb.roboticseducation.org', description: 'Competition policies, awards, and the engineering notebook.' },
];

export async function seed(scenario: 'A' | 'B', log: (s: string) => void = console.log) {
  const now = Date.now();
  const at = (ms: number) => new Date(now - ms);
  const e = env();
  const creds: string[] = [`FDRHS Robotics Hub — seed credentials (scenario ${scenario}), ${new Date(now).toISOString()}`, ''];

  // team
  const code = e.TEAM_JOIN_CODE || joinCode();
  await db.insert(schema.team).values({ id: 'team', name: 'FDRHS Robotics', school: 'Franklin D. Roosevelt High School', teamNumber: null, joinCodeHash: sha256(code.trim().toUpperCase()), createdAt: at(30 * DAY) });
  await db.insert(schema.settingsKv).values({ key: 'team.joinCodePlain', value: code });
  creds.push(`Team join code: ${code}`, '');

  // people
  const people: { key: string; username: string; display: string; color: string; role: 'admin' | 'captain' | 'member'; teamRole: string; avatarText?: string; skills?: string[] }[] = [
    { key: 'admin', username: e.ADMIN_USERNAME.toLowerCase(), display: 'Team Admin', color: AV.admin, role: 'admin', teamRole: 'Coach', avatarText: 'NA' },
    { key: 'maya', username: 'maya', display: 'Maya', color: AV.blue, role: 'captain', teamRole: 'Designer', skills: ['CAD', 'Intakes'] },
    { key: 'noor', username: 'noor', display: 'Noor', color: AV.red, role: 'member', teamRole: 'Builder', skills: ['Drivetrains'] },
    { key: 'amina', username: 'amina', display: 'Amina', color: AV.green, role: 'member', teamRole: 'Programmer', skills: ['C++', 'Autonomous'] },
    { key: 'zain', username: 'zain', display: 'Zain', color: AV.purple, role: 'member', teamRole: 'Builder', skills: ['Wiring'] },
    { key: 'sara', username: 'sara', display: 'Sara', color: AV.orange, role: 'member', teamRole: 'Notebook', skills: ['Notebook', 'Inventory'] },
    { key: 'zayd', username: 'zayd', display: 'Zayd', color: AV.teal, role: 'member', teamRole: 'Builder', skills: ['Lifts'] },
    { key: 'hana', username: 'hana', display: 'Hana', color: AV.pink, role: 'member', teamRole: 'Builder', skills: ['Electronics lead'] },
  ];
  const ids: Record<string, string> = {};
  for (const p of people) {
    const password = p.key === 'admin' && e.ADMIN_INITIAL_PASSWORD ? e.ADMIN_INITIAL_PASSWORD : pw();
    const id = newId();
    ids[p.key] = id;
    await db.insert(schema.users).values({
      id, username: p.username, displayName: p.display, avatarText: p.avatarText ?? null, avatarColor: p.color, role: p.role, teamRole: p.teamRole,
      passwordHash: await hashPassword(password, 10), mustChangePassword: p.key === 'admin', prefs: { layout: scenario === 'A' ? 'a' : 'b', memoryEnabled: true, replyLength: 'concise', quality: 'medium' },
      skills: p.skills ?? [], createdAt: at(30 * DAY), lastActiveAt: at(Math.floor(Math.random() * 3) * HOUR),
    });
    creds.push(`${p.display.padEnd(12)} username: ${p.username.padEnd(10)} password: ${password}${p.key === 'admin' ? '   (must change on first sign-in)' : ''}`);
  }
  const A = ids.admin;

  // seasons
  for (const s of SEASONS) await db.insert(schema.seasonProfiles).values({ id: s.id, name: s.name, program: s.program, years: s.years, rules: s as unknown as Record<string, unknown>, active: s.id === 'v5rc-2026-27-override' });

  // build + versions (v1 template −3d, v2 user −1d, v3 AI −2h = Appendix D)
  const buildId = newId();
  await db.insert(schema.builds).values({
    id: buildId, name: '2026 Competition Robot', tagline: 'High Stakes, Higher Standards', drawingPrefix: '2026_Robot', program: 'V5RC', seasonProfileId: 'v5rc-2026-27-override',
    status: 'in_progress', visibility: 'team', ownerId: ids.maya, isTeamActive: true, createdAt: at(3 * DAY), updatedAt: at(2 * HOUR),
  });
  const v1spec = TEMPLATES.mecanum.spec('2026 Competition Robot');
  const v2spec = { ...SEED_SPEC, subsystems: SEED_SPEC.subsystems.slice(0, 2).map((s) => (s.type === 'lift' ? { ...s, status: 'planned' as const } : s)), sensors: SEED_SPEC.sensors.slice(0, 2) };
  const r1 = await createVersion({ buildId, specInput: v1spec, source: 'template', authorId: ids.maya, quiet: true });
  const r2 = await createVersion({ buildId, specInput: v2spec, source: 'user', authorId: ids.noor, quiet: true });
  const r3 = await createVersion({ buildId, specInput: SEED_SPEC, source: 'ai', authorId: ids.maya, quiet: true, changeSummary: ['Added the planned catapult launcher', 'Lift arm now 13 in on a 12:60 reduction with 4 rubber bands', 'Added the optical sensor at the intake exit'] });
  await db.update(schema.buildVersions).set({ createdAt: at(3 * DAY) }).where(eq(schema.buildVersions.id, r1.id));
  await db.update(schema.buildVersions).set({ createdAt: at(DAY) }).where(eq(schema.buildVersions.id, r2.id));
  await db.update(schema.buildVersions).set({ createdAt: at(2 * HOUR) }).where(eq(schema.buildVersions.id, r3.id));
  const statuses: Record<string, 'complete' | 'in_progress' | 'planned'> = { drivetrain: 'complete', intake: 'complete', lift: 'in_progress', launcher: 'planned' };
  await db.delete(schema.subsystemStatus).where(eq(schema.subsystemStatus.buildId, buildId));
  for (const [sid, st] of Object.entries(statuses)) await db.insert(schema.subsystemStatus).values({ buildId, subsystemId: sid, status: st, updatedBy: ids.maya, updatedAt: at(2 * HOUR) });

  // a second, private practice build for variety
  const b2 = newId();
  await db.insert(schema.builds).values({ id: b2, name: 'Practice Bot', tagline: 'Drive practice chassis', drawingPrefix: 'Practice_Bot', program: 'Practice', seasonProfileId: 'practice', status: 'testing', visibility: 'team', ownerId: ids.noor, isTeamActive: false, createdAt: at(10 * DAY), updatedAt: at(5 * DAY) });
  const pspec = TEMPLATES['competition-base'].spec('Practice Bot');
  pspec.meta.program = 'Practice';
  const pr = await createVersion({ buildId: b2, specInput: pspec, source: 'template', authorId: ids.noor, quiet: true });
  await db.update(schema.buildVersions).set({ createdAt: at(5 * DAY) }).where(eq(schema.buildVersions.id, pr.id));

  // printed parts
  const parts: { key: string; name: string; template: string; params: Record<string, string | number | boolean>; material: string; color: string; label: string }[] = [
    { key: 'intake', name: 'Intake Mount', template: 'u-bracket', params: { lengthHoles: 5, widthHoles: 2, wallHeightMm: 19, thicknessMm: 3.2, holeStyle: 'round-8-32' }, material: 'PLA', color: 'black', label: 'bracket' },
    { key: 'gear', name: 'Gear Spacer', template: 'spur-gear', params: { teeth: 18, faceWidthMm: 6.35, bore: 'shaft-1/8', hubOdMm: 10, hubLengthMm: 4 }, material: 'PLA', color: 'red', label: 'gear spacer' },
    { key: 'arm', name: 'Arm Bracket', template: 'gusset-bracket', params: { legAHoles: 4, legBHoles: 3, angleDeg: 90, thicknessMm: 3.6, lighteningHoleMm: 8 }, material: 'PETG', color: 'black', label: 'arm bracket' },
    { key: 'sensor', name: 'Sensor Holder', template: 'sensor-mount', params: { sensor: 'distance', wallMm: 2, windowCutout: true, mountHoles: 2 }, material: 'PLA', color: 'black', label: 'sensor holder' },
  ];
  const partIds: Record<string, string> = {};
  for (const p of parts) {
    const id = newId();
    partIds[p.key] = id;
    await db.insert(schema.customParts).values({ id, buildId, name: p.name, template: p.template, params: p.params, material: p.material, color: p.color, defaultQty: 2, purpose: 'Practice robot prototype', legality: 'practice', createdBy: ids.maya, createdAt: at(2 * DAY), updatedAt: at(2 * DAY) });
  }
  // Maya's STL upload (a simple printable bracket)
  const uploadId = newId();
  const stl = simpleStl();
  const key = `db:${uploadId}.stl`;
  await writeUploadBytes(uploadId, stl);
  await db.insert(schema.uploads).values({ id: uploadId, ownerId: ids.maya, filename: 'intake_v3.stl', mime: 'model/stl', size: stl.length, sha256: sha256(stl), kind: 'stl', storageKey: key, createdAt: at(2 * MIN) });

  // printers
  const printers: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const id = newId();
    printers.push(id);
    await db.insert(schema.printers).values({ id, name: `Printer ${i}`, model: 'Simulated FDM', adapter: 'simulated', materials: ['PLA', 'PETG'], bedMm: [256, 256, 256], throughputGPerMin: 0.35, online: true, sortOrder: i });
  }
  const job = async (j: { part: string; name: string; label: string; material: string; color: string; qty: number; printer: number | null; state: 'printing' | 'completed' | 'queued'; pct?: number; leftMin?: number; doneAgoMin?: number; estMin?: number; by: string; createdAgo: number; order: number }) => {
    const id = newId();
    let est = (j.estMin ?? 60) * 60, startedAt: Date | null = null, finishedAt: Date | null = null;
    if (j.state === 'printing') { const left = j.leftMin! * 60; est = Math.round(left / (1 - j.pct!)); startedAt = new Date(now - (est - left) * 1000); }
    if (j.state === 'completed') { est = (j.estMin ?? 40) * 60; finishedAt = at(j.doneAgoMin! * MIN); startedAt = new Date(finishedAt.getTime() - est * 1000); }
    await db.insert(schema.printJobs).values({
      id, customPartId: partIds[j.part], name: j.name, shortLabel: j.label, material: j.material, color: j.color, layerHeightMm: 0.2, infillPct: 30, quantity: j.qty,
      printerId: j.printer ? printers[j.printer - 1] : null, status: j.state, sortOrder: j.order, estSeconds: est, estGrams: 12 * j.qty, startedAt, finishedAt,
      requestedBy: j.by, history: [{ at: now - j.createdAgo, status: 'queued' }, ...(startedAt ? [{ at: startedAt.getTime(), status: 'printing' }] : []), ...(finishedAt ? [{ at: finishedAt.getTime(), status: 'completed' }] : [])],
      createdAt: new Date(now - j.createdAgo),
    });
    return id;
  };
  if (scenario === 'B') {
    await job({ part: 'intake', name: 'Intake Mount', label: 'bracket', material: 'PLA', color: 'black', qty: 2, printer: 1, state: 'printing', pct: 0.78, leftMin: 32, by: ids.noor, createdAgo: 2 * HOUR, order: 1 });
    await job({ part: 'gear', name: 'Gear Spacer', label: 'gear spacer', material: 'PLA', color: 'red', qty: 4, printer: 4, state: 'completed', doneAgoMin: 25, estMin: 44, by: A, createdAgo: 2 * HOUR, order: 2 });
    await job({ part: 'arm', name: 'Arm Bracket', label: 'arm bracket', material: 'PETG', color: 'black', qty: 2, printer: 2, state: 'printing', pct: 0.45, leftMin: 72, by: ids.maya, createdAgo: 3 * HOUR, order: 3 });
    await job({ part: 'sensor', name: 'Sensor Holder', label: 'sensor holder', material: 'PLA', color: 'black', qty: 8, printer: 3, state: 'printing', pct: 0.12, leftMin: 128, by: ids.hana, createdAgo: 1 * HOUR, order: 4 });
  } else {
    await job({ part: 'intake', name: 'Intake Mount', label: 'bracket', material: 'PLA', color: 'black', qty: 2, printer: 1, state: 'printing', pct: 0.72, leftMin: 72, by: ids.noor, createdAgo: 4 * HOUR, order: 1 });
    await job({ part: 'gear', name: 'Gear Spacer', label: 'gear spacer', material: 'PLA', color: 'red', qty: 8, printer: 2, state: 'printing', pct: 0.4, leftMin: 38, by: A, createdAgo: 2 * HOUR, order: 2 });
    await job({ part: 'arm', name: 'Arm Bracket', label: 'arm bracket', material: 'PETG', color: 'black', qty: 2, printer: 3, state: 'printing', pct: 0.12, leftMin: 125, by: ids.maya, createdAgo: HOUR, order: 3 });
    await job({ part: 'gear', name: 'Gear Spacer', label: 'gear spacer', material: 'PLA', color: 'red', qty: 4, printer: 4, state: 'completed', doneAgoMin: 25, estMin: 44, by: A, createdAgo: 3 * HOUR, order: 0 });
    await db.update(schema.printJobs).set({ pickedUp: true }).where(eq(schema.printJobs.status, 'completed'));
  }

  // competition + tasks (39/50 = 78%)
  const compId = newId();
  await db.insert(schema.competitions).values({
    id: compId, name: 'Fall 2026 V5RC Qualifier', shortName: 'VEX Competition', startDate: '2026-12-12', location: 'TBD — the admin edits the real details', program: 'V5RC', isTarget: true,
    packing: ['Robot + spare battery (charged)', 'Controller + charging cable', 'Tool box', 'Engineering notebook', 'Spare motors and cartridges', 'Zip ties + rubber bands', 'Laptop with VEXcode'].map((t) => ({ text: t, done: false })),
    createdAt: at(20 * DAY),
  });
  await db.insert(schema.competitions).values({ id: newId(), name: 'Winter 2027 League Night', shortName: 'League Night', startDate: '2027-01-23', program: 'V5RC', isTarget: false, createdAt: at(20 * DAY) });
  const taskSets: [string, number, number, string[]][] = [
    ['mechanical', 14, 14, ['Build drivetrain rails', 'Mount mecanum wheels', 'Square the frame', 'Build intake arms', 'Mount intake rollers', 'Chain the intake', 'Build lift towers', 'Cut lift arms', 'Mount lift gears', 'Add rubber bands', 'Mount brain standoffs', 'Mount battery plate', 'Build fork end effector', 'Tighten all screws']],
    ['electronics', 10, 10, ['Wiring diagram', 'Mount brain', 'Mount battery', 'Mount radio', 'Plug in drive motors', 'Plug in intake motor', 'Plug in lift motors', 'Mount inertial sensor', 'Mount rotation sensor', 'Cable management']],
    ['code', 12, 12, ['Generate robot config', 'Tank drive control', 'Mecanum drive control', 'Intake buttons', 'Lift buttons with hold', 'Calibrate inertial', 'First autonomous path', 'Turn tuning', 'Lift position control', 'Brain screen status', 'Driver practice mode', 'Code review']],
    ['testing', 3, 14, ['Drive test', 'Intake test', 'Lift range test', 'Autonomous run 1', 'Autonomous run 2', 'Battery endurance', 'Sizing box check', 'Driver practice 1', 'Driver practice 2', 'Skills run', 'Match simulation', 'Inspection dry run', 'Tipping test', 'Final checklist']],
  ];
  const assignees = [ids.maya, ids.noor, ids.amina, ids.zain, ids.sara, ids.zayd, ids.hana];
  let tk = 0;
  for (const [cat, done, total, titles] of taskSets) {
    for (let i = 0; i < total; i++) {
      const isDone = i < done;
      const doing = !isDone && cat === 'testing' && i === done;
      await db.insert(schema.tasks).values({
        id: newId(), buildId, competitionId: compId, title: titles[i], category: cat as 'mechanical', status: isDone ? 'done' : doing ? 'doing' : 'todo',
        assigneeId: assignees[tk++ % assignees.length], weight: 1, completedAt: isDone ? at((5 + i) * HOUR) : null, createdBy: A, createdAt: at(14 * DAY),
      });
    }
  }
  await db.insert(schema.tasks).values({ id: newId(), buildId, competitionId: compId, title: 'Notebook: design process entry', category: 'notebook', status: 'doing', assigneeId: ids.sara, createdBy: A, createdAt: at(3 * DAY) });

  // inventory + orders
  const inv = scenarioInventory(scenario);
  const invIds: string[] = [];
  for (const it of inv) {
    const id = newId();
    invIds.push(id);
    await db.insert(schema.inventoryItems).values({ id, name: it.name, sku: it.sku ?? null, category: it.category, subcategory: it.subcategory, unit: 'pcs', qtyOnHand: it.qty, minQty: it.min, location: it.location, supplier: it.category === 'printed_parts' ? 'Team printers' : 'VEX Robotics', url: it.sku ? `https://www.vexrobotics.com/${it.sku}.html` : null, catalogPartId: it.catalogPartId ?? null, wasLow: it.min > 0 && it.qty <= it.min, createdAt: at(30 * DAY), updatedAt: at(3 * HOUR) });
  }
  const orderCount = scenario === 'B' ? 6 : 2;
  const lowItems = inv.map((it, i) => ({ it, id: invIds[i] })).filter(({ it }) => it.min > 0 && it.qty <= it.min).slice(0, orderCount);
  for (let i = 0; i < orderCount; i++) {
    const src = lowItems[i % Math.max(1, lowItems.length)];
    await db.insert(schema.orders).values({ id: newId(), itemId: src?.id ?? null, name: src?.it.name ?? 'Smart Cable 24″', sku: src?.it.sku ?? null, qty: 10 + i * 2, status: i % 2 ? 'ordered' : 'requested', requestedBy: assignees[i % assignees.length], createdAt: at((i + 1) * DAY), updatedAt: at(i * HOUR) });
  }
  await db.insert(schema.orders).values({ id: newId(), itemId: invIds[0], name: inv[0].name, sku: inv[0].sku ?? null, qty: 100, status: 'received', requestedBy: ids.sara, updatedBy: A, createdAt: at(8 * DAY), updatedAt: at(6 * DAY) });

  // code: scenario file is the most recently edited
  const files = await db.select().from(schema.codeFiles).where(eq(schema.codeFiles.buildId, buildId));
  const main = files.find((f) => f.path === 'src/main.cpp')!;
  const scenarioPath = scenario === 'A' ? 'include/intake-control.h' : 'include/autonomous.h';
  const other = scenario === 'A' ? 'include/autonomous.h' : 'include/intake-control.h';
  await db.update(schema.codeFiles).set({ content: main.content.replace('#include "vex.h"\n', `#include "vex.h"\n#include "${scenarioPath.replace('include/', '')}"\n#include "${other.replace('include/', '')}"\n`), updatedAt: at(3 * HOUR) }).where(eq(schema.codeFiles.id, main.id));
  for (const [p, content] of Object.entries(SEED_FILES)) {
    const fid = newId();
    const t = p === scenarioPath ? at(HOUR) : at(26 * HOUR);
    await db.insert(schema.codeFiles).values({ id: fid, buildId, path: p, content, generated: false, updatedBy: ids.amina, updatedAt: t });
    await db.insert(schema.codeVersions).values({ id: newId(), fileId: fid, content, authorId: ids.amina, message: 'saved', createdAt: t });
  }
  for (const f of files) if (f.generated) await db.update(schema.codeFiles).set({ updatedAt: at(2 * HOUR) }).where(eq(schema.codeFiles.id, f.id));

  // activity
  const act = async (type: string, actor: string | null, entityType: string, entityId: string, data: Record<string, unknown>, ago: number) =>
    db.insert(schema.activity).values({ id: newId(), actorId: actor, type, entityType, entityId, data, createdAt: at(ago) });
  const autonFile = (await db.select().from(schema.codeFiles).where(eq(schema.codeFiles.buildId, buildId))).find((f) => f.path === 'include/autonomous.h')!;
  await act('build.created', ids.maya, 'build', buildId, { build: '2026 Competition Robot' }, 3 * DAY);
  await act('ai.design', ids.maya, 'build', buildId, { build: '2026 Competition Robot', firstName: 'Maya', top: 'Added the planned catapult launcher' }, 2 * HOUR + 5 * MIN);
  if (scenario === 'B') {
    await act('inventory.added', ids.sara, 'item', invIds[60], { subcategory: 'gears' }, 3 * HOUR);
    await act('task.completed', ids.zain, 'task', compId, { title: 'Wiring diagram' }, 2 * HOUR);
    await act('code.updated', ids.amina, 'file', autonFile.id, { label: 'autonomous' }, HOUR);
  } else {
    await act('task.completed', ids.hana, 'task', compId, { title: 'Wiring diagram' }, 3 * HOUR);
    await act('inventory.added', ids.zayd, 'item', invIds[0], { qty: 6 }, 2 * HOUR);
    await act('code.updated', ids.amina, 'file', autonFile.id, { label: 'autonomous' }, HOUR);
  }
  await act('print.queued', ids.noor, 'job', 'seed', { shortLabel: 'bracket' }, 18 * MIN);
  await act('file.uploaded', ids.maya, 'upload', uploadId, { filename: 'intake_v3.stl' }, 2 * MIN);

  // notifications
  await db.insert(schema.notifications).values({ id: newId(), userId: A, type: 'print.completed', title: 'Gear Spacer finished printing', body: '4 × Gear Spacer on Printer 4', link: '/printer', createdAt: at(25 * MIN) });
  await db.insert(schema.notifications).values({ id: newId(), userId: A, type: 'build.changed', title: 'Maya updated 2026 Competition Robot', body: 'v3 via the AI Mentor', link: `/builds/${buildId}`, readAt: at(HOUR), createdAt: at(2 * HOUR) });

  // resources + settings
  await db.insert(schema.settingsKv).values({ key: 'resources.links', value: DEFAULT_RESOURCES });
  await db.insert(schema.settingsKv).values({ key: 'ai.limits', value: { perHour: e.AI_MAX_REQUESTS_PER_HOUR, perDay: e.AI_MAX_REQUESTS_PER_DAY, teamDaily: e.AI_GLOBAL_DAILY_CAP } });
  await db.insert(schema.settingsKv).values({ key: 'safety.escalateToCoach', value: false });
  await db.insert(schema.settingsKv).values({ key: 'seed.scenario', value: scenario });

  // credentials file
  const dataDir = path.resolve('data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'seed-credentials.txt'), creds.join('\n') + '\n', { mode: 0o600 });
  log(`Seeded scenario ${scenario}. Credentials → data/seed-credentials.txt`);
  log(creds.slice(2).join('\n'));
}

/** a small binary STL (U-bracket-ish block) for the seeded upload */
function simpleStl(): Buffer {
  const boxes: [number, number, number, number, number, number][] = [[0, 0, 0, 63.5, 25.4, 3.2], [0, 0, 0, 3.2, 25.4, 19], [60.3, 0, 0, 63.5, 25.4, 19]];
  const tris: number[][] = [];
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3]];
    for (const t of f) tris.push([...v[t[0]], ...v[t[1]], ...v[t[2]]]);
  }
  const buf = Buffer.alloc(84 + tris.length * 50);
  buf.write('FDRHS Robotics Hub - intake_v3', 0, 'ascii');
  buf.writeUInt32LE(tris.length, 80);
  tris.forEach((t, i) => { for (let k = 0; k < 9; k++) buf.writeFloatLE(t[k], 84 + i * 50 + 12 + k * 4); });
  return buf;
}
