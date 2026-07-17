'use client';

import { useState, useEffect, useRef, type FormEvent, type CSSProperties } from 'react';
import styles from './landing.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/** Combine des noms de classes vers le module CSS scopé de la landing page. */
function c(...names: string[]): string {
  return names.map((n) => styles[n]).filter(Boolean).join(' ');
}

/** Style avec propriété CSS personnalisée (--h) — non typée nativement par React. */
function cssVar(vars: Record<string, string>): CSSProperties {
  return vars as CSSProperties;
}

interface PublicPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceAnnual: number;
  trialDays: number;
  quotaSalles: number;
  quotaGestionnaires: number | null;
  quotaAdherents: number | null;
  modules: string[];
}

const MODULE_LABELS: Record<string, string> = {
  qr_code: "Contrôle d'accès QR",
  reservations: 'Réservations',
  marketing: 'Marketing & fidélisation',
  mobile: 'Application mobile',
  whatsapp: 'Notifications WhatsApp',
  rapports_avances: 'Rapports avancés',
  api: 'Accès API',
  bi: 'Tableaux de bord avancés (BI)',
};

/** Puces de fonctionnalités dérivées des vraies données du plan — jamais de texte figé qui pourrait se désynchroniser des tarifs réels. */
function buildPlanFeatures(plan: PublicPlan): string[] {
  const feats: string[] = [];
  feats.push(plan.quotaSalles === 1 ? '1 salle incluse' : `${plan.quotaSalles} salles incluses`);
  feats.push(plan.quotaGestionnaires == null ? 'Gestionnaires illimités' : `${plan.quotaGestionnaires} gestionnaire${plan.quotaGestionnaires > 1 ? 's' : ''}`);
  feats.push(plan.quotaAdherents == null ? 'Adhérents illimités' : `Jusqu'à ${plan.quotaAdherents.toLocaleString('fr-FR')} adhérents`);
  feats.push('Adhérents, abonnements, paiements');
  // Modules avancés présents sur ce plan, dans un ordre de lecture stable
  ['qr_code', 'reservations', 'marketing', 'mobile', 'whatsapp', 'rapports_avances', 'api', 'bi']
    .filter((m) => plan.modules.includes(m))
    .forEach((m) => feats.push(MODULE_LABELS[m]));
  if (!plan.modules.includes('rapports_avances')) feats.push('Rapports standards');
  return feats;
}

const FAQ_ITEMS = [
  {
    q: 'GymCloud fonctionne-t-il avec Orange Money, Moov Money et Wave ?',
    a: "Oui. Les trois opérateurs sont pris en charge pour l'encaissement des adhérents comme pour le règlement de votre propre abonnement GymCloud, en plus des espèces.",
  },
  {
    q: 'Puis-je gérer plusieurs salles avec un seul compte ?',
    a: "Oui, c'est justement pensé pour ça. Un compte propriétaire peut regrouper plusieurs salles, chacune avec ses propres gestionnaires, coachs et adhérents, tout en gardant une vue consolidée des revenus.",
  },
  {
    q: 'Que se passe-t-il si je change de plan en cours de mois ?',
    a: 'Le changement est immédiat et le montant est calculé au prorata des jours restants sur votre période en cours — vous ne payez jamais deux fois pour la même période.',
  },
  {
    q: "Mes adhérents ont-ils besoin d'un smartphone ?",
    a: "Non pour l'accès — le badge QR peut être imprimé sur une carte physique. L'application mobile adhérent est un service en plus, pas une obligation.",
  },
  {
    q: 'Est-ce que je peux essayer avant de payer ?',
    a: "Le plan Starter démarre par une période d'essai gratuite. Aucune facture n'est émise tant que l'essai est en cours.",
  },
];

/**
 * §3.2, §9.5 — Page d'accueil publique de GymCloud (vitrine), servie
 * directement par l'app à la racine "/" pour les visiteurs non
 * connectés. Contenu porté depuis l'ancien site vitrine statique
 * (07_Site_Vitrine), désormais abandonné au profit d'un seul domaine
 * unique — plus de dépendance à un hébergement séparé.
 *
 * Styles isolés via CSS Module (landing.module.css) : tous les
 * sélecteurs globaux de l'origine (*, body, a, img, h1-h3) ont été
 * scopés à .landingRoot pour ne jamais affecter le reste de l'app.
 */
export function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const planIdRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Sourdine du scroll fluide pour les ancres internes, uniquement
  // pendant que cette page est montée — jamais laissé actif ailleurs
  // dans l'app au moment de la navigation.
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  // Plans publics, pour le sélecteur du formulaire
  useEffect(() => {
    fetch(`${API_URL}/public/plans`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: PublicPlan[]) => setPlans(data))
      .catch(() => {
        /* silencieux — le champ reste optionnel si l'API n'est pas joignable */
      });
  }, []);

  // Révélation au défilement — comportement identique à l'original
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const els = root.querySelectorAll(`.${styles.reveal}`);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.in);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');

    const payload = {
      firstName: firstNameRef.current?.value.trim() ?? '',
      lastName: lastNameRef.current?.value.trim() ?? '',
      phone: phoneRef.current?.value.trim() ?? '',
      email: emailRef.current?.value.trim() || undefined,
      companyName: companyNameRef.current?.value.trim() || undefined,
      city: cityRef.current?.value.trim() || undefined,
      desiredPlanId: planIdRef.current?.value || undefined,
      message: messageRef.current?.value.trim() || undefined,
    };

    try {
      const res = await fetch(`${API_URL}/public/subscription-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(Array.isArray(body.message) ? body.message[0] : body.message || 'Une erreur est survenue.');
      }
      const result = await res.json();
      setFormMessage(result.message);
      setFormStatus('success');
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : "Impossible d'envoyer votre demande — réessayez dans un instant.");
      setFormStatus('error');
    }
  };

  return (
    <div className={styles.landingRoot} ref={containerRef}>
      <header>
        <nav className={c('wrap')}>
          <a href="#top" className={c('logo')}>
            <svg className={c('logo-mark')} viewBox="0 0 26 26" fill="none">
              <rect width="26" height="26" rx="7" fill="#3DFF9A" />
              <path d="M8 13.2l3 3L18 9" stroke="#14432F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            GymCloud
          </a>
          <div className={c('nav-links')}>
            <a href="#modules">Fonctionnalités</a>
            <a href="#comment">Comment ça marche</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#faq">Questions</a>
          </div>
          <div className={c('nav-actions')}>
            <a href="/login" className={c('nav-login')}>
              Se connecter
            </a>
            <a href="#contact" className={c('nav-cta')}>
              Demander une démo
            </a>
            <button
              className={c('nav-mobile-toggle')}
              aria-label="Ouvrir le menu"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((v) => !v)}
            >
              {isMobileMenuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </nav>
        {isMobileMenuOpen && (
          <div className={c('mobile-menu', 'open')}>
            <a href="#modules" onClick={closeMobileMenu}>
              Fonctionnalités
            </a>
            <a href="#comment" onClick={closeMobileMenu}>
              Comment ça marche
            </a>
            <a href="#tarifs" onClick={closeMobileMenu}>
              Tarifs
            </a>
            <a href="#faq" onClick={closeMobileMenu}>
              Questions
            </a>
            <a href="/login" onClick={closeMobileMenu}>
              Se connecter
            </a>
            <a href="#contact" className={c('nav-cta')} onClick={closeMobileMenu}>
              Demander une démo
            </a>
          </div>
        )}
      </header>

      <main id="top">
        {/* HERO */}
        <section className={c('hero')} style={{ paddingTop: '96px' }}>
          <div className={c('grain')} aria-hidden="true" />
          <div className={c('wrap', 'hero-grid')}>
            <div>
              <span className={c('eyebrow')}>
                <span className={c('dot')} /> Conçu pour les salles d'Afrique de l'Ouest
              </span>
              <h1>
                Votre salle de sport, <em>pilotée</em> comme une vraie entreprise.
              </h1>
              <p className={c('lead')}>
                GymCloud remplace le cahier, la caisse en espèces et les fiches papier par un système unique : accès
                par QR code, adhérents, paiements Mobile Money et facturation — pour une salle ou pour toute une
                chaîne.
              </p>
              <div className={c('hero-ctas')}>
                <a href="#contact" className={c('btn-primary')}>
                  Demander une démo
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a href="#tarifs" className={c('btn-ghost')}>
                  Voir les tarifs
                </a>
              </div>
              <p className={c('hero-microtext')}>Aucune carte bancaire requise · Essai gratuit sur le plan STARTER</p>
            </div>

            <div className={c('scan-stage')} aria-hidden="true">
              <div className={c('badge')}>
                <div className={c('scan-ring')} />
                <div className={c('badge-top')}>
                  <div>
                    <div className={c('badge-name')}>Aïcha Ouédraogo</div>
                    <div className={c('badge-sub')}>MEMBRE · GC-2K91-4F</div>
                  </div>
                  <div className={c('badge-chip')} />
                </div>
                <div className={c('qr-wrap')}>
                  <svg viewBox="0 0 100 100" width="100%">
                    <rect width="100" height="100" fill="#FAF8F3" />
                    <g fill="#14432F">
                      <rect x="8" y="8" width="24" height="24" />
                      <rect x="14" y="14" width="12" height="12" fill="#FAF8F3" />
                      <rect x="18" y="18" width="4" height="4" fill="#14432F" />
                      <rect x="68" y="8" width="24" height="24" />
                      <rect x="74" y="14" width="12" height="12" fill="#FAF8F3" />
                      <rect x="78" y="18" width="4" height="4" fill="#14432F" />
                      <rect x="8" y="68" width="24" height="24" />
                      <rect x="14" y="74" width="12" height="12" fill="#FAF8F3" />
                      <rect x="18" y="78" width="4" height="4" fill="#14432F" />
                      <rect x="40" y="8" width="6" height="6" />
                      <rect x="52" y="8" width="6" height="6" />
                      <rect x="40" y="20" width="6" height="6" />
                      <rect x="52" y="26" width="6" height="6" />
                      <rect x="40" y="40" width="6" height="6" />
                      <rect x="52" y="40" width="6" height="6" />
                      <rect x="64" y="40" width="6" height="6" />
                      <rect x="40" y="52" width="6" height="6" />
                      <rect x="76" y="52" width="6" height="6" />
                      <rect x="84" y="52" width="6" height="6" />
                      <rect x="40" y="64" width="6" height="6" />
                      <rect x="52" y="64" width="6" height="6" />
                      <rect x="64" y="64" width="6" height="6" />
                      <rect x="76" y="76" width="6" height="6" />
                      <rect x="84" y="84" width="6" height="6" />
                      <rect x="40" y="84" width="6" height="6" />
                      <rect x="52" y="84" width="6" height="6" />
                      <rect x="64" y="84" width="6" height="6" />
                    </g>
                  </svg>
                  <div className={c('scan-line')} />
                </div>
                <div className={c('badge-foot')}>
                  <span className={c('badge-id')}>Salle Iron Temple · Ouaga</span>
                  <span className={c('status-pill')}>
                    <svg viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.2l2.3 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Accès autorisé
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className={c('strip')} aria-hidden="true">
          <div className={c('strip-inner')}>
            <span>ORANGE MONEY</span>
            <span>·</span>
            <span>MOOV MONEY</span>
            <span>·</span>
            <span>WAVE</span>
            <span>·</span>
            <span>CONTRÔLE D'ACCÈS QR</span>
            <span>·</span>
            <span>MULTI-SALLES</span>
            <span>·</span>
            <span>FACTURATION AUTOMATIQUE</span>
            <span>·</span>
            <span>ORANGE MONEY</span>
            <span>·</span>
            <span>MOOV MONEY</span>
            <span>·</span>
            <span>WAVE</span>
            <span>·</span>
            <span>CONTRÔLE D'ACCÈS QR</span>
            <span>·</span>
            <span>MULTI-SALLES</span>
            <span>·</span>
            <span>FACTURATION AUTOMATIQUE</span>
            <span>·</span>
          </div>
        </div>

        {/* AVANT / APRES */}
        <section>
          <div className={c('wrap')}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>La transformation</span>
              <h2>Le même métier. Un fonctionnement totalement différent.</h2>
              <p>Pas besoin de changer votre façon de gérer votre salle — juste la manière dont c'est enregistré, suivi et sécurisé.</p>
            </div>

            <div className={c('compare', 'reveal')}>
              <div className={c('compare-col', 'before')}>
                <span className={c('compare-label')}>Aujourd'hui, sans GymCloud</span>
                <div className={c('compare-item')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="#C6491F" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Un cahier pour noter qui a payé, et qui a oublié
                </div>
                <div className={c('compare-item')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="#C6491F" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  L'accueil laisse entrer sur simple parole
                </div>
                <div className={c('compare-item')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="#C6491F" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Impossible de savoir le revenu du mois sans tout ressaisir
                </div>
                <div className={c('compare-item')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="#C6491F" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Une deuxième salle = une deuxième comptabilité, séparée
                </div>
              </div>
              <div className={c('compare-col', 'after')}>
                <span className={c('compare-label')}>Avec GymCloud</span>
                <div className={c('compare-item')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5l3.5 3.5L13 5" stroke="#3DFF9A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Chaque paiement Espèces ou Mobile Money horodaté automatiquement
                </div>
                <div className={c('compare-item')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5l3.5 3.5L13 5" stroke="#3DFF9A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Le badge QR refuse l'accès si l'abonnement est expiré
                </div>
                <div className={c('compare-item')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5l3.5 3.5L13 5" stroke="#3DFF9A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Revenus du jour, du mois et par salle en un coup d'œil
                </div>
                <div className={c('compare-item')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5l3.5 3.5L13 5" stroke="#3DFF9A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Toutes vos salles pilotées depuis un seul tableau de bord
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* APERÇU TABLEAU DE BORD */}
        <section style={{ paddingTop: '0' }}>
          <div className={c('wrap')}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>Sous le capot</span>
              <h2>Un vrai tableau de bord, pas un tableur.</h2>
              <p>Revenus, salles, abonnements qui expirent, encaissements à valider — tout au même endroit, mis à jour en temps réel.</p>
            </div>

            <div className={c('dash-mockup', 'reveal')}>
              <div className={c('dash-chrome')}>
                <span className={c('dash-dot')} style={{ background: '#FF5F57' }} />
                <span className={c('dash-dot')} style={{ background: '#FEBC2E' }} />
                <span className={c('dash-dot')} style={{ background: '#28C840' }} />
                <span className={c('dash-url')}>app.gymcloud.africa/vue-globale</span>
              </div>
              <div className={c('dash-body')}>
                <div className={c('dash-stats')}>
                  <div className={c('dash-stat')}>
                    <span className={c('dash-stat-label')}>Revenus ce mois</span>
                    <span className={c('dash-stat-value')}>
                      2 840 000 <small>XOF</small>
                    </span>
                    <span className={c('dash-stat-delta')}>+ 12% vs mois dernier</span>
                  </div>
                  <div className={c('dash-stat')}>
                    <span className={c('dash-stat-label')}>Adhérents actifs</span>
                    <span className={c('dash-stat-value')}>1 247</span>
                    <span className={c('dash-stat-delta')}>3 salles</span>
                  </div>
                  <div className={c('dash-stat')}>
                    <span className={c('dash-stat-label')}>Abonnements SaaS</span>
                    <span className={c('dash-stat-value')}>
                      98% <small>à jour</small>
                    </span>
                    <span className={c('dash-stat-delta', 'dash-stat-delta--warn')}>1 validation en attente</span>
                  </div>
                </div>

                <div className={c('dash-grid')}>
                  <div className={c('dash-chart')}>
                    <span className={c('dash-panel-label')}>Revenus — 7 derniers jours</span>
                    <div className={c('dash-bars')}>
                      <div className={c('dash-bar')} style={cssVar({ '--h': '38%' })} />
                      <div className={c('dash-bar')} style={cssVar({ '--h': '52%' })} />
                      <div className={c('dash-bar')} style={cssVar({ '--h': '41%' })} />
                      <div className={c('dash-bar')} style={cssVar({ '--h': '67%' })} />
                      <div className={c('dash-bar')} style={cssVar({ '--h': '58%' })} />
                      <div className={c('dash-bar')} style={cssVar({ '--h': '79%' })} />
                      <div className={c('dash-bar', 'dash-bar--now')} style={cssVar({ '--h': '64%' })} />
                    </div>
                  </div>
                  <div className={c('dash-activity')}>
                    <span className={c('dash-panel-label')}>Activité récente</span>
                    <div className={c('dash-activity-item')}>
                      <span className={c('dash-activity-dot')} />
                      <div>
                        <p>Paiement encaissé — Fatou D.</p>
                        <span>Il y a 4 min · Mobile Money</span>
                      </div>
                    </div>
                    <div className={c('dash-activity-item')}>
                      <span className={c('dash-activity-dot')} />
                      <div>
                        <p>Accès autorisé — Ibrahim T.</p>
                        <span>Il y a 11 min · Salle Ouaga 2000</span>
                      </div>
                    </div>
                    <div className={c('dash-activity-item')}>
                      <span className={c('dash-activity-dot', 'dash-activity-dot--warn')} />
                      <div>
                        <p>Abonnement expire dans 2 jours — Awa K.</p>
                        <span>Il y a 20 min</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MODULES */}
        <section id="modules" style={{ background: 'var(--paper-dim)' }}>
          <div className={c('wrap')}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>Ce que couvre GymCloud</span>
              <h2>Six modules. Une seule plateforme.</h2>
              <p>Activés selon votre formule — vous ne payez que pour ce dont votre salle a besoin aujourd'hui.</p>
            </div>

            <div className={c('modules', 'reveal')}>
              <div className={c('module')}>
                <svg className={c('module-icon')} viewBox="0 0 38 38" fill="none">
                  <circle cx="19" cy="13" r="6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M7 31c1.5-6.5 6.5-10 12-10s10.5 3.5 12 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <h3>Adhérents & abonnements</h3>
                <p>Dossier complet, historique des formules, statut à jour automatiquement — plus de fiches perdues.</p>
              </div>
              <div className={c('module')}>
                <svg className={c('module-icon')} viewBox="0 0 38 38" fill="none">
                  <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="21" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="7" y="21" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M24 25h7M27.5 21.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <h3>Contrôle d'accès QR</h3>
                <p>Un badge, un scan, une décision instantanée. Aucun abonnement expiré ne passe la porte.</p>
              </div>
              <div className={c('module')}>
                <svg className={c('module-icon')} viewBox="0 0 38 38" fill="none">
                  <rect x="5" y="11" width="28" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M5 17h28" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M10 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <h3>Paiements & Mobile Money</h3>
                <p>Espèces, Orange Money, Moov Money, Wave — chaque encaissement génère un reçu, sans exception.</p>
              </div>
              <div className={c('module')}>
                <svg className={c('module-icon')} viewBox="0 0 38 38" fill="none">
                  <rect x="6" y="8" width="26" height="24" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M6 15h26" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 4v7M26 4v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <h3>Réservations</h3>
                <p>Cours collectifs avec liste d'attente automatique, séances individuelles avec vos coachs.</p>
              </div>
              <div className={c('module')}>
                <svg className={c('module-icon')} viewBox="0 0 38 38" fill="none">
                  <path d="M6 19c0-7 5.8-13 13-13s13 6 13 13-5.8 13-13 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M19 13v6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 19l4-4M6 19l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <h3>Marketing & fidélisation</h3>
                <p>Campagnes ciblées par segment (bientôt expirés, inactifs...) et coupons de réduction.</p>
              </div>
              <div className={c('module')}>
                <svg className={c('module-icon')} viewBox="0 0 38 38" fill="none">
                  <rect x="5" y="19" width="9" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="15" y="12" width="9" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="25" y="6" width="9" height="26" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                <h3>Multi-salles & facturation</h3>
                <p>Chaque nouvelle salle rejoint votre compte propriétaire, avec une facturation SaaS consolidée.</p>
              </div>
            </div>
          </div>
        </section>

        {/* COMMENT CA MARCHE */}
        <section id="comment">
          <div className={c('wrap')}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>Mise en route</span>
              <h2>Opérationnel en trois étapes</h2>
            </div>
            <div className={c('steps', 'reveal')}>
              <div className={c('step')}>
                <div className={c('step-num')}>01 / Inscription</div>
                <h3>Créez votre compte propriétaire</h3>
                <p>Vous choisissez votre plan et renseignez votre première salle — nom, adresse, contact.</p>
              </div>
              <div className={c('step')}>
                <div className={c('step-num')}>02 / Configuration</div>
                <h3>Ajoutez votre équipe et vos formules</h3>
                <p>Gestionnaires, coachs, formules d'abonnement et tarifs — configurés en quelques minutes.</p>
              </div>
              <div className={c('step')}>
                <div className={c('step-num')}>03 / Ouverture</div>
                <h3>Inscrivez vos premiers adhérents</h3>
                <p>Badge QR généré automatiquement, premier encaissement, première facture. C'est parti.</p>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="tarifs" style={{ background: 'var(--paper-dim)' }}>
          <div className={c('wrap')}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>Tarifs</span>
              <h2>Un plan pour chaque étape de votre croissance</h2>
              <p>Changez de formule à tout moment — le prorata est calculé automatiquement, sans surprise sur la facture.</p>
            </div>

            <div className={c('pricing-grid', 'reveal')}>
              {plans.map((plan) => (
                <div key={plan.id} className={c('plan', ...(plan.code === 'PROFESSIONAL' ? ['featured'] : []))}>
                  {plan.code === 'PROFESSIONAL' && <span className={c('plan-tag')}>Le plus choisi</span>}
                  <div className={c('plan-name')}>{plan.name}</div>
                  <div className={c('plan-desc')}>{plan.description}</div>
                  <div className={c('plan-price')}>
                    <span className={c('amount')}>{Math.round(plan.priceMonthly).toLocaleString('fr-FR').replace(/\u202f/g, ' ')}</span>
                    <span className={c('unit')}>XOF / mois</span>
                  </div>
                  <ul className={c('plan-feats')}>
                    {buildPlanFeatures(plan).map((feat) => (
                      <li key={feat}>
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                          <path d="M2.5 8l3.5 3.5L12.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <a href="#contact" className={c('plan-cta')}>
                    {plan.trialDays > 0 ? "Démarrer l'essai gratuit" : 'Parler à un conseiller'}
                  </a>
                </div>
              ))}
              {plans.length === 0 && (
                <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--ink-400, #71767A)' }}>
                  Chargement des tarifs...
                </p>
              )}
            </div>
            <p className={c('pricing-note')}>
              Tarifs indicatifs en XOF, hors taxes locales éventuelles. Salle supplémentaire au-delà du quota inclus : facturation à l'usage.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <div className={c('wrap')} style={{ maxWidth: '820px' }}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>Questions fréquentes</span>
              <h2>Avant de vous décider</h2>
            </div>

            <div className={c('faq', 'reveal')}>
              {FAQ_ITEMS.map((item, i) => (
                <details
                  key={item.q}
                  className={c('faq-item')}
                  open={openFaqIndex === i}
                  onToggle={(e) => {
                    if ((e.target as HTMLDetailsElement).open) setOpenFaqIndex(i);
                  }}
                >
                  <summary className={c('faq-q')}>
                    {item.q}
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <p className={c('faq-a')}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section id="contact">
          <div className={c('wrap')}>
            <div className={c('cta-final', 'reveal')}>
              <div className={c('grain')} aria-hidden="true" />
              <h2>Prêt à faire tourner votre salle autrement ?</h2>
              <p>Laissez-nous vos coordonnées — un conseiller vous recontacte pour configurer votre première salle, en moins de 20 minutes.</p>

              {formStatus === 'success' ? (
                <div className={c('demo-form-success')}>
                  <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                    <circle cx="17" cy="17" r="17" fill="rgba(61,255,154,0.15)" />
                    <path d="M10 17.5l4.5 4.5L24 12" stroke="var(--signal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p>{formMessage}</p>
                </div>
              ) : (
                <form className={c('demo-form')} onSubmit={handleSubmit}>
                  <div className={c('demo-form-row')}>
                    <input ref={firstNameRef} type="text" placeholder="Prénom" required />
                    <input ref={lastNameRef} type="text" placeholder="Nom" required />
                  </div>
                  <div className={c('demo-form-row')}>
                    <input ref={phoneRef} type="tel" placeholder="Téléphone" required />
                    <input ref={emailRef} type="email" placeholder="E-mail (optionnel)" />
                  </div>
                  <div className={c('demo-form-row')}>
                    <input ref={companyNameRef} type="text" placeholder="Nom de votre salle (optionnel)" />
                    <input ref={cityRef} type="text" placeholder="Ville (optionnel)" />
                  </div>
                  <select ref={planIdRef} defaultValue="">
                    <option value="">Plan qui vous intéresse (optionnel)</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {Math.round(p.priceMonthly).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF/mois
                      </option>
                    ))}
                  </select>
                  <textarea ref={messageRef} placeholder="Un message ? (optionnel)" rows={2} />

                  {formStatus === 'error' && <div className={c('demo-form-error')}>{formMessage}</div>}

                  <button type="submit" className={c('btn-primary')} disabled={formStatus === 'submitting'} style={{ width: '100%', justifyContent: 'center' }}>
                    {formStatus === 'submitting' ? 'Envoi...' : 'Envoyer ma demande'}
                    {formStatus !== 'submitting' && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </form>
              )}

              <a href="#tarifs" className={c('btn-ghost')} style={{ marginTop: '18px', display: 'inline-flex' }}>
                Revoir les tarifs
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className={c('wrap')}>
          <div className={c('foot-grid')}>
            <div className={c('foot-col')}>
              <div className={c('foot-logo')}>
                <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
                  <rect width="26" height="26" rx="7" fill="#3DFF9A" />
                  <path d="M8 13.2l3 3L18 9" stroke="#14432F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                GymCloud
              </div>
              <p style={{ maxWidth: '240px', lineHeight: '1.6' }}>Le logiciel de gestion pensé pour les salles de sport d'Afrique de l'Ouest.</p>
            </div>
            <div className={c('foot-col')}>
              <h4>Produit</h4>
              <a href="#modules">Fonctionnalités</a>
              <a href="#tarifs">Tarifs</a>
              <a href="#comment">Comment ça marche</a>
            </div>
            <div className={c('foot-col')}>
              <h4>Ressources</h4>
              <a href="#faq">Questions fréquentes</a>
              <a href="mailto:contact@gymcloud.africa">Contact</a>
            </div>
            <div className={c('foot-col')}>
              <h4>Légal</h4>
              <a href="#">Conditions d'utilisation</a>
              <a href="#">Confidentialité</a>
            </div>
          </div>
          <div className={c('foot-bottom')}>
            <span>© 2026 GymCloud. Tous droits réservés.</span>
            <span className={c('mono')} style={{ opacity: '0.5' }}>
              Ouagadougou, Burkina Faso
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
