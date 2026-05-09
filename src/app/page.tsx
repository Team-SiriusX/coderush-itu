import { currentUser } from '@/lib/current-user';
import { redirect } from 'next/navigation';

type AppUser = {
  role?: 'COMMAND' | 'CAPTAIN' | string;
};

export default async function Home() {
  const user = (await currentUser()) as AppUser | null;

  if (!user) redirect('/auth/sign-in');
  if (user.role === 'COMMAND') redirect('/command');
  if (user.role === 'CAPTAIN') redirect('/captain');

  redirect('/auth/sign-in');
}
