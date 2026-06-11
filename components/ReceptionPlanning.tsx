'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, startOfMonth, getDaysInMonth, getDay, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import clsx from 'clsx';

const SLOTS: string[] = [];
for (let h = 7; h <= 22; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`);
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface Assignment {
  id: number;
  week_start: string;
  day_of_week: number;
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

interface ClosedSlot {
  day_of_week: number;
  slot: string;
}

function getWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export default function ReceptionPlanning({ readOnly = false }: { readOnly?: boolean }) {
  const [weekDate, setWeekDate] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekStart = getWeekStart(weekDate);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [closedCells, setClosedCells] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(() => startOfMonth(new Date()));

  const load = useCallback(async (ws: string) => {
    setLoading(true);
    const res = await fetch(`/api/planning/reception?weekStart=${ws}`);
    if (res.ok) {
      const data = await res.json();
      setAssignments(data.assignments);
      setEmployees(data.employees);
      setClosedCells(new Set(
        (data.closedSlots as ClosedSlot[]).map(c => `${c.day_of_week}-${c.slot}`)
      ));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(weekStart); }, [weekStart, load]);

  function cellAssignments(dayOfWeek: number, slot: string): Assignment[] {
    return assignments.filter(a => a.day_of_week === dayOfWeek && a.slot === slot);
  }

  async function addEmployee(dayOfWeek: number, slot: string, employeeId: number) {
    const key = `${dayOfWeek}-${slot}`;
    setSaving(key);
    await fetch('/api/planning/reception', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart, slot, dayOfWeek, employeeId }),
    });
    await load(weekStart);
    setSaving(null);
  }

  async function removeAssignment(id: number) {
    await fetch(`/api/planning/reception?id=${id}`, { method: 'DELETE' });
    setAssignments(prev => prev.filter(a => a.id !== id));
  }

  async function toggleClosed(dayOfWeek: number, slot: string) {
    const key = `${dayOfWeek}-${slot}`;
    if (closedCells.has(key)) {
      await fetch(
        `/api/planning/reception/closed?weekStart=${weekStart}&dayOfWeek=${dayOfWeek}&slot=${encodeURIComponent(slot)}`,
        { method: 'DELETE' }
      );
      setClosedCells(prev => { const next = new Set(prev); next.delete(key); return next; });
    } else {
      await fetch('/api/planning/reception/closed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, dayOfWeek, slot }),
      });
      setClosedCells(prev => new Set([...prev, key]));
    }
  }

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

  const weekEnd = addDays(weekDate, 6);
  const weekLabel = `${format(weekDate, 'd MMM', { locale: fr })} – ${format(weekEnd, 'd MMM yyyy', { locale: fr })}`;
  const weekDates = DAYS.map((_, i) => addDays(weekDate, i));

  return (
    <div className="p-4">
      {/* Toolbar */}
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
          <div className="relative ml-1">
            <button
              onClick={() => { setPickerMonth(startOfMonth(weekDate)); setShowPicker(p => !p); }}
              className="text-sm font-medium text-slate-700 hover:text-celadon-600 transition-colors capitalize flex items-center gap-1"
            >
              {weekLabel}
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showPicker && (
              <div
                className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-64"
                onMouseLeave={() => setShowPicker(false)}
              >
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => setPickerMonth(m => subMonths(m, 1))} className="p-1 hover:bg-slate-100 rounded transition-colors">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-sm font-semibold text-slate-700 capitalize">
                    {format(pickerMonth, 'MMMM yyyy', { locale: fr })}
                  </span>
                  <button onClick={() => setPickerMonth(m => addMonths(m, 1))} className="p-1 hover:bg-slate-100 rounded transition-colors">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {['L','M','M','J','V','S','D'].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-medium text-slate-400 py-0.5">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px">
                  {(() => {
                    const firstDow = (getDay(pickerMonth) + 6) % 7;
                    const total = getDaysInMonth(pickerMonth);
                    const wkEndStr = format(addDays(weekDate, 6), 'yyyy-MM-dd');
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    const cells: React.ReactNode[] = [];
                    for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`} />);
                    for (let d = 1; d <= total; d++) {
                      const date = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), d);
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const inWeek = dateStr >= weekStart && dateStr <= wkEndStr;
                      const isT = dateStr === todayStr;
                      cells.push(
                        <button
                          key={d}
                          onClick={() => { setWeekDate(startOfWeek(date, { weekStartsOn: 1 })); setShowPicker(false); }}
                          className={clsx(
                            'text-xs rounded py-1 w-full transition-colors',
                            inWeek
                              ? 'bg-celadon-500 text-white font-semibold'
                              : isT
                              ? 'bg-taupe text-white font-semibold'
                              : 'hover:bg-slate-100 text-slate-700'
                          )}
                        >
                          {d}
                        </button>
                      );
                    }
                    return cells;
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {!readOnly && (
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
        )}
      </div>

      {!readOnly && copyMsg && (
        <div className="mb-3 text-sm px-3 py-2 rounded-lg bg-celadon-50 border border-celadon-200 text-celadon-700">
          {copyMsg}
        </div>
      )}

      {/* Grille 7 jours × créneaux horaires */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Chargement…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 z-10 bg-slate-50 w-14 px-2 py-2 text-left text-slate-500 font-medium border-r border-slate-200 text-[11px]">
                  Heure
                </th>
                {DAYS.map((day, i) => (
                  <th
                    key={i}
                    className={clsx(
                      'min-w-[120px] px-2 py-2 text-center font-semibold text-slate-600 border-r border-slate-100 last:border-r-0',
                      i === 5 && 'border-l-2 border-slate-300'
                    )}
                    style={i === 5 ? { borderRight: 'none' } : i === 6 ? { borderRight: '2px solid #cbd5e1' } : undefined}
                  >
                    <div>{day}</div>
                    <div className="text-[10px] font-normal text-slate-400">
                      {format(weekDates[i], 'd MMM', { locale: fr })}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SLOTS.map(slot => (
                <tr key={slot} className="hover:bg-slate-50/50 transition-colors">
                  <td className="sticky left-0 z-10 bg-white w-14 px-2 py-2 text-slate-600 font-semibold border-r border-slate-200 text-center align-top pt-2.5 text-[11px]">
                    {slot}
                  </td>
                  {DAYS.map((_, dayIdx) => {
                    const cellKey = `${dayIdx}-${slot}`;
                    const isClosed = closedCells.has(cellKey);
                    const asgns = cellAssignments(dayIdx, slot);
                    const assignedIds = new Set(asgns.map(a => a.employee_id));
                    const available = employees.filter(e => !assignedIds.has(e.id));
                    const isSaving = saving === cellKey;

                    return (
                      <td
                        key={dayIdx}
                        className={clsx(
                          'px-1.5 py-1.5 align-top border-r border-slate-100 last:border-r-0',
                          isClosed && 'bg-red-50',
                          dayIdx === 5 && 'border-l-2 border-slate-300'
                        )}
                        style={dayIdx === 5 ? { borderRight: 'none' } : dayIdx === 6 ? { borderRight: '2px solid #cbd5e1' } : undefined}
                      >
                        {isClosed ? (
                          readOnly ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600">
                              Fermé
                            </span>
                          ) : (
                            <button
                              onClick={() => toggleClosed(dayIdx, slot)}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                              title="Cliquer pour rouvrir"
                            >
                              Fermé ×
                            </button>
                          )
                        ) : (
                          <div className="flex flex-wrap gap-1 min-h-[22px] items-start">
                            {asgns.map(a => (
                              <span
                                key={a.id}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-800"
                                style={{ backgroundColor: a.employee_color }}
                              >
                                {a.employee_name.split(' ')[0]}
                                {!readOnly && (
                                  <button
                                    onClick={() => removeAssignment(a.id)}
                                    className="opacity-40 hover:opacity-100 leading-none text-slate-700 ml-0.5"
                                    title="Retirer"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            ))}
                            {!readOnly && available.length > 0 && (
                              <select
                                defaultValue=""
                                disabled={isSaving}
                                onChange={e => {
                                  const id = Number(e.target.value);
                                  if (id) { addEmployee(dayIdx, slot, id); e.target.value = ''; }
                                }}
                                className="text-[10px] border border-dashed border-slate-300 rounded-full px-1.5 py-0.5 text-slate-400 bg-white cursor-pointer hover:border-celadon-400 hover:text-celadon-600 appearance-none transition-colors focus:outline-none disabled:opacity-50"
                              >
                                <option value="" disabled>+</option>
                                {available.map(emp => (
                                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                              </select>
                            )}
                            {!readOnly && (
                              <button
                                onClick={() => toggleClosed(dayIdx, slot)}
                                className="text-[10px] text-red-300 hover:text-red-600 border border-dashed border-red-200 hover:border-red-400 rounded-full px-1.5 py-0.5 transition-colors"
                                title="Fermer ce créneau"
                              >
                                Fermé
                              </button>
                            )}
                            {readOnly && asgns.length === 0 && (
                              <span className="text-[10px] text-slate-300">—</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
