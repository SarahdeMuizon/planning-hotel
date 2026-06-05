'use client';

import { useState, useEffect } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Employee, LeaveType } from '@/types';

interface LeaveRow {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_color: string;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  note: string | null;
}

const LEAVE_LABELS: Record<LeaveType, string> = {
  cp: 'Congés payés',
  cm: 'Congé maladie',
};
const LEAVE_COLORS: Record<LeaveType, { bg: string; text: string; badge: string }> = {
  cp: { bg: 'bg-green-50',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700' },
  cm: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
};

function fmtDate(d: string) {
  return format(new Date(d + 'T00:00:00'), 'd MMM yyyy', { locale: fr });
}
function nbDays(start: string, end: string) {
  return differenceInCalendarDays(new Date(end + 'T00:00:00'), new Date(start + 'T00:00:00')) + 1;
}

export default function PaidLeaveManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form state
  const [employeeId, setEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('cp');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  async function load() {
    const [empRes, leaveRes] = await Promise.all([
      fetch('/api/employes'),
      fetch('/api/planning/leaves'),
    ]);
    if (empRes.ok) setEmployees(await empRes.json());
    if (leaveRes.ok) setLeaves(await leaveRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    setFormError('');
    if (!employeeId || !startDate || !endDate) {
      setFormError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (startDate > endDate) {
      setFormError('La date de début doit être avant ou égale à la date de fin.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/planning/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: Number(employeeId), leaveType, startDate, endDate, note: note || null }),
    });
    setSaving(false);
    if (res.ok) {
      setEmployeeId(''); setStartDate(''); setEndDate(''); setNote('');
      await load();
    } else {
      const data = await res.json();
      setFormError(data.error || "Erreur lors de l'ajout.");
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    await fetch(`/api/planning/leaves?id=${id}`, { method: 'DELETE' });
    setDeletingId(null);
    setLeaves(prev => prev.filter(l => l.id !== id));
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [...new Set(leaves.map(l => l.start_date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  if (!years.includes(String(currentYear))) years.unshift(String(currentYear));

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">

      {/* Add form */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Ajouter une période de congé</h2>

        <div className="space-y-3">
          {/* Type de congé */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type de congé *</label>
            <div className="flex gap-2">
              {(['cp', 'cm'] as LeaveType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setLeaveType(t)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    leaveType === t
                      ? t === 'cp'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {LEAVE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Employee */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Employé *</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="input-field"
            >
              <option value="">— Sélectionner un employé</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date de début *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date de fin *</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={e => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {startDate && endDate && startDate <= endDate && (
            <p className="text-xs text-slate-500">
              Durée : <span className="font-medium">{nbDays(startDate, endDate)} jour{nbDays(startDate, endDate) > 1 ? 's' : ''}</span>
            </p>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Note (optionnel)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="input-field"
              placeholder={leaveType === 'cp' ? "Ex: congés d'été, RTT..." : "Ex: arrêt maladie, hospitalisation..."}
            />
          </div>

          {formError && <p className="text-xs text-red-500">{formError}</p>}

          <button onClick={handleAdd} disabled={saving} className="btn-primary w-full">
            {saving ? 'Enregistrement...' : 'Ajouter'}
          </button>
        </div>
      </div>

      {/* Existing leaves */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Congés enregistrés</h2>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Chargement...</div>
        ) : leaves.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Aucun congé enregistré.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {years.map(year => {
              const yearLeaves = leaves.filter(l => l.start_date.startsWith(year));
              if (yearLeaves.length === 0) return null;
              return (
                <div key={year}>
                  <div className="px-4 py-1.5 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    {year}
                  </div>
                  {yearLeaves.map(leave => {
                    const lt = (leave.leave_type || 'cp') as LeaveType;
                    const colors = LEAVE_COLORS[lt];
                    return (
                      <div key={leave.id} className="flex items-center gap-3 px-4 py-3">
                        <span
                          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-slate-800 text-xs font-bold"
                          style={{ backgroundColor: leave.employee_color }}
                        >
                          {leave.employee_name[0].toUpperCase()}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{leave.employee_name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.badge}`}>
                              {lt.toUpperCase()}
                            </span>
                          </div>
                          <div className={`text-xs font-medium ${colors.text}`}>
                            {fmtDate(leave.start_date)} → {fmtDate(leave.end_date)}
                            <span className="ml-2 text-slate-400">({nbDays(leave.start_date, leave.end_date)} j.)</span>
                          </div>
                          {leave.note && (
                            <div className="text-xs text-slate-400 truncate">{leave.note}</div>
                          )}
                        </div>

                        <button
                          onClick={() => handleDelete(leave.id)}
                          disabled={deletingId === leave.id}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                          title="Supprimer"
                        >
                          {deletingId === leave.id ? (
                            <span className="text-xs text-slate-300">...</span>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
