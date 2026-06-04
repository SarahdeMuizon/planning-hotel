import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getManagerSession } from '@/lib/auth';

// GET /api/planning/requests?status=pending|all
export async function GET(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';

  const db = await getDb();
  const sql = status === 'pending'
    ? `SELECT lr.*, e.name as employee_name, e.color as employee_color
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE lr.status = 'pending'
       ORDER BY lr.created_at ASC`
    : `SELECT lr.*, e.name as employee_name, e.color as employee_color
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       ORDER BY lr.created_at DESC`;

  const res = await db.execute(sql);
  return NextResponse.json(res.rows);
}

// PUT /api/planning/requests  { id, action: 'approve'|'reject', rejectionReason? }
export async function PUT(req: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id, action, rejectionReason } = await req.json();
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date().toISOString();

  if (action === 'approve') {
    // Fetch the request to get its data
    const reqRes = await db.execute({
      sql: 'SELECT * FROM leave_requests WHERE id = ? AND status = ?',
      args: [id, 'pending'],
    });
    if (reqRes.rows.length === 0) {
      return NextResponse.json({ error: 'Demande introuvable ou déjà traitée' }, { status: 404 });
    }
    const lr = reqRes.rows[0];

    // Batch: update request status + insert into paid_leaves
    await db.batch([
      {
        sql: "UPDATE leave_requests SET status = 'approved', reviewed_at = ? WHERE id = ?",
        args: [now, id],
      },
      {
        sql: 'INSERT INTO paid_leaves (employee_id, start_date, end_date, leave_type, note) VALUES (?, ?, ?, ?, ?)',
        args: [lr.employee_id, lr.start_date, lr.end_date, lr.leave_type, lr.comment || null],
      },
    ], 'write');

    return NextResponse.json({ ok: true, action: 'approved' });
  }

  // Reject
  await db.execute({
    sql: "UPDATE leave_requests SET status = 'rejected', rejection_reason = ?, reviewed_at = ? WHERE id = ?",
    args: [rejectionReason || null, now, id],
  });
  return NextResponse.json({ ok: true, action: 'rejected' });
}
