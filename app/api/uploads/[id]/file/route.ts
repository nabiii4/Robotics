import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { uploadPath } from '@/lib/services/uploads';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params, req }) => {
  const up = await db.query.uploads.findFirst({ where: eq(schema.uploads.id, params.id) });
  if (!up) throw notFound('That file no longer exists.');
  let buf: Buffer;
  try { buf = fs.readFileSync(uploadPath(up.storageKey)); } catch { throw notFound('That file is missing from storage.'); }
  const inline = req.nextUrl.searchParams.get('inline') === '1' && (up.kind === 'pdf' || up.kind === 'image' || up.kind === 'text');
  return new Response(new Uint8Array(buf), {
    headers: {
      'content-type': up.kind === 'text' ? 'text/plain; charset=utf-8' : up.mime,
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${up.filename.replace(/"/g, '')}"`,
      'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=300',
    },
  });
});
