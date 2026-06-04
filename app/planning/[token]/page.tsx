import EmployeeDashboard from '@/components/EmployeeDashboard';

export default async function PlanningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <EmployeeDashboard token={token} />;
}
