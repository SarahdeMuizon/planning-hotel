'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, addDays, getMonth, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { EmployeeWeek, Employee } from '@/types';
import { DAYS_FR } from '@/types';
import ScheduleModal from './ScheduleModal';
import MonthStatsPanel from './MonthStatsPanel';
import clsx from 'clsx';
import { openPrintWindow } from '@/lib/print';
import { isOvernightShift } from '@/lib/schedule';

export default function WeekCalendar({
  department,
  readOnly = false,
  fetchToken,
}: {
  department?: string;
  readOnly?: boolean;
  fetchToken?: string;
}) {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [schedules, setSchedules] = useState<EmployeeWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [modalData, setModalData] = useState<{
    employee: Employee;
    date: string;
    dayOfWeek: number;
  } | null>(null);

  const fetchSchedules = useCallback(async (date: Date) => {
    setLoading(true);
    const startStr = format(date, 'yyyy-MM-dd');
    const tokenParam = fetchToken ? `&employeeToken=${fetchToken}` : '';
    const res = await fetch(`/api/planning?startDate=${startStr}${tokenParam}`);
    if (res.ok) {
      const data = await res.json();
      setSchedules(data);
    }
    setLoading(false);
  }, [fetchToken]);

  useEffect(() => {
    fetchSchedules(weekStart);
  }, [weekStart, fetchSchedules]);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function openModal(employee: Employee, date: string, dayOfWeek: number) {
    setModalData({ employee, date, dayOfWeek });
  }

  function handleModalClose(refreshed: boolean) {
    setModalData(null);
    if (refreshed) fetchSchedules(weekStart);
  }

  const weekLabel = `${format(weekStart, 'd MMM', { locale: fr })} – ${format(addDays(weekStart, 6), 'd MMM yyyy', { locale: fr })}`;

  const visible = department
    ? schedules.filter((s) => s.employee.department === department)
    : schedules;

  function handleExportPDF() {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const headerCells = weekDates.map((date, i) => {
      const ds = format(date, 'yyyy-MM-dd');
      const cls = ds === todayStr ? 'th-today' : '';
      return `<th class="${cls}">${DAYS_FR[i]}<br/>${format(date, 'd/MM')}</th>`;
    }).join('');

    const bodyRows = visible.map((row) => {
      const dayCells = weekDates.map((date) => {
        const ds = format(date, 'yyyy-MM-dd');
        const day = row.days[ds];
        if (day?.is_leave) {
          const isCM = day.leave_type === 'cm';
          return `<td style="background-color:${isCM ? '#ffedd5' : '#dcfce7'};color:${isCM ? '#c2410c' : '#15803d'};font-weight:600;">${isCM ? 'Congé maladie' : 'Congés payés'}</td>`;
        }
        const isWorking = day && !day.is_off;
        if (isWorking) {
          const bg = row.employee.color + '28';
          const slot2 = day.start_time2 && day.end_time2
            ? `<br/><span style="opacity:.7">${day.start_time2.slice(0,5)}–${day.end_time2.slice(0,5)}</span>`
            : '';
          return `<td style="background-color:${bg};color:${row.employee.color};font-weight:600;">`
            + `${day.start_time?.slice(0, 5)}<br/>${day.end_time?.slice(0, 5)}${slot2}`
            + `</td>`;
        }
        return `<td class="cell-rest">Repos</td>`;
      }).join('');

      const hrs = row.totalHours % 1 === 0 ? `${row.totalHours}h` : `${row.totalHours.toFixed(1)}h`;
      return `<tr>
        <td class="td-name"><span style="color:${row.employee.color};margin-right:4px">●</span>${row.employee.name}</td>
        ${dayCells}
        <td class="cell-total">${hrs}</td>
      </tr>`;
    }).join('');

    const html = `<table>
      <thead><tr>
        <th class="th-name">Employé</th>${headerCells}<th>Total</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;

    openPrintWindow(
      `Planning — Semaine du ${weekLabel}`,
      department || 'Tous les départements',
      html
    );
  }

  return (
    <div className="p-4 max-w-screen-xl mx-auto">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="btn-secondary p-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="btn-secondary px-3 py-2 text-sm"
          >
            Aujourd'hui
          </button>
          <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="btn-secondary p-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-slate-700 ml-1 capitalize">{weekLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className={clsx('btn-secondary text-sm', showStats && 'bg-celadon-100 border-celadon-300 text-celadon-700')}
          >
            Stats du mois
          </button>
          <button onClick={handleExportPDF} disabled={loading || visible.length === 0} className="btn-secondary text-sm flex items-center gap-1.5">
            <PdfIcon />
            PDF
          </button>
        </div>
      </div>

      {/* Month stats panel */}
      {showStats && (
        <MonthStatsPanel year={getYear(weekStart)} month={getMonth(weekStart) + 1} />
      )}

      {/* Calendar grid */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-celadon-500 text-white">
                <th className="py-3 px-3 text-left text-sm font-medium w-32 sticky left-0 bg-celadon-500 z-10">
                  Employé
                </th>
                {weekDates.map((date, i) => {
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <th
                      key={i}
                      className={clsx(
                        'py-3 px-2 text-center text-sm font-medium',
                        isToday && 'bg-taupe'
                      )}
                    >
                      <div>{DAYS_FR[i]}</div>
                      <div className="text-xs font-normal opacity-80">
                        {format(date, 'd/MM')}
                      </div>
                    </th>
                  );
                })}
                <th className="py-3 px-3 text-center text-sm font-medium w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    Chargement...
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    {schedules.length === 0 ? (
                      <>Aucun employé.{' '}<a href="/manager/dashboard/employes" className="text-celadon-600 underline">Ajouter des employés</a></>
                    ) : (
                      <>Aucun employé dans ce département.</>
                    )}
                  </td>
                </tr>
              ) : (
                visible.map((row, rowIdx) => (
                  <tr
                    key={row.employee.id}
                    className={clsx('border-t border-slate-100', rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50')}
                  >
                    {/* Employee name */}
                    <td className={clsx(
                      'py-2 px-3 sticky left-0 z-10',
                      rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    )}>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: row.employee.color }}
                        />
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[90px]">
                          {row.employee.name}
                        </span>
                      </div>
                    </td>

                    {/* Days */}
                    {weekDates.map((date, dayIdx) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const day = row.days[dateStr];
                      const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                      const isLeave = day?.is_leave ?? false;
                      const leaveType = day?.leave_type ?? null;
                      const isWorking = day && !day.is_off;

                      return (
                        <td
                          key={dayIdx}
                          className={clsx(
                            'py-1 px-1 text-center',
                            isToday && 'ring-1 ring-inset ring-taupe-light'
                          )}
                        >
                          <button
                            onClick={() => !isLeave && !readOnly && openModal(row.employee, dateStr, dayIdx)}
                            className={clsx(
                              'w-full rounded-lg py-1.5 px-1 text-xs transition-all',
                              isLeave
                                ? leaveType === 'cm'
                                  ? 'bg-orange-100 text-orange-800 font-medium cursor-default'
                                  : 'bg-green-100 text-green-800 font-medium cursor-default'
                                : readOnly
                                ? isWorking
                                  ? 'text-slate-800 font-medium shadow-sm cursor-default'
                                  : 'bg-slate-100 text-slate-400 cursor-default'
                                : isWorking
                                ? 'text-slate-800 font-medium shadow-sm hover:scale-105 hover:shadow-sm'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:scale-105'
                            )}
                            style={isWorking && !isLeave ? { backgroundColor: row.employee.color } : undefined}
                          >
                            {isLeave ? (
                              <span className={leaveType === 'cm' ? 'text-orange-700' : 'text-green-700'}>
                                {leaveType === 'cm' ? 'Congé maladie' : 'Congés payés'}
                              </span>
                            ) : isWorking ? (
                              <>
                                {isOvernightShift(day.start_time, day.end_time) && (
                                  <div className="text-[9px] opacity-90 -mb-0.5">🌙</div>
                                )}
                                <div>{day.start_time?.slice(0, 5)}</div>
                                <div className="opacity-80">{day.end_time?.slice(0, 5)}</div>
                                {day.start_time2 && day.end_time2 && (
                                  <>
                                    <div className="border-t border-slate-600/20 my-0.5" />
                                    <div className="text-[10px] opacity-90">{day.start_time2.slice(0, 5)}</div>
                                    <div className="text-[10px] opacity-70">{day.end_time2.slice(0, 5)}</div>
                                  </>
                                )}
                              </>
                            ) : (
                              <span>Repos</span>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Weekly total */}
                    <td className="py-2 px-3 text-center">
                      <span className="text-sm font-semibold text-slate-700">
                        {row.totalHours % 1 === 0
                          ? `${row.totalHours}h`
                          : `${row.totalHours.toFixed(1)}h`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-green-200" /> Congés payés (CP)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-orange-200" /> Congé maladie (CM)
          </span>
          {!readOnly && <span>Cliquer sur une case pour modifier</span>}
        </div>
      </div>

      {/* Schedule edit modal — manager/admin only */}
      {!readOnly && modalData && (
        <ScheduleModal
          employee={modalData.employee}
          date={modalData.date}
          dayOfWeek={modalData.dayOfWeek}
          currentSchedule={
            schedules
              .find((s) => s.employee.id === modalData.employee.id)
              ?.days[modalData.date] ?? null
          }
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}

function PdfIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
