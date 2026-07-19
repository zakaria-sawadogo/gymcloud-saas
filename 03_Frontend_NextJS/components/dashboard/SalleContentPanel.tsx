'use client';

import { useState, type FormEvent } from 'react';
import { Image as ImageIcon, Plus, Trash2, Megaphone, EyeOff, Eye } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import type { SalleGalleryImage, SallePost } from '@/types';

/**
 * §3.2, §3.4 — Contenu promotionnel du site public : galerie photo et
 * fil de publications, gérés par le propriétaire de la salle. Distinct
 * des cours collectifs (planning réel), pensé pour la mise en avant
 * commerciale (nouvelle offre, événement, ambiance de la salle...).
 */
export function SalleContentPanel({ salleId }: { salleId: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GalleryCard salleId={salleId} />
      <PostsCard salleId={salleId} />
    </div>
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
      await apiClient.post(`/salles/${salleId}/content/posts`, formData);
      setTitle('');
      setContent('');
      setFile(null);
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

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Publier
        </Button>
      </form>
    </Modal>
  );
}
