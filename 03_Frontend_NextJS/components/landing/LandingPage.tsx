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
  priceMonthlyUsd: number;
  priceAnnualUsd: number;
  trialDays: number;
  quotaSalles: number;
  quotaGestionnaires: number | null;
  quotaAdherents: number | null;
  modules: string[];
}

interface PublicAddon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
}

const MODULE_LABELS: Record<Lang, Record<string, string>> = {
  fr: {
    qr_code: "Contrôle d'accès QR",
    reservations: 'Réservations',
    marketing: 'Marketing & fidélisation',
    mobile: 'Application mobile',
    whatsapp: 'Notifications WhatsApp',
    rapports_avances: 'Rapports avancés',
    api: 'Accès API',
    bi: 'Tableaux de bord avancés (BI)',
  },
  en: {
    qr_code: 'QR access control',
    reservations: 'Bookings',
    marketing: 'Marketing & retention',
    mobile: 'Mobile app',
    whatsapp: 'WhatsApp notifications',
    rapports_avances: 'Advanced reports',
    api: 'API access',
    bi: 'Advanced dashboards (BI)',
  },
};

/** Puces de fonctionnalités dérivées des vraies données du plan — jamais de texte figé qui pourrait se désynchroniser des tarifs réels. */
function buildPlanFeatures(plan: PublicPlan, lang: Lang): string[] {
  const feats: string[] = [];
  if (lang === 'fr') {
    feats.push(plan.quotaSalles === 1 ? '1 salle incluse' : `${plan.quotaSalles} salles incluses`);
    feats.push(plan.quotaGestionnaires == null ? 'Gestionnaires illimités' : `${plan.quotaGestionnaires} gestionnaire${plan.quotaGestionnaires > 1 ? 's' : ''}`);
    feats.push(plan.quotaAdherents == null ? 'Adhérents illimités' : `Jusqu'à ${plan.quotaAdherents.toLocaleString('fr-FR')} adhérents`);
    feats.push('Adhérents, abonnements, paiements');
  } else {
    feats.push(plan.quotaSalles === 1 ? '1 gym included' : `${plan.quotaSalles} gyms included`);
    feats.push(plan.quotaGestionnaires == null ? 'Unlimited managers' : `${plan.quotaGestionnaires} manager${plan.quotaGestionnaires > 1 ? 's' : ''}`);
    feats.push(plan.quotaAdherents == null ? 'Unlimited members' : `Up to ${plan.quotaAdherents.toLocaleString('en-US')} members`);
    feats.push('Members, subscriptions, payments');
  }
  // Modules avancés présents sur ce plan, dans un ordre de lecture stable
  ['qr_code', 'reservations', 'marketing', 'mobile', 'whatsapp', 'rapports_avances', 'api', 'bi']
    .filter((m) => plan.modules.includes(m))
    .forEach((m) => feats.push(MODULE_LABELS[lang][m]));
  if (!plan.modules.includes('rapports_avances')) feats.push(lang === 'fr' ? 'Rapports standards' : 'Standard reports');
  return feats;
}

const FAQ_ITEMS_FR = [
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

const FAQ_ITEMS_EN = [
  {
    q: 'Does GymCloud work with Orange Money, Moov Money and Wave?',
    a: 'Yes. All three operators are supported both for collecting member payments and for settling your own GymCloud subscription, alongside cash.',
  },
  {
    q: 'Can I manage several gyms with a single account?',
    a: "Yes, that's exactly what it's built for. One owner account can group several gyms, each with its own managers, coaches and members, while keeping a consolidated view of revenue.",
  },
  {
    q: 'What happens if I change plan mid-month?',
    a: 'The change is immediate and the amount is calculated pro-rata for the days remaining in your current period — you never pay twice for the same period.',
  },
  {
    q: 'Do my members need a smartphone?',
    a: 'Not for access — the QR badge can be printed on a physical card. The member mobile app is an extra service, not a requirement.',
  },
  {
    q: 'Can I try it before paying?',
    a: 'The Starter plan starts with a free trial period. No invoice is issued while the trial is running.',
  },
];

/**
 * §14.x — Dictionnaire de traduction FR/EN du site vitrine
 * uniquement (pas le tableau de bord — marché actuel 100%
 * francophone, pas de besoin identifié côté application). Approche
 * volontairement simple (objet + état React) plutôt qu'une librairie
 * i18n complète : un seul composant à couvrir, pas besoin de routing
 * par langue ni de chargement différé des traductions.
 */
const translations = {
  fr: {
    nav: { features: 'Fonctionnalités', how: 'Comment ça marche', pricing: 'Tarifs', faq: 'Questions', login: 'Se connecter', cta: 'Demander une démo', menuLabel: 'Ouvrir le menu' },
    hero: {
      eyebrow: "Conçu pour les salles d'Afrique de l'Ouest",
      titlePre: 'Votre salle de sport, ',
      titleEm: 'pilotée',
      titlePost: ' comme une vraie entreprise.',
      lead: 'GymCloud remplace le cahier, la caisse en espèces et les fiches papier par un système unique : accès par QR code, adhérents, paiements Mobile Money et facturation — pour une salle ou pour toute une chaîne.',
      ctaPrimary: 'Demander une démo',
      ctaSecondary: 'Voir les tarifs',
      microtext: 'Aucune carte bancaire requise · Essai gratuit sur le plan STARTER',
      badgeMember: 'Aïcha Ouédraogo',
      badgeSub: 'MEMBRE · GC-2K91-4F',
      badgeSalle: 'Salle Iron Temple · Ouaga',
      badgeAccess: 'Accès autorisé',
    },
    strip: ['ORANGE MONEY', 'MOOV MONEY', 'WAVE', "CONTRÔLE D'ACCÈS QR", 'MULTI-SALLES', 'FACTURATION AUTOMATIQUE'],
    compare: {
      kicker: 'La transformation',
      title: 'Le même métier. Un fonctionnement totalement différent.',
      lead: "Pas besoin de changer votre façon de gérer votre salle — juste la manière dont c'est enregistré, suivi et sécurisé.",
      beforeLabel: "Aujourd'hui, sans GymCloud",
      afterLabel: 'Avec GymCloud',
      before: [
        "Un cahier pour noter qui a payé, et qui a oublié",
        "L'accueil laisse entrer sur simple parole",
        "Impossible de savoir le revenu du mois sans tout ressaisir",
        "Une deuxième salle = une deuxième comptabilité, séparée",
      ],
      after: [
        "Chaque paiement Espèces ou Mobile Money horodaté automatiquement",
        "Le badge QR refuse l'accès si l'abonnement est expiré",
        "Revenus du jour, du mois et par salle en un coup d'œil",
        "Toutes vos salles pilotées depuis un seul tableau de bord",
      ],
    },
    pricing: {
      kicker: 'Tarifs',
      title: 'Un plan pour chaque étape de votre croissance',
      lead: 'Changez de formule à tout moment — le prorata est calculé automatiquement, sans surprise sur la facture.',
      loading: 'Chargement des tarifs...',
      note: "Tarifs indicatifs en XOF, hors taxes locales éventuelles. Salle supplémentaire au-delà du quota inclus : facturation à l'usage.",
      ctaTrial: "Démarrer l'essai gratuit",
      ctaContact: 'Parler à un conseiller',
      perMonth: '/ mois',
      perMonthShort: 'XOF/mois',
      featured: 'Le plus choisi',
    },
    addons: {
      kicker: 'Add-ons',
      title: 'Des extras à la carte, jamais imposés',
      lead: 'Activables à tout moment depuis votre espace, en plus de votre plan — vous ne payez que ce que vous activez.',
      perMonth: 'XOF/mois',
    },
    modules: {
      kicker: 'Ce que couvre GymCloud',
      title: 'Six modules. Une seule plateforme.',
      lead: 'Activés selon votre formule — vous ne payez que pour ce dont votre salle a besoin aujourd\'hui.',
      items: [
        { title: 'Adhérents & abonnements', desc: 'Dossier complet, historique des formules, statut à jour automatiquement — plus de fiches perdues.' },
        { title: "Contrôle d'accès QR", desc: "Un badge, un scan, une décision instantanée. Aucun abonnement expiré ne passe la porte." },
        { title: 'Paiements & Mobile Money', desc: 'Espèces, Orange Money, Moov Money, Wave — chaque encaissement génère un reçu, sans exception.' },
        { title: 'Réservations', desc: "Cours collectifs avec liste d'attente automatique, séances individuelles avec vos coachs." },
        { title: 'Marketing & fidélisation', desc: 'Campagnes ciblées par segment (bientôt expirés, inactifs...) et coupons de réduction.' },
        { title: 'Multi-salles & facturation', desc: 'Chaque nouvelle salle rejoint votre compte propriétaire, avec une facturation SaaS consolidée.' },
      ],
    },
    steps: {
      kicker: 'Mise en route',
      title: 'Opérationnel en trois étapes',
      items: [
        { num: '01 / Inscription', title: 'Créez votre compte propriétaire', desc: 'Vous choisissez votre plan et renseignez votre première salle — nom, adresse, contact.' },
        { num: '02 / Configuration', title: 'Ajoutez votre équipe et vos formules', desc: 'Gestionnaires, coachs, formules d\'abonnement et tarifs — configurés en quelques minutes.' },
        { num: '03 / Ouverture', title: 'Inscrivez vos premiers adhérents', desc: 'Badge QR généré automatiquement, premier encaissement, première facture. C\'est parti.' },
      ],
    },
    ctaFinal: {
      title: 'Prêt à faire tourner votre salle autrement ?',
      lead: 'Laissez-nous vos coordonnées — un conseiller vous recontacte pour configurer votre première salle, en moins de 20 minutes.',
      firstName: 'Prénom',
      lastName: 'Nom',
      phone: 'Téléphone',
      email: 'E-mail',
      companyName: 'Nom de votre salle',
      city: 'Ville (optionnel)',
      country: 'Pays',
      plan: 'Plan qui vous intéresse',
      addonsLabel: 'Add-ons qui vous intéressent (optionnel) :',
      addonsTotal: 'Total add-ons sélectionnés',
      referralCode: 'Code de parrainage (optionnel)',
      message: 'Un message ? (optionnel)',
      submitting: 'Envoi...',
      submit: 'Envoyer ma demande',
      backToPricing: 'Revoir les tarifs',
    },
    faq: {
      kicker: 'Questions fréquentes',
      title: 'Avant de vous décider',
      items: FAQ_ITEMS_FR,
    },
    footer: {
      tagline: "Le logiciel de gestion pensé pour les salles de sport d'Afrique de l'Ouest.",
      product: 'Produit',
      resources: 'Ressources',
      legal: 'Légal',
      terms: "Conditions d'utilisation",
      privacy: 'Confidentialité',
      rights: 'Tous droits réservés.',
    },
  },
  en: {
    nav: { features: 'Features', how: 'How it works', pricing: 'Pricing', faq: 'FAQ', login: 'Log in', cta: 'Request a demo', menuLabel: 'Open menu' },
    hero: {
      eyebrow: 'Built for West African gyms',
      titlePre: 'Your gym, ',
      titleEm: 'run',
      titlePost: ' like a real business.',
      lead: 'GymCloud replaces the notebook, the cash box and paper files with a single system: QR code access, members, Mobile Money payments and billing — for one gym or an entire chain.',
      ctaPrimary: 'Request a demo',
      ctaSecondary: 'View pricing',
      microtext: 'No credit card required · Free trial on the STARTER plan',
      badgeMember: 'Aïcha Ouédraogo',
      badgeSub: 'MEMBER · GC-2K91-4F',
      badgeSalle: 'Iron Temple Gym · Ouaga',
      badgeAccess: 'Access granted',
    },
    strip: ['ORANGE MONEY', 'MOOV MONEY', 'WAVE', 'QR ACCESS CONTROL', 'MULTI-GYM', 'AUTOMATIC BILLING'],
    compare: {
      kicker: 'The shift',
      title: 'The same job. A completely different way of running it.',
      lead: "No need to change how you run your gym — just how it's recorded, tracked and secured.",
      beforeLabel: 'Today, without GymCloud',
      afterLabel: 'With GymCloud',
      before: [
        'A notebook to track who paid, and who forgot',
        'Front desk lets people in on their word',
        "No way to know the month's revenue without redoing it all",
        'A second gym means a second, separate set of books',
      ],
      after: [
        'Every cash or Mobile Money payment timestamped automatically',
        'The QR badge refuses access if the membership has expired',
        "Today's, this month's and per-gym revenue at a glance",
        'All your gyms run from a single dashboard',
      ],
    },
    pricing: {
      kicker: 'Pricing',
      title: 'A plan for every stage of your growth',
      lead: 'Switch plans any time — the pro-rata is calculated automatically, no surprises on the invoice.',
      loading: 'Loading pricing...',
      note: 'Indicative pricing in XOF, excluding any local taxes. Extra gym beyond the included quota: billed by usage.',
      ctaTrial: 'Start free trial',
      ctaContact: 'Talk to an advisor',
      perMonth: '/ month',
      perMonthShort: 'XOF/mo',
      featured: 'Most popular',
    },
    addons: {
      kicker: 'Add-ons',
      title: 'À la carte extras, never imposed',
      lead: 'Activate any time from your dashboard, on top of your plan — you only pay for what you turn on.',
      perMonth: 'XOF/month',
    },
    modules: {
      kicker: 'What GymCloud covers',
      title: 'Six modules. One platform.',
      lead: 'Turned on based on your plan — you only pay for what your gym needs today.',
      items: [
        { title: 'Members & subscriptions', desc: 'Full profile, plan history, status kept up to date automatically — no more lost records.' },
        { title: 'QR access control', desc: 'One badge, one scan, an instant decision. No expired membership gets through the door.' },
        { title: 'Payments & Mobile Money', desc: 'Cash, Orange Money, Moov Money, Wave — every payment generates a receipt, no exceptions.' },
        { title: 'Bookings', desc: 'Group classes with automatic waiting lists, one-on-one sessions with your coaches.' },
        { title: 'Marketing & retention', desc: 'Segment-targeted campaigns (soon-to-expire, inactive...) and discount coupons.' },
        { title: 'Multi-gym & billing', desc: 'Every new gym joins your owner account, with consolidated SaaS billing.' },
      ],
    },
    steps: {
      kicker: 'Getting started',
      title: 'Up and running in three steps',
      items: [
        { num: '01 / Sign up', title: 'Create your owner account', desc: 'Choose your plan and enter your first gym — name, address, contact.' },
        { num: '02 / Setup', title: 'Add your team and your plans', desc: 'Managers, coaches, membership plans and pricing — set up in minutes.' },
        { num: '03 / Launch', title: 'Register your first members', desc: 'QR badge generated automatically, first payment, first invoice. Off you go.' },
      ],
    },
    ctaFinal: {
      title: 'Ready to run your gym differently?',
      lead: "Leave us your details — an advisor will get back to you to set up your first gym, in under 20 minutes.",
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Phone',
      email: 'Email',
      companyName: 'Your gym name',
      city: 'City (optional)',
      country: 'Country',
      plan: 'Plan you\'re interested in',
      addonsLabel: 'Add-ons you\'re interested in (optional):',
      addonsTotal: 'Total selected add-ons',
      referralCode: 'Referral code (optional)',
      message: 'A message? (optional)',
      submitting: 'Sending...',
      submit: 'Send my request',
      backToPricing: 'Back to pricing',
    },
    faq: {
      kicker: 'Frequently asked questions',
      title: 'Before you decide',
      items: FAQ_ITEMS_EN,
    },
    footer: {
      tagline: 'Management software built for West African gyms.',
      product: 'Product',
      resources: 'Resources',
      legal: 'Legal',
      terms: 'Terms of use',
      privacy: 'Privacy',
      rights: 'All rights reserved.',
    },
  },
} as const;

type Lang = keyof typeof translations;

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
  const [lang, setLang] = useState<Lang>('fr');
  const t = translations[lang];
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [addons, setAddons] = useState<PublicAddon[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedAddonCodes, setSelectedAddonCodes] = useState<string[]>([]);
  const [contact, setContact] = useState<{ supportEmail: string; supportPhone: string }>({
    supportEmail: 'gymcloudsys@gmail.com',
    supportPhone: '+226 68 46 11 19',
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [formMessage, setFormMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const countryIdRef = useRef<HTMLSelectElement>(null);
  const planIdRef = useRef<HTMLSelectElement>(null);
  const referralCodeRef = useRef<HTMLInputElement>(null);
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

  // Add-ons publics — affichés dans la section tarifs et sélectionnables
  // dans le formulaire de demande, au même titre que le plan. Jamais
  // pré-cochés : un choix positif du prospect, pas une case qu'il faut
  // penser à décocher.
  useEffect(() => {
    fetch(`${API_URL}/public/addons`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: PublicAddon[]) => setAddons(data))
      .catch(() => {
        /* silencieux — la section reste simplement vide si l'API n'est pas joignable */
      });
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/public/countries`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { id: string; name: string; code: string }[]) => setCountries(data))
      .catch(() => {
        /* silencieux — le champ reste simplement vide si l'API n'est pas joignable */
      });
  }, []);

  // Coordonnées de contact — modifiables par le SUPER_ADMIN depuis son
  // tableau de bord (page "Contacts") ; les valeurs par défaut ci-dessus
  // restent affichées si l'API n'est pas joignable.
  useEffect(() => {
    fetch(`${API_URL}/public/contact`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { supportEmail: string; supportPhone: string }) => setContact(data))
      .catch(() => {
        /* silencieux — les valeurs par défaut restent affichées */
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
      email: emailRef.current?.value.trim() ?? '',
      companyName: companyNameRef.current?.value.trim() ?? '',
      city: cityRef.current?.value.trim() || undefined,
      countryId: countryIdRef.current?.value ?? '',
      desiredPlanId: planIdRef.current?.value ?? '',
      desiredAddonCodes: selectedAddonCodes.length > 0 ? selectedAddonCodes : undefined,
      referralCode: referralCodeRef.current?.value.trim() || undefined,
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
            <a href="#modules">{t.nav.features}</a>
            <a href="#comment">{t.nav.how}</a>
            <a href="#tarifs">{t.nav.pricing}</a>
            <a href="#faq">{t.nav.faq}</a>
          </div>
          <div className={c('nav-actions')}>
            <button
              onClick={() => setLang((l) => (l === 'fr' ? 'en' : 'fr'))}
              style={{
                background: 'transparent',
                border: '1px solid var(--line-dark, rgba(20,67,47,0.15))',
                borderRadius: '7px',
                padding: '5px 10px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                color: 'inherit',
              }}
              aria-label={lang === 'fr' ? 'Switch to English' : 'Passer en français'}
            >
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            <a href="/login" className={c('nav-login')}>
              {t.nav.login}
            </a>
            <a href="#contact" className={c('nav-cta')}>
              {t.nav.cta}
            </a>
            <button
              className={c('nav-mobile-toggle')}
              aria-label={t.nav.menuLabel}
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
              {t.nav.features}
            </a>
            <a href="#comment" onClick={closeMobileMenu}>
              {t.nav.how}
            </a>
            <a href="#tarifs" onClick={closeMobileMenu}>
              {t.nav.pricing}
            </a>
            <a href="#faq" onClick={closeMobileMenu}>
              {t.nav.faq}
            </a>
            <a href="/login" onClick={closeMobileMenu}>
              {t.nav.login}
            </a>
            <a href="#contact" className={c('nav-cta')} onClick={closeMobileMenu}>
              {t.nav.cta}
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
                <span className={c('dot')} /> {t.hero.eyebrow}
              </span>
              <h1>
                {t.hero.titlePre}<em>{t.hero.titleEm}</em>{t.hero.titlePost}
              </h1>
              <p className={c('lead')}>{t.hero.lead}</p>
              <div className={c('hero-ctas')}>
                <a href="#contact" className={c('btn-primary')}>
                  {t.hero.ctaPrimary}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a href="#tarifs" className={c('btn-ghost')}>
                  {t.hero.ctaSecondary}
                </a>
              </div>
              <p className={c('hero-microtext')}>{t.hero.microtext}</p>
            </div>

            <div className={c('scan-stage')} aria-hidden="true">
              <div className={c('badge')}>
                <div className={c('scan-ring')} />
                <div className={c('badge-top')}>
                  <div>
                    <div className={c('badge-name')}>{t.hero.badgeMember}</div>
                    <div className={c('badge-sub')}>{t.hero.badgeSub}</div>
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
                  <span className={c('badge-id')}>{t.hero.badgeSalle}</span>
                  <span className={c('status-pill')}>
                    <svg viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.2l2.3 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t.hero.badgeAccess}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className={c('strip')} aria-hidden="true">
          <div className={c('strip-inner')}>
            {[...t.strip, ...t.strip].map((item, i) => (
              <span key={i}>
                {i > 0 && '· '}
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* AVANT / APRES */}
        <section>
          <div className={c('wrap')}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>{t.compare.kicker}</span>
              <h2>{t.compare.title}</h2>
              <p>{t.compare.lead}</p>
            </div>

            <div className={c('compare', 'reveal')}>
              <div className={c('compare-col', 'before')}>
                <span className={c('compare-label')}>{t.compare.beforeLabel}</span>
                {t.compare.before.map((item) => (
                  <div className={c('compare-item')} key={item}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="#C6491F" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
              <div className={c('compare-col', 'after')}>
                <span className={c('compare-label')}>{t.compare.afterLabel}</span>
                {t.compare.after.map((item) => (
                  <div className={c('compare-item')} key={item}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5l3.5 3.5L13 5" stroke="#3DFF9A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* APERÇU TABLEAU DE BORD */}
        {/* PRICING */}
        <section id="tarifs" style={{ background: 'var(--paper-dim)' }}>
          <div className={c('wrap')}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>{t.pricing.kicker}</span>
              <h2>{t.pricing.title}</h2>
              <p>{t.pricing.lead}</p>
            </div>

            <div className={c('pricing-grid', 'reveal')}>
              {plans.map((plan) => (
                <div key={plan.id} className={c('plan', ...(plan.code === 'PROFESSIONAL' ? ['featured'] : []))}>
                  {plan.code === 'PROFESSIONAL' && <span className={c('plan-tag')}>{t.pricing.featured}</span>}
                  <div className={c('plan-name')}>{plan.name}</div>
                  <div className={c('plan-desc')}>{plan.description}</div>
                  <div className={c('plan-price')}>
                    <span className={c('amount')}>{Math.round(plan.priceMonthly).toLocaleString('fr-FR').replace(/\u202f/g, ' ')}</span>
                    <span className={c('unit')}>XOF {t.pricing.perMonth}</span>
                  </div>
                  <div className={c('plan-price-usd')}>
                    ≈ {plan.priceMonthlyUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD {t.pricing.perMonth}
                  </div>
                  <ul className={c('plan-feats')}>
                    {buildPlanFeatures(plan, lang).map((feat) => (
                      <li key={feat}>
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                          <path d="M2.5 8l3.5 3.5L12.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <a href="#contact" className={c('plan-cta')}>
                    {plan.trialDays > 0 ? t.pricing.ctaTrial : t.pricing.ctaContact}
                  </a>
                </div>
              ))}
              {plans.length === 0 && (
                <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--ink-400, #71767A)' }}>
                  {t.pricing.loading}
                </p>
              )}
            </div>
            <p className={c('pricing-note')}>{t.pricing.note}
            </p>
          </div>
        </section>

        {/* ADD-ONS */}
        {addons.length > 0 && (
          <section style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
            <div className={c('wrap')}>
              <div className={c('section-head')} style={{ color: 'var(--paper)' }}>
                <span className={c('kicker')} style={{ color: 'var(--signal, #3DFF9A)' }}>
                  {t.addons.kicker}
                </span>
                <h2 style={{ color: 'var(--paper)' }}>{t.addons.title}</h2>
                <p style={{ color: 'rgba(250,248,243,0.65)' }}>{t.addons.lead}</p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '18px',
                  maxWidth: '920px',
                  margin: '0 auto',
                }}
              >
                {addons.map((addon, index) => {
                  const isFeatured = index === 1; // 1er/3ème blanc, 2ème mis en avant — même motif que les plans
                  return (
                    <div
                      key={addon.id}
                      style={{
                        background: isFeatured ? 'var(--ink)' : '#fff',
                        border: isFeatured ? '1px solid rgba(61,255,154,0.35)' : '1px solid var(--line-dark, rgba(20,67,47,0.12))',
                        borderRadius: '14px',
                        padding: '22px',
                        boxShadow: isFeatured
                          ? '0 20px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(61,255,154,0.08) inset'
                          : '0 10px 30px rgba(0,0,0,0.12)',
                        transform: isFeatured ? 'translateY(-6px)' : 'none',
                      }}
                    >
                      <p style={{ fontWeight: 600, fontSize: '15px', color: isFeatured ? 'var(--paper)' : 'var(--ink)', marginBottom: '6px' }}>
                        {addon.name}
                      </p>
                      {addon.description && (
                        <p
                          style={{
                            fontSize: '13px',
                            color: isFeatured ? 'rgba(250,248,243,0.6)' : 'var(--ink-soft, #1C5940)',
                            opacity: isFeatured ? 1 : 0.75,
                            marginBottom: '14px',
                            lineHeight: 1.5,
                          }}
                        >
                          {addon.description}
                        </p>
                      )}
                      <p style={{ fontWeight: 700, fontSize: '17px', color: isFeatured ? 'var(--signal, #3DFF9A)' : 'var(--emerald, #0F6E56)' }}>
                        +{Math.round(addon.price).toLocaleString('fr-FR').replace(/\u202f/g, ' ')}
                        <span
                          style={{
                            fontWeight: 400,
                            fontSize: '12px',
                            color: isFeatured ? 'rgba(250,248,243,0.55)' : 'var(--ink)',
                            opacity: isFeatured ? 1 : 0.55,
                          }}
                        >
                          {' '}
                          {t.addons.perMonth}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* MODULES */}
        <section id="modules" style={{ background: 'var(--paper-dim)' }}>
          <div className={c('wrap')}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>{t.modules.kicker}</span>
              <h2>{t.modules.title}</h2>
              <p>{t.modules.lead}</p>
            </div>

            <div className={c('modules', 'reveal')}>
              {[
                <>
                  <circle cx="19" cy="13" r="6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M7 31c1.5-6.5 6.5-10 12-10s10.5 3.5 12 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </>,
                <>
                  <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="21" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="7" y="21" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M24 25h7M27.5 21.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </>,
                <>
                  <rect x="5" y="11" width="28" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M5 17h28" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M10 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </>,
                <>
                  <rect x="6" y="8" width="26" height="24" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M6 15h26" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M12 4v7M26 4v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </>,
                <>
                  <path d="M6 19c0-7 5.8-13 13-13s13 6 13 13-5.8 13-13 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M19 13v6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 19l4-4M6 19l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </>,
                <>
                  <rect x="5" y="19" width="9" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="15" y="12" width="9" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="25" y="6" width="9" height="26" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
                </>,
              ].map((icon, i) => (
                <div className={c('module')} key={i}>
                  <svg className={c('module-icon')} viewBox="0 0 38 38" fill="none">
                    {icon}
                  </svg>
                  <h3>{t.modules.items[i].title}</h3>
                  <p>{t.modules.items[i].desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMMENT CA MARCHE */}
        <section id="comment">
          <div className={c('wrap')}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>{t.steps.kicker}</span>
              <h2>{t.steps.title}</h2>
            </div>
            <div className={c('steps', 'reveal')}>
              {t.steps.items.map((step) => (
                <div className={c('step')} key={step.num}>
                  <div className={c('step-num')}>{step.num}</div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section id="contact">
          <div className={c('wrap')}>
            <div className={c('cta-final', 'reveal')}>
              <div className={c('grain')} aria-hidden="true" />
              <h2>{t.ctaFinal.title}</h2>
              <p>{t.ctaFinal.lead}</p>

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
                    <input ref={firstNameRef} type="text" placeholder={t.ctaFinal.firstName} required />
                    <input ref={lastNameRef} type="text" placeholder={t.ctaFinal.lastName} required />
                  </div>
                  <div className={c('demo-form-row')}>
                    <input ref={phoneRef} type="tel" placeholder={t.ctaFinal.phone} required />
                    <input ref={emailRef} type="email" placeholder={t.ctaFinal.email} required />
                  </div>
                  <div className={c('demo-form-row')}>
                    <input ref={companyNameRef} type="text" placeholder={t.ctaFinal.companyName} required />
                    <input ref={cityRef} type="text" placeholder={t.ctaFinal.city} />
                  </div>
                  <div className={c('demo-form-row')}>
                    <select ref={countryIdRef} defaultValue="" required>
                      <option value="" disabled>
                        {t.ctaFinal.country}
                      </option>
                      {countries.map((country) => (
                        <option key={country.id} value={country.id}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                    <select ref={planIdRef} defaultValue="" required>
                      <option value="" disabled>
                        {t.ctaFinal.plan}
                      </option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {Math.round(p.priceMonthly).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} {t.pricing.perMonthShort} (≈ {p.priceMonthlyUsd.toFixed(2)} USD)
                        </option>
                      ))}
                    </select>
                  </div>
                  {addons.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '10px' }}>
                        {t.ctaFinal.addonsLabel}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {addons.map((a) => {
                          const isChecked = selectedAddonCodes.includes(a.code);
                          return (
                            <label
                              key={a.id}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                padding: '14px 16px',
                                borderRadius: '10px',
                                border: `2px solid ${isChecked ? 'var(--emerald, #0F6E56)' : 'var(--line-dark, rgba(20,67,47,0.12))'}`,
                                background: isChecked ? 'rgba(15,110,86,0.08)' : 'transparent',
                                boxShadow: isChecked ? '0 2px 10px rgba(15,110,86,0.15)' : 'none',
                                cursor: 'pointer',
                                transition: 'border-color .15s, background .15s, box-shadow .15s',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) =>
                                  setSelectedAddonCodes((prev) =>
                                    e.target.checked ? [...prev, a.code] : prev.filter((c) => c !== a.code),
                                  )
                                }
                                style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#0F6E56', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{a.name}</span>
                                  <span style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }}>
                                    {Math.round(a.price).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} {t.addons.perMonth}
                                  </span>
                                </div>
                                {a.description && (
                                  <p style={{ fontSize: '12.5px', opacity: 0.65, marginTop: '2px' }}>{a.description}</p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      {selectedAddonCodes.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: '10px',
                            paddingTop: '10px',
                            borderTop: '1px solid var(--line-dark, rgba(20,67,47,0.12))',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        >
                          <span>{t.ctaFinal.addonsTotal}</span>
                          <span>
                            {Math.round(
                              addons
                                .filter((a) => selectedAddonCodes.includes(a.code))
                                .reduce((sum, a) => sum + Number(a.price), 0),
                            )
                              .toLocaleString('fr-FR')
                              .replace(/\u202f/g, ' ')}{' '}
                            {t.addons.perMonth}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={referralCodeRef}
                    type="text"
                    placeholder={t.ctaFinal.referralCode}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <textarea ref={messageRef} placeholder={t.ctaFinal.message} rows={2} />

                  {formStatus === 'error' && <div className={c('demo-form-error')}>{formMessage}</div>}

                  <button type="submit" className={c('btn-primary')} disabled={formStatus === 'submitting'} style={{ width: '100%', justifyContent: 'center' }}>
                    {formStatus === 'submitting' ? t.ctaFinal.submitting : t.ctaFinal.submit}
                    {formStatus !== 'submitting' && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </form>
              )}

              <a href="#tarifs" className={c('btn-ghost')} style={{ marginTop: '18px', display: 'inline-flex' }}>
                {t.ctaFinal.backToPricing}
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <div className={c('wrap')} style={{ maxWidth: '820px' }}>
            <div className={c('section-head', 'reveal')}>
              <span className={c('kicker')}>{t.faq.kicker}</span>
              <h2>{t.faq.title}</h2>
            </div>

            <div className={c('faq', 'reveal')}>
              {t.faq.items.map((item, i) => (
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
              <p style={{ maxWidth: '240px', lineHeight: '1.6' }}>{t.footer.tagline}</p>
            </div>
            <div className={c('foot-col')}>
              <h4>{t.footer.product}</h4>
              <a href="#modules">{t.nav.features}</a>
              <a href="#tarifs">{t.nav.pricing}</a>
              <a href="#comment">{t.nav.how}</a>
            </div>
            <div className={c('foot-col')}>
              <h4>{t.footer.resources}</h4>
              <a href="#faq">{t.faq.kicker}</a>
              <a href={`mailto:${contact.supportEmail}`}>{contact.supportEmail}</a>
              <a href={`tel:${contact.supportPhone.replace(/\s/g, '')}`}>{contact.supportPhone}</a>
            </div>
            <div className={c('foot-col')}>
              <h4>{t.footer.legal}</h4>
              <a href="#">{t.footer.terms}</a>
              <a href="#">{t.footer.privacy}</a>
            </div>
          </div>
          <div className={c('foot-bottom')}>
            <span>© 2026 GymCloud. {t.footer.rights}</span>
            <span className={c('mono')} style={{ opacity: '0.5' }}>
              Ouagadougou, Burkina Faso
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
