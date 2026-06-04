'use client';

import { useState, useEffect } from 'react';
import type { MonthStats } from '@/types';

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function MonthStatsPanel({ year, month }: { year: number; month: number }) {
  const [stats, setStats] = useState<MonthStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/planning?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); });
  }, [year, month]);

  if (loading) {
    return <div className="card p-4 mb-4 text-sm text-slate-500 animate-pulse">Calcul des heures...</div>;
  }

  return (
    <div className="card p-4 mb-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Heures — {MONTHS_FR[month - 1]} {year}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.employee.id} className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.employee.color }}
              />
              <span className="text-xs font-medium text-slate-700 truncate">{s.employee.name}</span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {s.totalHours % 1 === 0 ? `${s.totalHours}h` : `${s.totalHours.toFixed(1)}h`}
            </div>
            <div className="text-xs text-slate-500">ce mois</div>
          </div>
        ))}
      </div>
    </div>
  );
}
