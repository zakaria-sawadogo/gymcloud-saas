'use client';

import { useState, type FormEvent } from 'react';
import { Image as ImageIcon, Plus, Trash2, Megaphone, EyeOff, Eye, GalleryHorizontal, Star, Share2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import type { SalleGalleryImage, SallePost, SalleTestimonial } from '@/types';

const SOCIAL_PLATFORMS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/votresalle' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/votresalle' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@votresalle' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/2260000000' },
];

/**
 * §3.2, §3.4 — Contenu promotionnel du site public : bannière, galerie
 * photo, fil de publications, témoignages et réseaux sociaux, gérés
 * par le propriétaire de la salle. Distinct des cours collectifs
 * (planning réel), pensé pour la mise en avant commerciale (nouvelle
 * offre, événement, ambiance de la salle...).
 */
export function SalleContentPanel({
  salleId,
  coverImageUrl,
  socialLinks,
}: {
  salleId: string;
  coverImageUrl?: string;
  socialLinks?: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <CoverImageCard salleId={salleId} initialCoverImageUrl={coverImageUrl} />
      <SocialLinksCard salleId={salleId} initialSocialLinks={socialLinks} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GalleryCard salleId={salleId} />
        <PostsCard salleId={salleId} />
      </div>
      <TestimonialsCard salleId={salleId} />
    </div>
  );
}

function CoverImageCard({ salleId, initialCoverImageUrl }: { salleId: string; initialCoverImageUrl?: string }) {
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const result = await apiClient.post<{ coverImageUrl: string }>(`/salles/${salleId}/content/cover-image`, formData);
      setCoverImageUrl(result.coverImageUrl);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
      e.target.value = '';
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardHeader className="mb-0">
          <CardTitle>Bannière du site public</CardTitle>
        </CardHeader>
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100">
            <GalleryHorizontal className="h-3.5 w-3.5" />
            {coverImageUrl ? 'Remplacer' : 'Ajouter'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            disabled={isSubmitting}
          />
        </label>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isSubmitting ? (
        <div className="h-32 animate-pulse rounded-lg bg-ink-50" />
      ) : coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl} alt="Bannière" className="h-32 w-full rounded-lg object-cover" />
      ) : (
        <div className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-lg bg-ink-50 text-center">
          <ImageIcon className="h-5 w-5 text-ink-300" />
          <p className="text-xs text-ink-400">
            Sans bannière, l&apos;en-tête affiche un simple dégradé de vos couleurs.
          </p>
        </div>
      )}
    </Card>
  );
}

function GalleryCard({ salleId }: { salleId: string }) {
  const { data: images, isLoading, refetch } = useApi<SalleGalleryImage[]>(`/salles/${salleId}/content/gallery`);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleDelete = async (imageId: string) => {
    if (!confirm('Retirer cette image de la galerie ?')) return;
    try {
      await apiClient.delete(`/salles/${salleId}/content/gallery/${imageId}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardHeader className="mb-0">
          <CardTitle>Galerie photo</CardTitle>
        </CardHeader>
        <Button size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-ink-50" />
          ))}
        </div>
      ) : !images || images.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <ImageIcon className="h-6 w-6 text-ink-300" />
          <p className="text-sm text-ink-400">
            Aucune photo — ajoutez des images de vos installations pour votre site public.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg bg-ink-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.imageUrl} alt={img.caption ?? ''} className="h-full w-full object-cover" />
              <button
                onClick={() => handleDelete(img.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddGalleryImageModal
        salleId={salleId}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdded={() => {
          setIsAddOpen(false);
          refetch();
        }}
      />
    </Card>
  );
}

function AddGalleryImageModal({
  salleId,
  isOpen,
  onClose,
  onAdded,
}: {
  salleId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Choisissez une image');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (caption) formData.append('caption', caption);
      await apiClient.post(`/salles/${salleId}/content/gallery`, formData);
      setFile(null);
      setCaption('');
      onAdded();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter une photo">
      <form onSubmit={handleSubmit}>
        <Field label="Image (JPEG, PNG ou WebP — 5 Mo maximum)">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700"
          />
        </Field>
        <Field label="Légende (optionnel)">
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Notre plateau de musculation" />
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Ajouter à la galerie
        </Button>
      </form>
    </Modal>
  );
}

function PostsCard({ salleId }: { salleId: string }) {
  const { data: posts, isLoading, refetch } = useApi<SallePost[]>(`/salles/${salleId}/content/posts`);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const togglePublished = async (post: SallePost) => {
    try {
      await apiClient.patch(`/salles/${salleId}/content/posts/${post.id}`, { published: !post.published });
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Supprimer définitivement cette publication ?')) return;
    try {
      await apiClient.delete(`/salles/${salleId}/content/posts/${postId}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardHeader className="mb-0">
          <CardTitle>Actualités & promotions</CardTitle>
        </CardHeader>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Publier
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-ink-50" />
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Megaphone className="h-6 w-6 text-ink-300" />
          <p className="text-sm text-ink-400">
            Aucune publication — annoncez une nouvelle offre ou un événement sur votre site public.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="rounded-lg border border-ink-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{post.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-400">{post.content}</p>
                  <p className="mt-1 text-xs text-ink-300">{formatDate(post.publishedAt)}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() => togglePublished(post)}
                    title={post.published ? 'Dépublier' : 'Republier'}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-50"
                  >
                    {post.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {!post.published && (
                <span className="mt-2 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                  Dépubliée
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <CreatePostModal
        salleId={salleId}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          refetch();
        }}
      />
    </Card>
  );
}

function CreatePostModal({
  salleId,
  isOpen,
  onClose,
  onCreated,
}: {
  salleId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      if (file) formData.append('image', file);
      if (expiresAt) formData.append('expiresAt', new Date(expiresAt).toISOString());
      await apiClient.post(`/salles/${salleId}/content/posts`, formData);
      setTitle('');
      setContent('');
      setFile(null);
      setExpiresAt('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle publication">
      <form onSubmit={handleSubmit}>
        <Field label="Titre">
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle offre de rentrée !" />
        </Field>
        <Field label="Contenu">
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-primary-400"
            placeholder="Décrivez votre actualité..."
          />
        </Field>
        <Field label="Image (optionnel)">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700"
          />
        </Field>
        <Field label="Offre valable jusqu'au (optionnel)">
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
        </Field>
        <p className="-mt-3 mb-4 text-xs text-ink-400">
          Laissez vide pour une actualité sans date limite. Avec une date, un badge de compte à rebours s&apos;affiche
          et la publication disparaît automatiquement du site une fois passée.
        </p>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Publier
        </Button>
      </form>
    </Modal>
  );
}

function SocialLinksCard({ salleId, initialSocialLinks }: { salleId: string; initialSocialLinks?: Record<string, string> }) {
  const [links, setLinks] = useState<Record<string, string>>(initialSocialLinks ?? {});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      // Ne garder que les liens réellement renseignés.
      const cleaned = Object.fromEntries(Object.entries(links).filter(([, v]) => v.trim().length > 0));
      await apiClient.patch(`/salles/${salleId}/branding`, { socialLinks: cleaned });
      setLinks(cleaned);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réseaux sociaux</CardTitle>
      </CardHeader>
      <p className="mb-4 text-xs text-ink-400">
        Affichés en icônes dans le pied de page du site public. Laissez vide ce que vous n&apos;utilisez pas.
      </p>
      <div className="space-y-3">
        {SOCIAL_PLATFORMS.map((platform) => (
          <Field key={platform.key} label={platform.label}>
            <Input
              value={links[platform.key] ?? ''}
              onChange={(e) => setLinks((prev) => ({ ...prev, [platform.key]: e.target.value }))}
              placeholder={platform.placeholder}
            />
          </Field>
        ))}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Button onClick={handleSave} isLoading={isSubmitting} size="sm">
        Enregistrer
      </Button>
    </Card>
  );
}

function TestimonialsCard({ salleId }: { salleId: string }) {
  const { data: testimonials, isLoading, refetch } = useApi<SalleTestimonial[]>(`/salles/${salleId}/content/testimonials`);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce témoignage ?')) return;
    try {
      await apiClient.delete(`/salles/${salleId}/content/testimonials/${id}`);
      refetch();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardHeader className="mb-0">
          <CardTitle>Avis clients</CardTitle>
        </CardHeader>
        <Button size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>
      <p className="mb-4 text-xs text-ink-400">
        Saisis par vous — pas de dépôt d&apos;avis public en libre accès, pour éviter les faux avis.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-ink-50" />
          ))}
        </div>
      ) : !testimonials || testimonials.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">Aucun témoignage pour l&apos;instant.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {testimonials.map((t) => (
            <div key={t.id} className="rounded-lg border border-ink-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {t.rating && (
                    <div className="mb-1 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < t.rating! ? 'fill-amber-400 text-amber-400' : 'text-ink-200'}`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="line-clamp-3 text-sm italic text-ink-700">&laquo; {t.content} &raquo;</p>
                  <p className="mt-1 text-xs font-medium text-ink-500">— {t.authorName}</p>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddTestimonialModal
        salleId={salleId}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdded={() => {
          setIsAddOpen(false);
          refetch();
        }}
      />
    </Card>
  );
}

function AddTestimonialModal({
  salleId,
  isOpen,
  onClose,
  onAdded,
}: {
  salleId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/salles/${salleId}/content/testimonials`, { authorName, content, rating });
      setAuthorName('');
      setContent('');
      setRating(5);
      onAdded();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un témoignage">
      <form onSubmit={handleSubmit}>
        <Field label="Nom de l'adhérent">
          <Input required value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Fatou K." />
        </Field>
        <Field label="Témoignage">
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-primary-400"
            placeholder="Ce que la personne a dit ou aurait dit de la salle..."
          />
        </Field>
        <Field label="Note">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
                <Star className={`h-6 w-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-ink-200'}`} />
              </button>
            ))}
          </div>
        </Field>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Ajouter
        </Button>
      </form>
    </Modal>
  );
}
