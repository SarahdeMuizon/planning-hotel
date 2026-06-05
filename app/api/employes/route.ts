import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { EMPLOYEE_COLORS } from '@/types';

export async function GET() {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const db = await getDb();
  const result = await db.execute('SELECT * FROM employees ORDER BY name ASC');
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { name, color, department, role, contract_start, contract_end } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });

  const db = await getDb();
  const token = uuidv4().replace(/-/g, '');

  const countRes = await db.execute('SELECT COUNT(*) as c FROM employees');
  const count = Number(countRes.rows[0].c);
  const defaultColor = color || EMPLOYEE_COLORS[count % EMPLOYEE_COLORS.length];
  const dept = department || 'Gestion Clientèle';
  const empRole = role === 'admin' ? 'admin' : 'employee';

  const result = await db.execute({
    sql: 'INSERT INTO employees (name, color, department, role, contract_start, contract_end, access_token) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
    args: [name.trim(), defaultColor, dept, empRole, contract_start || null, contract_end || null, token],
  });

  return NextResponse.json(result.rows[0], { status: 201 });
}
