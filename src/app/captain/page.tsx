import CaptainDashboard from '@/components/captain/captain-dashboard';
import { currentUser } from '@/lib/current-user';
import { redirect } from 'next/navigation';

type AppUser = {
  role?: 'COMMAND' | 'CAPTAIN' | string;
  assignedShipId?: string | null;
};

export default async function CaptainPage() {
  const user = (await currentUser()) as AppUser | null;

  if (!user) redirect('/auth/sign-in');
  if (user.role !== 'CAPTAIN') redirect('/command');

  return <CaptainDashboard shipId={user.assignedShipId ?? 'MV-7'} />;
}
