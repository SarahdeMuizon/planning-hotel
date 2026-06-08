import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';

// GET /api/notifications — liste les non lues (ou toutes si ?all=1)
export async function GET(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const all = new URL(req.url).searchParams.get('all') === '1';
  const db = await getDb();
  const res = await db.execute(
    all
      ? 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
      : 'SELECT * FROM notifications WHERE read_at IS NULL ORDER BY created_at DESC'
  );
  return NextResponse.json(res.rows);
}

// PATCH /api/notifications  { ids: number[] } — marque comme lues
export async function PATCH(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { ids } = await req.json() as { ids: number[] };
  if (!ids?.length) return NextResponse.json({ ok: true });

  const db = await getDb();
  await db.execute({
    sql: `UPDATE notifications SET read_at = datetime('now') WHERE id IN (${ids.map(() => '?').join(',')})`,
    args: ids,
  });
  return NextResponse.json({ ok: true });
}
