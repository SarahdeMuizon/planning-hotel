'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addDays, subDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { EmployeeWeek } from '@/types';
import clsx from 'clsx';

interface TimeclockRow {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_color: string;
  date: string;
  type: 'arrival' | 'departure';
  clocked_at: string;
}

interface EmployeeTimeclock {
  employee_id: number;
  employee_name: string;
  employee_color: string;
  arrival: string | null;
  departure: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  arrivalDiff: number | null;
  departureDiff: number | null;
}

function toMins(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function diffLabel(planned: string | null, actual: string | null): { text: string; cls: string } | null {
  const p = toMins(planned), a = toMins(actual);
  if (p === null || a === null) return null;
  const diff = a - p;
  const abs = Math.abs(diff);
  const text = diff === 0 ? 'À l\'heure' : diff > 0 ? `+${diff} min` : `${diff} min`;
  const cls = abs <= 5 ? 'text-green-600' : abs <= 15 ? 'text-orange-500' : 'text-red-600';
  return { text, cls };
}

function fmtDate(d: Date) {
  return format(d, 'EEEE d MMMM yyyy', { locale: fr });
}

export default function TimeclockManager() {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<TimeclockRow[]>([]);
  const [schedules, setSchedules] = useState<EmployeeWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async (date: string) => {
    setLoading(true);
    const weekStart = startOfWeek(new Date(date + 'T00:00:00'), { weekStartsOn: 1 });
    const [tcRes, schedRes] = await Promise.all([
      fetch(`/api/planning/timeclock?date=${date}`),
      fetch(`/api/planning?startDate=${format(weekStart, 'yyyy-MM-dd')}`),
    ]);
    if (tcRes.ok) setEntries(await tcRes.json());
    if (schedRes.ok) setSchedules(await schedRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(selectedDate); }, [selectedDate, load]);

  async function handleDelete(id: number) {
    setDeletingId(id);
    await fetch(`/api/planning/timeclock?id=${id}`, { method: 'DELETE' });
    setDeletingId(null);
    load(selectedDate);
  }

  // Build merged rows: one per employee who has either a schedule or a timeclock entry
  const merged: EmployeeTimeclock[] = (() => {
    const map = new Map<number, EmployeeTimeclock>();

    // Add from schedule
    for (const row of schedules) {
      const day = row.days[selectedDate];
      if (!day || day.is_off) continue;
      map.set(row.employee.id, {
        employee_id: row.employee.id,
        employee_name: row.employee.name,
        employee_color: row.employee.color,
        arrival: null,
        departure: null,
        scheduledStart: day.start_time,
        scheduledEnd: day.end_time,
        arrivalDiff: null,
        departureDiff: null,
      });
    }

    // Add timeclock entries
    for (const e of entries) {
      if (!map.has(e.employee_id)) {
        map.set(e.employee_id, {
          employee_id: e.employee_id,
          employee_name: e.employee_name,
          employee_color: e.employee_color,
          arrival: null, departure: null,
          scheduledStart: null, scheduledEnd: null,
          arrivalDiff: null, departureDiff: null,
        });
      }
      const m = map.get(e.employee_id)!;
      if (e.type === 'arrival') m.arrival = e.clocked_at;
      if (e.type === 'departure') m.departure = e.clocked_at;
    }

    // Compute diffs
    for (const row of map.values()) {
      const ad = diffLabel(row.scheduledStart, row.arrival);
      const dd = diffLabel(row.scheduledEnd, row.departure);
      row.arrivalDiff = ad ? toMins(row.arrival)! - toMins(row.scheduledStart)! : null;
      row.departureDiff = dd ? toMins(row.departure)! - toMins(row.scheduledEnd)! : null;
    }

    return Array.from(map.values()).sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  })();

  const date = new Date(selectedDate + 'T00:00:00');

  return (
    <div className="p-4 max-w-screen-xl mx-auto">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => setSelectedDate(format(subDays(date, 1), 'yyyy-MM-dd'))} className="btn-secondary p-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))} className="btn-secondary px-3 py-2 text-sm">
          Aujourd'hui
        </button>
        <button onClick={() => setSelectedDate(format(addDays(date, 1), 'yyyy-MM-dd'))} className="btn-secondary p-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-slate-700 ml-1 capitalize">{fmtDate(date)}</span>
        <div className="ml-auto">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="input-field text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-slate-800 text-white text-sm">
                <th className="py-3 px-4 text-left font-medium sticky left-0 bg-slate-800 w-36">Employé</th>
                <th className="py-3 px-3 text-center font-medium text-slate-300 w-24">Prévu arrivée</th>
                <th className="py-3 px-3 text-center font-medium w-24">Arrivée</th>
                <th className="py-3 px-3 text-center font-medium text-slate-300 w-20">Écart</th>
                <th className="py-3 px-3 text-center font-medium text-slate-300 w-24">Prévu départ</th>
                <th className="py-3 px-3 text-center font-medium w-24">Départ</th>
                <th className="py-3 px-3 text-center font-medium text-slate-300 w-20">Écart</th>
                <th className="py-3 px-3 text-center font-medium text-slate-400 w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">Chargement...</td>
                </tr>
              ) : merged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                    Aucun pointage ni planning ce jour.
                  </td>
                </tr>
              ) : (
                merged.map((row, i) => {
                  const arrDiff = diffLabel(row.scheduledStart, row.arrival);
                  const depDiff = diffLabel(row.scheduledEnd, row.departure);
                  const arrivalEntry = entries.find(e => e.employee_id === row.employee_id && e.type === 'arrival');
                  const depEntry = entries.find(e => e.employee_id === row.employee_id && e.type === 'departure');
                  return (
                    <tr key={row.employee_id} className={clsx('border-t border-slate-100', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                      <td className={clsx('py-3 px-4 sticky left-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: row.employee_color }}>
                            {row.employee_name[0].toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-slate-800 truncate max-w-[100px]">{row.employee_name}</span>
                        </div>
                      </td>
                      {/* Planned start */}
                      <td className="px-3 py-3 text-center text-sm text-slate-400">
                        {row.scheduledStart ?? '—'}
                      </td>
                      {/* Actual arrival */}
                      <td className="px-3 py-3 text-center">
                        {row.arrival ? (
                          <span className="text-sm font-semibold text-slate-800">{row.arrival}</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      {/* Arrival diff */}
                      <td className="px-3 py-3 text-center">
                        {arrDiff ? (
                          <span className={clsx('text-xs font-semibold', arrDiff.cls)}>{arrDiff.text}</span>
                        ) : <span className="text-slate-200 text-xs">—</span>}
                      </td>
                      {/* Planned end */}
                      <td className="px-3 py-3 text-center text-sm text-slate-400">
                        {row.scheduledEnd ?? '—'}
                      </td>
                      {/* Actual departure */}
                      <td className="px-3 py-3 text-center">
                        {row.departure ? (
                          <span className="text-sm font-semibold text-slate-800">{row.departure}</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      {/* Departure diff */}
                      <td className="px-3 py-3 text-center">
                        {depDiff ? (
                          <span className={clsx('text-xs font-semibold', depDiff.cls)}>{depDiff.text}</span>
                        ) : <span className="text-slate-200 text-xs">—</span>}
                      </td>
                      {/* Delete buttons */}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {arrivalEntry && (
                            <button
                              onClick={() => handleDelete(arrivalEntry.id)}
                              disabled={deletingId === arrivalEntry.id}
                              title="Supprimer arrivée"
                              className="text-[10px] text-slate-300 hover:text-red-500 px-1"
                            >
                              {deletingId === arrivalEntry.id ? '...' : '✕A'}
                            </button>
                          )}
                          {depEntry && (
                            <button
                              onClick={() => handleDelete(depEntry.id)}
                              disabled={deletingId === depEntry.id}
                              title="Supprimer départ"
                              className="text-[10px] text-slate-300 hover:text-red-500 px-1"
                            >
                              {deletingId === depEntry.id ? '...' : '✕D'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        {!loading && merged.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex flex-wrap gap-4">
            <span className="text-green-600 font-medium">À l'heure (≤5 min)</span>
            <span className="text-orange-500 font-medium">Léger retard (5–15 min)</span>
            <span className="text-red-600 font-medium">Retard (&gt;15 min)</span>
            <span>Valeur négative = en avance</span>
          </div>
        )}
      </div>
    </div>
  );
}
