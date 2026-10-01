'use client';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ClientError } from '@/lib/client/api';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/bits';
import { toast } from '../ui/Toast';

export interface Comp { id: string; name: string; shortName: string; startDate: string; endDate: string | null; location: string | null; program: string; url: string | null; notes?: string | null; isTarget: boolean }

export function CompetitionDialog({ open, onClose, comp, onSaved }: { open: boolean; onClose: () => void; comp?: Comp | null; onSaved?: (id: string) => void }) {
  const qc = useQueryClient();
  const blank = { name: '', shortName: '', startDate: '', endDate: '', location: '', program: 'V5RC', url: '', notes: '' };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(comp ? { name: comp.name, shortName: comp.shortName, startDate: comp.startDate, endDate: comp.endDate ?? '', location: comp.location ?? '', program: comp.program, url: comp.url ?? '', notes: comp.notes ?? '' } : blank); }, [open, comp]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const body = { ...f, endDate: f.endDate || null, location: f.location || null, url: f.url || null, notes: f.notes || null };
    try {
      let id = comp?.id;
      if (comp) await api.patch(`/api/competitions/${comp.id}`, body); else id = (await api.post<{ id: string }>('/api/competitions', body)).id;
      qc.invalidateQueries({ queryKey: ['competitions'] }); qc.invalidateQueries({ queryKey: ['competition'] }); toast.ok(comp ? 'Saved' : 'Event added'); onSaved?.(id!); onClose();
    } catch (e) { toast.error('Could not save', (e as ClientError).message); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={comp ? 'Edit event' : 'Add competition'} width={560}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.name.trim() || !f.shortName.trim() || !f.startDate} onClick={save}>{comp ? 'Save' : 'Add event'}</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Event name"><input autoFocus className="input" maxLength={120} value={f.name} onChange={set('name')} placeholder="Brooklyn VEX Robotics Tournament" /></Field></div>
        <Field label="Short name"><input className="input" maxLength={40} value={f.shortName} onChange={set('shortName')} placeholder="Brooklyn Qualifier" /></Field>
        <Field label="Program"><select className="input" value={f.program} onChange={set('program')}><option value="V5RC">V5RC</option><option value="VEXU">VEX U</option><option value="VAIRC">VEX AI</option></select></Field>
        <Field label="Start date"><input className="input" type="date" value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="End date (optional)"><input className="input" type="date" value={f.endDate} onChange={set('endDate')} /></Field>
        <div className="col-span-2"><Field label="Venue"><input className="input" maxLength={160} value={f.location} onChange={set('location')} /></Field></div>
        <div className="col-span-2"><Field label="RobotEvents URL"><input className="input" maxLength={300} value={f.url} onChange={set('url')} placeholder="https://www.robotevents.com/robot-competitions/vex-robotics-competition/RE-V5RC-…" /></Field></div>
        <div className="col-span-2"><Field label="Notes"><textarea className="input min-h-[70px]" maxLength={2000} value={f.notes} onChange={set('notes')} /></Field></div>
      </div>
    </Dialog>
  );
}
