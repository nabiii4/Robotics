import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { AuthShell } from '../AuthShell';
import { LoginForm } from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // the GitHub Pages build is a static export: no server session to check, and the form reads ?next= itself
  if (process.env.NEXT_PUBLIC_LOCAL_MODE === '1') return <AuthShell><LoginForm /></AuthShell>;
  if (await currentUser()) redirect('/');
  const sp = await searchParams;
  return <AuthShell><LoginForm next={sp.next} /></AuthShell>;
}
