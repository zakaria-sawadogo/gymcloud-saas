'use client';

import { useState, type FormEvent } from 'react';
import { QrCode, LogIn, LogOut, Users, Camera, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { QrCameraScanner } from '@/components/dashboard/QrCameraScanner';
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isManualSearchOpen, setIsManualSearchOpen] = useState(false);

  const { data: occupancy, refetch: refetchOccupancy } = useApi<AccessLog[]>(
    salleId ? `/access-control/salle/${salleId}/current` : null,
  );

  // §14.x — extrait de handleScan (formulaire) pour être appelable
  // directement avec un jeton explicite depuis la caméra aussi — lire
  // qrCodeToken depuis l'état juste après un setQrCodeToken(token)
  // exposerait une valeur pas encore à jour (mise à jour d'état React
  // asynchrone), d'où le passage explicite du jeton en paramètre.
  const processScan = async (token: string) => {
    if (!salleId || !token) return;
    setIsScanning(true);
    setScanResult(null);
    setIdentifiedAdherent(null);

    try {
      const adherent = await apiClient.get<AdherentProfile>(`/adherents/qr/${token}`);
      setIdentifiedAdherent(adherent);
    } catch {
      // Jeton totalement inconnu — pas d'adhérent à afficher, le scan
      // ci-dessous produira de toute façon une erreur explicite.
    }

    try {
      const result = await apiClient.post<{ direction: 'ENTREE' | 'SORTIE' }>('/access-control/scan', {
        qrCodeToken: token,
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

  const handleScan = async (e: FormEvent) => {
    e.preventDefault();
    await processScan(qrCodeToken);
  };

  const handleCameraScan = (token: string) => {
    setIsCameraOpen(false);
    processScan(token);
  };

  // §14.x — corrige un vrai trou trouvé à l'audit : le DTO/service
  // existaient (accès manuel par recherche d'adhérent, sans caméra ni
  // jeton — téléphone oublié, casse...), jamais relié à un écran.
  // Distinct du champ texte existant (qui exige encore de connaître le
  // jeton) : ici on cherche l'adhérent par son nom directement.
  const handleManualAccess = async (adherentId: string, reason: string) => {
    if (!salleId) return;
    setIsManualSearchOpen(false);
    setIsScanning(true);
    setScanResult(null);
    setIdentifiedAdherent(null);
    try {
      const adherent = await apiClient.get<AdherentProfile>(`/adherents/${adherentId}`);
      setIdentifiedAdherent(adherent);
    } catch {
      // non bloquant, même logique que processScan
    }
    try {
      const log = await apiClient.post<{ checkOutAt: string | null }>('/access-control/manual', {
        adherentId,
        salleId,
        reason: reason || undefined,
      });
      setScanResult({
        direction: log.checkOutAt ? 'SORTIE' : 'ENTREE',
        message: log.checkOutAt ? 'Sortie enregistrée manuellement' : 'Entrée enregistrée manuellement',
      });
      refetchOccupancy();
    } catch (err) {
      setScanResult({
        direction: '',
        message: err instanceof ApiClientError ? err.message : 'Erreur lors de l\'enregistrement',
        isError: true,
      });
    } finally {
      setIsScanning(false);
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

          <Button
            type="button"
            variant="secondary"
            className="mb-3 w-full"
            onClick={() => setIsCameraOpen(true)}
          >
            <Camera className="h-4 w-4" />
            Scanner avec la caméra
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="mb-3 w-full"
            onClick={() => setIsManualSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            Ni caméra ni jeton disponible ? Rechercher un adhérent
          </Button>

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
              <p className="text-xs text-ink-400">{identifiedAdherent.memberCode}</p>
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

      {isCameraOpen && <QrCameraScanner onScan={handleCameraScan} onClose={() => setIsCameraOpen(false)} />}
      {isManualSearchOpen && salleId && (
        <ManualAccessSearchModal
          salleId={salleId}
          onConfirm={handleManualAccess}
          onClose={() => setIsManualSearchOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * §6.6, §14.x — Alternative à la caméra/au jeton : recherche
 * l'adhérent par son nom (téléphone oublié, casse, illisible...) et
 * enregistre son passage avec un motif optionnel — même principe de
 * filtrage côté client que la page "Adhérents", pas de nouvel
 * endpoint de recherche serveur nécessaire.
 */
function ManualAccessSearchModal({
  salleId,
  onConfirm,
  onClose,
}: {
  salleId: string;
  onConfirm: (adherentId: string, reason: string) => void;
  onClose: () => void;
}) {
  const { data: adherents, isLoading } = useApi<AdherentProfile[]>(`/adherents/salle/${salleId}`);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdherentProfile | null>(null);
  const [reason, setReason] = useState('');

  const filtered = (adherents ?? []).filter((a) => {
    if (!search) return false;
    const q = search.toLowerCase();
    return `${a.user.firstName} ${a.user.lastName}`.toLowerCase().includes(q) || a.memberCode?.toLowerCase().includes(q);
  });

  return (
    <Modal isOpen onClose={onClose} title="Rechercher un adhérent">
      {!selected ? (
        <>
          <Input
            autoFocus
            placeholder="Nom ou code membre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          {isLoading ? (
            <p className="text-sm text-ink-400">Chargement...</p>
          ) : search && filtered.length === 0 ? (
            <p className="text-sm text-ink-400">Aucun adhérent trouvé.</p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-50"
                >
                  <span className="font-medium text-ink-900">
                    {a.user.firstName} {a.user.lastName}
                  </span>
                  <span className="text-xs text-ink-400">{a.memberCode}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 rounded-lg bg-ink-50 p-3">
            <p className="text-sm font-medium text-ink-900">
              {selected.user.firstName} {selected.user.lastName}
            </p>
            <p className="text-xs text-ink-400">{selected.memberCode}</p>
          </div>
          <Input
            placeholder="Motif (optionnel) — ex: téléphone oublié"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mb-4"
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onConfirm(selected.id, reason)}>
              Enregistrer le passage
            </Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Retour
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
