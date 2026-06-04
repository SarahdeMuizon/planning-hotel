import EmployeePlanning from '@/components/EmployeePlanning';

export default async function PlanningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <EmployeePlanning token={token} />;
}
