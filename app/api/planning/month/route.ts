import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';
import { getAllEmployeesMonthSchedule } from '@/lib/schedule';
import type { Employee } from '@/types';

async function checkAuth(req: NextRequest): Promise<boolean> {
  const session = await getManagerSession();
  if (session) return true;
  const { searchParams } = new URL(req.url);
  const empToken = searchParams.get('employeeToken');
  if (!empToken) return false;
  const db = await getDb();
  const r = await db.execute({ sql: 'SELECT id FROM employees WHERE access_token = ?', args: [empToken] });
  return r.rows.length > 0;
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get('year') || now.getFullYear());
  const month = Number(searchParams.get('month') || now.getMonth() + 1);

  const { startOfMonth, endOfMonth, format } = await import('date-fns');
  const ms = startOfMonth(new Date(year, month - 1));
  const me = endOfMonth(ms);
  const mStart = format(ms, 'yyyy-MM-dd');
  const mEnd   = format(me, 'yyyy-MM-dd');

  const db = await getDb();
  const employeesRes = await db.execute({
    sql: `SELECT * FROM employees WHERE (contract_start IS NULL OR contract_start <= ?) AND (contract_end IS NULL OR contract_end >= ?) ORDER BY name ASC`,
    args: [mEnd, mStart],
  });
  const employees = employeesRes.rows as unknown as Employee[];

  const data = await getAllEmployeesMonthSchedule(year, month, employees);
  return NextResponse.json(data);
}
