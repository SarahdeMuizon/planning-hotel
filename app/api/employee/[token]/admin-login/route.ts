import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createManagerToken } from '@/lib/auth';

// POST /api/employee/[token]/admin-login
// Called when an admin employee visits their token URL — sets manager JWT cookie
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const empRes = await db.execute({
    sql: "SELECT id FROM employees WHERE access_token = ? AND role = 'admin'",
    args: [token],
  });

  if (empRes.rows.length === 0) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const jwt = await createManagerToken('admin', token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('manager_token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
