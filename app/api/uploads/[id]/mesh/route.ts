import { route } from '@/lib/api';
import { uploadMesh } from '@/lib/services/printJobs';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params }) => {
  const m = await uploadMesh(params.id);
  return { positions: Array.from(m.positions, (v) => Math.round(v * 100) / 100), indices: Array.from(m.indices), bbox: m.bbox, volumeMm3: m.volumeMm3, filename: m.filename };
});
