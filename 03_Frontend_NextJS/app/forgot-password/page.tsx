'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiClient, ApiClientError } from '@/lib/api-client';

/**
 * §4.9 — Réinitialisation de mot de passe en deux étapes : demande
 * d'un code (OTP), puis confirmation avec ce code + le nouveau mot de
 * passe. Accessible sans être connecté (routes publiques côté API).
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'confirm' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ message: string; devOtpCode?: string }>('/auth/forgot-password', { phone });
      setDevOtpCode(res.devOtpCode ?? null);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { phone, otpCode, newPassword });
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
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
          <p className="text-sm text-ink-400">Réinitialiser votre mot de passe</p>
        </div>

        <div className="rounded-card bg-white p-6 shadow-card">
          {step === 'phone' && (
            <form onSubmit={handleRequestOtp}>
              <div className="mb-5">
                <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-ink-800">
                  Numéro de téléphone
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+226 70 00 00 00"
                  className="h-10 w-full rounded-lg border border-ink-100 px-3 text-sm outline-none focus:border-primary-400"
                />
              </div>
              {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" isLoading={isLoading} className="w-full">
                Envoyer un code
              </Button>
            </form>
          )}

          {step === 'confirm' && (
            <form onSubmit={handleConfirm}>
              <p className="mb-4 text-sm text-ink-600">
                Si ce numéro existe, un code à 6 chiffres a été envoyé par SMS.
              </p>
              {devOtpCode && (
                <p className="mb-4 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700">
                  Mode démonstration (pas de passerelle SMS branchée) — code : <strong>{devOtpCode}</strong>
                </p>
              )}
              <div className="mb-4">
                <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-ink-800">
                  Code reçu
                </label>
                <input
                  id="otp"
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="h-10 w-full rounded-lg border border-ink-100 px-3 text-center text-lg tracking-[0.3em] outline-none focus:border-primary-400"
                />
              </div>
              <div className="mb-5">
                <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-ink-800">
                  Nouveau mot de passe
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
              {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" isLoading={isLoading} className="w-full">
                Réinitialiser le mot de passe
              </Button>
            </form>
          )}

          {step === 'done' && (
            <div>
              <p className="mb-4 rounded-lg bg-primary-50 px-3 py-3 text-sm text-primary-700">
                Mot de passe réinitialisé avec succès.
              </p>
              <Button onClick={() => router.push('/login')} className="w-full">
                Se connecter
              </Button>
            </div>
          )}
        </div>

        <a href="/login" className="mt-6 block text-center text-sm text-ink-400 hover:text-ink-600">
          ← Retour à la connexion
        </a>
      </div>
    </div>
  );
}
