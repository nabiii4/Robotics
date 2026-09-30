import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { currentUser } from '@/lib/auth/session';
import { publicUser } from '@/lib/api';
import { aiMode } from '@/lib/ai/config';
import { AppShell, type Me } from '@/components/shell/AppShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const path = (await headers()).get('x-pathname') ?? '';
  if (user.mustChangePassword && !path.startsWith('/settings')) redirect('/settings/security?first=1');
  const mode = aiMode();
  return <AppShell me={publicUser(user) as Me} aiMode={{ configured: mode.configured, demo: mode.demo, targets: user.role === 'admin' ? mode.targets : [] }}>{children}</AppShell>;
}
