import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { AuthShell } from '../AuthShell';
import { JoinForm } from './JoinForm';

export const dynamic = 'force-dynamic';
export default async function JoinPage() {
  if (await currentUser()) redirect('/');
  return <AuthShell><JoinForm /></AuthShell>;
}
