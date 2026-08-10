'use client';

import { useState } from 'react';
import { KeyRound, CheckCircle2, Trash2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { formatDateTime } from '@/lib/utils';

const PROVIDERS = [{ value: 'ORANGE_MONEY', label: 'Orange Money' }] as const;

interface CredentialStatus {
  configured: boolean;
  lastRotatedAt: string | null;
}

/**
 * §14.x — Chaque salle a son propre compte marchand Mobile Money,
 * encaisse directement plutôt que de passer par un agrégateur
 * centralisé. Une fois saisi, un identifiant ne se réaffiche jamais
 * en clair — seul son statut ("configuré depuis le...") est visible,
 * pour éviter qu'une simple consultation de cette page ne devienne un
 * moyen d'exfiltrer un secret marchand.
 */
export function MobileMoneyCredentialsPanel({ salleId }: { salleId: string }) {
  const [provider] = useState<'ORANGE_MONEY'>('ORANGE_MONEY');
  const {
    data: status,
    isLoading,
    refetch,
  } = useApi<CredentialStatus>(`/salles/${salleId}/api-credentials/status?provider=${provider}`);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [merchantNumber, setMerchantNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/salles/${salleId}/api-credentials`, {
        provider,
        credentials: { username, password, merchantNumber },
      });
      setUsername('');
      setPassword('');
      setMerchantNumber('');
      refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Révoquer cet identifiant ? Les paiements Mobile Money directs ne fonctionneront plus tant qu\'un nouvel identifiant ne sera pas saisi.')) return;
    try {
      await apiClient.delete(`/salles/${salleId}/api-credentials?provider=${provider}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compte marchand Mobile Money</CardTitle>
      </CardHeader>
      <p className="mb-4 text-sm text-ink-500">
        Votre propre compte marchand — les paiements Mobile Money sont encaissés directement, sans intermédiaire.
      </p>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-ink-50" />
      ) : (
        <>
          {status?.configured && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-primary-50 p-3">
              <div className="flex items-center gap-2 text-sm text-primary-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {PROVIDERS.find((p) => p.value === provider)?.label} configuré
                  {status.lastRotatedAt && ` — depuis le ${formatDateTime(status.lastRotatedAt)}`}
                </span>
              </div>
              <button onClick={handleRevoke} className="text-ink-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          <p className="mb-3 text-xs text-ink-400">
            {status?.configured
              ? 'Saisir de nouveaux identifiants remplacera les actuels.'
              : "Renseignez les identifiants fournis par Orange Money lors de la signature de votre contrat marchand."}
          </p>

          <Field label="Nom d'utilisateur API">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Mot de passe API">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Numéro marchand">
            <Input value={merchantNumber} onChange={(e) => setMerchantNumber(e.target.value)} />
          </Field>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button
            disabled={!username || !password || !merchantNumber}
            isLoading={isSubmitting}
            onClick={handleSave}
          >
            <KeyRound className="h-4 w-4" />
            Enregistrer
          </Button>
        </>
      )}
    </Card>
  );
}
