'use client';

import { useState, useEffect } from 'react';
import WeekCalendar from '@/components/WeekCalendar';
import DayTimeline from '@/components/DayTimeline';
import RestDaysCalendar from '@/components/RestDaysCalendar';
import PaidLeaveManager from '@/components/PaidLeaveManager';
import LeaveRequestsManager from '@/components/LeaveRequestsManager';
import EmployeePlanning from '@/components/EmployeePlanning';
import TimeclockManager from '@/components/TimeclockManager';
import { DEPARTMENTS } from '@/types';
import clsx from 'clsx';

type View = 'week' | 'day' | 'rest' | 'leaves' | 'requests' | 'timeclock' | 'myplan';

const DEPT_TABS = [
  { value: '', label: 'Tous', color: 'slate' },
  { value: 'Gestion Clientèle', label: 'Clientèle', color: 'celadon' },
  { value: 'Gestion Riad', label: 'Riad', color: 'purple' },
] as const;

export default function DashboardPage() {
  const [view, setView] = useState<View>('week');
  const [department, setDepartment] = useState<string>('');
  const [pendingCount, setPendingCount] = useState(0);
  const [employeeToken, setEmployeeToken] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/planning/requests?status=pending').then(r => r.ok ? r.json() : []),
      fetch('/api/auth/me').then(r => r.ok ? r.json() : { employeeToken: null }),
    ]).then(([rows, me]: [unknown[], { employeeToken?: string | null }]) => {
      setPendingCount(rows.length);
      if (me.employeeToken) setEmployeeToken(me.employeeToken);
    }).catch(() => {});
  }, [view]);

  const showDeptBar = view !== 'leaves' && view !== 'requests' && view !== 'timeclock' && view !== 'myplan';

  return (
    <div>
      {/* ── Tab bar ──────────────────────────────────────────────────────────
          Outer div owns the scroll boundary. Inner div is min-w-max so it
          never shrinks — the key fix for mobile. Scrollbar is hidden
          visually but functional (swipe gesture works on iOS/Android). */}
      <div className="border-b border-slate-200 bg-white overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max px-2 sm:px-4">

          <ViewTab
            label="Semaine" fullLabel="Vue semaine"
            icon={<WeekIcon />}
            active={view === 'week'}
            onClick={() => setView('week')}
          />
          <ViewTab
            label="Timeline"
            icon={<DayIcon />}
            active={view === 'day'}
            onClick={() => setView('day')}
          />
          <ViewTab
            label="Repos" fullLabel="Jours de repos"
            icon={<RestIcon />}
            active={view === 'rest'}
            onClick={() => setView('rest')}
          />
          <ViewTab
            label="Congés"
            icon={<LeaveIcon />}
            active={view === 'leaves'}
            onClick={() => setView('leaves')}
          />
          <ViewTab
            label="Pointages"
            icon={<ClockIcon />}
            active={view === 'timeclock'}
            onClick={() => setView('timeclock')}
          />
          <ViewTab
            label="Demandes"
            icon={<RequestIcon />}
            active={view === 'requests'}
            onClick={() => setView('requests')}
            badge={pendingCount}
          />
          {employeeToken && (
            <ViewTab
              label="Moi" fullLabel="Mon planning"
              icon={<UserIcon />}
              active={view === 'myplan'}
              onClick={() => setView('myplan')}
            />
          )}

        </div>
      </div>

      {/* ── Department filter bar ─────────────────────────────────────────── */}
      {showDeptBar && (
        <div className="bg-slate-50 border-b border-slate-200 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 min-w-max px-4 py-2">
            <span className="text-xs text-slate-400 font-medium mr-1 flex-shrink-0">Département :</span>
            {DEPT_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setDepartment(tab.value)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border flex-shrink-0',
                  department === tab.value
                    ? tab.color === 'celadon'
                      ? 'bg-celadon-500 text-white border-celadon-500'
                      : tab.color === 'purple'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'week'     && <WeekCalendar department={department || undefined} />}
      {view === 'day'      && <DayTimeline department={department || undefined} />}
      {view === 'rest'     && <RestDaysCalendar department={department || undefined} />}
      {view === 'leaves'   && <PaidLeaveManager />}
      {view === 'requests' && <LeaveRequestsManager />}
      {view === 'timeclock' && <TimeclockManager />}
      {view === 'myplan'   && employeeToken && <EmployeePlanning token={employeeToken} embedded />}
    </div>
  );
}

// ── ViewTab ────────────────────────────────────────────────────────────────
// `label`     = texte affiché sur mobile (court)
// `fullLabel` = texte affiché sur desktop sm+ (optionnel, sinon = label)
function ViewTab({
  label, fullLabel, icon, active, onClick, badge,
}: {
  label: string;
  fullLabel?: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 relative',
        active
          ? 'border-taupe text-taupe'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      )}
    >
      {icon}
      {fullLabel ? (
        <>
          <span className="sm:hidden">{label}</span>
          <span className="hidden sm:inline">{fullLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex-shrink-0">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────
function WeekIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function DayIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function RestIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}
function LeaveIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
function RequestIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function EmpIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
