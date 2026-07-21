const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export interface PublicSalle {
  id: string;
  name: string;
  slogan?: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  website?: string;
  socialLinks?: Record<string, string>;
  openingHours?: Record<string, string>;
}

export interface PublicFormule {
  id: string;
  name: string;
  description?: string;
  durationDays: number;
  price: number;
  currency: string;
}

export interface PublicCoursCollectif {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  capacity: number;
  coach: { user: { firstName: string; lastName: string } };
  _count: { bookings: number };
}

export class PublicApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new PublicApiError(body.message ?? 'Une erreur est survenue', res.status);
  }
  return res.json();
}

export async function getSalle(subdomain: string): Promise<PublicSalle | null> {
  try {
    return await request<PublicSalle>(`/public/salles/${subdomain}`);
  } catch (err) {
    if (err instanceof PublicApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getCatalogue(subdomain: string): Promise<PublicFormule[]> {
  return request<PublicFormule[]>(`/public/salles/${subdomain}/catalogue`);
}

export async function getCoursCollectifs(subdomain: string): Promise<PublicCoursCollectif[]> {
  return request<PublicCoursCollectif[]>(`/public/salles/${subdomain}/cours-collectifs`);
}

export interface PublicGalleryImage {
  id: string;
  imageUrl: string;
  caption?: string;
}

export interface PublicPost {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  publishedAt: string;
  expiresAt?: string;
}

export async function getGallery(subdomain: string): Promise<PublicGalleryImage[]> {
  return request<PublicGalleryImage[]>(`/public/salles/${subdomain}/gallery`);
}

export async function getPosts(subdomain: string): Promise<PublicPost[]> {
  return request<PublicPost[]>(`/public/salles/${subdomain}/posts`);
}

export interface PublicCoach {
  id: string;
  firstName: string;
  lastName: string;
  bio?: string;
  photoUrl?: string;
  specialties: string[];
}

export async function getCoachs(subdomain: string): Promise<PublicCoach[]> {
  return request<PublicCoach[]>(`/public/salles/${subdomain}/coachs`);
}

export interface PublicTestimonial {
  id: string;
  authorName: string;
  content: string;
  rating?: number;
}

export async function getTestimonials(subdomain: string): Promise<PublicTestimonial[]> {
  return request<PublicTestimonial[]>(`/public/salles/${subdomain}/testimonials`);
}

export interface RegisterProspectPayload {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  desiredCatalogueId?: string;
  message?: string;
}

export async function registerProspect(subdomain: string, payload: RegisterProspectPayload) {
  return request<{ id: string; message: string }>(`/public/salles/${subdomain}/prospects`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface RequestTrialPayload {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  trialCoursCollectifId: string;
  message?: string;
}

export async function requestTrialSession(subdomain: string, payload: RequestTrialPayload) {
  return request<{ id: string; message: string }>(`/public/salles/${subdomain}/essai-gratuit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
