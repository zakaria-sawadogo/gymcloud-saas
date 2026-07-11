'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { ApiClientError } from '@/lib/api-client';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(phone, password);
      router.push('/');
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
          <p className="text-sm text-ink-400">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-card bg-white p-6 shadow-card">
          <div className="mb-4">
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

          <div className="mb-5">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-800">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-ink-100 px-3 text-sm outline-none focus:border-primary-400"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full">
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
