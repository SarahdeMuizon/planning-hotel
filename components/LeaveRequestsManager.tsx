'use client';

import { useState, useEffect } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { LeaveType } from '@/types';
import clsx from 'clsx';

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_color: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  certificate_data: string | null;
  certificate_name: string | null;
}

function CertificateBlock({ data, name }: { data: string; name: string | null }) {
  const isImage = data.startsWith('data:image');
  return (
    <div className="mt-2">
      {isImage ? (
        <button
          onClick={() => window.open(data, '_blank')}
          className="block group relative"
          title="Voir en grand"
        >
          <img
            src={data}
            alt="Certificat médical"
            className="max-h-28 rounded-lg border border-orange-200 object-cover shadow-sm group-hover:opacity-90 transition-opacity"
          />
          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-lg text-white text-xs font-medium transition-opacity">
            Agrandir
          </span>
        </button>
      ) : null}
      <button
        onClick={() => {
          const link = document.createElement('a');
          link.href = data;
          link.download = name || 'certificat';
          link.click();
        }}
        className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-800 mt-1.5 font-medium"
      >
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        {name || 'certificat_medical'}
      </button>
    </div>
  );
}

const TYPE_LABELS: Record<LeaveType, string> = { cp: 'Congés payés', cm: 'Congé maladie' };
const TYPE_COLORS: Record<LeaveType, string> = { cp: 'bg-green-100 text-green-700', cm: 'bg-orange-100 text-orange-700' };

function fmtDate(d: string) {
  return format(new Date(d + 'T00:00:00'), 'd MMM yyyy', { locale: fr });
}
function nbDays(start: string, end: string) {
  return differenceInCalendarDays(new Date(end + 'T00:00:00'), new Date(start + 'T00:00:00')) + 1;
}

export default function LeaveRequestsManager() {
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    setLoading(true);
    const [pendingRes, allRes] = await Promise.all([
      fetch('/api/planning/requests?status=pending'),
      fetch('/api/planning/requests?status=all'),
    ]);
    if (pendingRes.ok) setPending(await pendingRes.json());
    if (allRes.ok) {
      const all: LeaveRequest[] = await allRes.json();
      setHistory(all.filter(r => r.status !== 'pending'));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: number) {
    setProcessingId(id);
    await fetch('/api/planning/requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'approve' }),
    });
    setProcessingId(null);
    await load();
  }

  async function handleReject(id: number) {
    setProcessingId(id);
    await fetch('/api/planning/requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reject', rejectionReason: rejectReason || null }),
    });
    setProcessingId(null);
    setRejectingId(null);
    setRejectReason('');
    await load();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">

      {/* Pending section */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Demandes en attente</h2>
            {!loading && pending.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {pending.length}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Chargement...</div>
        ) : pending.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Aucune demande en attente.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pending.map(req => (
              <div key={req.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-slate-800 text-xs font-bold mt-0.5"
                    style={{ backgroundColor: req.employee_color }}
                  >
                    {req.employee_name[0].toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{req.employee_name}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[req.leave_type]}`}>
                        {TYPE_LABELS[req.leave_type]}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5">
                      {fmtDate(req.start_date)} → {fmtDate(req.end_date)}
                      <span className="ml-2 text-xs text-slate-400">({nbDays(req.start_date, req.end_date)} j.)</span>
                    </div>
                    {req.comment && (
                      <div className="text-xs text-slate-500 mt-1 italic">"{req.comment}"</div>
                    )}
                    {req.leave_type === 'cm' && req.certificate_data && (
                      <CertificateBlock data={req.certificate_data} name={req.certificate_name} />
                    )}
                    {req.leave_type === 'cm' && !req.certificate_data && (
                      <p className="text-[10px] text-slate-400 mt-1 italic">Aucun certificat joint</p>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">
                      Soumis le {format(new Date(req.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                    </div>

                    {/* Reject form */}
                    {rejectingId === req.id ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          className="input-field text-sm"
                          placeholder="Motif du refus (optionnel)"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={processingId === req.id}
                            className="btn-danger text-xs px-3 py-1.5"
                          >
                            {processingId === req.id ? '...' : 'Confirmer le refus'}
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="btn-secondary text-xs px-3 py-1.5"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={processingId === req.id}
                          className="btn-primary text-xs px-4 py-1.5"
                        >
                          {processingId === req.id ? '...' : 'Approuver'}
                        </button>
                        <button
                          onClick={() => setRejectingId(req.id)}
                          disabled={processingId === req.id}
                          className="btn-secondary text-xs px-4 py-1.5 text-red-600 hover:bg-red-50 hover:border-red-200"
                        >
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History section */}
      {!loading && history.length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-left"
          >
            <span className="text-sm font-semibold text-slate-800">
              Historique ({history.length})
            </span>
            <svg className={clsx('w-4 h-4 text-slate-400 transition-transform', showHistory && 'rotate-180')}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showHistory && (
            <div className="divide-y divide-slate-100">
              {history.map(req => (
                <div key={req.id} className="px-4 py-3 flex items-start gap-3">
                  <span
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-slate-800 text-[10px] font-bold mt-0.5"
                    style={{ backgroundColor: req.employee_color }}
                  >
                    {req.employee_name[0].toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-700">{req.employee_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLORS[req.leave_type]}`}>
                        {req.leave_type.toUpperCase()}
                      </span>
                      <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded', {
                        'bg-green-100 text-green-700': req.status === 'approved',
                        'bg-red-100 text-red-700': req.status === 'rejected',
                      })}>
                        {req.status === 'approved' ? 'Approuvé' : 'Refusé'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {fmtDate(req.start_date)} → {fmtDate(req.end_date)}
                    </div>
                    {req.rejection_reason && (
                      <div className="text-xs text-red-500 mt-0.5">Motif : {req.rejection_reason}</div>
                    )}
                    {req.leave_type === 'cm' && req.certificate_data && (
                      <CertificateBlock data={req.certificate_data} name={req.certificate_name} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
