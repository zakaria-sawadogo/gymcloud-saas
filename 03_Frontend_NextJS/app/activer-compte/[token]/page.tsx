'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiClient, ApiClientError } from '@/lib/api-client';

/**
 * §14.x — Page de première connexion, atteinte depuis le lien envoyé
 * par WhatsApp (et par e-mail quand disponible) à la création d'un
 * compte — remplace la transmission d'un mot de passe généré en
 * clair. Volontairement séparée de /forgot-password : celle-ci
 * confirme une identité déjà connue (téléphone + code), celle-ci
 * active un compte tout neuf à partir d'un jeton à usage unique déjà
 * lié au bon utilisateur — pas besoin de redemander le téléphone.
 */
export default function ActivateAccountPage() {
  const router = useRouter();
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';

  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'done'>('checking');
  const [firstName, setFirstName] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    apiClient
      .get<{ valid: boolean; firstName?: string }>(`/auth/activate/${token}`)
      .then((res) => {
        if (res.valid) {
          setFirstName(res.firstName ?? null);
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/activate', { token, newPassword });
      setStatus('done');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500">
            <Dumbbell className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">GymCloud</h1>
          <p className="text-sm text-ink-400">Activation de votre compte</p>
        </div>

        <div className="rounded-card bg-white p-6 shadow-card">
          {status === 'checking' && (
            <div className="flex justify-center py-6">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            </div>
          )}

          {status === 'invalid' && (
            <div>
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">
                Ce lien n&apos;est plus valide — il a peut-être déjà été utilisé, ou a expiré (validité de 7 jours).
                Utilisez &quot;Mot de passe oublié&quot; sur la page de connexion pour en obtenir un nouveau.
              </p>
              <Button onClick={() => router.push('/login')} className="w-full">
                Aller à la connexion
              </Button>
            </div>
          )}

          {status === 'valid' && (
            <form onSubmit={handleSubmit}>
              <p className="mb-5 text-sm text-ink-600">
                {firstName ? `Bienvenue ${firstName} !` : 'Bienvenue !'} Choisissez votre mot de passe pour activer
                votre compte.
              </p>
              <div className="mb-4">
                <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-ink-800">
                  Mot de passe
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-ink-100 px-3 text-sm outline-none focus:border-primary-400"
                />
                <p className="mt-1.5 text-xs text-ink-400">
                  Au moins 10 caractères, avec une minuscule, une majuscule et un chiffre.
                </p>
              </div>
              <div className="mb-5">
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-ink-800">
                  Confirmez le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={10}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-ink-100 px-3 text-sm outline-none focus:border-primary-400"
                />
              </div>
              {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" isLoading={isSubmitting} className="w-full">
                Activer mon compte
              </Button>
            </form>
          )}

          {status === 'done' && (
            <div>
              <p className="mb-4 rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
                Compte activé avec succès.
              </p>
              <Button onClick={() => router.push('/login')} className="w-full">
                Se connecter
              </Button>
            </div>
          )}
        </div>

        <Link href="/login" className="mt-6 block text-center text-sm text-ink-400 hover:text-ink-600">
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
