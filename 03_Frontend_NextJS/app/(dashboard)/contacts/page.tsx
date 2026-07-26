'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

interface PlatformSettings {
  supportEmail?: string;
  supportPhone?: string;
  whatsappNumber?: string;
  updatedAt: string;
}

/**
 * §14.x — Coordonnées de contact de la plateforme GymCloud elle-même
 * (adresse d'envoi des e-mails de notification, support...),
 * éditables uniquement par le SUPER_ADMIN. Jusqu'ici, ces informations
 * n'existaient nulle part dans l'application — l'adresse d'envoi
 * était figée dans la configuration serveur, invisible et non
 * modifiable depuis l'interface.
 */
export default function ContactsPage() {
  const { data, isLoading, refetch } = useApi<PlatformSettings>('/platform-settings');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (data) {
      setSupportEmail(data.supportEmail ?? '');
      setSupportPhone(data.supportPhone ?? '');
      setWhatsappNumber(data.whatsappNumber ?? '');
    }
  }, [data]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    try {
      await apiClient.patch('/platform-settings', { supportEmail, supportPhone, whatsappNumber });
      setSuccess(true);
      refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-semibold text-ink-900">Contacts de la plateforme</h1>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Coordonnées</CardTitle>
        </CardHeader>
        <p className="mb-4 text-sm text-ink-500">
          Utilisées comme adresse d&apos;envoi pour les notifications par e-mail, et affichées comme contact de
          support GymCloud.
        </p>

        {isLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-ink-50" />
        ) : (
          <form onSubmit={handleSubmit}>
            <Field label="E-mail de support / d'envoi">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-ink-400" />
                <Input
                  type="email"
                  required
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="gymcloudsys@gmail.com"
                />
              </div>
            </Field>
            <Field label="Téléphone de support (optionnel)">
              <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
            </Field>
            <Field label="Numéro WhatsApp (optionnel)">
              <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
            </Field>

            {success && (
              <p className="mb-4 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700">
                Coordonnées mises à jour avec succès.
              </p>
            )}
            {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <Button type="submit" isLoading={isSubmitting}>
              Enregistrer
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
