import { z } from 'zod';
import { route } from '@/lib/api';
import { getSetting, setSetting } from '@/lib/services/settings';

export const runtime = 'nodejs';
type Link = { title: string; url: string; description: string };

export const GET = route({}, async () => ({ links: await getSetting<Link[]>('resources.links', []) }));

export const PUT = route({ role: 'captain', body: z.object({ links: z.array(z.object({ title: z.string().trim().min(1).max(80), url: z.string().trim().url().max(300), description: z.string().trim().max(200) })).max(40) }) }, async ({ body }) => {
  await setSetting('resources.links', body.links);
  return { ok: true };
});
