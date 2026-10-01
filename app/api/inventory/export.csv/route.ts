import { route } from '@/lib/api';
import { exportCsv } from '@/lib/services/inventoryItems';

export const runtime = 'nodejs';

export const GET = route({}, async () => new Response(await exportCsv(), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="fdrhs_inventory_${new Date().toISOString().slice(0, 10)}.csv"` } }));
