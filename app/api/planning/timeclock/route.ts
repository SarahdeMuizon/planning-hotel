import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';

// GET /api/planning/timeclock?date=YYYY-MM-DD
// Returns all timeclock entries for the given date with employee info
export async function GET(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT t.*, e.name as employee_name, e.color as employee_color
          FROM timeclock t
          JOIN employees e ON e.id = t.employee_id
          WHERE t.date = ?
          ORDER BY e.name, t.type`,
    args: [date],
  });

  return NextResponse.json(res.rows);
}

// DELETE /api/planning/timeclock?id=5  (admin correction)
export async function DELETE(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });

  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM timeclock WHERE id = ?', args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
