import { NextRequest, NextResponse } from 'next/server';
import { checkManagerPassword, createManagerToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  const role = checkManagerPassword(password);
  if (!role) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
  }

  const token = await createManagerToken(role);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set('manager_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
