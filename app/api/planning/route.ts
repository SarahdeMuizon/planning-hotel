import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';
import { getWeekSchedules, getMonthStats } from '@/lib/schedule';
import { startOfWeek } from 'date-fns';
import type { Employee } from '@/types';

// GET /api/planning?startDate=YYYY-MM-DD  → week schedule for all employees
// GET /api/planning?year=2024&month=1     → monthly stats
export async function GET(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const db = await getDb();
  const employeesRes = await db.execute('SELECT * FROM employees ORDER BY name ASC');
  const employees = employeesRes.rows as unknown as Employee[];

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  if (year && month) {
    const stats = await getMonthStats(Number(year), Number(month), employees);
    return NextResponse.json(stats);
  }

  const weekStart = startDate
    ? new Date(startDate + 'T00:00:00')
    : startOfWeek(new Date(), { weekStartsOn: 1 });

  const schedules = await getWeekSchedules(weekStart, employees);
  return NextResponse.json(schedules);
}
