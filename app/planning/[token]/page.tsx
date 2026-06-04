import { getDb } from '@/lib/db';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import AdminLoginRedirect from '@/components/AdminLoginRedirect';

export default async function PlanningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const db = await getDb();
  const empRes = await db.execute({
    sql: "SELECT role FROM employees WHERE access_token = ?",
    args: [token],
  });

  // Admin employee → auto-login then redirect to full dashboard
  if (empRes.rows.length > 0 && empRes.rows[0].role === 'admin') {
    return <AdminLoginRedirect token={token} />;
  }

  return <EmployeeDashboard token={token} />;
}
