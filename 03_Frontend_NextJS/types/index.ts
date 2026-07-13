// ═══════════════════════════════════════════════════════════════
// Types partagés — reflètent les modèles Prisma du backend
// (02_Backend_NestJS/prisma/schema.prisma) pour garantir la
// cohérence des contrats entre frontend et API.
// ═══════════════════════════════════════════════════════════════

export type RoleCode =
  | 'SUPER_ADMIN'
  | 'PROPRIETAIRE'
  | 'GESTIONNAIRE'
  | 'COACH'
  | 'ADHERENT'
  | string; // rôles internes GymCloud dynamiques (§2.2)

export interface AuthUser {
  userId: string;
  roleCode: RoleCode;
  salleId: string | null;
  isGlobalAccess: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ── Propriétaires & Pays ──────────────────────────────────────

export interface Country {
  id: string;
  code: string;
  name: string;
  currency: string;
  timezone: string;
}

export interface Proprietaire {
  id: string;
  userId: string;
  companyName?: string;
  address?: string;
  countryId?: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    status: 'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE_VALIDATION' | 'DESACTIVE';
  };
  salles: Array<{ id: string; name: string }>;
}

export interface GestionnaireProfile {
  id: string;
  salleId: string;
  user: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
}

export interface CoachProfile {
  id: string;
  salleId: string;
  bio?: string;
  specialties: string[];
  user: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
}

// ── Salles ────────────────────────────────────────────────────

export type SalleStatus = 'ACTIF' | 'EN_GRACE' | 'SUSPENDU' | 'EXPIRE';

export interface Salle {
  id: string;
  proprietaireId: string;
  subscriptionId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  slogan?: string;
  email?: string;
  phone: string;
  address: string;
  city: string;
  countryId: string;
  primaryColor?: string;
  secondaryColor?: string;
  status: SalleStatus;
  isSalleSupplementaire: boolean;
  createdAt: string;
}

// ── SaaS ──────────────────────────────────────────────────────

export interface SaasPlan {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'ACTIF' | 'SUSPENDU' | 'ARCHIVE';
  priceMonthly: number;
  priceAnnual: number;
  extraSalleFee: number;
  quotaSalles: number;
  quotaGestionnaires: number | null;
  quotaCoachs: number | null;
  quotaAdherents: number | null;
  modules: string[];
}

// ── Adhérents ─────────────────────────────────────────────────

export type AdherentStatus = 'ACTIF' | 'EN_GRACE' | 'SUSPENDU' | 'EXPIRE' | 'INACTIF';

export interface AdherentProfile {
  id: string;
  userId: string;
  salleId: string;
  memberCode: string;
  qrCodeToken: string;
  status: AdherentStatus;
  joinedAt: string;
  user: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
}

export interface AbonnementCatalogue {
  id: string;
  salleId: string;
  name: string;
  description?: string;
  durationDays: number;
  price: number;
  currency: string;
  active: boolean;
}

export type AbonnementInstanceStatus = 'ACTIF' | 'EN_GRACE' | 'SUSPENDU' | 'EXPIRE';

export interface AdherentAbonnement {
  id: string;
  adherentId: string;
  abonnementCatalogueId: string;
  startDate: string;
  endDate: string;
  status: AbonnementInstanceStatus;
  isRenewal: boolean;
  abonnementCatalogue?: AbonnementCatalogue;
}

// ── Paiements ─────────────────────────────────────────────────

export type PaymentMethod =
  | 'ESPECES'
  | 'ORANGE_MONEY'
  | 'MOOV_MONEY'
  | 'WAVE'
  | 'CARTE_BANCAIRE'
  | 'VIREMENT';

export type PaymentStatus = 'EN_ATTENTE' | 'VALIDE' | 'REJETE' | 'REMBOURSE';
export type PaymentType = 'ABONNEMENT' | 'SEANCE' | 'AUTRE';

export interface Payment {
  id: string;
  salleId: string;
  adherentId?: string;
  type: PaymentType;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  createdAt: string;
  adherent?: {
    user: { firstName: string; lastName: string };
  };
}

// ── Réservations ──────────────────────────────────────────────

export type BookingType = 'SEANCE_INDIVIDUELLE' | 'COURS_COLLECTIF';
export type BookingStatus = 'CONFIRMEE' | 'EN_ATTENTE' | 'ANNULEE' | 'TERMINEE' | 'ABSENCE';

export interface CoursCollectif {
  id: string;
  salleId: string;
  coachId: string;
  name: string;
  capacity: number;
  startAt: string;
  endAt: string;
  _count?: { bookings: number };
  coach?: { user: { firstName: string; lastName: string } };
}

export interface Booking {
  id: string;
  salleId: string;
  adherentId: string;
  coachId?: string;
  coursCollectifId?: string;
  type: BookingType;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  adherent?: {
    user: { firstName: string; lastName: string };
  };
  coursCollectif?: {
    name: string;
  };
}

// ── Contrôle d'accès ──────────────────────────────────────────

export interface AccessLog {
  id: string;
  salleId: string;
  adherentId: string;
  method: 'QR_CODE' | 'MANUEL';
  checkInAt: string;
  checkOutAt?: string;
  anomalyFlag: boolean;
  adherent?: { user: { firstName: string; lastName: string } };
}

// ── Reporting ─────────────────────────────────────────────────

export interface GestionnaireDashboard {
  adherents: {
    actifs: number;
    enGrace: number;
    expires: number;
    suspendus: number;
    nouveauxCeMois: number;
    total: number;
  };
  revenus: {
    aujourdHui: number;
    ceMois: number;
  };
  frequentation: {
    visitesAujourdHui: number;
    presentsActuellement: number;
  };
  reservations: {
    confirmeesSeptJoursAVenir: number;
  };
}

export interface ProprietaireDashboard {
  consolidated: {
    totalAdherentsActifs: number;
    revenusAujourdHui: number;
    revenusCeMois: number;
    presentsActuellement: number;
  };
  salles: Array<{ salleId: string; salleName: string } & GestionnaireDashboard>;
}

export interface SuperAdminDashboard {
  plateforme: {
    totalSalles: number;
    totalProprietaires: number;
    totalGestionnaires: number;
    totalCoachs: number;
    totalAdherents: number;
    nouvellesSallesCeMois: number;
    nouveauxProprietairesCeMois: number;
  };
  activiteSaas: {
    sallesActives: number;
    sallesEnGrace: number;
    sallesSuspendues: number;
    sallesExpirees: number;
    renouvellementsCeMois: number;
    upgradesCeMois: number;
    downgradesCeMois: number;
  };
  revenus: {
    aujourdHui: number;
    ceMois: number;
    cetteAnnee: number;
    enAttente: number;
    sallesSupplementairesCeMois: number;
    repartitionParPlan: Array<{ planCode: string; count: number }>;
  };
}

export interface SaasKpis {
  revenus: {
    mrr: number;
    arr: number;
    revenuMoyenParSalle: number;
    revenuMoyenParProprietaire: number;
  };
  fidelisation: {
    tauxRenouvellement: number | null;
    tauxRetention: number;
    churnRate: number;
  };
  rentabilite: {
    ltv: number | null;
    revenuMoyenParClient: number;
  };
  croissance: {
    mensuelle: number | null;
    trimestrielle: number | null;
    annuelle: number | null;
  };
}

export interface SaasInvoice {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  extraSallesCount: number;
  extraSallesAmount: number;
  totalAmount: number;
  currency: string;
  status: 'EMISE' | 'PAYEE' | 'EN_RETARD' | 'ANNULEE';
  issuedAt: string;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  subscription: {
    proprietaire: {
      user: { firstName: string; lastName: string };
    };
    saasPlan: { name: string; code: string };
  };
}

export interface Role {
  id: string;
  code: string;
  name: string;
  scope: 'SYSTEM' | 'INTERNAL';
}

export interface InternalUser {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  status: string;
  createdAt: string;
  role: { name: string; code: string };
  country?: { name: string };
}

// ── API générique ─────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
