import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';

// GET /api/planning/timeclock/month?year=YYYY&month=M
// Returns all timeclock entries for every day of the given month, with employee info.
export async function GET(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get('year') || now.getFullYear());
  const month = Number(searchParams.get('month') || now.getMonth() + 1);

  const { startOfMonth, endOfMonth, format } = await import('date-fns');
  const ms = startOfMonth(new Date(year, month - 1));
  const me = endOfMonth(ms);
  const startDate = format(ms, 'yyyy-MM-dd');
  const endDate = format(me, 'yyyy-MM-dd');

  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT t.*, e.name as employee_name, e.color as employee_color
          FROM timeclock t
          JOIN employees e ON e.id = t.employee_id
          WHERE t.date BETWEEN ? AND ?
          ORDER BY e.name, t.date, t.type`,
    args: [startDate, endDate],
  });

  return NextResponse.json(res.rows);
}
