'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { tokenStorage } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * §11 — Téléchargement du rapport PDF d'un tableau de bord (Gestionnaire,
 * Propriétaire ou SUPER_ADMIN selon `path`). Même mécanisme que le
 * téléchargement des factures SaaS (fetch + Authorization Bearer +
 * blob), puisque ces routes exigent un token comme n'importe quelle
 * autre route protégée — un simple lien `<a href>` ne suffit pas.
 */
export function DownloadReportButton({ path, filename }: { path: string; filename: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const token = tokenStorage.getAccessToken();
      const res = await fetch(`${API_URL}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        alert('Impossible de générer le rapport PDF');
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
      <Download className="h-3.5 w-3.5" />
      Rapport PDF
    </Button>
  );
}
