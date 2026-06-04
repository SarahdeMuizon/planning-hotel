import { NextResponse } from 'next/server';
import { getManagerSession } from '@/lib/auth';

export async function GET() {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ role: null });
  return NextResponse.json({ role: session.role });
}
