import { redirect } from 'next/navigation';
import { getManagerSession } from '@/lib/auth';

export default async function Home() {
  const session = await getManagerSession();
  if (session) {
    redirect('/manager/dashboard');
  }
  redirect('/manager');
}
