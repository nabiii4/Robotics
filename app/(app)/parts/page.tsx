'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, DownloadSimple, FileArrowUp, MagnifyingGlass, Minus, Package, Plus, Warning, ShoppingCart, Tray } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { timeAgo } from '@/lib/format';
import { useMe } from '@/components/shell/AppShell';
import { useBuilds } from '@/components/mentor/MentorDrawer';
import { Badge, EmptyState, Field, Page, PageHeader, Skeleton, Spinner } from '@/components/ui/bits';
import { Dialog, Drawer } from '@/components/ui/Dialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { toast } from '@/components/ui/Toast';
import { useBomCompare } from '@/components/builds/AssemblyTab';

interface Item { id: string; name: string; sku: string | null; category: string; subcategory: string; unit: string; qtyOnHand: number; minQty: number; location: string | null; supplier: string | null; url: string | null; notes: string | null; reserved: number; available: number; onOrder: number; low: boolean; out: boolean; updatedAt: number }
interface Order { id: string; itemId: string | null; name: string; sku: string | null; qty: number; status: 'requested' | 'ordered' | 'received' | 'canceled'; requestedBy: string; requestedByName: string | null; updatedByName: string | null; eta: string | null; createdAt: number; updatedAt: number }
const CATS: [string, string][] = [['', 'All'], ['screws_hardware', 'Screws & Hardware'], ['vex_structural', 'VEX Structural'], ['motors_electronics', 'Motors & Electronics'], ['printed_parts', '3D Printed Parts']];
const ORDER_TONE = { requested: 'amber', ordered: 'blue', received: 'green', canceled: 'grey' } as const;
const FIELDS = ['name', 'sku', 'category', 'subcategory', 'unit', 'qty_on_hand', 'min_qty', 'location', 'supplier', 'url', 'notes'];

function useInventory() { return useQuery({ queryKey: ['inventory'], queryFn: () => api.get<{ items: Item[]; metrics: { total: number; low: number; out: number; onOrder: number } }>('/api/inventory') }); }
function useOrders() { return useQuery({ queryKey: ['orders'], queryFn: () => api.get<{ orders: Order[] }>('/api/orders') }); }

function ItemDialog({ item, open, onClose }: { item: Item | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const blank = { name: '', sku: '', category: 'vex_structural', subcategory: '', unit: 'pcs', qtyOnHand: 0, minQty: 0, location: '', supplier: '', url: '', notes: '' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setErr(null); setF(item ? { name: item.name, sku: item.sku ?? '', category: item.category, subcategory: item.subcategory, unit: item.unit, qtyOnHand: item.qtyOnHand, minQty: item.minQty, location: item.location ?? '', supplier: item.supplier ?? '', url: item.url ?? '', notes: item.notes ?? '' } : blank); } }, [open, item]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setErr(null);
    try {
      const body = { ...f, sku: f.sku || null, location: f.location || null, supplier: f.supplier || null, notes: f.notes || null };
      if (item) await api.patch(`/api/inventory/${item.id}`, body); else await api.post('/api/inventory', body);
      qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['bom-compare'] });
      toast.ok(item ? 'Saved' : 'Item added'); onClose();
    } catch (e) { setErr((e as ClientError).message); }
  };
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: ['qtyOnHand', 'minQty'].includes(k) ? Math.max(0, Math.round(Number(e.target.value) || 0)) : e.target.value });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={item ? `Edit ${item.name}` : 'Add inventory item'} width={560}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.name.trim()} onClick={save}>{item ? 'Save' : 'Add item'}</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Name"><input autoFocus className="input" maxLength={120} value={f.name} onChange={set('name')} /></Field></div>
        <Field label="SKU"><input className="input" maxLength={40} value={f.sku} onChange={set('sku')} placeholder="276-1234" /></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={set('category')}>{CATS.slice(1).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Subcategory"><input className="input" maxLength={60} value={f.subcategory} onChange={set('subcategory')} placeholder="e.g. gears" /></Field>
        <Field label="Unit"><input className="input" maxLength={12} value={f.unit} onChange={set('unit')} /></Field>
        <Field label="On hand"><input className="input" type="number" min={0} value={f.qtyOnHand} onChange={set('qtyOnHand')} /></Field>
        <Field label="Minimum" hint="Low stock when on hand ≤ this"><input className="input" type="number" min={0} value={f.minQty} onChange={set('minQty')} /></Field>
        <Field label="Location"><input className="input" maxLength={60} value={f.location} onChange={set('location')} placeholder="Bin A3" /></Field>
        <Field label="Supplier"><input className="input" maxLength={60} value={f.supplier} onChange={set('supplier')} placeholder="VEX Robotics" /></Field>
        <div className="col-span-2"><Field label="Product URL"><input className="input" maxLength={300} value={f.url} onChange={set('url')} placeholder="https://www.vexrobotics.com/…" /></Field></div>
        <div className="col-span-2"><Field label="Notes"><textarea className="input min-h-[60px]" maxLength={500} value={f.notes} onChange={set('notes')} /></Field></div>
      </div>
      {err && <p className="mt-3 text-[13px] text-fdr-red">{err}</p>}
    </Dialog>
  );
}

function AdjustDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState('');
  useEffect(() => { setDelta(1); setReason(''); }, [item]);
  const go = async () => {
    if (!item) return;
    try { await api.post(`/api/inventory/${item.id}/adjust`, { delta, reason: reason || undefined }); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok(`${item.name}: ${delta > 0 ? '+' : ''}${delta}`); onClose(); }
    catch (e) { toast.error('Could not adjust', (e as ClientError).message); }
  };
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()} title={`Adjust ${item?.name ?? ''}`} description={item ? `${item.qtyOnHand} on hand now` : ''} width={420}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!delta} onClick={go}>Apply</button></>}>
      <div className="grid gap-3">
        <Field label="Change (use a minus for parts used)"><input className="input" type="number" value={delta} onChange={(e) => setDelta(Math.round(Number(e.target.value) || 0))} /></Field>
        <Field label="Reason"><select className="input" value={reason} onChange={(e) => setReason(e.target.value)}><option value="">Choose…</option>{['Counted', 'Used on robot', 'Broken / lost', 'Donated', 'Returned to stock'].map((r) => <option key={r}>{r}</option>)}</select></Field>
      </div>
    </Dialog>
  );
}

function HistoryDrawer({ item, onClose }: { item: Item; onClose: () => void }) {
  const q = useQuery({ queryKey: ['inv-history', item.id], queryFn: () => api.get<{ history: { id: string; delta: number; reason: string | null; actor: string; createdAt: number }[] }>(`/api/inventory/${item.id}/history`) });
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={`${item.name} history`} width={440}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><div><div className="text-[15px] font-bold text-ink-900">{item.name}</div><div className="text-[12px] text-ink-500">{item.qtyOnHand} on hand · {item.reserved} reserved</div></div><button className="btn btn-outline h-8 text-[12px]" onClick={onClose}>Close</button></div>
      <ul className="scroll-thin min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {q.isLoading && <li className="p-4"><Spinner /></li>}
        {q.data?.history.map((h) => <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]"><span className={`tabular w-14 font-bold ${h.delta > 0 ? 'text-ok' : 'text-fdr-red'}`}>{h.delta > 0 ? '+' : ''}{h.delta}</span><span className="flex-1 text-ink-800">{h.reason ?? 'Adjusted'}<span className="block text-[11.5px] text-ink-400">{h.actor} · {timeAgo(h.createdAt)}</span></span></li>)}
        {q.data && !q.data.history.length && <li className="p-4 text-[13px] text-ink-500">No changes recorded yet.</li>}
      </ul>
    </Drawer>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [csv, setCsv] = useState('');
  const [res, setRes] = useState<null | { header: string[]; mapping: Record<string, number>; rows: number; created: number; updated: number; skipped: { row: number; reason: string }[]; preview: Record<string, unknown>[] }>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setCsv(''); setRes(null); setMapping({}); } }, [open]);
  const preview = async (text: string, map?: Record<string, number>) => {
    try { const r = await api.post<NonNullable<typeof res>>('/api/inventory/import', { csv: text, mapping: map, dryRun: true }); setRes(r); setMapping(r.mapping); }
    catch (e) { toast.error('Could not read that CSV', (e as ClientError).message); }
  };
  const run = async () => {
    try { const r = await api.post<{ created: number; updated: number }>('/api/inventory/import', { csv, mapping, dryRun: false }); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok(`Imported: ${r.created} new, ${r.updated} updated`); onClose(); }
    catch (e) { toast.error('Import failed', (e as ClientError).message); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Import inventory CSV" description="Columns: name, sku, category, subcategory, unit, qty_on_hand, min_qty, location, supplier, url, notes" width={760}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!res || mapping.name == null} onClick={run}>Import {res ? `${res.created + res.updated} rows` : ''}</button></>}>
      <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const t = await f.text(); setCsv(t); preview(t); }} />
      <button className="btn btn-outline h-9" onClick={() => file.current?.click()}><FileArrowUp size={16} />Choose CSV</button>
      {res && (
        <div className="mt-4 grid gap-4">
          <div>
            <div className="label mb-1.5">Column mapping</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FIELDS.map((k) => (
                <label key={k} className="text-[12px] text-ink-600">{k}
                  <select className="input mt-0.5 h-8 py-0 text-[12.5px]" value={mapping[k] ?? ''} onChange={(e) => { const m = { ...mapping }; if (e.target.value === '') delete m[k]; else m[k] = Number(e.target.value); setMapping(m); preview(csv, m); }}>
                    <option value="">— skip —</option>{res.header.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <div className="text-[13px] text-ink-700">{res.rows} rows → <b>{res.created}</b> new, <b>{res.updated}</b> updated{res.skipped.length ? `, ${res.skipped.length} skipped (${res.skipped.slice(0, 3).map((s) => `row ${s.row}: ${s.reason}`).join('; ')})` : ''}</div>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-[12px]"><thead className="bg-[#F8F9FA]"><tr>{['action', 'name', 'sku', 'category', 'qtyOnHand', 'minQty'].map((h) => <th key={h} className="px-2 py-1 text-left font-semibold text-ink-500">{h}</th>)}</tr></thead>
              <tbody>{res.preview.map((p, i) => <tr key={i} className="border-t border-line">{['action', 'name', 'sku', 'category', 'qtyOnHand', 'minQty'].map((h) => <td key={h} className="px-2 py-1">{String(p[h] ?? '')}</td>)}</tr>)}</tbody></table>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function InventoryTable({ items, onEdit, onAdjust, onHistory }: { items: Item[]; onEdit: (i: Item) => void; onAdjust: (i: Item) => void; onHistory: (i: Item) => void }) {
  const qc = useQueryClient();
  const { me } = useMe();
  const box = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [h, setH] = useState(560);
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setH(el.clientHeight)); ro.observe(el); return () => ro.disconnect(); }, []);
  const ROW = 46;
  const start = Math.max(0, Math.floor(top / ROW) - 6);
  const end = Math.min(items.length, Math.ceil((top + h) / ROW) + 6);
  const step = async (i: Item, d: number) => {
    qc.setQueryData<{ items: Item[] }>(['inventory'], (old) => old && { ...old, items: old.items.map((x) => (x.id === i.id ? { ...x, qtyOnHand: x.qtyOnHand + d, available: x.available + d } : x)) });
    try { await api.post(`/api/inventory/${i.id}/adjust`, { delta: d, reason: d > 0 ? 'Added' : 'Used' }); qc.invalidateQueries({ queryKey: ['dashboard'] }); }
    catch (e) { toast.error('Could not update', (e as ClientError).message); }
    finally { qc.invalidateQueries({ queryKey: ['inventory'] }); }
  };
  const del = async (i: Item) => { if (!confirm(`Delete ${i.name} from inventory?`)) return; try { await api.del(`/api/inventory/${i.id}`); qc.invalidateQueries({ queryKey: ['inventory'] }); toast.ok('Deleted'); } catch (e) { toast.error('Could not delete', (e as ClientError).message); } };
  const cols = 'grid grid-cols-[minmax(200px,2fr)_110px_120px_128px_80px_80px_60px_100px_80px_110px_40px] items-center gap-2';
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1180px]">
        <div ref={box} onScroll={(e) => setTop(e.currentTarget.scrollTop)} className="scroll-thin relative h-[calc(100vh-420px)] min-h-[360px] overflow-y-auto" role="table" aria-rowcount={items.length}>
          <div style={{ height: items.length * ROW }} className="relative">
            {items.slice(start, end).map((i, k) => (
              <div key={i.id} role="row" className={`${cols} absolute inset-x-0 border-b border-line px-4 text-[12.5px] hover:bg-[#FAFBFC] ${i.low ? 'bg-[#FFFAF5]' : ''}`} style={{ top: (start + k) * ROW, height: ROW }}>
                <button className="truncate text-left font-medium text-ink-900 hover:text-fdr-red" onClick={() => onEdit(i)}>{i.name}{i.out ? <Badge tone="red" className="ml-1.5">Out</Badge> : i.low ? <Badge tone="amber" className="ml-1.5">Low</Badge> : null}</button>
                <span className="truncate font-mono text-[11.5px] text-ink-500">{i.sku ?? '—'}</span>
                <span className="truncate text-ink-600">{i.subcategory || '—'}</span>
                <span className="flex items-center gap-1">
                  <button aria-label={`Use one ${i.name}`} disabled={i.qtyOnHand <= 0} onClick={() => step(i, -1)} className="flex h-6 w-6 items-center justify-center rounded border border-line hover:bg-[#F3F4F6] disabled:opacity-30"><Minus size={12} /></button>
                  <span className="tabular w-12 text-center font-semibold">{i.qtyOnHand}</span>
                  <button aria-label={`Add one ${i.name}`} onClick={() => step(i, 1)} className="flex h-6 w-6 items-center justify-center rounded border border-line hover:bg-[#F3F4F6]"><Plus size={12} /></button>
                </span>
                <span className="tabular text-right text-ink-600">{i.reserved || '—'}</span>
                <span className="tabular text-right font-semibold">{i.available}</span>
                <span className="tabular text-right text-ink-500">{i.minQty || '—'}</span>
                <span className="truncate text-ink-600">{i.location ?? '—'}</span>
                <span className="tabular text-right text-ink-600">{i.onOrder || '—'}</span>
                <span className="text-[11.5px] text-ink-400">{timeAgo(i.updatedAt)}</span>
                <Menu>
                  <MenuTrigger asChild><button aria-label={`${i.name} menu`} className="rounded px-1 text-[18px] leading-none text-ink-500 hover:bg-black/5">⋯</button></MenuTrigger>
                  <MenuContent width={170}>
                    <MenuItem onSelect={() => onEdit(i)}>Edit</MenuItem>
                    <MenuItem onSelect={() => onAdjust(i)}>Adjust…</MenuItem>
                    <MenuItem onSelect={() => onHistory(i)}>History</MenuItem>
                    {me.role !== 'member' && <><MenuSeparator /><MenuItem danger onSelect={() => del(i)}>Delete</MenuItem></>}
                  </MenuContent>
                </Menu>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrdersTab() {
  const qc = useQueryClient();
  const { me } = useMe();
  const q = useOrders();
  const inv = useInventory();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ itemId: '', name: '', qty: 1 });
  const set = async (o: Order, status: Order['status']) => { try { await api.patch(`/api/orders/${o.id}`, { status }); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok(status === 'received' ? `${o.qty} × ${o.name} added to inventory` : `Marked ${status}`); } catch (e) { toast.error('Could not update', (e as ClientError).message); } };
  const add = async () => {
    const item = inv.data?.items.find((i) => i.id === f.itemId);
    try { await api.post('/api/orders', { itemId: item?.id ?? null, name: item?.name ?? f.name, sku: item?.sku ?? null, qty: f.qty }); qc.invalidateQueries({ queryKey: ['orders'] }); setAdding(false); setF({ itemId: '', name: '', qty: 1 }); toast.ok('Requested'); }
    catch (e) { toast.error('Could not add', (e as ClientError).message); }
  };
  const captain = me.role !== 'member';
  return (
    <div>
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><span className="text-[13px] text-ink-600">{captain ? 'Move lines Requested → Ordered → Received. Received adds the quantity to inventory.' : 'Request parts — a captain or admin orders them.'}</span><button className="btn btn-primary h-9 text-[13px]" onClick={() => setAdding(true)}><Plus size={15} />Request parts</button></div>
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500"><tr className="border-b border-line"><th className="px-4 py-2 font-semibold">Part</th><th className="font-semibold">Qty</th><th className="font-semibold">Status</th><th className="font-semibold">Requested by</th><th className="font-semibold">Updated</th><th /></tr></thead>
        <tbody className="divide-y divide-line">
          {q.data?.orders.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-2 font-medium text-ink-900">{o.name}{o.sku && <span className="ml-1.5 font-mono text-[11px] text-ink-400">{o.sku}</span>}</td>
              <td className="tabular">{o.qty}</td>
              <td><Badge tone={ORDER_TONE[o.status]}>{o.status[0].toUpperCase() + o.status.slice(1)}</Badge></td>
              <td className="text-ink-600">{o.requestedByName}</td>
              <td className="text-ink-400">{timeAgo(o.updatedAt)}{o.updatedByName ? ` · ${o.updatedByName.split(' ')[0]}` : ''}</td>
              <td className="pr-4 text-right">
                {captain && o.status === 'requested' && <button className="btn btn-outline mr-1 h-7 text-[12px]" onClick={() => set(o, 'ordered')}>Mark ordered</button>}
                {captain && (o.status === 'requested' || o.status === 'ordered') && <button className="btn btn-primary mr-1 h-7 text-[12px]" onClick={() => set(o, 'received')}>Received</button>}
                {captain && (o.status === 'requested' || o.status === 'ordered') && <button className="btn btn-ghost h-7 text-[12px]" onClick={() => set(o, 'canceled')}>Cancel</button>}
              </td>
            </tr>
          ))}
          {q.data && !q.data.orders.length && <tr><td colSpan={6}><EmptyState icon={<ShoppingCart size={32} />} text="No order lines yet." /></td></tr>}
        </tbody>
      </table>
      <Dialog open={adding} onOpenChange={setAdding} title="Request parts" width={460} footer={<><button className="btn btn-outline" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" disabled={!f.itemId && !f.name.trim()} onClick={add}>Request</button></>}>
        <div className="grid gap-3">
          <Field label="Inventory item"><select className="input" value={f.itemId} onChange={(e) => setF({ ...f, itemId: e.target.value })}><option value="">— something new —</option>{inv.data?.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
          {!f.itemId && <Field label="Part name"><input className="input" maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>}
          <Field label="Quantity"><input className="input" type="number" min={1} value={f.qty} onChange={(e) => setF({ ...f, qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })} /></Field>
        </div>
      </Dialog>
    </div>
  );
}

function BomTab() {
  const qc = useQueryClient();
  const builds = useBuilds();
  const [bid, setBid] = useState('');
  useEffect(() => { if (!bid && builds.data?.builds[0]) setBid((builds.data.builds.find((b) => b.isTeamActive) ?? builds.data.builds[0]).id); }, [builds.data, bid]);
  const cmp = useBomCompare(bid);
  const rows = cmp.data?.rows ?? [];
  const act = async (path: string, label: (r: { reserved?: number; ordered?: number }) => string) => { try { const r = await api.post<{ reserved?: number; ordered?: number }>(`/api/builds/${bid}/bom-compare/${path}`); qc.invalidateQueries({ queryKey: ['bom-compare', bid] }); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['orders'] }); toast.ok(label(r)); } catch (e) { toast.error('That didn’t work', (e as ClientError).message); } };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <select aria-label="Build" className="input h-9 w-auto" value={bid} onChange={(e) => setBid(e.target.value)}>{builds.data?.builds.map((b) => <option key={b.id} value={b.id}>{b.name} v{b.version}</option>)}</select>
        <span className="text-[12.5px] text-ink-500">{rows.length} lines · {rows.filter((r) => r.short).length} short</span>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-outline h-9 text-[13px]" disabled={!bid} onClick={() => act('reserve', (r) => `Reserved ${r.reserved} part types`)}><Tray size={15} />Reserve</button>
          <button className="btn btn-outline h-9 text-[13px]" disabled={!rows.some((r) => r.short)} onClick={() => act('order', (r) => (r.ordered ? `Added ${r.ordered} order lines` : 'Already on order'))}><ShoppingCart size={15} />Add shortages to orders</button>
        </div>
      </div>
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500"><tr className="border-b border-line"><th className="px-4 py-2 font-semibold">Part</th><th className="text-right font-semibold">Need</th><th className="text-right font-semibold">Have</th><th className="text-right font-semibold">Available</th><th className="text-right font-semibold">On order</th><th className="px-4 text-right font-semibold">Short</th></tr></thead>
        <tbody className="divide-y divide-line">
          {cmp.isLoading && <tr><td colSpan={6} className="p-6 text-center"><Spinner /></td></tr>}
          {rows.map((r) => <tr key={r.key} className={r.short ? 'bg-[#FFF8F8]' : ''}><td className="px-4 py-1.5">{r.name}{!r.itemId && <span className="ml-1 text-[11px] text-ink-400">(not tracked)</span>}</td><td className="tabular text-right">{r.need}</td><td className="tabular text-right">{r.itemId ? r.onHand : '—'}</td><td className="tabular text-right">{r.available}</td><td className="tabular text-right">{r.onOrder || '—'}</td><td className={`tabular px-4 text-right font-semibold ${r.short ? 'text-fdr-red' : 'text-ok'}`}>{r.short || '✓'}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function PartsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const inv = useInventory();
  const tab = ['orders', 'bom'].includes(sp.get('tab') ?? '') ? sp.get('tab')! : 'items';
  const category = sp.get('category') ?? '';
  const filter = sp.get('filter') ?? '';
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ k: keyof Item; dir: 1 | -1 }>({ k: 'name', dir: 1 });
  const [edit, setEdit] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [adjust, setAdjust] = useState<Item | null>(null);
  const [hist, setHist] = useState<Item | null>(null);
  const [importing, setImporting] = useState(false);
  const setQ = (kv: Record<string, string | null>) => { const q = new URLSearchParams(sp.toString()); for (const [k, v] of Object.entries(kv)) { if (v) q.set(k, v); else q.delete(k); } router.replace(`/parts?${q.toString()}`, { scroll: false }); };
  useEffect(() => { const id = sp.get('item'); if (id && inv.data) { const it = inv.data.items.find((i) => i.id === id); if (it) setHist(it); } }, [sp, inv.data]);
  const items = useMemo(() => {
    let r = inv.data?.items ?? [];
    if (category) r = r.filter((i) => i.category === category);
    if (filter === 'low') r = r.filter((i) => i.low); else if (filter === 'out') r = r.filter((i) => i.out); else if (filter === 'onorder') r = r.filter((i) => i.onOrder > 0);
    if (search) { const s = search.toLowerCase(); r = r.filter((i) => i.name.toLowerCase().includes(s) || (i.sku ?? '').toLowerCase().includes(s) || i.subcategory.toLowerCase().includes(s) || (i.location ?? '').toLowerCase().includes(s)); }
    return [...r].sort((a, b) => { const x = a[sort.k], y = b[sort.k]; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))) * sort.dir; });
  }, [inv.data, category, filter, search, sort]);
  const m = inv.data?.metrics;
  const tiles: [string, number | undefined, string, () => void, boolean][] = [
    ['Total Parts', m?.total, 'text-ink-900', () => setQ({ tab: null, filter: null }), !filter && tab === 'items'],
    ['Low Stock', m?.low, 'text-fdr-red', () => setQ({ tab: null, filter: 'low' }), filter === 'low'],
    ['On Order', m?.onOrder, 'text-[#1F6FD1]', () => setQ({ tab: 'orders', filter: null }), tab === 'orders'],
    ['Out of Stock', m?.out, 'text-ink-900', () => setQ({ tab: null, filter: 'out' }), filter === 'out'],
  ];
  const SortH = ({ k, label, right }: { k: keyof Item; label: string; right?: boolean }) => (
    <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 }))} className={`flex items-center gap-0.5 font-semibold uppercase hover:text-ink-900 ${right ? 'justify-end' : ''}`}>{label}{sort.k === k && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button>
  );
  return (
    <Page>
      <PageHeader title="Parts & Inventory" subtitle="What the team has, what's reserved for builds, and what's on order."
        actions={<><button className="btn btn-outline h-10" onClick={() => setImporting(true)}><FileArrowUp size={16} />Import CSV</button><button className="btn btn-outline h-10" onClick={() => download('/api/inventory/export.csv')}><DownloadSimple size={16} />Export CSV</button><button className="btn btn-primary h-10 px-4" onClick={() => setAdding(true)}><Plus size={16} />Add item</button></>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([l, v, c, on, act]) => (
          <button key={l} onClick={on} aria-pressed={act} className={`card rounded-[10px] px-4 py-3 text-left transition-shadow hover:shadow-[0_6px_18px_rgb(16_24_40/.1)] ${act ? 'ring-2 ring-fdr-red' : ''}`}>
            <div className="text-[12.5px] font-semibold text-ink-500">{l}</div>
            <div className={`tabular text-[26px] font-extrabold ${c}`}>{v ?? '–'}</div>
          </button>
        ))}
      </div>
      <section className="card rounded-[10px]">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 pt-2">
          {([['items', 'Inventory'], ['orders', 'Orders'], ['bom', 'BOM Compare']] as const).map(([k, l]) => <button key={k} onClick={() => setQ({ tab: k === 'items' ? null : k })} className={`border-b-[3px] px-3 pb-2 pt-1 text-[13.5px] font-semibold ${tab === k ? 'border-fdr-red text-fdr-red' : 'border-transparent text-ink-600 hover:text-ink-900'}`}>{l}</button>)}
        </div>
        {tab === 'orders' ? <OrdersTab /> : tab === 'bom' ? <BomTab /> : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <div className="flex flex-wrap gap-1">{CATS.map(([k, l]) => <button key={k} onClick={() => setQ({ category: k || null })} className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${category === k ? 'bg-ink-900 text-white' : 'bg-[#F0F1F3] text-ink-700 hover:bg-[#E5E7EA]'}`}>{l}</button>)}</div>
              {filter && <button onClick={() => setQ({ filter: null })} className="flex items-center gap-1 rounded-full bg-[#FFF0F0] px-3 py-1 text-[12px] font-semibold text-fdr-red"><Warning size={13} />{filter === 'low' ? 'Low stock' : filter === 'out' ? 'Out of stock' : 'On order'} ×</button>}
              <label className="relative ml-auto w-full sm:w-64"><MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input h-9 pl-9" placeholder="Search name, SKU, location" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
            </div>
            <div className="overflow-x-auto">
              <div className="grid min-w-[1180px] grid-cols-[minmax(200px,2fr)_110px_120px_128px_80px_80px_60px_100px_80px_110px_40px] gap-2 border-b border-line bg-[#F8F9FA] px-4 py-2 text-[11px] tracking-wider text-ink-500">
                <SortH k="name" label="Name" /><SortH k="sku" label="SKU" /><SortH k="subcategory" label="Type" /><SortH k="qtyOnHand" label="On hand" /><SortH k="reserved" label="Reserved" right /><SortH k="available" label="Avail." right /><SortH k="minQty" label="Min" right /><SortH k="location" label="Location" /><SortH k="onOrder" label="On order" right /><SortH k="updatedAt" label="Updated" /><span />
              </div>
            </div>
            {inv.isLoading ? <div className="p-4"><Skeleton className="h-64" /></div> : !items.length ? <EmptyState icon={<Package size={36} />} text={inv.data?.items.length ? 'No items match.' : 'No inventory yet — add items or import a CSV.'} /> : <InventoryTable items={items} onEdit={setEdit} onAdjust={setAdjust} onHistory={setHist} />}
            <div className="border-t border-line px-4 py-2 text-[12px] text-ink-500">{items.length} items · {items.reduce((s, i) => s + i.qtyOnHand, 0).toLocaleString()} units</div>
          </>
        )}
      </section>
      <ItemDialog item={edit} open={!!edit || adding} onClose={() => { setEdit(null); setAdding(false); }} />
      <AdjustDialog item={adjust} onClose={() => setAdjust(null)} />
      {hist && <HistoryDrawer item={hist} onClose={() => { setHist(null); if (sp.get('item')) setQ({ item: null }); }} />}
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </Page>
  );
}

export default function PartsPage() {
  return <Suspense><PartsInner /></Suspense>;
}
