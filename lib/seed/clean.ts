import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { hashPassword } from '../auth/password';
import { env } from '../env';
import { SEASONS } from '../robot/seasons';
import { sha256 } from '../crypto';
import { DEFAULT_RESOURCES } from './index';

/**
 * A real team's first run: the team, one admin, season rules, curated links and one simulated printer.
 * No sample students, builds or inventory (use SEED_SCENARIO=B for the demo data instead).
 */
export async function seedClean(log: (s: string) => void = console.log) {
  const e = env();
  const now = new Date();
  const code = (e.TEAM_JOIN_CODE || `COUGAR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`).trim().toUpperCase();
  const password = e.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(9).toString('base64url');
  await db.insert(schema.team).values({ id: 'team', name: 'FDRHS Robotics', school: 'Franklin D. Roosevelt High School', teamNumber: null, joinCodeHash: sha256(code), createdAt: now });
  await db.insert(schema.settingsKv).values({ key: 'team.joinCodePlain', value: code });
  await db.insert(schema.users).values({
    id: newId(), username: e.ADMIN_USERNAME.toLowerCase(), displayName: 'Coach', avatarText: null, avatarColor: '#171D22', role: 'admin', teamRole: 'Coach',
    passwordHash: await hashPassword(password), mustChangePassword: !e.ADMIN_INITIAL_PASSWORD, prefs: { layout: 'b', memoryEnabled: true, replyLength: 'concise', quality: 'medium' },
    skills: [], createdAt: now, lastActiveAt: null,
  });
  for (const s of SEASONS) await db.insert(schema.seasonProfiles).values({ id: s.id, name: s.name, program: s.program, years: s.years, rules: s as unknown as Record<string, unknown>, active: s.id === 'v5rc-2026-27-override' });
  await db.insert(schema.printers).values({ id: newId(), name: 'Practice printer', model: 'Simulated FDM', adapter: 'simulated', materials: ['PLA', 'PETG'], bedMm: [256, 256, 256], throughputGPerMin: 0.35, online: true, sortOrder: 1 });
  await db.insert(schema.settingsKv).values([
    { key: 'resources.links', value: DEFAULT_RESOURCES },
    { key: 'ai.limits', value: { perHour: e.AI_MAX_REQUESTS_PER_HOUR, perDay: e.AI_MAX_REQUESTS_PER_DAY, teamDaily: e.AI_GLOBAL_DAILY_CAP } },
    { key: 'safety.escalateToCoach', value: false },
    { key: 'seed.scenario', value: 'clean' },
  ]);
  const lines = [
    'FDRHS Robotics Hub — first sign-in', '',
    `Admin username: ${e.ADMIN_USERNAME.toLowerCase()}`,
    e.ADMIN_INITIAL_PASSWORD ? 'Admin password: (the ADMIN_INITIAL_PASSWORD you set)' : `Admin password: ${password}   (you must change it at first sign-in)`,
    `Team join code: ${code}   (students sign up at /join)`,
  ];
  const dataDir = path.resolve('data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'seed-credentials.txt'), lines.join('\n') + '\n', { mode: 0o600 });
  log(lines.join('\n'));
}
