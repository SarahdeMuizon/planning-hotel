'use client';
 
import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, subDays, startOfWeek, subWeeks, getDay, startOfMonth, getDaysInMonth, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { EmployeeWeek, DaySchedule, Employee } from '@/types';
import clsx from 'clsx';
import { openPrintWindow } from '@/lib/print';
import { isOvernightShift, calcHours } from '@/lib/schedule';
 
// ── Timeline spans 06:00 → 22:00 (inclusive) in 30-min slots ──────────────
const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 22) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
 
const OVERNIGHT_CAP = '22:30';
const TIMELINE_START = TIME_SLOTS[0]; // "06:00"
 
// ── VisualShift: one continuous block to render on the timeline ────────────
interface VisualShift {
  start_time: string;
  end_time: string;
  actualStart: string;
  actualEnd: string;
  isOvernightStart: boolean;
  isOvernightEnd: boolean;
  is_exception: boolean;
  hours: number;
  unscheduled?: boolean; // pointé alors que non prévu au planning (ex: repos)
}
 
function makeShift(
  start: string, end: string,
  isException: boolean,
): VisualShift {
  const overnight = isOvernightShift(start, end);
  return {
    start_time: start,
    end_time: overnight ? OVERNIGHT_CAP : end,
    actualStart: start,
    actualEnd: end,
    isOvernightStart: overnight,
    isOvernightEnd: false,
    is_exception: isException,
    hours: calcHours(start, end),
  };
}
 
// Builds a visual block from raw punches on a day with NO scheduled shift
// (e.g. an employee clocking in on a rest day). Spans from the earliest to the
// latest punch, with a minimum 30-min width so a single punch stays visible.
function punchesToUnscheduledShift(times: string[]): VisualShift | null {
  if (times.length === 0) return null;
  const mins = times.map(toMinutes).sort((a, b) => a - b);
  const startMin = mins[0];
  const endMin = Math.max(mins[mins.length - 1], startMin + 30);
  const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const start = toHHMM(startMin);
  const end = toHHMM(endMin);
  return {
    start_time: start,
    end_time: end,
    actualStart: start,
    actualEnd: end,
    isOvernightStart: false,
    isOvernightEnd: false,
    is_exception: false,
    hours: calcHours(start, end),
    unscheduled: true,
  };
}
 
// Returns up to 2 visual shifts for an employee on the selected day.
// If today has no shifts, falls back to yesterday's overnight bleed-in.
function getVisualShifts(
  today: DaySchedule | null,
  yesterday: DaySchedule | null,
): VisualShift[] {
  const shifts: VisualShift[] = [];
 
  if (today && !today.is_off) {
    if (today.start_time && today.end_time) {
      shifts.push(makeShift(today.start_time, today.end_time, today.is_exception));
    }
    if (today.start_time2 && today.end_time2) {
      shifts.push(makeShift(today.start_time2, today.end_time2, today.is_exception));
    }
    if (shifts.length > 0) return shifts;
  }
 
  // Bleed-in from yesterday's overnight shifts
  if (yesterday && !yesterday.is_off) {
    for (const [s, e] of [
      [yesterday.start_time, yesterday.end_time],
      [yesterday.start_time2, yesterday.end_time2],
    ] as [string | null, string | null][]) {
      if (s && e && isOvernightShift(s, e)) {
        shifts.push({
          start_time: TIMELINE_START,
          end_time: e,
          actualStart: s,
          actualEnd: e,
          isOvernightStart: false,
          isOvernightEnd: true,
          is_exception: yesterday.is_exception,
          hours: calcHours(s, e),
        });
      }
    }
  }
 
  return shifts;
}
 
// ── Slot helpers ──────────────────────────────────────────────────────────
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
 
function getActiveShift(visuals: VisualShift[], slot: string): VisualShift | null {
  const s = toMinutes(slot);
  for (const v of visuals) {
    if (s >= toMinutes(v.start_time) && s < toMinutes(v.end_time)) return v;
  }
  return null;
}
 
function isSlotActive(visuals: VisualShift[], slot: string): boolean {
  return getActiveShift(visuals, slot) !== null;
}
 
function isFirstOfBlock(visuals: VisualShift[], idx: number): boolean {
  if (!isSlotActive(visuals, TIME_SLOTS[idx])) return false;
  return idx === 0 || !isSlotActive(visuals, TIME_SLOTS[idx - 1]);
}
 
function isLastOfBlock(visuals: VisualShift[], idx: number): boolean {
  if (!isSlotActive(visuals, TIME_SLOTS[idx])) return false;
  return idx === TIME_SLOTS.length - 1 || !isSlotActive(visuals, TIME_SLOTS[idx + 1]);
}
 
function getCurrentSlotIdx(): number | null {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const first = toMinutes(TIME_SLOTS[0]);
  const last = toMinutes(TIME_SLOTS[TIME_SLOTS.length - 1]);
  if (mins < first || mins > last + 30) return null;
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    if (mins < toMinutes(TIME_SLOTS[i]) + 30) return i;
  }
  return null;
}
 
// ── Component ─────────────────────────────────────────────────────────────
export default function DayTimeline({ department, fetchToken }: { department?: string; fetchToken?: string }) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [schedules, setSchedules] = useState<EmployeeWeek[]>([]);
  const [prevWeekSchedules, setPrevWeekSchedules] = useState<EmployeeWeek[]>([]);
  const [loading, setLoading] = useState(true);
  // Pointages du jour affiché, par employé — sert à signaler un pointage fait
  // alors que le jour n'était pas prévu au planning (ex : repos).
  const [dayPunches, setDayPunches] = useState<Map<number, string[]>>(new Map());
  const [now, setNow] = useState<Date>(new Date());
  const currentRowRef = useRef<HTMLTableRowElement>(null);
 
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
 
  const fetchDay = useCallback(async (date: Date) => {
    setLoading(true);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const tp = fetchToken ? `&employeeToken=${fetchToken}` : '';
    const dateStr = format(date, 'yyyy-MM-dd');
    const [res, tcRes] = await Promise.all([
      fetch(`/api/planning?startDate=${format(weekStart, 'yyyy-MM-dd')}${tp}`),
      fetch(`/api/planning/timeclock/range?start=${dateStr}&end=${dateStr}${tp}`),
    ]);
    if (res.ok) setSchedules(await res.json());
    if (tcRes.ok) {
      const rows: { employee_id: number; clocked_at: string }[] = await tcRes.json();
      const map = new Map<number, string[]>();
      for (const r of rows) {
        if (!map.has(r.employee_id)) map.set(r.employee_id, []);
        map.get(r.employee_id)!.push(r.clocked_at);
      }
      setDayPunches(map);
    } else {
      setDayPunches(new Map());
    }
 
    if (getDay(date) === 1) {
      const prevWeekStart = subWeeks(weekStart, 1);
      const prevRes = await fetch(`/api/planning?startDate=${format(prevWeekStart, 'yyyy-MM-dd')}${tp}`);
      if (prevRes.ok) setPrevWeekSchedules(await prevRes.json());
    } else {
      setPrevWeekSchedules([]);
    }
    setLoading(false);
  }, [fetchToken]);
 
  useEffect(() => { fetchDay(selectedDate); }, [selectedDate, fetchDay]);
 
  useEffect(() => {
    if (!loading && currentRowRef.current) {
      currentRowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [loading]);
 
  const dateStr     = format(selectedDate, 'yyyy-MM-dd');
  const prevDateStr = format(subDays(selectedDate, 1), 'yyyy-MM-dd');
  const isToday     = dateStr === format(new Date(), 'yyyy-MM-dd');
  const currentSlotIdx = isToday ? getCurrentSlotIdx() : null;
 
  function getPrevShift(employeeId: number): DaySchedule | null {
    const source = getDay(selectedDate) === 1 && prevWeekSchedules.length > 0
      ? prevWeekSchedules
      : schedules;
    return source.find(r => r.employee.id === employeeId)?.days[prevDateStr] ?? null;
  }
 
  const entries = schedules
    .filter(row => !department || row.employee.department === department)
    .map(row => {
      const today = row.days[dateStr] ?? null;
      const prev  = getPrevShift(row.employee.id);
      const visuals = getVisualShifts(today, prev);
      const isLeave = today?.is_leave ?? false;
      const leaveType = today?.leave_type ?? null;
 
      // Pointé alors que non prévu (repos ou pas de planning ce jour) : on
      // ajoute un bloc "non prévu" sur la timeline pour le signaler visuellement.
      let punchedUnscheduled = false;
      if (visuals.length === 0 && !isLeave) {
        const punches = dayPunches.get(row.employee.id);
        if (punches && punches.length > 0) {
          const synthetic = punchesToUnscheduledShift(punches);
          if (synthetic) { visuals.push(synthetic); punchedUnscheduled = true; }
        }
      }
 
      const actualHours = (() => {
        if (today && !today.is_off) return today.hours;
        if (prev && !prev.is_off) return prev.hours;
        return 0;
      })();
      return { employee: row.employee, visuals, actualHours, isLeave, leaveType, punchedUnscheduled };
    });
 
  const presentNow = isToday
    ? entries.filter(({ visuals }) => {
        const nowMins = now.getHours() * 60 + now.getMinutes();
        return visuals.some(v => nowMins >= toMinutes(v.start_time) && nowMins < toMinutes(v.end_time));
      })
    : [];
 
  const workingToday = entries.filter(({ visuals }) => visuals.length > 0);
 
  // ── PDF export ────────────────────────────────────────────────────────────
  function handleExportPDF() {
    const activeSlots = TIME_SLOTS.filter(slot =>
      entries.some(({ visuals }) => isSlotActive(visuals, slot))
    );
 
    const empHeaders = entries.map(({ employee, visuals }) => {
      let sub = 'Repos';
      if (visuals.length > 0) {
        sub = visuals.map(v =>
          v.isOvernightEnd   ? `🌙→${v.actualEnd.slice(0, 5)}`
          : v.isOvernightStart ? `${v.actualStart.slice(0, 5)}→🌙`
          : `${v.actualStart.slice(0,5)}–${v.actualEnd.slice(0,5)}`
        ).join(' / ');
      }
      return `<th style="${visuals.length ? `border-bottom:3px solid ${employee.color}` : ''}">
        ${employee.name.split(' ')[0]}<br/>
        <span style="font-size:8px;font-weight:400;opacity:.8">${sub}</span>
      </th>`;
    }).join('');
 
    const bodyRows = (activeSlots.length ? activeSlots : TIME_SLOTS).map(slot => {
      const isFullHour = slot.endsWith(':00');
      const cells = entries.map(({ employee, visuals }) => {
        const active = isSlotActive(visuals, slot);
        if (active) {
          const idx   = TIME_SLOTS.indexOf(slot);
          const first = isFirstOfBlock(visuals, idx);
          const last  = isLastOfBlock(visuals, idx);
          const radius = `${first ? '4px 4px' : '0 0'} ${last ? '4px 4px' : '0 0'}`;
          const activeShift = getActiveShift(visuals, slot)!;
          const labelFirst = first ? (activeShift.isOvernightEnd ? '🌙' : activeShift.actualStart.slice(0, 5)) : '';
          const labelLast  = last  ? (activeShift.isOvernightStart ? '🌙' : activeShift.actualEnd.slice(0, 5))  : '';
          const label = labelFirst || labelLast;
          return `<td style="padding:0;height:${isFullHour ? 18 : 14}px">
            <div style="background:${employee.color};border-radius:${radius};margin:0 2px;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-size:8px">${label}</div>
          </td>`;
        }
        return `<td style="height:${isFullHour ? 18 : 14}px"></td>`;
      }).join('');
      const count = entries.filter(({ visuals }) => isSlotActive(visuals, slot)).length;
      return `<tr>
        <td style="font-weight:${isFullHour ? 700 : 400};color:${isFullHour ? '#1e293b' : '#94a3b8'};text-align:right;padding-right:6px;font-size:${isFullHour ? 9 : 8}px;white-space:nowrap">${slot}</td>
        ${cells}<td class="cell-count">${count > 0 ? count : ''}</td>
      </tr>`;
    }).join('');
 
    const footerCells = entries.map(({ employee, visuals, actualHours: h }) =>
      `<td style="background:${h > 0 ? employee.color + '22' : ''};color:${h > 0 ? employee.color : '#94a3b8'};font-weight:700">
        ${h > 0 ? (h % 1 === 0 ? h + 'h' : h.toFixed(1) + 'h') : '—'}
        ${visuals.some(v => v.isOvernightStart || v.isOvernightEnd) ? '<span style="font-size:8px">🌙</span>' : ''}
      </td>`
    ).join('');
 
    const html = `<table>
      <thead><tr><th class="th-name">Heure</th>${empHeaders}<th>Nb</th></tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot><tr><td class="td-name">Total</td>${footerCells}<td></td></tr></tfoot>
    </table>`;
 
    const dateLabel = format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr });
    openPrintWindow(
      `Timeline — ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}`,
      department || 'Tous les départements',
      html,
      false,  // portrait
      true,   // compact : tient sur une seule page A4 portrait / smartphone
    );
  }
 
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-screen-xl mx-auto">
 
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(d => subDays(d, 1))} className="btn-secondary p-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={() => setSelectedDate(new Date())} className="btn-secondary px-3 py-2 text-sm">
            Aujourd'hui
          </button>
          <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="btn-secondary p-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {/* Date label — click to open mini calendar */}
          <div className="relative ml-1">
            <button
              onClick={() => { setPickerMonth(startOfMonth(selectedDate)); setShowPicker(p => !p); }}
              className="text-sm font-medium text-slate-700 hover:text-celadon-600 transition-colors capitalize flex items-center gap-1"
            >
              {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-64"
                onMouseLeave={() => setShowPicker(false)}>
                {/* Month nav */}
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
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {['L','M','M','J','V','S','D'].map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-medium text-slate-400 py-0.5">{d}</div>
                  ))}
                </div>
                {/* Day grid */}
                <div className="grid grid-cols-7 gap-px">
                  {(() => {
                    const firstDow = (getDay(pickerMonth) + 6) % 7;
                    const total = getDaysInMonth(pickerMonth);
                    const cells: React.ReactNode[] = [];
                    for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`} />);
                    for (let d = 1; d <= total; d++) {
                      const date = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), d);
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const selStr = format(selectedDate, 'yyyy-MM-dd');
                      const todayStr = format(new Date(), 'yyyy-MM-dd');
                      const isSel = dateStr === selStr;
                      const isT = dateStr === todayStr;
                      cells.push(
                        <button key={d}
                          onClick={() => { setSelectedDate(date); setShowPicker(false); }}
                          className={clsx(
                            'text-xs rounded py-1 w-full transition-colors',
                            isSel ? 'bg-celadon-500 text-white font-semibold'
                              : isT ? 'bg-taupe text-white font-semibold'
                              : 'hover:bg-slate-100 text-slate-700'
                          )}
                        >{d}</button>
                      );
                    }
                    return cells;
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
 
        <div className="flex items-center gap-2 text-sm">
          {isToday && (
            <span className="bg-celadon-100 text-celadon-700 px-2.5 py-1 rounded-full font-medium">
              {presentNow.length} présent{presentNow.length !== 1 ? 's' : ''} maintenant
            </span>
          )}
          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            {workingToday.length} travaillent ce jour
          </span>
          <button
            onClick={handleExportPDF}
            disabled={loading || entries.length === 0}
            className="btn-secondary flex items-center gap-1.5"
          >
            <PdfIcon />
            PDF
          </button>
        </div>
      </div>
 
      {/* Timeline table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full min-w-max border-collapse">
 
            {/* ── Header ── */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-celadon-500 text-white">
                <th className="w-16 py-3 px-3 text-left text-xs font-medium text-white/70 sticky left-0 bg-celadon-500 z-30">
                  Heure
                </th>
 
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <th key={i} className="px-2 py-3 min-w-[80px]">
                        <div className="h-4 bg-celadon-600 rounded animate-pulse w-16 mx-auto" />
                      </th>
                    ))
                  : entries.map(({ employee, visuals, isLeave, leaveType, punchedUnscheduled }) => (
                      <th key={employee.id} className="px-2 py-2 min-w-[80px] text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={clsx(
                              'w-7 h-7 rounded-full flex items-center justify-center text-slate-800 text-xs font-bold',
                              visuals.length === 0 && !isLeave && 'opacity-40'
                            )}
                            style={{ backgroundColor: punchedUnscheduled ? '#fca5a5' : employee.color }}
                          >
                            {employee.name[0].toUpperCase()}
                          </span>
                          <span className={clsx(
                            'text-xs font-medium max-w-[70px] truncate',
                            visuals.length > 0 ? 'text-white/90' : isLeave ? 'text-green-300' : 'text-white/50'
                          )}>
                            {employee.name.split(' ')[0]}
                          </span>
                          {isLeave ? (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium text-white ${leaveType === 'cm' ? 'bg-orange-500' : 'bg-green-500'}`}>
                              {leaveType === 'cm' ? 'Maladie' : 'Congés'}
                            </span>
                          ) : punchedUnscheduled ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white bg-red-500" title="Pointé alors que non prévu au planning ce jour">
                              ⚠️ Repos pointé
                            </span>
                          ) : visuals.length > 0 ? (
                            <span className="text-[10px] text-white/70 text-center">
                              {visuals.map((v, vi) => (
                                <span key={vi}>
                                  {vi > 0 && <br />}
                                  {v.isOvernightEnd
                                    ? `🌙→${v.actualEnd.slice(0, 5)}`
                                    : v.isOvernightStart
                                    ? `${v.actualStart.slice(0, 5)}→🌙`
                                    : `${v.actualStart.slice(0, 5)}–${v.actualEnd.slice(0, 5)}`}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      </th>
                    ))}
 
                {!loading && entries.length > 0 && (
                  <th className="px-3 py-3 text-xs font-medium text-slate-400 w-14 text-center">Nb</th>
                )}
              </tr>
            </thead>
 
            {/* ── Body ── */}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400 text-sm">
                    Chargement...
                  </td>
                </tr>
              ) : (
                TIME_SLOTS.map((slot, slotIdx) => {
                  const isCurrentSlot = currentSlotIdx === slotIdx;
                  const isFullHour    = slot.endsWith(':00');
                  const presentCount  = entries.filter(({ visuals }) => isSlotActive(visuals, slot)).length;
 
                  return (
                    <tr
                      key={slot}
                      ref={isCurrentSlot ? currentRowRef : undefined}
                      className={clsx(
                        'border-t',
                        isCurrentSlot
                          ? 'border-red-400 bg-red-50'
                          : isFullHour
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-100 bg-white'
                      )}
                    >
                      {/* Hour label */}
                      <td
                        className={clsx(
                          'sticky left-0 z-10 px-3 text-right select-none w-16',
                          isCurrentSlot ? 'bg-red-50' : 'bg-white',
                          isFullHour ? 'h-7' : 'h-6'
                        )}
                      >
                        {isFullHour ? (
                          <span className={clsx(
                            'text-xs font-semibold',
                            isCurrentSlot ? 'text-red-600' : 'text-slate-500'
                          )}>
                            {slot}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">{slot}</span>
                        )}
                        {isCurrentSlot && (
                          <span className="ml-1 inline-block w-1.5 h-1.5 bg-red-500 rounded-full align-middle" />
                        )}
                      </td>
 
                      {/* Employee cells */}
                      {entries.map(({ employee, visuals }) => {
                        const activeShift = getActiveShift(visuals, slot);
                        const active = !!activeShift;
                        const first  = active && isFirstOfBlock(visuals, slotIdx);
                        const last   = active && isLastOfBlock(visuals, slotIdx);
 
                        return (
                          <td key={employee.id} className={clsx('p-0', isFullHour ? 'h-7' : 'h-6')}>
                            {active ? (
                              <div
                                className={clsx(
                                  'h-full mx-0.5 relative',
                                  first && 'rounded-t-md',
                                  last  && 'rounded-b-md',
                                  activeShift.unscheduled && 'ring-2 ring-inset ring-red-500'
                                )}
                                style={{ backgroundColor: activeShift.unscheduled ? '#fca5a5' : employee.color, opacity: 0.9 }}
                                title={activeShift.unscheduled ? 'Pointé alors que non prévu au planning ce jour' : undefined}
                              >
                                {first && (
                                  <span className="absolute top-0.5 left-1 text-slate-800 text-[9px] font-semibold leading-none">
                                    {activeShift.unscheduled ? '⚠️' : activeShift.isOvernightEnd ? '🌙' : activeShift.actualStart.slice(0, 5)}
                                  </span>
                                )}
                                {last && (
                                  <span className="absolute bottom-0.5 right-1 text-slate-800 text-[9px] font-semibold leading-none">
                                    {activeShift.isOvernightStart ? '🌙' : activeShift.actualEnd.slice(0, 5)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="h-full" />
                            )}
                          </td>
                        );
                      })}
 
                      {/* Present count */}
                      {entries.length > 0 && (
                        <td className={clsx('px-2 text-center', isFullHour ? 'h-7' : 'h-6')}>
                          {presentCount > 0 && (
                            <span className={clsx(
                              'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white',
                              isCurrentSlot ? 'bg-red-500' : 'bg-slate-400'
                            )}>
                              {presentCount}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
 
            {/* ── Footer ── */}
            {!loading && entries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                  <td className="sticky left-0 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                    Total
                  </td>
                  {entries.map(({ employee, visuals, actualHours: h }) => (
                    <td key={employee.id} className="px-2 py-2 text-center">
                      {h > 0 ? (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded text-slate-800 inline-flex items-center gap-0.5"
                          style={{ backgroundColor: employee.color }}>
                          {h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`}
                          {visuals.some(v => v.isOvernightStart || v.isOvernightEnd) && (
                            <span className="text-[9px]">🌙</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
 
          {/* Empty state */}
          {!loading && entries.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">
              Aucun employé.{' '}
              <a href="/manager/dashboard/employes" className="text-celadon-600 underline">
                Ajouter des employés
              </a>
            </div>
          )}
        </div>
 
        {/* Legend */}
        {!loading && entries.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex flex-wrap gap-4">
            <span>🌙 = créneau de nuit chevauchant minuit</span>
            <span>🌙→ = heure de fin du créneau de nuit du jour précédent</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-red-300 ring-1 ring-inset ring-red-500" /> ⚠️ = pointé alors que non prévu au planning (ex : repos)
            </span>
          </div>
        )}
      </div>
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
 

