import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';

// GET /api/planning/reception?weekStart=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await getManagerSession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get('weekStart');
  if (!weekStart) return NextResponse.json({ error: 'weekStart requis' }, { status: 400 });

  const db = await getDb();

  const rows = await db.execute({
    sql: `SELECT rp.id, rp.week_start, rp.day_of_week, rp.slot, rp.employee_id,
                 e.name as employee_name, e.color as employee_color
          FROM reception_planning rp
          LEFT JOIN employees e ON e.id = rp.employee_id
          WHERE rp.week_start = ?
          ORDER BY rp.day_of_week, rp.slot, e.name`,
    args: [weekStart],
  });

  const empRows = await db.execute({
    sql: 'SELECT id, name, color FROM employees ORDER BY name',
    args: [],
  });

  const closedRows = await db.execute({
    sql: 'SELECT day_of_week, slot FROM reception_closed WHERE week_start = ?',
    args: [weekStart],
  });

  return NextResponse.json({
    assignments: rows.rows,
    employees: empRows.rows,
    closedSlots: closedRows.rows,
  });
}

// POST /api/planning/reception  { weekStart, slot, dayOfWeek, employeeId }
export async function POST(req: NextRequest) {
  const auth = await getManagerSession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { weekStart, slot, dayOfWeek, employeeId } = await req.json();
  if (!weekStart || !slot || dayOfWeek === undefined || !employeeId) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const db = await getDb();
  try {
    const result = await db.execute({
      sql: `INSERT INTO reception_planning (week_start, day_of_week, slot, employee_id)
            VALUES (?, ?, ?, ?) RETURNING *`,
      args: [weekStart, dayOfWeek, slot, employeeId],
    });
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Déjà assigné sur ce créneau' }, { status: 409 });
  }
}

// DELETE /api/planning/reception?id=X
export async function DELETE(req: NextRequest) {
  const auth = await getManagerSession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM reception_planning WHERE id = ?', args: [Number(id)] });
  return NextResponse.json({ ok: true });
}

// PATCH /api/planning/reception — copie la semaine précédente
export async function PATCH(req: NextRequest) {
  const auth = await getManagerSession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { weekStart } = await req.json();
  if (!weekStart) return NextResponse.json({ error: 'weekStart requis' }, { status: 400 });

  const current = new Date(weekStart + 'T00:00:00');
  current.setDate(current.getDate() - 7);
  const prevWeekStart = current.toISOString().slice(0, 10);

  const db = await getDb();

  const prev = await db.execute({
    sql: 'SELECT day_of_week, slot, employee_id FROM reception_planning WHERE week_start = ?',
    args: [prevWeekStart],
  });

  if (prev.rows.length === 0) {
    return NextResponse.json({ error: 'Aucun planning la semaine précédente' }, { status: 404 });
  }

  await db.execute({
    sql: 'DELETE FROM reception_planning WHERE week_start = ?',
    args: [weekStart],
  });

  for (const row of prev.rows) {
    try {
      await db.execute({
        sql: 'INSERT INTO reception_planning (week_start, day_of_week, slot, employee_id) VALUES (?, ?, ?, ?)',
        args: [weekStart, row.day_of_week as number, row.slot as string, row.employee_id as number],
      });
    } catch { /* skip duplicates */ }
  }

  // Also copy closed slots
  const prevClosed = await db.execute({
    sql: 'SELECT day_of_week, slot FROM reception_closed WHERE week_start = ?',
    args: [prevWeekStart],
  });
  await db.execute({ sql: 'DELETE FROM reception_closed WHERE week_start = ?', args: [weekStart] });
  for (const row of prevClosed.rows) {
    try {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO reception_closed (week_start, day_of_week, slot) VALUES (?, ?, ?)',
        args: [weekStart, row.day_of_week as number, row.slot as string],
      });
    } catch { /* skip */ }
  }

  return NextResponse.json({ ok: true, copied: prev.rows.length });
}
