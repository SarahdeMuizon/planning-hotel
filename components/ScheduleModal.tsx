'use client';

import { useState } from 'react';
import type { Employee, DaySchedule } from '@/types';
import { DAYS_FULL_FR } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  employee: Employee;
  date: string;
  dayOfWeek: number;
  currentSchedule: DaySchedule | null;
  onClose: (refreshed: boolean) => void;
}

type EditMode = 'exception' | 'template';

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function calcSlotHours(start: string, end: string): number {
  const s = toMins(start), e = toMins(end);
  return (e >= s ? e - s : 24 * 60 - s + e) / 60;
}
function fmtDuration(hrs: number) {
  const m = Math.round(hrs * 60);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

export default function ScheduleModal({ employee, date, dayOfWeek, currentSchedule, onClose }: Props) {
  const [mode, setMode] = useState<EditMode>('exception');
  const [isOff, setIsOff] = useState(currentSchedule?.is_off ?? true);

  // Créneau 1
  const [startTime, setStartTime] = useState(currentSchedule?.start_time || '08:00');
  const [endTime, setEndTime] = useState(currentSchedule?.end_time || '16:00');

  // Créneau 2
  const [hasSlot2, setHasSlot2] = useState(!!(currentSchedule?.start_time2));
  const [startTime2, setStartTime2] = useState(currentSchedule?.start_time2 || '14:00');
  const [endTime2, setEndTime2] = useState(currentSchedule?.end_time2 || '18:00');

  const [note, setNote] = useState(currentSchedule?.note || '');
  const [saving, setSaving] = useState(false);

  const dateLabel = format(new Date(date + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: fr });

  const totalHours = isOff ? 0
    : calcSlotHours(startTime, endTime) + (hasSlot2 ? calcSlotHours(startTime2, endTime2) : 0);

  async function handleSave() {
    setSaving(true);
    const slot2 = hasSlot2 && !isOff ? { startTime2, endTime2 } : { startTime2: null, endTime2: null };

    if (mode === 'exception') {
      await fetch('/api/planning/exceptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          date,
          startTime: isOff ? null : startTime,
          endTime: isOff ? null : endTime,
          ...slot2,
          note: note || null,
        }),
      });
    } else {
      await fetch('/api/planning/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id,
          dayOfWeek,
          startTime: isOff ? null : startTime,
          endTime: isOff ? null : endTime,
          ...slot2,
        }),
      });
    }

    setSaving(false);
    onClose(true);
  }

  async function handleDeleteException() {
    setSaving(true);
    await fetch(
      `/api/planning/exceptions?employeeId=${employee.id}&date=${date}`,
      { method: 'DELETE' }
    );
    setSaving(false);
    onClose(true);
  }

  function SlotRow({
    label, start, end, onStart, onEnd,
  }: {
    label: string;
    start: string; end: string;
    onStart: (v: string) => void; onEnd: (v: string) => void;
  }) {
    const overnight = toMins(end) < toMins(start);
    const hrs = calcSlotHours(start, end);
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-600">{label}</span>
          <span className="text-xs text-slate-500">
            {fmtDuration(hrs)}
            {overnight && <span className="ml-1 text-indigo-500">🌙</span>}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Début</label>
            <select value={start} onChange={(e) => onStart(e.target.value)} className="input-field">
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Fin</label>
            <select value={end} onChange={(e) => onEnd(e.target.value)} className="input-field">
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900 text-base">Modifier le planning</h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: employee.color }}
              />
              <span className="text-sm text-slate-600">{employee.name}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{dateLabel}</p>
          </div>
          <button onClick={() => onClose(false)} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-4 text-sm">
          <button
            onClick={() => setMode('exception')}
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === 'exception' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Ce jour uniquement
          </button>
          <button
            onClick={() => setMode('template')}
            className={`flex-1 py-2 font-medium transition-colors border-l border-slate-200 ${
              mode === 'template' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Tous les {DAYS_FULL_FR[dayOfWeek]}s
          </button>
        </div>

        {mode === 'template' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
            Cette modification s'appliquera à tous les {DAYS_FULL_FR[dayOfWeek]}s dans le modèle récurrent.
          </div>
        )}

        {/* Day off toggle */}
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg">
          <span className="text-sm font-medium text-slate-700">Jour de repos</span>
          <button
            onClick={() => setIsOff(!isOff)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isOff ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                isOff ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Time pickers */}
        {!isOff && (
          <>
            <SlotRow
              label="Créneau 1"
              start={startTime} end={endTime}
              onStart={setStartTime} onEnd={setEndTime}
            />

            {hasSlot2 ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 border-t border-dashed border-slate-200" />
                  <span className="text-xs text-slate-400">coupure</span>
                  <div className="flex-1 border-t border-dashed border-slate-200" />
                </div>
                <div className="relative">
                  <SlotRow
                    label="Créneau 2"
                    start={startTime2} end={endTime2}
                    onStart={setStartTime2} onEnd={setEndTime2}
                  />
                  <button
                    onClick={() => setHasSlot2(false)}
                    className="absolute top-0 right-0 text-[10px] text-red-400 hover:text-red-600"
                    title="Supprimer le 2ème créneau"
                  >
                    ✕ Supprimer
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setHasSlot2(true)}
                className="w-full border border-dashed border-slate-300 rounded-lg py-2 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors mb-3"
              >
                + Ajouter un 2ème créneau
              </button>
            )}

            {/* Total duration */}
            <div className="text-center text-sm text-slate-600 mb-4">
              Total :{' '}
              <span className="font-semibold text-slate-800">
                {totalHours > 0 ? fmtDuration(totalHours) : '—'}
              </span>
            </div>
          </>
        )}

        {/* Note (only for exception) */}
        {mode === 'exception' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Note (optionnel)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field"
              placeholder="Ex: congé maladie, formation..."
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => onClose(false)} className="btn-secondary flex-1">
            Annuler
          </button>
          {mode === 'exception' && currentSchedule?.is_exception && (
            <button
              onClick={handleDeleteException}
              disabled={saving}
              className="btn-danger px-3"
              title="Supprimer l'exception (revenir au modèle)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
