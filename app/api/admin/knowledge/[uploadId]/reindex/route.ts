import { route, bad } from '@/lib/api';
import { indexUpload } from '@/lib/ai/knowledge';

export const runtime = 'nodejs';
export const maxDuration = 120;

export const POST = route<{ uploadId: string }>({ role: 'admin' }, async ({ params }) => {
  try { return { chunks: await indexUpload(params.uploadId) }; } catch (e) { throw bad(`Could not index that document: ${(e as Error).message}`); }
});
