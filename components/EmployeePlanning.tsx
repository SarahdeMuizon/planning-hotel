'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, startOfWeek, addWeeks, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Employee, DaySchedule, LeaveType } from '@/types';
import { DAYS_FR } from '@/types';
import clsx from 'clsx';

interface LeaveRequest {
  id: number;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

const STATUS_LABEL = { pending: 'En attente', approved: 'Approuvé', rejected: 'Refusé' };
const STATUS_CLS = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface PlanningData {
  employee: Employee;
  schedule: Record<string, DaySchedule>;
  totalHours: number;
  year: number;
  month: number;
}

export default function EmployeePlanning({ token, embedded = false }: { token: string; embedded?: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Leave requests state
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqType, setReqType] = useState<LeaveType>('cp');
  const [reqStart, setReqStart] = useState('');
  const [reqEnd, setReqEnd] = useState('');
  const [reqComment, setReqComment] = useState('');
  const [reqSaving, setReqSaving] = useState(false);
  const [reqError, setReqError] = useState('');
  const [reqSuccess, setReqSuccess] = useState(false);

  const loadRequests = useCallback(async () => {
    const res = await fetch(`/api/employee/${token}/leave-requests`);
    if (res.ok) setRequests(await res.json());
  }, [token]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/employee/${token}?year=${year}&month=${month}`)
      .then(async (res) => {
        if (!res.ok) { setError('Lien invalide ou expiré.'); setLoading(false); return; }
        setData(await res.json());
        setLoading(false);
      })
      .catch(() => { setError('Erreur de connexion.'); setLoading(false); });
  }, [token, year, month]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function handleSubmitRequest() {
    setReqError('');
    if (!reqStart || !reqEnd) { setReqError('Veuillez renseigner les dates.'); return; }
    if (reqStart > reqEnd) { setReqError('La date de début doit être avant la date de fin.'); return; }
    setReqSaving(true);
    const res = await fetch(`/api/employee/${token}/leave-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leaveType: reqType, startDate: reqStart, endDate: reqEnd, comment: reqComment || null }),
    });
    setReqSaving(false);
    if (res.ok) {
      setReqSuccess(true);
      setShowRequestForm(false);
      setReqStart(''); setReqEnd(''); setReqComment('');
      await loadRequests();
      setTimeout(() => setReqSuccess(false), 4000);
    } else {
      const d = await res.json();
      setReqError(d.error || 'Erreur lors de la soumission.');
    }
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  if (loading) {
    return (
      <div className={embedded ? 'py-16 text-center text-slate-400 text-sm' : 'min-h-screen bg-slate-50 flex items-center justify-center'}>
        <div className="text-slate-400 text-sm">Chargement...</div>
      </div>
    );
  }

  if (error || !data) {
    if (embedded) return <div className="py-10 text-center text-red-400 text-sm">{error}</div>;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-6 text-center max-w-sm">
          <div className="text-red-500 text-lg mb-2">Lien invalide</div>
          <p className="text-slate-500 text-sm">{error || "Ce lien de planning n'existe pas."}</p>
        </div>
      </div>
    );
  }

  const { employee, schedule, totalHours } = data;

  // Build calendar grid
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start with empty cells (Mon = 0)
  const startPad = (getDay(monthStart) + 6) % 7;

  // Calculate weekly hours
  const weeklyHours: Record<string, number> = {};
  for (const [dateStr, day] of Object.entries(schedule)) {
    const weekKey = format(startOfWeek(new Date(dateStr + 'T00:00:00'), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    weeklyHours[weekKey] = (weeklyHours[weekKey] || 0) + day.hours;
  }

  // Current week key
  const currentWeekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const thisWeekHours = weeklyHours[currentWeekKey] || 0;

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {/* Header — hidden when embedded in EmployeeDashboard */}
      {!embedded && (
        <div className="bg-slate-900 text-white px-4 py-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center gap-3 mb-1">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: employee.color }}
              >
                {employee.name[0].toUpperCase()}
              </span>
              <div>
                <h1 className="font-semibold text-base">{employee.name}</h1>
                <p className="text-blue-300 text-xs">Mon planning</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-slate-900">
              {thisWeekHours % 1 === 0 ? `${thisWeekHours}h` : `${thisWeekHours.toFixed(1)}h`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Cette semaine</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-slate-900">
              {totalHours % 1 === 0 ? `${totalHours}h` : `${totalHours.toFixed(1)}h`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{MONTHS_FR[month - 1]}</div>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="btn-secondary p-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-base font-semibold text-slate-800">
            {MONTHS_FR[month - 1]} {year}
          </h2>
          <button onClick={nextMonth} className="btn-secondary p-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar grid */}
        <div className="card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-slate-800">
            {DAYS_FR.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-slate-300 py-2">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Padding */}
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}

            {days.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const day = schedule[dateStr];
              const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
              const isLeave = day?.is_leave ?? false;
              const isWorking = day && !day.is_off && !isLeave;

              return (
                <div
                  key={dateStr}
                  className={clsx(
                    'p-1 min-h-[60px] border-t border-l border-slate-100 first:border-l-0',
                    isToday && 'bg-blue-50',
                  )}
                >
                  <div className={clsx(
                    'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                    isToday ? 'bg-blue-600 text-white' : 'text-slate-500'
                  )}>
                    {format(date, 'd')}
                  </div>
                  {isLeave ? (
                    <div className={`rounded text-[10px] px-1 py-0.5 leading-tight font-medium text-center ${
                      day.leave_type === 'cm' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {day.leave_type === 'cm' ? 'CM' : 'CP'}
                    </div>
                  ) : isWorking ? (
                    <div
                      className="rounded text-white text-[10px] px-1 py-0.5 leading-tight"
                      style={{ backgroundColor: employee.color }}
                    >
                      <div>{day.start_time?.slice(0, 5)}</div>
                      <div className="opacity-80">{day.end_time?.slice(0, 5)}</div>
                      {day.start_time2 && day.end_time2 && (
                        <>
                          <div className="border-t border-white/30 my-0.5" />
                          <div>{day.start_time2.slice(0, 5)}</div>
                          <div className="opacity-80">{day.end_time2.slice(0, 5)}</div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-300 text-center mt-1">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* This month detail list */}
        <div className="card divide-y divide-slate-100">
          <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
            Détail du mois
          </div>
          {days
            .filter((date) => {
              const day = schedule[format(date, 'yyyy-MM-dd')];
              return day && (!day.is_off || day.is_leave);
            })
            .map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const day = schedule[dateStr];
              const hours = day?.hours || 0;

              return (
                <div key={dateStr} className="flex items-center px-4 py-2.5 gap-3">
                  <div className="w-16 flex-shrink-0">
                    <div className="text-sm font-medium text-slate-800 capitalize">
                      {format(date, 'EEE', { locale: fr })}
                    </div>
                    <div className="text-xs text-slate-400">
                      {format(date, 'd MMM', { locale: fr })}
                    </div>
                  </div>
                  {day?.is_leave ? (
                    <div className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
                      day.leave_type === 'cm' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {day.leave_type === 'cm' ? 'Congé maladie' : 'Congés payés'}
                    </div>
                  ) : (
                    <div
                      className="flex-1 rounded-lg px-3 py-1.5 text-white text-sm font-medium"
                      style={{ backgroundColor: employee.color }}
                    >
                      <div>{day?.start_time?.slice(0, 5)} – {day?.end_time?.slice(0, 5)}</div>
                      {day?.start_time2 && day?.end_time2 && (
                        <div className="text-xs opacity-85 mt-0.5">
                          {day.start_time2.slice(0, 5)} – {day.end_time2.slice(0, 5)}
                        </div>
                      )}
                      {day?.note && <span className="text-xs opacity-80">({day.note})</span>}
                    </div>
                  )}
                  <div className="text-sm font-semibold text-slate-600 w-10 text-right">
                    {hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`}
                  </div>
                </div>
              );
            })}
        </div>

      </div>

      {/* ── Leave request section ─────────────────────────────────────── */}
      <div className="space-y-3">

        {reqSuccess && (
          <div className="card px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
            Demande envoyée, en attente de validation.
          </div>
        )}

        {/* CTA button */}
        {!showRequestForm && (
          <button
            onClick={() => setShowRequestForm(true)}
            className="w-full card px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors border-dashed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Faire une demande de congé
          </button>
        )}

        {/* Request form */}
        {showRequestForm && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Nouvelle demande de congé</h3>
              <button onClick={() => setShowRequestForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Type */}
            <div className="flex gap-2">
              {(['cp', 'cm'] as LeaveType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setReqType(t)}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-xs font-medium border transition-colors',
                    reqType === t
                      ? t === 'cp' ? 'bg-green-600 text-white border-green-600' : 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-slate-600 border-slate-200'
                  )}
                >
                  {t === 'cp' ? 'Congés payés' : 'Congé maladie'}
                </button>
              ))}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Du</label>
                <input type="date" value={reqStart} onChange={e => setReqStart(e.target.value)} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Au</label>
                <input type="date" value={reqEnd} min={reqStart || undefined} onChange={e => setReqEnd(e.target.value)} className="input-field text-sm" />
              </div>
            </div>

            {reqStart && reqEnd && reqStart <= reqEnd && (
              <p className="text-xs text-slate-500">
                {differenceInCalendarDays(new Date(reqEnd + 'T00:00:00'), new Date(reqStart + 'T00:00:00')) + 1} jour(s)
              </p>
            )}

            {/* Comment */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Commentaire (optionnel)</label>
              <input
                type="text"
                value={reqComment}
                onChange={e => setReqComment(e.target.value)}
                className="input-field text-sm"
                placeholder="Motif, précisions..."
              />
            </div>

            {reqError && <p className="text-xs text-red-500">{reqError}</p>}

            <button onClick={handleSubmitRequest} disabled={reqSaving} className="btn-primary w-full text-sm">
              {reqSaving ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </div>
        )}

        {/* My requests */}
        {requests.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Mes demandes
            </div>
            <div className="divide-y divide-slate-100">
              {requests.map(req => (
                <div key={req.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded',
                          req.leave_type === 'cm' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        )}>
                          {req.leave_type.toUpperCase()}
                        </span>
                        <span className="text-sm text-slate-700">
                          {format(new Date(req.start_date + 'T00:00:00'), 'd MMM', { locale: fr })} →{' '}
                          {format(new Date(req.end_date + 'T00:00:00'), 'd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                      {req.comment && (
                        <p className="text-xs text-slate-400 mt-0.5 italic">"{req.comment}"</p>
                      )}
                      {req.rejection_reason && (
                        <p className="text-xs text-red-500 mt-0.5">Motif : {req.rejection_reason}</p>
                      )}
                    </div>
                    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0', STATUS_CLS[req.status])}>
                      {STATUS_LABEL[req.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
