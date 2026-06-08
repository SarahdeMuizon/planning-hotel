import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';

// GET /api/planning/leaves?employeeId=1  (omit to get all)
export async function GET(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get('employeeId');

  const db = await getDb();
  const result = employeeId
    ? await db.execute({
        sql: 'SELECT * FROM paid_leaves WHERE employee_id = ? ORDER BY start_date DESC',
        args: [Number(employeeId)],
      })
    : await db.execute(
        'SELECT pl.*, e.name as employee_name, e.color as employee_color FROM paid_leaves pl JOIN employees e ON e.id = pl.employee_id ORDER BY pl.start_date DESC'
      );

  return NextResponse.json(result.rows);
}

// POST /api/planning/leaves  { employeeId, startDate, endDate, note? }
export async function POST(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { employeeId, startDate, endDate, leaveType, note } = await req.json();
  if (!employeeId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: 'La date de début doit être avant la date de fin' }, { status: 400 });
  }
  const type = leaveType === 'cm' ? 'cm' : 'cp';

  const db = await getDb();
  const result = await db.execute({
    sql: 'INSERT INTO paid_leaves (employee_id, start_date, end_date, leave_type, note) VALUES (?, ?, ?, ?, ?) RETURNING *',
    args: [employeeId, startDate, endDate, type, note || null],
  });

  return NextResponse.json(result.rows[0], { status: 201 });
}

// PATCH /api/planning/leaves  { id, startDate, endDate, leaveType, note? }
export async function PATCH(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id, startDate, endDate, leaveType, note } = await req.json();
  if (!id || !startDate || !endDate) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: 'La date de début doit être avant la date de fin' }, { status: 400 });
  }
  const type = leaveType === 'cm' ? 'cm' : 'cp';

  const db = await getDb();
  await db.execute({
    sql: 'UPDATE paid_leaves SET start_date=?, end_date=?, leave_type=?, note=? WHERE id=?',
    args: [startDate, endDate, type, note || null, Number(id)],
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/planning/leaves?id=5
export async function DELETE(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });

  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM paid_leaves WHERE id = ?', args: [Number(id)] });

  return NextResponse.json({ ok: true });
}
