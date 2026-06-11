'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

// Créneaux horaires de 07:00 à 23:00, par heure
const SLOTS: string[] = [];
for (let h = 7; h <= 23; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`);
}

interface Assignment {
  id: number;
  week_start: string;
  slot: string;
  employee_id: number;
  employee_name: string;
  employee_color: string;
}

interface Employee {
  id: number;
  name: string;
  color: string;
}

function getWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export default function ReceptionPlanning() {
  const [weekDate, setWeekDate] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekStart = getWeekStart(weekDate);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // slot being saved
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');

  const load = useCallback(async (ws: string) => {
    setLoading(true);
    const res = await fetch(`/api/planning/reception?weekStart=${ws}`);
    if (res.ok) {
      const data = await res.json();
      setAssignments(data.assignments);
      setEmployees(data.employees);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(weekStart); }, [weekStart, load]);

  // Returns assignments for a given slot
  function slotAssignments(slot: string): Assignment[] {
    return assignments.filter(a => a.slot === slot);
  }

  // Add employee to slot
  async function addEmployee(slot: string, employeeId: number) {
    setSaving(slot);
    const res = await fetch('/api/planning/reception', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart, slot, employeeId }),
    });
    if (res.ok) {
      await load(weekStart);
    }
    setSaving(null);
  }

  // Remove assignment
  async function removeAssignment(id: number) {
    await fetch(`/api/planning/reception?id=${id}`, { method: 'DELETE' });
    setAssignments(prev => prev.filter(a => a.id !== id));
  }

  // Copy from previous week
  async function copyFromPrevWeek() {
    setCopying(true);
    setCopyMsg('');
    const res = await fetch('/api/planning/reception', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart }),
    });
    if (res.ok) {
      const data = await res.json();
      setCopyMsg(`${data.copied} créneaux copiés depuis la semaine précédente.`);
      await load(weekStart);
    } else {
      const data = await res.json();
      setCopyMsg(data.error || 'Erreur lors de la copie.');
    }
    setCopying(false);
    setTimeout(() => setCopyMsg(''), 4000);
  }

  // Week label
  const weekEnd = addDays(weekDate, 6);
  const weekLabel = `${format(weekDate, 'd MMM', { locale: fr })} – ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`;

  return (
    <div className="p-4 max-w-2xl mx-auto">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekDate(d => subWeeks(d, 1))} className="btn-secondary p-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setWeekDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="btn-secondary px-3 py-2 text-sm"
          >
            Cette semaine
          </button>
          <button onClick={() => setWeekDate(d => addWeeks(d, 1))} className="btn-secondary p-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-700 ml-1 capitalize">{weekLabel}</span>
        </div>

        <button
          onClick={copyFromPrevWeek}
          disabled={copying}
          className="btn-secondary flex items-center gap-1.5 text-sm"
          title="Copier le planning de la semaine précédente"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copying ? 'Copie…' : 'Copier sem. préc.'}
        </button>
      </div>

      {copyMsg && (
        <div className="mb-3 text-sm px-3 py-2 rounded-lg bg-celadon-50 border border-celadon-200 text-celadon-700">
          {copyMsg}
        </div>
      )}

      {/* ── Tableau des créneaux ── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Chargement…</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {SLOTS.map(slot => {
              const slotAsgns = slotAssignments(slot);
              const isSaving = saving === slot;

              // Employees already assigned to this slot
              const assignedIds = new Set(slotAsgns.map(a => a.employee_id));
              // Available employees (not yet assigned)
              const available = employees.filter(e => !assignedIds.has(e.id));

              return (
                <div key={slot} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  {/* Heure */}
                  <div className="w-14 flex-shrink-0 pt-0.5">
                    <span className="text-sm font-semibold text-slate-600">{slot}</span>
                  </div>

                  {/* Employés assignés */}
                  <div className="flex-1 flex flex-wrap gap-2 min-h-[28px] items-center">
                    {slotAsgns.map(a => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-slate-800 group"
                        style={{ backgroundColor: a.employee_color }}
                      >
                        {a.employee_name.split(' ')[0]}
                        <button
                          onClick={() => removeAssignment(a.id)}
                          className="ml-0.5 opacity-50 hover:opacity-100 text-slate-700 leading-none"
                          title="Retirer"
                        >
                          ×
                        </button>
                      </span>
                    ))}

                    {/* Dropdown pour ajouter un employé */}
                    {available.length > 0 && (
                      <div className="relative">
                        <select
                          defaultValue=""
                          disabled={isSaving}
                          onChange={e => {
                            const id = Number(e.target.value);
                            if (id) { addEmployee(slot, id); e.target.value = ''; }
                          }}
                          className={clsx(
                            'text-xs border border-dashed border-slate-300 rounded-full px-2 py-1',
                            'text-slate-400 bg-white cursor-pointer hover:border-celadon-400 hover:text-celadon-600',
                            'appearance-none transition-colors focus:outline-none focus:border-celadon-400',
                            isSaving && 'opacity-50'
                          )}
                        >
                          <option value="" disabled>+ Ajouter…</option>
                          {available.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {slotAsgns.length === 0 && available.length === 0 && (
                      <span className="text-xs text-slate-300 italic">Aucun employé disponible</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Cliquez sur <strong>+ Ajouter…</strong> pour affecter un employé à un créneau. Plusieurs employés peuvent être assignés au même créneau.
        Utilisez <strong>Copier sem. préc.</strong> pour dupliquer le planning d'une semaine à l'autre.
      </p>
    </div>
  );
}
