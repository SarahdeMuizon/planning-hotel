import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';

// POST /api/planning/reception/closed  { weekStart, zone, dayOfWeek, slot }
export async function POST(req: NextRequest) {
  const auth = await getManagerSession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { weekStart, zone = 'reception', dayOfWeek, slot } = await req.json();
  if (!weekStart || dayOfWeek === undefined || !slot) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const db = await getDb();
  await db.execute({
    sql: 'INSERT OR IGNORE INTO reception_closed (week_start, zone, day_of_week, slot) VALUES (?, ?, ?, ?)',
    args: [weekStart, zone, dayOfWeek, slot],
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/planning/reception/closed?weekStart=...&zone=...&dayOfWeek=...&slot=...
export async function DELETE(req: NextRequest) {
  const auth = await getManagerSession();
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get('weekStart');
  const zone = searchParams.get('zone') || 'reception';
  const dayOfWeek = searchParams.get('dayOfWeek');
  const slot = searchParams.get('slot');
  if (!weekStart || !dayOfWeek || !slot) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const db = await getDb();
  await db.execute({
    sql: 'DELETE FROM reception_closed WHERE week_start = ? AND zone = ? AND day_of_week = ? AND slot = ?',
    args: [weekStart, zone, Number(dayOfWeek), slot],
  });
  return NextResponse.json({ ok: true });
}
