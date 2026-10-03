import { HolaMundo } from '@/components/home/HolaMundo';
import { LogoutButton } from '@/components/login/LogoutButton';
import { getCurrentUser } from '@/modules/auth/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute right-6 top-6 z-20 flex items-center gap-4 sm:right-10">
        <span className="text-sm text-white/70">{user.email}</span>
        <LogoutButton />
      </div>
      <HolaMundo />
    </main>
  );
}
