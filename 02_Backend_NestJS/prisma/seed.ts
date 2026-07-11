import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seed initial — exécuté une fois après la première migration
 * (`npx prisma db seed`).
 *
 * Crée :
 *  - les 5 rôles système non supprimables (§2.2)
 *  - un jeu de permissions de base pour les rôles internes GymCloud (§2.2)
 *  - le pays Burkina Faso (marché de lancement)
 */
async function main() {
  console.log('Seed — rôles système...');

  const systemRoles = [
    { code: 'SUPER_ADMIN', name: 'Super administrateur', description: 'Responsable stratégique et technique de GymCloud' },
    { code: 'PROPRIETAIRE', name: 'Propriétaire', description: 'Responsable d\'une ou plusieurs salles de sport' },
    { code: 'GESTIONNAIRE', name: 'Gestionnaire', description: 'Administration quotidienne d\'une salle' },
    { code: 'COACH', name: 'Coach', description: 'Encadrement sportif' },
    { code: 'ADHERENT', name: 'Adhérent', description: 'Client de la salle' },
  ];

  for (const role of systemRoles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: {
        id: randomUUID(),
        code: role.code,
        name: role.name,
        description: role.description,
        scope: 'SYSTEM',
        isDeletable: false,
      },
    });
  }

  console.log('Seed — rôles internes GymCloud (exemples, §2.2)...');

  const internalRoles = [
    { code: 'ADMIN_GYMCLOUD', name: 'Administrateur GymCloud' },
    { code: 'RESPONSABLE_SUPPORT', name: 'Responsable Support' },
    { code: 'RESPONSABLE_FINANCE', name: 'Responsable Finance' },
    { code: 'RESPONSABLE_COMMERCIAL', name: 'Responsable Commercial' },
    { code: 'RESPONSABLE_MARKETING', name: 'Responsable Marketing' },
    { code: 'SUPERVISEUR_PAYS', name: 'Superviseur Pays' },
  ];

  for (const role of internalRoles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: {
        id: randomUUID(),
        code: role.code,
        name: role.name,
        scope: 'INTERNAL',
        isDeletable: true,
      },
    });
  }

  console.log('Seed — permissions de base (§2.2 « Exemples de permissions »)...');

  const permissions = [
    // Gestion des propriétaires
    { code: 'proprietaire.create', category: 'Gestion des propriétaires', description: 'Créer un propriétaire' },
    { code: 'proprietaire.update', category: 'Gestion des propriétaires', description: 'Modifier un propriétaire' },
    { code: 'proprietaire.suspend', category: 'Gestion des propriétaires', description: 'Suspendre un propriétaire' },
    // Gestion des salles
    { code: 'salle.create', category: 'Gestion des salles', description: 'Créer une salle' },
    { code: 'salle.update', category: 'Gestion des salles', description: 'Modifier une salle' },
    { code: 'salle.suspend', category: 'Gestion des salles', description: 'Suspendre une salle' },
    // Gestion SaaS
    { code: 'saas_plan.assign', category: 'Gestion SaaS', description: 'Affecter un plan SaaS' },
    { code: 'saas_subscription.renew', category: 'Gestion SaaS', description: 'Renouveler un abonnement SaaS' },
    // Facturation
    { code: 'invoice.read', category: 'Facturation', description: 'Consulter les factures' },
    { code: 'invoice.generate', category: 'Facturation', description: 'Générer des factures' },
    { code: 'revenue.read', category: 'Facturation', description: 'Consulter les revenus' },
    // Support
    { code: 'user.reset_password', category: 'Support', description: 'Réinitialiser un mot de passe' },
    { code: 'user.unlock', category: 'Support', description: 'Débloquer un compte' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: { id: randomUUID(), ...perm },
    });
  }

  console.log('Seed — pays de lancement...');

  await prisma.country.upsert({
    where: { code: 'BF' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'BF',
      name: 'Burkina Faso',
      currency: 'XOF',
      timezone: 'Africa/Ouagadougou',
    },
  });

  console.log('Seed — plans SaaS par défaut (§9.3)...');

  // Quotas exacts du cahier des charges §9.3. Prix et quotas de coachs
  // non spécifiés par le cahier des charges → valeurs d'exemple pour le
  // développement, à ajuster par le SUPER_ADMIN via l'admin (§9.3 :
  // « Aucun montant ne doit être codé en dur dans l'application »).
  await prisma.saasPlan.upsert({
    where: { code: 'STARTER' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'STARTER',
      name: 'Starter',
      description: 'Idéal pour démarrer avec une seule salle',
      displayOrder: 1,
      priceMonthly: 15000,
      priceAnnual: 150000,
      extraSalleFee: 10000,
      trialDays: 14,
      taxRatePct: 0,
      quotaSalles: 1,
      quotaGestionnaires: 1,
      quotaCoachs: 2,
      quotaAdherents: 200,
      modules: ['adherents', 'abonnements', 'paiements', 'rapports_standards'],
    },
  });

  await prisma.saasPlan.upsert({
    where: { code: 'PROFESSIONAL' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'PROFESSIONAL',
      name: 'Professional',
      description: 'Pour les salles en croissance avec plusieurs sites',
      displayOrder: 2,
      priceMonthly: 35000,
      priceAnnual: 350000,
      extraSalleFee: 15000,
      trialDays: 14,
      taxRatePct: 0,
      quotaSalles: 2,
      quotaGestionnaires: 4,
      quotaCoachs: 10,
      quotaAdherents: 2000,
      modules: [
        'adherents', 'abonnements', 'paiements', 'rapports_standards',
        'qr_code', 'reservations', 'marketing', 'mobile',
      ],
    },
  });

  await prisma.saasPlan.upsert({
    where: { code: 'ENTERPRISE' },
    update: {},
    create: {
      id: randomUUID(),
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Pour les réseaux et franchises multi-salles',
      displayOrder: 3,
      priceMonthly: 75000,
      priceAnnual: 750000,
      extraSalleFee: 20000,
      trialDays: 0,
      taxRatePct: 0,
      quotaSalles: 5,
      quotaGestionnaires: null, // illimité (§9.3)
      quotaCoachs: null,
      quotaAdherents: null,
      modules: [
        'adherents', 'abonnements', 'paiements', 'rapports_standards',
        'qr_code', 'reservations', 'marketing', 'whatsapp', 'mobile',
        'rapports_avances', 'api', 'bi',
      ],
    },
  });

  console.log('Seed — premier compte SUPER_ADMIN...');

  // Problème de démarrage classique : impossible de créer un
  // SUPER_ADMIN via l'API (il faut déjà être SUPER_ADMIN pour créer
  // des utilisateurs). Ce seed crée donc le tout premier compte
  // directement en base — À CHANGER IMMÉDIATEMENT après la première
  // connexion (§13.4).
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'SUPER_ADMIN' } });
  const defaultPassword = 'GymCloud@2026'; // ⚠️ mot de passe de démarrage — à changer immédiatement
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  await prisma.user.upsert({
    where: { phone: '+22600000000' },
    update: {},
    create: {
      id: randomUUID(),
      phone: '+22600000000',
      email: 'admin@gymcloud.dev',
      firstName: 'Super',
      lastName: 'Admin',
      passwordHash,
      roleId: superAdminRole.id,
      status: 'ACTIF',
    },
  });

  console.log('  → Téléphone : +22600000000');
  console.log('  → Mot de passe : GymCloud@2026 (⚠️  À CHANGER IMMÉDIATEMENT)');

  console.log('Seed terminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
