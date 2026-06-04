'use client';

import { useState, useEffect } from 'react';
import type { Employee, ScheduleTemplate } from '@/types';
import { DAYS_FULL_FR } from '@/types';
import clsx from 'clsx';

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function slotHours(s: string, e: string) {
  const diff = toMins(e) - toMins(s);
  return diff >= 0 ? diff / 60 : (24 * 60 + diff) / 60;
}

interface DayState {
  isWorking: boolean;
  startTime: string;
  endTime: string;
  hasSlot2: boolean;
  startTime2: string;
  endTime2: string;
}

export default function TemplateEditor({ employee }: { employee: Employee }) {
  const [days, setDays] = useState<DayState[]>(
    Array.from({ length: 7 }, () => ({
      isWorking: false,
      startTime: '08:00', endTime: '16:00',
      hasSlot2: false, startTime2: '14:00', endTime2: '18:00',
    }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/planning/templates?employeeId=${employee.id}`)
      .then((r) => r.json())
      .then((templates: ScheduleTemplate[]) => {
        const newDays: DayState[] = Array.from({ length: 7 }, () => ({
          isWorking: false,
          startTime: '08:00', endTime: '16:00',
          hasSlot2: false, startTime2: '14:00', endTime2: '18:00',
        }));
        for (const tpl of templates) {
          if (tpl.day_of_week >= 0 && tpl.day_of_week <= 6) {
            newDays[tpl.day_of_week] = {
              isWorking: !!tpl.start_time,
              startTime: tpl.start_time || '08:00',
              endTime: tpl.end_time || '16:00',
              hasSlot2: !!tpl.start_time2,
              startTime2: tpl.start_time2 || '14:00',
              endTime2: tpl.end_time2 || '18:00',
            };
          }
        }
        setDays(newDays);
        setLoading(false);
      });
  }, [employee.id]);

  function updateDay(i: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await Promise.all(
      days.map((day, i) =>
        fetch('/api/planning/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: employee.id,
            dayOfWeek: i,
            startTime: day.isWorking ? day.startTime : null,
            endTime: day.isWorking ? day.endTime : null,
            startTime2: (day.isWorking && day.hasSlot2) ? day.startTime2 : null,
            endTime2: (day.isWorking && day.hasSlot2) ? day.endTime2 : null,
          }),
        })
      )
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const totalHours = days.reduce((sum, d) => {
    if (!d.isWorking) return sum;
    let h = slotHours(d.startTime, d.endTime);
    if (d.hasSlot2) h += slotHours(d.startTime2, d.endTime2);
    return sum + h;
  }, 0);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: employee.color }}
          >
            {employee.name[0]}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-800">{employee.name}</div>
            <div className="text-xs text-slate-500">Planning type hebdomadaire</div>
          </div>
        </div>
        <span className="text-sm font-bold text-slate-700">
          {totalHours % 1 === 0 ? `${totalHours}h` : `${totalHours.toFixed(1)}h`}/sem.
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-4 text-center">Chargement...</div>
      ) : (
        <div className="space-y-2">
          {days.map((day, i) => (
            <div
              key={i}
              className={clsx(
                'p-2 rounded-lg',
                day.isWorking ? 'bg-blue-50' : 'bg-slate-50'
              )}
            >
              {/* Ligne principale */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-xs font-medium text-slate-600 flex-shrink-0">
                  {DAYS_FULL_FR[i].slice(0, 3)}.
                </span>

                <button
                  onClick={() => updateDay(i, { isWorking: !day.isWorking })}
                  className={clsx(
                    'text-xs px-2 py-1 rounded font-medium transition-colors flex-shrink-0',
                    day.isWorking
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                  )}
                >
                  {day.isWorking ? 'Travail' : 'Repos'}
                </button>

                {day.isWorking && (
                  <>
                    <select
                      value={day.startTime}
                      onChange={(e) => updateDay(i, { startTime: e.target.value })}
                      className="flex-1 text-xs border border-slate-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0"
                    >
                      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-slate-400 text-xs flex-shrink-0">→</span>
                    <select
                      value={day.endTime}
                      onChange={(e) => updateDay(i, { endTime: e.target.value })}
                      className="flex-1 text-xs border border-slate-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0"
                    >
                      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </>
                )}
              </div>

              {/* Créneau 2 */}
              {day.isWorking && (
                day.hasSlot2 ? (
                  <div className="mt-2 pl-[72px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 flex-shrink-0">+ coupure</span>
                      <select
                        value={day.startTime2}
                        onChange={(e) => updateDay(i, { startTime2: e.target.value })}
                        className="flex-1 text-xs border border-slate-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0"
                      >
                        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="text-slate-400 text-xs flex-shrink-0">→</span>
                      <select
                        value={day.endTime2}
                        onChange={(e) => updateDay(i, { endTime2: e.target.value })}
                        className="flex-1 text-xs border border-slate-200 rounded px-1 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0"
                      >
                        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button
                        onClick={() => updateDay(i, { hasSlot2: false })}
                        className="text-[10px] text-red-400 hover:text-red-600 flex-shrink-0"
                        title="Supprimer le 2ème créneau"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 pl-[72px]">
                    <button
                      onClick={() => updateDay(i, { hasSlot2: true })}
                      className="text-[10px] text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      + 2ème créneau
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={clsx('btn-primary text-sm', saved && '!bg-green-600')}
        >
          {saved ? 'Enregistré ✓' : saving ? 'Enregistrement...' : 'Enregistrer le modèle'}
        </button>
      </div>
    </div>
  );
}
