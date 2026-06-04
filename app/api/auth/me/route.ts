import { NextResponse } from 'next/server';
import { getManagerSession } from '@/lib/auth';

export async function GET() {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ role: null, employeeToken: null });
  return NextResponse.json({ role: session.role, employeeToken: session.employeeToken ?? null });
}
