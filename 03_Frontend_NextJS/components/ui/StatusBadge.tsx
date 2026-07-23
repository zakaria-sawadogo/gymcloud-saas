import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  ACTIF: 'bg-primary-50 text-primary-700',
  EN_GRACE: 'bg-accent-50 text-accent-700',
  SUSPENDU: 'bg-ink-100 text-ink-600',
  DESACTIVE: 'bg-red-50 text-red-700',
  EN_ATTENTE_VALIDATION: 'bg-accent-50 text-accent-700',
  EXPIRE: 'bg-red-50 text-red-700',
  INACTIF: 'bg-ink-50 text-ink-400',
  VALIDE: 'bg-primary-50 text-primary-700',
  EN_ATTENTE: 'bg-accent-50 text-accent-700',
  EN_ATTENTE_PAIEMENT: 'bg-accent-50 text-accent-700',
  REJETE: 'bg-red-50 text-red-700',
  REMBOURSE: 'bg-ink-100 text-ink-600',
  CONFIRMEE: 'bg-primary-50 text-primary-700',
  ANNULEE: 'bg-red-50 text-red-700',
  TERMINEE: 'bg-ink-100 text-ink-600',
  EMISE: 'bg-accent-50 text-accent-700',
  PAYEE: 'bg-primary-50 text-primary-700',
  EN_RETARD: 'bg-red-50 text-red-700',
  ARCHIVE: 'bg-ink-100 text-ink-400',
  NOUVEAU: 'bg-accent-50 text-accent-700',
  CONTACTE: 'bg-ink-100 text-ink-600',
  CONVERTI: 'bg-primary-50 text-primary-700',
  PERDU: 'bg-red-50 text-red-700',
  NOUVELLE: 'bg-accent-50 text-accent-700',
  CONTACTEE: 'bg-ink-100 text-ink-600',
  CONVERTIE: 'bg-primary-50 text-primary-700',
  REJETEE: 'bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIF: 'Actif',
  EN_GRACE: 'En grâce',
  SUSPENDU: 'Suspendu',
  DESACTIVE: 'Désactivé',
  EN_ATTENTE_VALIDATION: 'En attente',
  EXPIRE: 'Expiré',
  INACTIF: 'Inactif',
  VALIDE: 'Validé',
  EN_ATTENTE: 'En attente',
  REJETE: 'Rejeté',
  REMBOURSE: 'Remboursé',
  CONFIRMEE: 'Confirmée',
  ANNULEE: 'Annulée',
  TERMINEE: 'Terminée',
  EMISE: 'En attente',
  PAYEE: 'Payée',
  EN_RETARD: 'En retard',
  ARCHIVE: 'Archivé',
  NOUVEAU: 'Nouveau',
  CONTACTE: 'Contacté',
  CONVERTI: 'Converti',
  PERDU: 'Perdu',
  NOUVELLE: 'Nouvelle',
  CONTACTEE: 'Contactée',
  CONVERTIE: 'Convertie',
  REJETEE: 'Rejetée',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        STATUS_STYLES[status] ?? 'bg-ink-50 text-ink-600',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
