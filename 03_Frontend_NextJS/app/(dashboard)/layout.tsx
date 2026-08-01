'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/Sidebar';
import { NotificationBell } from '@/components/layout/NotificationBell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  // §14.x — referme le tiroir mobile à chaque changement de page,
  // sinon il resterait ouvert par-dessus le nouvel écran.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null; // redirection en cours

  return (
    <div className="flex h-screen bg-ink-50">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="relative flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mb-4 flex items-center justify-between md:absolute md:right-8 md:top-8 md:z-40 md:mb-0">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 md:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
}
