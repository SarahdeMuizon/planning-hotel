import Link from 'next/link';
import Image from 'next/image';
import { getManagerSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getManagerSession();
  if (!session) redirect('/manager');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/manager/dashboard" className="flex items-center gap-2 font-semibold text-white hover:text-celadon-300 transition-colors">
              <Image src="/logo-riad.png" alt="Riad Anyssates" width={28} height={28} className="object-contain" />
              Riad Anyssates
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link href="/manager/dashboard" className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                Calendrier
              </Link>
              <Link href="/manager/dashboard/employes" className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
                Employés
              </Link>
            </nav>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
