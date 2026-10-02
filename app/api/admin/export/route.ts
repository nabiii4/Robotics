import { route } from '@/lib/api';
import { exportAll } from '@/lib/services/dataExport';

export const runtime = 'nodejs';

export const GET = route({ role: 'admin' }, async () => {
  const data = await exportAll();
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="fdrhs-hub-export-${new Date().toISOString().slice(0, 10)}.json"` } });
});
