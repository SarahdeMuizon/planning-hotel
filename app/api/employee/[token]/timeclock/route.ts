import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Employee } from '@/types';

type Ctx = { params: Promise<{ token: string }> };

async function resolveEmployee(token: string): Promise<Employee | null> {
  const db = await getDb();
  const res = await db.execute({ sql: 'SELECT * FROM employees WHERE access_token = ?', args: [token] });
  return res.rows.length > 0 ? (res.rows[0] as unknown as Employee) : null;
}

// GET /api/employee/[token]/timeclock?date=YYYY-MM-DD
export async function GET(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const employee = await resolveEmployee(token);
  if (!employee) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const db = await getDb();

  const res = date
    ? await db.execute({
        sql: 'SELECT * FROM timeclock WHERE employee_id = ? AND date = ? ORDER BY created_at',
        args: [employee.id, date],
      })
    : await db.execute({
        sql: 'SELECT * FROM timeclock WHERE employee_id = ? ORDER BY date DESC, created_at DESC LIMIT 30',
        args: [employee.id],
      });

  return NextResponse.json(res.rows);
}

// POST /api/employee/[token]/timeclock  { type: 'arrival'|'departure', clockedAt: 'HH:MM', date: 'YYYY-MM-DD' }
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const employee = await resolveEmployee(token);
  if (!employee) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });

  const { type, clockedAt, date } = await req.json();
  if (!type || !clockedAt || !date) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  if (type !== 'arrival' && type !== 'departure') return NextResponse.json({ error: 'Type invalide' }, { status: 400 });

  const db = await getDb();

  // Check if already clocked for this type today
  const existing = await db.execute({
    sql: 'SELECT id FROM timeclock WHERE employee_id = ? AND date = ? AND type = ?',
    args: [employee.id, date, type],
  });
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'Pointage déjà enregistré pour aujourd\'hui' }, { status: 409 });
  }

  const result = await db.execute({
    sql: 'INSERT INTO timeclock (employee_id, date, type, clocked_at) VALUES (?, ?, ?, ?) RETURNING *',
    args: [employee.id, date, type, clockedAt],
  });
  return NextResponse.json(result.rows[0], { status: 201 });
}
