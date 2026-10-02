'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DownloadSimple, Info, ShoppingCart, Tray } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import type { Derived } from '../viewer3d/Viewer';
import { Spinner } from '../ui/bits';
import { Tip } from '../ui/Tip';
import { toast } from '../ui/Toast';
import { useBomCompare } from './AssemblyTab';

export function SpecsTab({ d, buildId }: { d: Derived; buildId: string }) {
  const qc = useQueryClient();
  const cmp = useBomCompare(buildId);
  const [busy, setBusy] = useState<string | null>(null);
  const [hw, setHw] = useState(true);
  const m = d.metrics;
  const dt = d.spec.drivetrain;
  const g = dt.gearing ? `${dt.gearing.driving}:${dt.gearing.driven}` : 'direct';
  const rows: [string, string, string][] = [
    ['Motor speed', `${m.motorRpm} rpm`, `${dt.motors.type} motor with the ${dt.motors.cartridge} cartridge (red 100, green 200, blue 600 rpm; 5.5 W is 200 rpm).`],
    ['External gear ratio', `${g} = ${m.externalRatio.toFixed(3)}`, 'Driving teeth ÷ driven teeth. Below 1 means the wheel turns slower than the motor (more torque).'],
    ['Wheel speed', `${m.wheelRpm} rpm`, 'Motor rpm × external ratio.'],
    ['Top speed (theoretical)', `${m.topSpeedInPerS} in/s · ${m.topSpeedFtPerS} ft/s`, 'π × wheel diameter × wheel rpm ÷ 60. Real robots reach about 80% of this.'],
    ['Pushing force (est.)', `${m.pushLbf} lbf`, 'Motors × stall torque (2.1 N·m at 100 rpm, scaled by cartridge) ÷ external ratio ÷ wheel radius, in pounds-force. A stall value — real pushing is lower.'],
    ['Motor power', `${m.motorPowerW} W (${m.motors11W} × 11 W + ${m.motors55W} × 5.5 W)`, 'Sum of every motor’s rated power. The season limit is checked in Rules.'],
    ['Starting size', `${m.startSize.length} × ${m.startSize.width} × ${m.startSize.height} in`, 'Length × width × height of everything at pose 0 (starting configuration), measured from the 3D model.'],
    ['Max height (extended)', `${m.maxHeight} in`, 'Tallest point with lifts raised / pistons extended (pose 1).'],
    ['Weight (est.)', `${m.weightLb} lb`, 'Sum of catalog weights for every part, including screws and nuts (some weights are estimates).'],
    ['Wheel travel per wheel rev', `${m.wheelTravelMm.toFixed(2)} mm`, 'π × wheel diameter × 25.4.'],
    ['Travel per motor rev', `${m.wheelTravelPerMotorRevMm.toFixed(2)} mm`, 'Wheel travel × external ratio. This is the WHEEL_TRAVEL_MM passed to smartdrive.'],
    ['Track width', `${m.trackWidthIn} in`, 'Center-to-center distance between the left and right wheels.'],
    ['Wheelbase', `${m.wheelBaseIn} in`, 'Front axle to back axle.'],
    ['Wheel diameter', `${m.wheelDiameterIn} in`, 'Nominal VEX wheel size.'],
    ['Ground clearance', `${m.groundClearanceIn} in`, 'Lowest structural point above the floor.'],
    ...(m.liftPivotHeightIn != null ? [['Lift pivot height', `${m.liftPivotHeightIn} in`, 'Height of the lift’s main pivot axle.'] as [string, string, string]] : []),
    ...(m.armLengthIn != null ? [['Arm length', `${m.armLengthIn} in`, 'Pivot to tip of the lift arm.'] as [string, string, string]] : []),
    ['Part count', `${m.partCount}`, 'Every instance in the model, hardware included.'],
  ];
  const bom = (cmp.data?.rows ?? []).filter((r) => hw || !d.bom.find((b) => b.key === r.key)?.hardware);
  const totalShort = (cmp.data?.rows ?? []).reduce((s, r) => s + r.short, 0);
  const act = async (k: string, fn: () => Promise<{ reserved?: number; ordered?: number }>) => {
    setBusy(k);
    try {
      const r = await fn();
      qc.invalidateQueries({ queryKey: ['bom-compare', buildId] }); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.ok(k === 'reserve' ? `Reserved ${r.reserved} part types for this build` : r.ordered ? `Added ${r.ordered} lines to the order list` : 'Nothing to order — shortages are already on order');
    } catch (e) { toast.error('That didn’t work', (e as ClientError).message); }
    finally { setBusy(null); }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
      <section className="card h-fit rounded-[10px] p-4">
        <h3 className="mb-2 text-[14px] font-bold text-ink-900">Metrics</h3>
        <dl className="divide-y divide-line">
          {rows.map(([k, v, why]) => (
            <div key={k} className="flex items-center gap-2 py-2 text-[13px]">
              <dt className="flex flex-1 items-center gap-1 text-ink-600">{k}<Tip label={<span className="block max-w-[260px]">{why}</span>}><button aria-label={`How ${k} is calculated`} className="text-ink-300 hover:text-ink-700"><Info size={14} /></button></Tip></dt>
              <dd className="tabular text-right font-semibold text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card min-w-0 rounded-[10px]">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <h3 className="text-[14px] font-bold text-ink-900">Bill of materials</h3>
          <span className="text-[12px] text-ink-500">{d.bom.length} lines · {totalShort ? <b className="text-fdr-red">{totalShort} short</b> : 'nothing short'}</span>
          <label className="ml-2 flex items-center gap-1.5 text-[12px] text-ink-600"><input type="checkbox" checked={hw} onChange={(e) => setHw(e.target.checked)} className="accent-[#C8061C]" />Hardware</label>
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn btn-outline h-8 text-[12.5px]" disabled={!!busy} onClick={() => act('reserve', () => api.post(`/api/builds/${buildId}/bom-compare/reserve`))}>{busy === 'reserve' ? <Spinner size={13} /> : <Tray size={15} />}Reserve all available</button>
            <button className="btn btn-outline h-8 text-[12.5px]" disabled={!!busy || !totalShort} onClick={() => act('order', () => api.post(`/api/builds/${buildId}/bom-compare/order`))}>{busy === 'order' ? <Spinner size={13} /> : <ShoppingCart size={15} />}Add shortages to order list</button>
            <button className="btn btn-outline h-8 text-[12.5px]" onClick={() => download(`/api/builds/${buildId}/bom.csv`)}><DownloadSimple size={15} />Export CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead className="bg-[#F8F9FA] text-left text-[11px] uppercase tracking-wider text-ink-500">
              <tr><th className="px-4 py-2 font-semibold">Part</th><th className="px-2 py-2 font-semibold">SKU</th><th className="px-2 py-2 text-right font-semibold">Need</th><th className="px-2 py-2 text-right font-semibold">On hand</th><th className="px-2 py-2 text-right font-semibold">Reserved</th><th className="px-2 py-2 text-right font-semibold">On order</th><th className="px-4 py-2 text-right font-semibold">Short</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {cmp.isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-500"><Spinner /></td></tr>}
              {bom.map((r) => {
                const b = d.bom.find((x) => x.key === r.key);
                return (
                  <tr key={r.key} className={r.short ? 'bg-[#FFF8F8]' : ''}>
                    <td className="px-4 py-1.5 text-ink-900">{r.name}{b?.detail && <span className="text-ink-400"> · {b.detail}</span>}{!r.itemId && <span className="ml-1 text-[11px] text-ink-400">(not in inventory)</span>}</td>
                    <td className="px-2 py-1.5 font-mono text-[11.5px] text-ink-500">{r.sku ?? '—'}</td>
                    <td className="tabular px-2 py-1.5 text-right font-semibold">{r.need}{b?.plannedQty ? <span className="text-ink-400"> +{b.plannedQty}</span> : null}</td>
                    <td className="tabular px-2 py-1.5 text-right">{r.itemId ? r.onHand : '—'}</td>
                    <td className="tabular px-2 py-1.5 text-right">{r.reserved || '—'}</td>
                    <td className="tabular px-2 py-1.5 text-right">{r.onOrder || '—'}</td>
                    <td className={`tabular px-4 py-1.5 text-right font-semibold ${r.short ? 'text-fdr-red' : 'text-ok'}`}>{r.short || '✓'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
