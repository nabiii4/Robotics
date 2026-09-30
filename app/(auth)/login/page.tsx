import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { AuthShell } from '../AuthShell';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect('/');
  const sp = await searchParams;
  return <AuthShell><LoginForm next={sp.next} /></AuthShell>;
}
