'use client';

import { useState, type FormEvent } from 'react';
import { QrCode, LogIn, LogOut, AlertTriangle, Users, Ban, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';
import type { AccessLog, AdherentProfile } from '@/types';

export default function AccessControlPage() {
  const { user } = useAuth();
  const salleId = user?.salle?.id;
  const [qrCodeToken, setQrCodeToken] = useState('');
  const [identifiedAdherent, setIdentifiedAdherent] = useState<AdherentProfile | null>(null);
  const [scanResult, setScanResult] = useState<{ direction: string; message: string; isError?: boolean } | null>(
    null,
  );
  const [isScanning, setIsScanning] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const { data: occupancy, refetch: refetchOccupancy } = useApi<AccessLog[]>(
    salleId ? `/access-control/salle/${salleId}/current` : null,
  );
  const { data: anomalies, refetch: refetchAnomalies } = useApi<AccessLog[]>(
    salleId ? `/access-control/salle/${salleId}/anomalies` : null,
  );

  const handleScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!salleId || !qrCodeToken) return;
    setIsScanning(true);
    setScanResult(null);
    setIdentifiedAdherent(null);

    // Identifie toujours l'adhérent en premier — même si le scan
    // échoue ensuite (suspendu/expiré), le gestionnaire sait qui s'est
    // présenté et peut agir immédiatement (§6.13).
    try {
      const adherent = await apiClient.get<AdherentProfile>(`/adherents/qr/${qrCodeToken}`);
      setIdentifiedAdherent(adherent);
    } catch {
      // Jeton totalement inconnu — pas d'adhérent à afficher, le scan
      // ci-dessous produira de toute façon une erreur explicite.
    }

    try {
      const result = await apiClient.post<{ direction: 'ENTREE' | 'SORTIE' }>('/access-control/scan', {
        qrCodeToken,
        salleId,
      });
      setScanResult({
        direction: result.direction,
        message: result.direction === 'ENTREE' ? 'Entrée enregistrée' : 'Sortie enregistrée',
      });
      setQrCodeToken('');
      refetchOccupancy();
    } catch (err) {
      setScanResult({
        direction: '',
        message: err instanceof ApiClientError ? err.message : 'Erreur de scan',
        isError: true,
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!identifiedAdherent) return;
    setIsTogglingStatus(true);
    try {
      const action = identifiedAdherent.status === 'SUSPENDU' ? 'reactivate' : 'suspend';
      const updated = await apiClient.patch<AdherentProfile>(`/adherents/${identifiedAdherent.id}/${action}`);
      setIdentifiedAdherent(updated);
    } catch (err) {
      setScanResult({
        direction: '',
        message: err instanceof ApiClientError ? err.message : 'Une erreur est survenue',
        isError: true,
      });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Contrôle d'accès</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Scanner un QR Code</CardTitle>
          </CardHeader>
          <form onSubmit={handleScan}>
            <div className="mb-3 flex items-center gap-2">
              <QrCode className="h-5 w-5 text-ink-400" />
              <Input
                autoFocus
                value={qrCodeToken}
                onChange={(e) => setQrCodeToken(e.target.value)}
                placeholder="Jeton QR de l'adhérent"
              />
            </div>
            <Button type="submit" isLoading={isScanning} className="w-full">
              Enregistrer le passage
            </Button>
          </form>

          {scanResult && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                scanResult.isError
                  ? 'bg-red-50 text-red-700'
                  : scanResult.direction === 'ENTREE'
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-ink-50 text-ink-700'
              }`}
            >
              {!scanResult.isError &&
                (scanResult.direction === 'ENTREE' ? (
                  <LogIn className="h-4 w-4" />
                ) : (
                  <LogOut className="h-4 w-4" />
                ))}
              {scanResult.message}
            </div>
          )}

          {identifiedAdherent && (
            <div className="mt-4 rounded-lg border border-ink-100 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-900">
                  {identifiedAdherent.user.firstName} {identifiedAdherent.user.lastName}
                </span>
                <StatusBadge status={identifiedAdherent.status} />
              </div>
              <p className="mb-3 text-xs text-ink-400">{identifiedAdherent.memberCode}</p>
              <Button
                variant={identifiedAdherent.status === 'SUSPENDU' ? 'secondary' : 'danger'}
                size="sm"
                className="w-full"
                isLoading={isTogglingStatus}
                onClick={handleToggleStatus}
              >
                {identifiedAdherent.status === 'SUSPENDU' ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Réactiver l'accès
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5" />
                    Suspendre l'accès
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Présents actuellement ({occupancy?.length ?? 0})</CardTitle>
          </CardHeader>
          {!occupancy || occupancy.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="Personne dans la salle pour le moment" />
          ) : (
            <div className="space-y-2">
              {occupancy.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                  <span className="text-sm font-medium text-ink-900">
                    {log.adherent?.user.firstName} {log.adherent?.user.lastName}
                  </span>
                  <span className="text-xs text-ink-400">Entré à {formatDateTime(log.checkInAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {anomalies && anomalies.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2 text-accent-600">
                <AlertTriangle className="h-4 w-4" />
                Anomalies à vérifier ({anomalies.length})
              </span>
            </CardTitle>
          </CardHeader>
          <p className="mb-3 text-xs text-ink-400">
            Sessions fermées automatiquement après 6h sans scan de sortie — vérifiez qu'il ne s'agit pas d'un oubli
            de contrôle.
          </p>
          <div className="space-y-2">
            {anomalies.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg bg-accent-50 px-3 py-2 text-sm">
                <span className="font-medium text-ink-900">
                  {log.adherent?.user.firstName} {log.adherent?.user.lastName}
                </span>
                <span className="text-xs text-ink-500">Entré à {formatDateTime(log.checkInAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
