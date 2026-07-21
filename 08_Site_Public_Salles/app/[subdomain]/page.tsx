import { notFound } from 'next/navigation';
import { getSalle, getCatalogue, getCoursCollectifs, getGallery, getPosts, getCoachs, getTestimonials } from '@/lib/api';
import { PublicSiteClient } from '@/components/PublicSiteClient';

/**
 * §3.2 — Site public d'une salle. Chaque salle a sa propre adresse
 * (fitnessclub.gymcloud.africa) réécrite en interne vers cette route
 * par le middleware (voir middleware.ts) selon le sous-domaine
 * demandé. Aucune fonction d'administration n'est jamais accessible
 * ici — uniquement présentation, activités, inscription en ligne et
 * demande d'essai gratuit (toutes deux de simples pistes commerciales,
 * jamais un compte adhérent ni une réservation réelle).
 */
export default async function SallePublicPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;

  const salle = await getSalle(subdomain);
  if (!salle) notFound();

  const [catalogue, coursCollectifs, gallery, posts, coachs, testimonials] = await Promise.all([
    getCatalogue(subdomain),
    getCoursCollectifs(subdomain),
    getGallery(subdomain),
    getPosts(subdomain),
    getCoachs(subdomain),
    getTestimonials(subdomain),
  ]);

  return (
    <PublicSiteClient
      subdomain={subdomain}
      salle={salle}
      catalogue={catalogue}
      coursCollectifs={coursCollectifs}
      gallery={gallery}
      posts={posts}
      coachs={coachs}
      testimonials={testimonials}
    />
  );
}
