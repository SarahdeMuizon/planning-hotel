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

  // Return assignments joined with employee info
  const rows = await db.execute({
    sql: `SELECT rp.id, rp.week_start, rp.slot, rp.employee_id,
                 e.name as employee_name, e.color as employee_color
          FROM reception_planning rp
          LEFT JOIN employees e ON e.id = rp.employee_id
          WHERE rp.week_start = ?
          ORDER BY rp.slot, e.name`,
    args: [weekStart],
  });

  // Also return all employees for the dropdown
  const empRows = await db.execute({
    sql: 'SELECT id, name, color FROM employees ORDER BY name',
    args: [],
  });

  return NextResponse.json({
    assignments: rows.rows,
    employees: empRows.rows,
  });
}

// POST /api/planning/reception  { weekStart, slot, employeeId }
export async function POST(req: NextRequest) {
  const auth = await getManagerSession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { weekStart, slot, employeeId } = await req.json();
  if (!weekStart || !slot || !employeeId) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const db = await getDb();
  try {
    const result = await db.execute({
      sql: `INSERT INTO reception_planning (week_start, slot, employee_id)
            VALUES (?, ?, ?) RETURNING *`,
      args: [weekStart, slot, employeeId],
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

// PATCH /api/planning/reception/copy — copie la semaine précédente
export async function PATCH(req: NextRequest) {
  const auth = await getManagerSession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { weekStart } = await req.json();
  if (!weekStart) return NextResponse.json({ error: 'weekStart requis' }, { status: 400 });

  // Compute previous week start (weekStart - 7 days)
  const current = new Date(weekStart + 'T00:00:00');
  current.setDate(current.getDate() - 7);
  const prevWeekStart = current.toISOString().slice(0, 10);

  const db = await getDb();

  // Get previous week's assignments
  const prev = await db.execute({
    sql: 'SELECT slot, employee_id FROM reception_planning WHERE week_start = ?',
    args: [prevWeekStart],
  });

  if (prev.rows.length === 0) {
    return NextResponse.json({ error: 'Aucun planning la semaine précédente' }, { status: 404 });
  }

  // Delete current week and re-insert from previous
  await db.execute({
    sql: 'DELETE FROM reception_planning WHERE week_start = ?',
    args: [weekStart],
  });

  for (const row of prev.rows) {
    try {
      await db.execute({
        sql: 'INSERT INTO reception_planning (week_start, slot, employee_id) VALUES (?, ?, ?)',
        args: [weekStart, row.slot as string, row.employee_id as number],
      });
    } catch { /* skip duplicates */ }
  }

  return NextResponse.json({ ok: true, copied: prev.rows.length });
}
