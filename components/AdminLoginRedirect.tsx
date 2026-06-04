'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginRedirect({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/employee/${token}/admin-login`, { method: 'POST' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => router.replace('/manager/dashboard'))
      .catch(() => router.replace(`/planning/${token}?error=1`));
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-300 text-sm">Connexion en cours...</p>
      </div>
    </div>
  );
}
