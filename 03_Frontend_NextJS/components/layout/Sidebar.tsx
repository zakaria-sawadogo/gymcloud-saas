'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  CreditCard,
  CalendarCheck,
  QrCode,
  Megaphone,
  Building2,
  Layers,
  UserCog,
  ShieldCheck,
  Settings,
  Globe,
  BarChart3,
  History,
  Wallet,
  LogOut,
  Mail,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Navigation conditionnée par rôle (§2.3, §2.8).
 * Chaque rôle ne voit que les sections auxquelles il a effectivement
 * accès côté API — cohérent avec les permissions CASL du backend.
 */
const NAV_BY_ROLE: Record<string, NavItem[]> = {
  SUPER_ADMIN: [
    { label: 'Vue globale', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Salles', href: '/salles', icon: Building2 },
    { label: 'Propriétaires', href: '/proprietaires', icon: UserCog },
    { label: 'Demandes d\'abonnement', href: '/demandes-abonnement', icon: UserPlus },
    { label: 'Plans SaaS', href: '/plans-saas', icon: Layers },
    { label: 'Facturation SaaS', href: '/facturation-saas', icon: CreditCard },
    { label: 'Personnel interne', href: '/personnel-interne', icon: ShieldCheck },
    { label: 'Contrôle d\'accès', href: '/access-control', icon: QrCode },
    { label: 'Journal global', href: '/journal-global', icon: History },
    { label: 'Pays', href: '/pays', icon: Globe },
    { label: 'Contacts', href: '/contacts', icon: Mail },
    { label: 'Statistiques', href: '/statistiques', icon: BarChart3 },
  ],
  PROPRIETAIRE: [
    { label: 'Vue consolidée', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Mes salles', href: '/salles', icon: Building2 },
    { label: 'Clôture', href: '/cloture', icon: Wallet },
    { label: 'Journal d\'activité', href: '/journal-activite', icon: History },
    { label: 'Statistiques', href: '/statistiques', icon: BarChart3 },
    { label: 'Mon abonnement', href: '/mon-abonnement', icon: Layers },
  ],
  GESTIONNAIRE: [
    { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Adhérents', href: '/adherents', icon: Users },
    { label: 'Prospects', href: '/prospects', icon: UserPlus },
    { label: 'Formules d\'abonnement', href: '/abonnements', icon: Layers },
    { label: 'Contrôle d\'accès', href: '/access-control', icon: QrCode },
    { label: 'Réservations', href: '/bookings', icon: CalendarCheck },
    { label: 'Paiements', href: '/payments', icon: CreditCard },
    { label: 'Boutique', href: '/boutique', icon: ShoppingBag },
    { label: 'Finances', href: '/finances', icon: Wallet },
    { label: 'Marketing', href: '/marketing', icon: Megaphone },
    { label: 'Statistiques', href: '/statistiques', icon: BarChart3 },
  ],
  COACH: [
    { label: 'Mon planning', href: '/dashboard', icon: CalendarCheck },
    { label: 'Réservations', href: '/bookings', icon: CalendarCheck },
  ],
  ADHERENT: [
    { label: 'Mon espace', href: '/dashboard', icon: LayoutDashboard },
  ],

  // ── Personnel interne GymCloud (§2.2) — chaque rôle ne voit que ce
  // qui lui est réellement autorisé côté API (voir ability.factory.ts).
  ADMIN_GYMCLOUD: [
    { label: 'Vue globale', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Salles', href: '/salles', icon: Building2 },
    { label: 'Propriétaires', href: '/proprietaires', icon: UserCog },
    { label: 'Plans SaaS', href: '/plans-saas', icon: Layers },
    { label: 'Personnel interne', href: '/personnel-interne', icon: ShieldCheck },
  ],
  RESPONSABLE_SUPPORT: [
    { label: 'Salles', href: '/salles', icon: Building2 },
    { label: 'Propriétaires', href: '/proprietaires', icon: UserCog },
    { label: 'Contrôle d\'accès', href: '/access-control', icon: QrCode },
  ],
  RESPONSABLE_FINANCE: [
    { label: 'Facturation SaaS', href: '/facturation-saas', icon: CreditCard },
    { label: 'Plans SaaS', href: '/plans-saas', icon: Layers },
    { label: 'Propriétaires', href: '/proprietaires', icon: UserCog },
  ],
  RESPONSABLE_COMMERCIAL: [
    { label: 'Demandes d\'abonnement', href: '/demandes-abonnement', icon: UserPlus },
    { label: 'Propriétaires', href: '/proprietaires', icon: UserCog },
    { label: 'Salles', href: '/salles', icon: Building2 },
  ],
  SUPERVISEUR_PAYS: [
    { label: 'Salles', href: '/salles', icon: Building2 },
    { label: 'Propriétaires', href: '/proprietaires', icon: UserCog },
  ],
};

export function Sidebar({ isOpen = false, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = user ? (NAV_BY_ROLE[user.roleCode] ?? []) : [];

  return (
    <>
      {/* §14.x — voile de fond sur mobile uniquement, ferme le tiroir
          au clic en dehors — invisible et inerte sur desktop (md:hidden). */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-60 flex-col border-r border-ink-100 bg-white transition-transform duration-200 md:relative md:z-0 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <svg width="32" height="32" viewBox="0 0 26 26" fill="none" className="h-8 w-8">
            <rect width="26" height="26" rx="7" fill="#3DFF9A" />
            <path d="M8 13.2l3 3L18 9" stroke="#14432F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-lg font-semibold text-ink-900">GymCloud</span>
        </div>

        {user?.salle && (
          <div className="mx-4 mb-2 rounded-lg bg-ink-50 px-3 py-2">
            <p className="truncate text-xs font-medium text-ink-800">{user.salle.name}</p>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-ink-600 hover:bg-ink-50',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-100 p-3">
          {user && (
            <div className="mb-2 px-2">
              <p className="truncate text-sm font-medium text-ink-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-ink-400">{user.roleCode}</p>
            </div>
          )}
          <Link
            href="/parametres"
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === '/parametres' ? 'bg-primary-50 text-primary-700' : 'text-ink-600 hover:bg-ink-50',
            )}
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      </aside>
    </>
  );
}
