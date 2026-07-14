'use client';

import { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { requestTrialSession, PublicApiError, type PublicCoursCollectif } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

/**
 * §3.2 — Demande de séance d'essai gratuite : crée un prospect lié au
 * cours visé, jamais une vraie réservation ni un compte adhérent —
 * outil de prospection uniquement. La salle confirme la place par
 * téléphone.
 */
export function TrialModal({
  subdomain,
  cours,
  onClose,
}: {
  subdomain: string;
  cours: PublicCoursCollectif;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await requestTrialSession(subdomain, {
        firstName,
        lastName,
        phone,
        email: email || undefined,
        trialCoursCollectifId: cours.id,
      });
      setSuccess(res.message);
    } catch (err) {
      setError(err instanceof PublicApiError ? err.message : 'Une erreur est survenue, réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {success ? 'Demande envoyée' : 'Essai gratuit'}
          </h2>
          <button onClick={onClose} className="rounded-full p-1 text-ink-400 hover:bg-ink-50" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--salle-primary)' }} />
            <p className="text-sm text-ink-600">{success}</p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-full py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--salle-primary)' }}
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-lg bg-ink-50 px-3 py-2.5">
              <p className="text-sm font-medium text-ink-900">{cours.name}</p>
              <p className="text-xs text-ink-400">{formatDateTime(cours.startAt)}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-600">Prénom</label>
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-ink-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-600">Nom</label>
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-ink-400"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">Téléphone</label>
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+226 70 00 00 00"
                  className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-ink-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-600">E-mail (optionnel)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-ink-400"
                />
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--salle-primary)' }}
              >
                {isSubmitting ? 'Envoi...' : 'Confirmer ma demande'}
              </button>
              <p className="text-center text-xs text-ink-400">
                La salle confirmera votre place par téléphone — cette demande ne réserve pas encore votre place.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
