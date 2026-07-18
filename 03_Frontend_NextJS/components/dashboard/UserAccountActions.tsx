'use client';

import { useState } from 'react';
import { Ban, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { apiClient, ApiClientError } from '@/lib/api-client';
import type { UserAccountStatus } from '@/types';

/**
 * §4.2 — Actions de cycle de vie d'un compte, communes à gestionnaires,
 * coachs et adhérents. Un seul bouton pertinent affiché selon le
 * statut actuel plutôt qu'un menu chargé : ACTIF → Suspendre ;
 * SUSPENDU → Réactiver + Désactiver ; DESACTIVE → Réactiver.
 */
export function UserAccountActions({
  status,
  suspendPath,
  reactivatePath,
  deactivatePath,
  onChanged,
}: {
  status: UserAccountStatus;
  suspendPath: string;
  reactivatePath: string;
  deactivatePath: string;
  onChanged: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const call = async (path: string) => {
    setIsLoading(true);
    try {
      await apiClient.patch(path);
      onChanged();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
      setConfirmingDeactivate(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {status !== 'DESACTIVE' && <StatusBadge status={status} />}

      {status === 'ACTIF' && (
        <Button size="sm" variant="ghost" isLoading={isLoading} onClick={() => call(suspendPath)}>
          <Ban className="h-3.5 w-3.5" />
          Suspendre
        </Button>
      )}

      {status === 'SUSPENDU' && (
        <>
          <Button size="sm" variant="ghost" isLoading={isLoading} onClick={() => call(reactivatePath)}>
            <RotateCcw className="h-3.5 w-3.5" />
            Réactiver
          </Button>
          {confirmingDeactivate ? (
            <Button size="sm" variant="ghost" isLoading={isLoading} onClick={() => call(deactivatePath)}>
              Confirmer ?
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDeactivate(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </>
      )}

      {status === 'DESACTIVE' && (
        <Button size="sm" variant="ghost" isLoading={isLoading} onClick={() => call(reactivatePath)}>
          <RotateCcw className="h-3.5 w-3.5" />
          Réactiver
        </Button>
      )}
    </div>
  );
}
