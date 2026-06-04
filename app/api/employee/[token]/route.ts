import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getEmployeeMonthSchedule } from '@/lib/schedule';
import type { Employee } from '@/types';

// GET /api/employee/[token]?year=2024&month=1
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const db = await getDb();
  const empRes = await db.execute({
    sql: 'SELECT * FROM employees WHERE access_token = ?',
    args: [token],
  });

  if (empRes.rows.length === 0) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  const employee = empRes.rows[0] as unknown as Employee;

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get('year') || now.getFullYear());
  const month = Number(searchParams.get('month') || now.getMonth() + 1);

  const { schedule, totalHours } = await getEmployeeMonthSchedule(employee.id, year, month);

  return NextResponse.json({ employee, schedule, totalHours, year, month });
}
