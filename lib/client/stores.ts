'use client';
import { create } from 'zustand';

// ---------- Mentor drawer ----------
interface MentorState {
  open: boolean;
  threadId: string | null;
  buildId: string | null;
  pending: { text: string; chipId?: string; codeContext?: { fileId: string } } | null;
  openDrawer: (o?: { message?: string; chipId?: string; threadId?: string | null; buildId?: string | null; codeContext?: { fileId: string } }) => void;
  close: () => void;
  setThread: (id: string | null) => void;
  setBuild: (id: string | null) => void;
  takePending: () => MentorState['pending'];
}
export const useMentor = create<MentorState>((set, get) => ({
  open: false, threadId: null, buildId: null, pending: null,
  openDrawer: (o) => set((s) => ({
    open: true,
    threadId: o?.threadId !== undefined ? o.threadId : o?.message ? s.threadId : s.threadId,
    buildId: o?.buildId !== undefined ? o.buildId : s.buildId,
    pending: o?.message ? { text: o.message, chipId: o.chipId, codeContext: o.codeContext } : s.pending,
  })),
  close: () => set({ open: false }),
  setThread: (id) => set({ threadId: id }),
  setBuild: (id) => set({ buildId: id }),
  takePending: () => { const p = get().pending; set({ pending: null }); return p; },
}));

// ---------- VEX Brain over Web Serial ----------
/* eslint-disable @typescript-eslint/no-explicit-any */
type BrainStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected';
interface BrainState {
  status: BrainStatus;
  lines: { t: number; text: string }[];
  portLabel: string | null;
  binaryWarning: boolean;
  consoleOpen: boolean;
  init: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clear: () => void;
  setConsole: (o: boolean) => void;
  send: (text: string) => Promise<void>;
}
let port: any = null;
let reader: any = null;
let presenceTimer: any = null;

async function presence(label: string | null) {
  try { await fetch('/api/brain/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ portLabel: label }) }); } catch { /* offline */ }
}

export const useBrain = create<BrainState>((set, get) => ({
  status: 'disconnected', lines: [], portLabel: null, binaryWarning: false, consoleOpen: false,
  init: () => {
    if (typeof navigator === 'undefined') return;
    if (!('serial' in navigator)) { set({ status: 'unsupported' }); return; }
    (navigator as any).serial.addEventListener?.('disconnect', () => { if (get().status === 'connected') get().disconnect(); });
  },
  connect: async () => {
    const nav = navigator as any;
    if (!nav.serial) { set({ status: 'unsupported' }); return; }
    set({ status: 'connecting', binaryWarning: false });
    try {
      port = await nav.serial.requestPort({ filters: [{ usbVendorId: 0x2888 }] });
      await port.open({ baudRate: 115200 });
      const info = port.getInfo?.() ?? {};
      const label = `VEX V5 (VID ${Number(info.usbVendorId ?? 0x2888).toString(16)}:${Number(info.usbProductId ?? 0).toString(16)})`;
      set({ status: 'connected', portLabel: label });
      presence(label);
      presenceTimer = setInterval(() => presence(label), 15000);
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable).catch(() => {});
      reader = decoder.readable.getReader();
      let buf = '';
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;
            // unreadable binary → probably the Communications port
            const junk = (value.match(/[\u0000-\u0008\u000e-\u001f�]/g) ?? []).length;
            if (junk > value.length * 0.3) set({ binaryWarning: true });
            buf += value;
            const parts = buf.split(/\r?\n/);
            buf = parts.pop() ?? '';
            if (parts.length) set((s) => ({ lines: [...s.lines, ...parts.map((p) => ({ t: Date.now(), text: p }))].slice(-800) }));
          }
        } catch { /* closed */ }
      })();
    } catch (e) {
      set({ status: 'disconnected' });
      if ((e as Error).name !== 'NotFoundError') throw e;
    }
  },
  disconnect: async () => {
    clearInterval(presenceTimer);
    presence(null);
    try { await reader?.cancel(); } catch { /* ignore */ }
    try { await port?.close(); } catch { /* ignore */ }
    port = null; reader = null;
    set({ status: 'disconnected', portLabel: null });
  },
  clear: () => set({ lines: [] }),
  setConsole: (o) => set({ consoleOpen: o }),
  send: async (text: string) => {
    if (!port?.writable) return;
    const w = port.writable.getWriter();
    await w.write(new TextEncoder().encode(text + '\n'));
    w.releaseLock();
  },
}));

// ---------- dialogs opened from anywhere ----------
interface UIState {
  newBuild: boolean;
  sendToPrinter: { open: boolean; partId?: string; buildId?: string; qty?: number; uploadId?: string };
  readiness: boolean;
  setNewBuild: (o: boolean) => void;
  openSendToPrinter: (o?: { partId?: string; buildId?: string; qty?: number; uploadId?: string }) => void;
  closeSendToPrinter: () => void;
  setReadiness: (o: boolean) => void;
}
export const useUI = create<UIState>((set) => ({
  newBuild: false, sendToPrinter: { open: false }, readiness: false,
  setNewBuild: (o) => set({ newBuild: o }),
  openSendToPrinter: (o) => set({ sendToPrinter: { open: true, ...o } }),
  closeSendToPrinter: () => set({ sendToPrinter: { open: false } }),
  setReadiness: (o) => set({ readiness: o }),
}));
