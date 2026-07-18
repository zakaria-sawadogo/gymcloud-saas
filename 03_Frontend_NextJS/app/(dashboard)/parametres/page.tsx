'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

/**
 * §4.9 — Page Paramètres, commune à tous les rôles : chaque
 * utilisateur peut y modifier son prénom/nom/email, et changer son
 * mot de passe. Le téléphone (identifiant de connexion) n'est
 * volontairement pas modifiable ici, ni le rôle, ni le statut.
 */
export default function ParametresPage() {
  const { user, refetchUser } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Paramètres</h1>
        <p className="mt-1 text-sm text-ink-400">Gérez vos informations personnelles et votre mot de passe.</p>
      </div>

      {user && <ProfileForm currentFirstName={user.firstName} currentLastName={user.lastName} currentEmail={user.email} phone={user.phone} onSaved={refetchUser} />}
      <PasswordForm />
    </div>
  );
}

function ProfileForm({
  currentFirstName,
  currentLastName,
  currentEmail,
  phone,
  onSaved,
}: {
  currentFirstName: string;
  currentLastName: string;
  currentEmail?: string;
  phone: string;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const [email, setEmail] = useState(currentEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFirstName(currentFirstName);
    setLastName(currentLastName);
    setEmail(currentEmail ?? '');
  }, [currentFirstName, currentLastName, currentEmail]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    try {
      await apiClient.patch('/auth/me', { firstName, lastName, email: email || undefined });
      setSuccess(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mes informations</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} className="mt-4">
        <Field label="Téléphone">
          <Input value={phone} disabled />
        </Field>
        <p className="-mt-3 mb-4 text-xs text-ink-400">
          Identifiant de connexion — non modifiable ici.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom">
            <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Nom">
            <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field label="Email (optionnel)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="mb-4 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700">
            Informations mises à jour.
          </p>
        )}

        <Button type="submit" isLoading={isSubmitting}>
          Enregistrer
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} className="mt-4">
        <Field label="Mot de passe actuel">
          <Input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </Field>
        <Field label="Nouveau mot de passe">
          <Input type="password" required minLength={10} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
        <p className="-mt-3 mb-4 text-xs text-ink-400">
          Au moins 10 caractères, avec une minuscule, une majuscule et un chiffre.
        </p>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="mb-4 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700">
            Mot de passe changé. Vos autres sessions ont été déconnectées par sécurité.
          </p>
        )}

        <Button type="submit" isLoading={isSubmitting}>
          Changer le mot de passe
        </Button>

        <a href="/forgot-password" className="ml-4 text-sm text-ink-400 hover:text-ink-600">
          Mot de passe oublié à la place ?
        </a>
      </form>
    </Card>
  );
}
