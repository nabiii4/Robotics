'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client/api';
import { useBrain } from '@/lib/client/stores';
import { ChromeA } from './ChromeA';
import { ChromeB } from './ChromeB';
import { MentorDrawer } from '../mentor/MentorDrawer';
import { NewBuildDialog } from '../builds/NewBuildDialog';
import { SendToPrinterDialog } from '../printer/SendToPrinterDialog';
import { ReadinessDialog } from '../dashboard/ReadinessDialog';
import { SerialConsoleDrawer } from '../code/SerialConsole';

export interface Me {
  id: string; username: string; displayName: string; avatarText: string | null; avatarColor: string; role: 'admin' | 'captain' | 'member';
  teamRole: string; grade: string | null; bio: string | null; mustChangePassword: boolean; skills: string[];
  prefs: { layout?: 'a' | 'b' | 'auto'; quality?: 'low' | 'medium' | 'high'; reduceMotion?: boolean; replyLength?: 'concise' | 'detailed'; memoryEnabled?: boolean; mentorPanelOpen?: boolean; notif?: Record<string, boolean> };
}
interface Ctx { me: Me; layout: 'a' | 'b'; setMe: (m: Me) => void; savePrefs: (p: Partial<Me['prefs']>) => Promise<void>; aiMode: AiMode }
export interface AiMode { configured: boolean; demo: boolean; targets: string[] }
const MeCtx = createContext<Ctx | null>(null);
export const useMe = () => { const c = useContext(MeCtx); if (!c) throw new Error('useMe outside AppShell'); return c; };

function useWidth() {
  const [w, setW] = useState<number>(typeof window === 'undefined' ? 1672 : window.innerWidth);
  useEffect(() => { const on = () => setW(window.innerWidth); on(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  return w;
}

export function AppShell({ me: initial, aiMode, children }: { me: Me; aiMode: AiMode; children: React.ReactNode }) {
  const [me, setMe] = useState(initial);
  const width = useWidth();
  const qc = useQueryClient();
  const pref = me.prefs.layout ?? 'b';
  const layout: 'a' | 'b' = pref === 'auto' ? (width >= 1600 ? 'a' : 'b') : pref;
  const init = useBrain((s) => s.init);
  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    document.body.dataset.layout = layout;
    document.body.classList.toggle('reduce-motion', !!me.prefs.reduceMotion);
  }, [layout, me.prefs.reduceMotion]);
  const ctx = useMemo<Ctx>(() => ({
    me, layout, setMe, aiMode,
    savePrefs: async (p) => {
      const r = await api.patch<{ user: Me }>('/api/me', { prefs: p });
      setMe(r.user);
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  }), [me, layout, qc, aiMode]);
  const Chrome = layout === 'a' ? ChromeA : ChromeB;
  return (
    <MeCtx.Provider value={ctx}>
      <Chrome>{children}</Chrome>
      <MentorDrawer />
      <NewBuildDialog />
      <SendToPrinterDialog />
      <ReadinessDialog />
      <SerialConsoleDrawer />
    </MeCtx.Provider>
  );
}
