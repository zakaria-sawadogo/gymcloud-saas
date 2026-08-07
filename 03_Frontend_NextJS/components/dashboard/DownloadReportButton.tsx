'use client';

import { useState } from 'react';
import { Download, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { tokenStorage } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * §11, §14.x — Téléchargement d'un fichier généré par le backend
 * (rapport PDF, export Excel...) — même mécanisme que le
 * téléchargement des factures SaaS (fetch + Authorization Bearer +
 * blob), puisque ces routes exigent un token comme n'importe quelle
 * autre route protégée — un simple lien `<a href>` ne suffit pas.
 *
 * `label` et `icon` personnalisables (§14.x — généralisé depuis un
 * composant initialement pensé pour le seul rapport PDF, réutilisé
 * tel quel pour l'export comptable Excel plutôt que de dupliquer
 * cette même logique de téléchargement authentifié).
 */
export function DownloadReportButton({
  path,
  filename,
  label = 'Rapport PDF',
  icon: Icon = Download,
}: {
  path: string;
  filename: string;
  label?: string;
  icon?: LucideIcon;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const token = tokenStorage.getAccessToken();
      const res = await fetch(`${API_URL}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        alert(`Impossible de générer : ${label}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button size="sm" variant="secondary" isLoading={isDownloading} onClick={handleDownload}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
