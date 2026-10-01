'use client';
import { useEffect, useRef, useState } from 'react';
import { DownloadSimple, Plugs, PlugsConnected, Trash, X } from '@phosphor-icons/react';
import { useBrain } from '@/lib/client/stores';
import { downloadBlob } from '@/lib/client/api';
import { Drawer } from '../ui/Dialog';
import { Switch } from '../ui/Switch';
import { toast } from '../ui/Toast';

/** Serial console body — used in the drawer and in the Code IDE bottom panel (spec §18.7). */
export function SerialConsole({ dark = true }: { dark?: boolean }) {
  const { status, lines, portLabel, binaryWarning, connect, disconnect, clear, send } = useBrain();
  const [auto, setAuto] = useState(true);
  const [stamps, setStamps] = useState(false);
  const [input, setInput] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (auto && box.current) box.current.scrollTop = box.current.scrollHeight; }, [lines, auto]);
  const doConnect = async () => { try { await connect(); } catch (e) { toast.error('Could not open the port', (e as Error).message); } };
  const save = () => downloadBlob(new Blob([lines.map((l) => `${new Date(l.t).toISOString()}  ${l.text}`).join('\n')], { type: 'text/plain' }), `brain-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`);
  const tone = dark ? 'bg-code-bg text-[#D4D4D4]' : 'bg-white text-ink-900';
  return (
    <div className={`flex h-full min-h-0 flex-col ${tone}`}>
      <div className={`flex flex-wrap items-center gap-2 border-b px-3 py-2 ${dark ? 'border-white/10' : 'border-line'}`}>
        {status === 'connected'
          ? <button onClick={disconnect} className="btn btn-dark h-8 text-[12.5px]"><PlugsConnected size={15} />Disconnect</button>
          : <button onClick={doConnect} disabled={status === 'unsupported' || status === 'connecting'} className="btn btn-primary h-8 text-[12.5px]"><Plugs size={15} />{status === 'connecting' ? 'Connecting…' : 'Connect Brain'}</button>}
        <span className={`truncate text-[12px] ${dark ? 'text-white/60' : 'text-ink-500'}`}>{status === 'connected' ? `${portLabel} · 115200 baud` : status === 'unsupported' ? 'Web Serial needs Chrome or Edge on a computer' : 'Not connected'}</span>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <label className="flex items-center gap-1.5"><Switch checked={auto} onCheckedChange={setAuto} label="Autoscroll" />Autoscroll</label>
          <label className="flex items-center gap-1.5"><Switch checked={stamps} onCheckedChange={setStamps} label="Timestamps" />Time</label>
          <button onClick={clear} aria-label="Clear" className={`rounded p-1 ${dark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}><Trash size={15} /></button>
          <button onClick={save} disabled={!lines.length} aria-label="Save log" className={`rounded p-1 disabled:opacity-40 ${dark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}><DownloadSimple size={15} /></button>
        </div>
      </div>
      {binaryWarning && <div className="bg-[#5C4400] px-3 py-1.5 text-[12px] text-[#FFE7A3]">This looks like binary data — you may be on the Brain’s <b>Communications</b> port. Disconnect and pick the <b>User</b> port instead.</div>}
      <div ref={box} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-[18px]" role="log" aria-live="polite">
        {lines.length === 0 ? (
          <div className={dark ? 'text-white/40' : 'text-ink-400'}>
            {status === 'connected' ? 'Waiting for output… print with printf("…\\n") or Brain.Screen in your code.' : 'Plug the V5 Brain (or controller) into this computer with USB, then click Connect Brain and choose the “User” port.'}
          </div>
        ) : lines.map((l, i) => <div key={i} className="whitespace-pre-wrap break-all">{stamps && <span className="mr-2 text-[#6A9955]">{new Date(l.t).toLocaleTimeString()}</span>}{l.text}</div>)}
      </div>
      {status === 'connected' && (
        <form className={`flex gap-2 border-t px-3 py-2 ${dark ? 'border-white/10' : 'border-line'}`} onSubmit={(e) => { e.preventDefault(); if (input) { send(input); setInput(''); } }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Send to the Brain…" className={`h-8 flex-1 rounded-[6px] px-2 font-mono text-[12px] outline-none ${dark ? 'bg-white/10 text-white placeholder:text-white/40' : 'input'}`} />
          <button className="btn btn-dark h-8 text-[12px]">Send</button>
        </form>
      )}
    </div>
  );
}

export function SerialConsoleDrawer() {
  const { consoleOpen, setConsole } = useBrain();
  return (
    <Drawer open={consoleOpen} onOpenChange={setConsole} title="VEX Brain — Serial Console" width={560}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="text-[15px] font-bold text-ink-900">VEX Brain — Serial Console</div>
          <div className="text-[12px] text-ink-500">Live output from your robot over USB</div>
        </div>
        <button aria-label="Close" onClick={() => setConsole(false)} className="rounded-md p-1.5 text-ink-500 hover:bg-[#F3F4F6] hover:text-ink-900"><X size={18} /></button>
      </div>
      <div className="min-h-0 flex-1"><SerialConsole /></div>
    </Drawer>
  );
}
