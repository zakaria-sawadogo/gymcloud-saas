'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, tokenStorage } from './api-client';

export interface CurrentUserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  roleCode: string;
  proprietaireId: string | null;
  adherentId: string | null;
  coachId: string | null;
  gestionnaireId: string | null;
  salle: { id: string; name: string; logoUrl?: string; currency: string } | null;
}

interface AuthContextValue {
  user: CurrentUserProfile | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Fournisseur d'authentification global.
 *
 * Au montage, si un access token est déjà présent en session (retour
 * sur l'app après refresh de page), tente de recharger le profil via
 * `/auth/me` — le client API gère lui-même le refresh silencieux du
 * token en cas d'expiration (voir api-client.ts).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = async () => {
    try {
      const profile = await apiClient.get<CurrentUserProfile>('/auth/me');
      setUser(profile);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (tokenStorage.getAccessToken()) {
        await fetchUser();
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = async (phone: string, password: string) => {
    const tokens = await apiClient.post<{ accessToken: string; refreshToken: string }>(
      '/auth/login',
      { phone, password },
      { skipAuth: true },
    );
    tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    await fetchUser();
  };

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refetchUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur d\'un <AuthProvider>');
  return ctx;
}
