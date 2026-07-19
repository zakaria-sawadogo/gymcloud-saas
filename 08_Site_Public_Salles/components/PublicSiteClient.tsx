'use client';

import { useState } from 'react';
import { MapPin, Phone, Clock, Sparkles, UserPlus, Users, ChevronRight, Camera } from 'lucide-react';
import type { PublicSalle, PublicFormule, PublicCoursCollectif, PublicGalleryImage, PublicPost } from '@/lib/api';
import { formatCurrency, formatDateTime, formatDate } from '@/lib/utils';
import { RegisterModal } from '@/components/RegisterModal';
import { TrialModal } from '@/components/TrialModal';

const DAY_LABELS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi',
  friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
};

export function PublicSiteClient({
  subdomain,
  salle,
  catalogue,
  coursCollectifs,
  gallery,
  posts,
}: {
  subdomain: string;
  salle: PublicSalle;
  catalogue: PublicFormule[];
  coursCollectifs: PublicCoursCollectif[];
  gallery: PublicGalleryImage[];
  posts: PublicPost[];
}) {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [trialCours, setTrialCours] = useState<PublicCoursCollectif | null>(null);
  const [preselectedFormule, setPreselectedFormule] = useState<string | undefined>(undefined);

  const brandVars = {
    '--salle-primary': salle.primaryColor || '#0F3B4D',
    '--salle-secondary': salle.secondaryColor || '#2E75B6',
  } as React.CSSProperties;

  const openRegisterWithFormule = (formuleId?: string) => {
    setPreselectedFormule(formuleId);
    setIsRegisterOpen(true);
  };

  return (
    <div style={brandVars}>
      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            {salle.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={salle.logoUrl} alt={salle.name} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--salle-primary)' }}
              >
                {salle.name.charAt(0)}
              </div>
            )}
            <span className="font-display text-base font-semibold text-ink-900">{salle.name}</span>
          </div>
          <button
            onClick={() => openRegisterWithFormule(undefined)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--salle-primary)' }}
          >
            S&apos;inscrire
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden px-6 py-20 text-white"
        style={{
          background: `linear-gradient(160deg, var(--salle-primary) 0%, var(--salle-secondary) 100%)`,
        }}
      >
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide">
            {salle.city}
          </p>
          <h1 className="max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-5xl">{salle.name}</h1>
          {salle.slogan && <p className="mt-4 max-w-xl text-lg text-white/85">{salle.slogan}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => openRegisterWithFormule(undefined)}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink-900 transition-transform hover:-translate-y-0.5"
            >
              S&apos;inscrire en ligne
            </button>
            {coursCollectifs.length > 0 && (
              <a
                href="#activites"
                className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Voir les activités
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Présentation ── */}
      {salle.description && (
        <section className="mx-auto max-w-3xl px-6 py-14">
          <p className="text-base leading-relaxed text-ink-600">{salle.description}</p>
        </section>
      )}

      {/* ── Actualités & promotions ── */}
      {posts.length > 0 && (
        <section className="px-6 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 font-display text-2xl font-semibold text-ink-900">Actualités</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <div key={post.id} className="overflow-hidden rounded-2xl border border-ink-100">
                  {post.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.imageUrl} alt={post.title} className="h-40 w-full object-cover" />
                  )}
                  <div className="p-5">
                    <p className="text-xs text-ink-400">{formatDate(post.publishedAt)}</p>
                    <h3 className="mt-1 font-display text-base font-semibold text-ink-900">{post.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-ink-600">{post.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Galerie photo ── */}
      {gallery.length > 0 && (
        <section className="bg-ink-50 px-6 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center gap-2">
              <Camera className="h-5 w-5" style={{ color: 'var(--salle-primary)' }} />
              <h2 className="font-display text-2xl font-semibold text-ink-900">Galerie</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {gallery.map((img) => (
                <div key={img.id} className="aspect-square overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.imageUrl} alt={img.caption ?? salle.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Activités / essai gratuit ── */}
      {coursCollectifs.length > 0 && (
        <section id="activites" className="bg-ink-50 px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: 'var(--salle-primary)' }} />
              <h2 className="font-display text-2xl font-semibold text-ink-900">Activités à venir</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {coursCollectifs.map((c) => {
                const full = c._count.bookings >= c.capacity;
                return (
                  <div key={c.id} className="rounded-2xl border border-ink-100 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-ink-900">{c.name}</h3>
                        <p className="mt-1 text-sm text-ink-400">{formatDateTime(c.startAt)}</p>
                        <p className="mt-1 text-xs text-ink-400">
                          Avec {c.coach.user.firstName} {c.coach.user.lastName}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-ink-50 px-2 py-1 text-xs text-ink-600">
                        <Users className="h-3 w-3" />
                        {c._count.bookings}/{c.capacity}
                      </span>
                    </div>
                    <button
                      onClick={() => setTrialCours(c)}
                      disabled={full}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold disabled:cursor-not-allowed disabled:text-ink-400"
                      style={{ color: full ? undefined : 'var(--salle-primary)' }}
                    >
                      {full ? 'Complet' : 'Demander un essai gratuit'}
                      {!full && <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Formules ── */}
      {catalogue.length > 0 && (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 font-display text-2xl font-semibold text-ink-900">Nos formules</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {catalogue.map((f) => (
                <div key={f.id} className="flex flex-col rounded-2xl border border-ink-100 p-6">
                  <h3 className="font-display text-lg font-semibold text-ink-900">{f.name}</h3>
                  {f.description && <p className="mt-1 text-sm text-ink-400">{f.description}</p>}
                  <p className="mt-4 font-display text-2xl font-semibold text-ink-900">
                    {formatCurrency(f.price, f.currency)}
                  </p>
                  <p className="mb-5 text-xs text-ink-400">{f.durationDays} jours</p>
                  <button
                    onClick={() => openRegisterWithFormule(f.id)}
                    className="mt-auto rounded-full py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--salle-primary)' }}
                  >
                    Choisir cette formule
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Contact ── */}
      <section className="bg-ink-50 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 font-display text-2xl font-semibold text-ink-900">Nous trouver</h2>
          <div className="space-y-3 text-sm text-ink-600">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-400" />
              {salle.address}, {salle.city}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 flex-shrink-0 text-ink-400" />
              {salle.phone}
            </p>
            {salle.openingHours && Object.keys(salle.openingHours).length > 0 && (
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-400" />
                <div>
                  {Object.entries(salle.openingHours).map(([day, hours]) => (
                    <p key={day}>
                      {DAY_LABELS[day] ?? day} — {hours}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="px-6 py-16 text-center">
        <UserPlus className="mx-auto mb-4 h-8 w-8" style={{ color: 'var(--salle-primary)' }} />
        <h2 className="font-display text-2xl font-semibold text-ink-900">Prêt à commencer ?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
          Inscrivez-vous en ligne, {salle.name} vous recontactera rapidement pour finaliser votre inscription.
        </p>
        <button
          onClick={() => openRegisterWithFormule(undefined)}
          className="mt-6 rounded-full px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--salle-primary)' }}
        >
          S&apos;inscrire en ligne
        </button>
      </section>

      <footer className="border-t border-ink-100 px-6 py-8 text-center">
        <p className="text-xs text-ink-400">
          {salle.name} · Propulsé par{' '}
          <span className="font-medium" style={{ color: 'var(--salle-primary)' }}>
            GymCloud
          </span>
        </p>
      </footer>

      {isRegisterOpen && (
        <RegisterModal
          subdomain={subdomain}
          catalogue={catalogue}
          preselectedFormuleId={preselectedFormule}
          onClose={() => setIsRegisterOpen(false)}
        />
      )}
      {trialCours && (
        <TrialModal subdomain={subdomain} cours={trialCours} onClose={() => setTrialCours(null)} />
      )}
    </div>
  );
}
