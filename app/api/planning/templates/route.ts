import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';

// GET /api/planning/templates?employeeId=1
export async function GET(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId');

  const db = await getDb();
  const result = employeeId
    ? await db.execute({
        sql: 'SELECT * FROM schedule_templates WHERE employee_id = ? ORDER BY day_of_week',
        args: [Number(employeeId)],
      })
    : await db.execute('SELECT * FROM schedule_templates ORDER BY employee_id, day_of_week');

  return NextResponse.json(result.rows);
}

// PUT /api/planning/templates  { employeeId, dayOfWeek, startTime, endTime }
export async function PUT(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { employeeId, dayOfWeek, startTime, endTime, startTime2, endTime2 } = await req.json();
  const db = await getDb();

  if (!startTime) {
    // Delete the template entry (= day off by default)
    await db.execute({
      sql: 'DELETE FROM schedule_templates WHERE employee_id = ? AND day_of_week = ?',
      args: [employeeId, dayOfWeek],
    });
    return NextResponse.json({ ok: true });
  }

  await db.execute({
    sql: `INSERT INTO schedule_templates (employee_id, day_of_week, start_time, end_time, start_time2, end_time2)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(employee_id, day_of_week) DO UPDATE SET
            start_time = excluded.start_time,
            end_time = excluded.end_time,
            start_time2 = excluded.start_time2,
            end_time2 = excluded.end_time2`,
    args: [employeeId, dayOfWeek, startTime, endTime, startTime2 || null, endTime2 || null],
  });

  return NextResponse.json({ ok: true });
}
