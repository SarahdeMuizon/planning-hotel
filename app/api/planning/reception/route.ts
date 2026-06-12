import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';
import { format, addDays, parseISO } from 'date-fns';

// GET /api/planning/reception?weekStart=YYYY-MM-DD&zone=reception — public
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get('weekStart');
  const zone = searchParams.get('zone') || 'reception';
  if (!weekStart) return NextResponse.json({ error: 'weekStart requis' }, { status: 400 });

  const db = await getDb();

  const rows = await db.execute({
    sql: `SELECT rp.id, rp.week_start, rp.zone, rp.day_of_week, rp.slot, rp.employee_id,
                 e.name as employee_name, e.color as employee_color
          FROM reception_planning rp
          LEFT JOIN employees e ON e.id = rp.employee_id
          WHERE rp.week_start = ? AND rp.zone = ?
          ORDER BY rp.day_of_week, rp.slot, e.name`,
    args: [weekStart, zone],
  });

  const empRows = await db.execute({
    sql: 'SELECT id, name, color FROM employees ORDER BY name',
    args: [],
  });

  const closedRows = await db.execute({
    sql: 'SELECT day_of_week, slot FROM reception_closed WHERE week_start = ? AND zone = ?',
    args: [weekStart, zone],
  });

  // Compute employee off days for this week
  const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');

  const [templateOffRows, exceptOffRows, exceptWorkRows, leaveRows] = await Promise.all([
    db.execute({ sql: 'SELECT employee_id, day_of_week FROM schedule_templates WHERE start_time IS NULL', args: [] }),
    db.execute({ sql: 'SELECT employee_id, date FROM schedule_exceptions WHERE date >= ? AND date <= ? AND start_time IS NULL', args: [weekStart, weekEnd] }),
    db.execute({ sql: 'SELECT employee_id, date FROM schedule_exceptions WHERE date >= ? AND date <= ? AND start_time IS NOT NULL', args: [weekStart, weekEnd] }),
    db.execute({ sql: 'SELECT employee_id, start_date, end_date FROM paid_leaves WHERE start_date <= ? AND end_date >= ?', args: [weekEnd, weekStart] }),
  ]);

  // Build off set: "employeeId-dayOfWeek"
  const offSet = new Set<string>();

  for (const row of templateOffRows.rows) {
    offSet.add(`${row.employee_id}-${row.day_of_week}`);
  }
  // Exception working day overrides template off
  for (const row of exceptWorkRows.rows) {
    const dow = ((parseISO(row.date as string).getDay() + 6) % 7);
    offSet.delete(`${row.employee_id}-${dow}`);
  }
  // Exception off day
  for (const row of exceptOffRows.rows) {
    const dow = ((parseISO(row.date as string).getDay() + 6) % 7);
    offSet.add(`${row.employee_id}-${dow}`);
  }
  // Paid leaves override everything
  for (const row of leaveRows.rows) {
    for (let i = 0; i < 7; i++) {
      const dateStr = format(addDays(parseISO(weekStart), i), 'yyyy-MM-dd');
      if (dateStr >= (row.start_date as string) && dateStr <= (row.end_date as string)) {
        offSet.add(`${row.employee_id}-${i}`);
      }
    }
  }

  const offDays = Array.from(offSet).map(k => {
    const [empId, dow] = k.split('-');
    return { employee_id: Number(empId), day_of_week: Number(dow) };
  });

  return NextResponse.json({
    assignments: rows.rows,
    employees: empRows.rows,
    closedSlots: closedRows.rows,
    offDays,
  });
}

// POST /api/planning/reception  { weekStart, zone, slot, dayOfWeek, employeeId }
export async function POST(req: NextRequest) {
  const auth = await getManagerSession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { weekStart, zone = 'reception', slot, dayOfWeek, employeeId } = await req.json();
  if (!weekStart || !slot || dayOfWeek === undefined || !employeeId) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const db = await getDb();
  try {
    const result = await db.execute({
      sql: `INSERT INTO reception_planning (week_start, zone, day_of_week, slot, employee_id)
            VALUES (?, ?, ?, ?, ?) RETURNING *`,
      args: [weekStart, zone, dayOfWeek, slot, employeeId],
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

  const { weekStart, zone = 'reception' } = await req.json();
  if (!weekStart) return NextResponse.json({ error: 'weekStart requis' }, { status: 400 });

  const current = new Date(weekStart + 'T00:00:00');
  current.setDate(current.getDate() - 7);
  const prevWeekStart = current.toISOString().slice(0, 10);

  const db = await getDb();

  const prev = await db.execute({
    sql: 'SELECT day_of_week, slot, employee_id FROM reception_planning WHERE week_start = ? AND zone = ?',
    args: [prevWeekStart, zone],
  });

  if (prev.rows.length === 0) {
    return NextResponse.json({ error: 'Aucun planning la semaine précédente' }, { status: 404 });
  }

  await db.execute({
    sql: 'DELETE FROM reception_planning WHERE week_start = ? AND zone = ?',
    args: [weekStart, zone],
  });

  for (const row of prev.rows) {
    try {
      await db.execute({
        sql: 'INSERT INTO reception_planning (week_start, zone, day_of_week, slot, employee_id) VALUES (?, ?, ?, ?, ?)',
        args: [weekStart, zone, row.day_of_week as number, row.slot as string, row.employee_id as number],
      });
    } catch { /* skip duplicates */ }
  }

  // Copy closed slots
  const prevClosed = await db.execute({
    sql: 'SELECT day_of_week, slot FROM reception_closed WHERE week_start = ? AND zone = ?',
    args: [prevWeekStart, zone],
  });
  await db.execute({ sql: 'DELETE FROM reception_closed WHERE week_start = ? AND zone = ?', args: [weekStart, zone] });
  for (const row of prevClosed.rows) {
    try {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO reception_closed (week_start, zone, day_of_week, slot) VALUES (?, ?, ?, ?)',
        args: [weekStart, zone, row.day_of_week as number, row.slot as string],
      });
    } catch { /* skip */ }
  }

  return NextResponse.json({ ok: true, copied: prev.rows.length });
}
