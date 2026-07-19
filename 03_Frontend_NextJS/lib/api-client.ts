import type { ApiError } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const ACCESS_TOKEN_KEY = 'gymcloud_access_token';
const REFRESH_TOKEN_KEY = 'gymcloud_refresh_token';

// ─────────────────────────────────────────────────────────────
// Stockage des jetons
//
// En mémoire + sessionStorage plutôt que localStorage : réduit la
// fenêtre d'exposition en cas de XSS, tout en survivant à un
// rafraîchissement de page (§13.x — bonnes pratiques de sécurité
// côté client complémentaires au HttpOnly cookie qui serait le choix
// idéal en production avec un backend adapté en conséquence).
// ─────────────────────────────────────────────────────────────

export const tokenStorage = {
  getAccessToken: () => (typeof window === 'undefined' ? null : sessionStorage.getItem(ACCESS_TOKEN_KEY)),
  getRefreshToken: () => (typeof window === 'undefined' ? null : sessionStorage.getItem(REFRESH_TOKEN_KEY)),
  setTokens: (accessToken: string, refreshToken: string) => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshPromise: Promise<string> | null = null;

/**
 * Renouvelle l'access token via le refresh token. Mutualise les appels
 * concurrents (plusieurs requêtes 401 simultanées ne déclenchent qu'un
 * seul appel de refresh).
 */
async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) throw new ApiClientError(401, 'Session expirée');

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      tokenStorage.clear();
      throw new ApiClientError(401, 'Session expirée, veuillez vous reconnecter');
    }

    const data = await res.json();
    tokenStorage.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Point d'entrée unique pour tous les appels API. Ajoute
 * automatiquement le Bearer token, et retente une fois la requête
 * après un refresh silencieux en cas de 401.
 */
async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { skipAuth, headers, ...rest } = options;

  const isFormData = rest.body instanceof FormData;
  const finalHeaders: Record<string, string> = {
    // Un FormData (upload de fichier) doit laisser le navigateur fixer
    // lui-même Content-Type avec sa frontière (boundary) — la forcer
    // ici casserait silencieusement l'envoi multipart.
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = tokenStorage.getAccessToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders });
  } catch (networkError) {
    // `fetch` lève ici pour toute panne AVANT réception d'une réponse HTTP :
    // serveur injoignable, CORS bloqué par le navigateur, DNS, etc. Sans ce
    // bloc, ces cas remontaient comme un message générique indiscernable
    // d'une vraie erreur applicative — on les distingue explicitement.
    console.error('[apiClient] Échec réseau vers', `${API_URL}${path}`, networkError);
    throw new ApiClientError(
      0,
      `Impossible de contacter le serveur (${API_URL}). Vérifiez que l'API est démarrée et que CORS_ORIGINS l'autorise.`,
    );
  }

  if (res.status === 401 && !skipAuth && !isRetry) {
    try {
      await refreshAccessToken();
      return request<T>(path, options, true);
    } catch {
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new ApiClientError(401, 'Session expirée');
    }
  }

  if (!res.ok) {
    const errorBody: ApiError = await res.json().catch(() => ({
      statusCode: res.status,
      message: res.statusText,
    }));
    const message = Array.isArray(errorBody.message) ? errorBody.message.join(', ') : errorBody.message;
    throw new ApiClientError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

export { ApiClientError };
