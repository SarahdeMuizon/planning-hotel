import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';

// PUT /api/planning/exceptions  { employeeId, date, startTime, endTime, note }
export async function PUT(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { employeeId, date, startTime, endTime, startTime2, endTime2, note } = await req.json();
  const db = await getDb();

  if (startTime === undefined && endTime === undefined) {
    // Delete exception (revert to template)
    await db.execute({
      sql: 'DELETE FROM schedule_exceptions WHERE employee_id = ? AND date = ?',
      args: [employeeId, date],
    });
    return NextResponse.json({ ok: true, action: 'deleted' });
  }

  await db.execute({
    sql: `INSERT INTO schedule_exceptions (employee_id, date, start_time, end_time, start_time2, end_time2, note)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(employee_id, date) DO UPDATE SET
            start_time = excluded.start_time,
            end_time = excluded.end_time,
            start_time2 = excluded.start_time2,
            end_time2 = excluded.end_time2,
            note = excluded.note`,
    args: [employeeId, date, startTime || null, endTime || null, startTime2 || null, endTime2 || null, note || null],
  });

  return NextResponse.json({ ok: true, action: 'upserted' });
}

// DELETE /api/planning/exceptions?employeeId=1&date=2024-01-15
export async function DELETE(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId');
  const date = searchParams.get('date');

  if (!employeeId || !date) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });

  const db = await getDb();
  await db.execute({
    sql: 'DELETE FROM schedule_exceptions WHERE employee_id = ? AND date = ?',
    args: [Number(employeeId), date],
  });

  return NextResponse.json({ ok: true });
}
