import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { AuthShell } from '../AuthShell';
import { JoinForm } from './JoinForm';

export default async function JoinPage() {
  if (process.env.NEXT_PUBLIC_LOCAL_MODE !== '1' && (await currentUser())) redirect('/');
  return <AuthShell><JoinForm /></AuthShell>;
}
