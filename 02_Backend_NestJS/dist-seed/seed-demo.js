"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Seed de DÉMONSTRATION — données fictives pour tester rapidement
 * l'application sans tout créer à la main via l'interface.
 *
 * Distinct de seed.ts (données système obligatoires : rôles, plans,
 * SUPER_ADMIN) : celui-ci crée un propriétaire, une salle, une équipe
 * et des adhérents aux statuts volontairement variés (actif, en
 * grâce, expiré, suspendu) pour que le tableau de bord et les listes
 * ne soient jamais vides pendant les tests.
 *
 * Le plan SaaS du propriétaire est lui-même créé SUSPENDU, avec une
 * facture impayée en attente — pas un simple oubli : sans ça, rien ne
 * permet de tester le flux "Facturation SaaS → Validations en attente
 * → encaissement → réactivation automatique" (§9.7, §9.10, §9.11).
 * Toutes les autres données (adhérents, paiements, cours) sont quand
 * même créées normalement : le seed écrit directement en base, sans
 * passer par l'API — seules les actions futures via l'interface
 * seront bloquées par SubscriptionAccessGuard tant que la facture
 * n'est pas validée.
 *
 * Usage : npm run prisma:seed-demo
 * (nécessite que seed.ts ait déjà été exécuté au moins une fois —
 * dépend des rôles et du pays "BF" qu'il crée)
 */
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const prisma = new client_1.PrismaClient();
const BCRYPT_ROUNDS = 12;
const DEMO_PASSWORD = 'Demo@2026'; // même mot de passe pour tous les comptes de démo, pour simplifier les tests
function slugify(name) {
    const base = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${base}-${(0, crypto_1.randomUUID)().slice(0, 6)}`;
}
function qrToken() {
    return (0, crypto_1.randomBytes)(24).toString('base64url');
}
async function createUser(data) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: data.roleCode } });
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
    return prisma.user.create({
        data: {
            id: (0, crypto_1.randomUUID)(),
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            email: data.email,
            passwordHash,
            roleId: role.id,
            status: 'ACTIF',
            countryId: data.countryId,
        },
    });
}
async function main() {
    console.log('🌱 Seed de démonstration — démarrage...');
    const country = await prisma.country.findUniqueOrThrow({ where: { code: 'BF' } });
    const proPlan = await prisma.saasPlan.findUniqueOrThrow({ where: { code: 'PROFESSIONAL' } });
    // ── 1. Propriétaire ──────────────────────────────────────────
    const proprietaireUser = await createUser({
        firstName: 'Aïcha',
        lastName: 'Ouédraogo',
        phone: '+22670000001',
        email: 'aicha.demo@gymcloud.africa',
        roleCode: 'PROPRIETAIRE',
        countryId: country.id,
    });
    const proprietaire = await prisma.proprietaire.create({
        data: {
            id: (0, crypto_1.randomUUID)(),
            userId: proprietaireUser.id,
            companyName: 'Iron Temple SARL',
            address: 'Avenue Kwame Nkrumah, Ouagadougou',
            countryId: country.id,
        },
    });
    console.log(`✓ Propriétaire créé : ${proprietaireUser.phone}`);
    // ── 2. Souscription SaaS — volontairement DÉSACTIVÉE (voir plus bas) ──
    const now = new Date();
    // §9.7, §9.10 — Le propriétaire de démo est volontairement créé
    // avec un plan DÉSACTIVÉ (SUSPENDU) et une facture impayée (EMISE) :
    // sans ça, rien ne permet de tester le flux "Facturation SaaS →
    // Validations en attente → encaissement → réactivation" qu'on vient
    // de construire. La période couverte est déjà passée (20 jours),
    // au-delà des 15 jours de grâce — d'où la suspension.
    const periodEndPast = new Date(now);
    periodEndPast.setDate(periodEndPast.getDate() - 20);
    const subscription = await prisma.saasSubscription.create({
        data: {
            id: (0, crypto_1.randomUUID)(),
            proprietaireId: proprietaire.id,
            saasPlanId: proPlan.id,
            billingCycle: 'MENSUEL',
            status: 'SUSPENDU',
            startDate: new Date(periodEndPast.getTime() - 30 * 86400000),
            currentPeriodEnd: periodEndPast,
        },
    });
    // Facture impayée, en attente d'encaissement par le SUPER_ADMIN —
    // visible dans "Facturation SaaS", à approuver pour réactiver la
    // salle (démontre le flux complet de bout en bout).
    await prisma.saasInvoice.create({
        data: {
            id: (0, crypto_1.randomUUID)(),
            subscriptionId: subscription.id,
            invoiceNumber: `GC-SAAS-DEMO-${(0, crypto_1.randomUUID)().slice(0, 8).toUpperCase()}`,
            periodStart: new Date(periodEndPast.getTime() - 30 * 86400000),
            periodEnd: periodEndPast,
            baseAmount: proPlan.priceMonthly,
            extraSallesCount: 0,
            extraSallesAmount: 0,
            addonsAmount: 0,
            taxAmount: 0,
            totalAmount: proPlan.priceMonthly,
            currency: 'XOF',
            status: 'EMISE',
        },
    });
    // ── 3. Salle ──────────────────────────────────────────────────
    const salleName = 'Iron Temple — Ouaga 2000';
    const salle = await prisma.salle.create({
        data: {
            id: (0, crypto_1.randomUUID)(),
            proprietaireId: proprietaire.id,
            subscriptionId: subscription.id,
            name: salleName,
            slug: slugify(salleName),
            phone: '+22625000001',
            email: 'contact@irontemple.bf',
            address: 'Zone Ouaga 2000, Rue 15.30',
            city: 'Ouagadougou',
            countryId: country.id,
            activatedAt: now,
        },
    });
    console.log(`✓ Salle créée : ${salle.name}`);
    // ── 4. Gestionnaire ───────────────────────────────────────────
    const gestionnaireUser = await createUser({
        firstName: 'Boureima',
        lastName: 'Kaboré',
        phone: '+22670000002',
        email: 'boureima.demo@gymcloud.africa',
        roleCode: 'GESTIONNAIRE',
    });
    await prisma.gestionnaireProfile.create({
        data: { id: (0, crypto_1.randomUUID)(), userId: gestionnaireUser.id, salleId: salle.id },
    });
    console.log(`✓ Gestionnaire créé : ${gestionnaireUser.phone}`);
    // ── 5. Coachs (l'un avec tarification séances individuelles) ──
    const coach1User = await createUser({
        firstName: 'Fatimata',
        lastName: 'Zongo',
        phone: '+22670000003',
        roleCode: 'COACH',
    });
    const coach1 = await prisma.coachProfile.create({
        data: {
            id: (0, crypto_1.randomUUID)(),
            userId: coach1User.id,
            salleId: salle.id,
            bio: 'Coach spécialisée musculation et remise en forme.',
            specialties: ['Musculation', 'Remise en forme'],
            pricePerSession: 5000,
            priceMonthly: 35000,
            currency: 'XOF',
        },
    });
    const coach2User = await createUser({
        firstName: 'Ismaël',
        lastName: 'Traoré',
        phone: '+22670000004',
        roleCode: 'COACH',
    });
    const coach2 = await prisma.coachProfile.create({
        data: {
            id: (0, crypto_1.randomUUID)(),
            userId: coach2User.id,
            salleId: salle.id,
            bio: 'Coach cardio et cours collectifs.',
            specialties: ['Cardio', 'CrossTraining'],
        },
    });
    console.log(`✓ 2 coachs créés`);
    // ── 6. Formules d'abonnement ──────────────────────────────────
    const [mensuel, trimestriel, annuel] = await Promise.all([
        prisma.abonnementCatalogue.create({
            data: { id: (0, crypto_1.randomUUID)(), salleId: salle.id, name: 'Mensuel', durationDays: 30, price: 15000, currency: 'XOF' },
        }),
        prisma.abonnementCatalogue.create({
            data: { id: (0, crypto_1.randomUUID)(), salleId: salle.id, name: 'Trimestriel', durationDays: 90, price: 40000, currency: 'XOF' },
        }),
        prisma.abonnementCatalogue.create({
            data: { id: (0, crypto_1.randomUUID)(), salleId: salle.id, name: 'Annuel', durationDays: 365, price: 140000, currency: 'XOF' },
        }),
    ]);
    console.log(`✓ 3 formules d'abonnement créées`);
    // ── 7. Adhérents — statuts volontairement variés ─────────────
    // Chaque entrée décrit un scénario réaliste : le tableau de bord et
    // les listes ne doivent JAMAIS être vides ou uniformes en démo.
    const adherentsPlan = [
        { firstName: 'Moussa', lastName: 'Traoré', phone: '+22670000010', formule: mensuel, daysAgoStart: 10, payerStatus: 'VALIDE' }, // actif, bien en cours
        { firstName: 'Aminata', lastName: 'Compaoré', phone: '+22670000011', formule: trimestriel, daysAgoStart: 20, payerStatus: 'VALIDE' }, // actif
        { firstName: 'Seydou', lastName: 'Diallo', phone: '+22670000012', formule: annuel, daysAgoStart: 100, payerStatus: 'VALIDE' }, // actif, gros forfait
        { firstName: 'Rasmata', lastName: 'Sanou', phone: '+22670000013', formule: mensuel, daysAgoStart: 29, payerStatus: 'VALIDE' }, // actif, expire demain (bientôt en grâce)
        { firstName: 'Ibrahim', lastName: 'Ouattara', phone: '+22670000014', formule: mensuel, daysAgoStart: 32, payerStatus: 'VALIDE' }, // tout juste expiré -> EN_GRACE
        { firstName: 'Awa', lastName: 'Kientega', phone: '+22670000015', formule: mensuel, daysAgoStart: 60, payerStatus: 'VALIDE' }, // expiré depuis longtemps -> EXPIRE
        { firstName: 'Karim', lastName: 'Nikiema', phone: '+22670000016', formule: mensuel, daysAgoStart: 5, payerStatus: 'VALIDE' }, // actif, récent
        { firstName: 'Salimata', lastName: 'Bamogo', phone: '+22670000017', formule: trimestriel, daysAgoStart: 15, payerStatus: 'VALIDE' }, // actif
    ];
    for (const a of adherentsPlan) {
        const adherentUser = await createUser({
            firstName: a.firstName,
            lastName: a.lastName,
            phone: a.phone,
            roleCode: 'ADHERENT',
        });
        const memberCount = await prisma.adherentProfile.count({ where: { salleId: salle.id } });
        const prefix = salle.slug.slice(0, 4).toUpperCase();
        const adherent = await prisma.adherentProfile.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                userId: adherentUser.id,
                salleId: salle.id,
                memberCode: `${prefix}-${String(memberCount + 1).padStart(5, '0')}`,
                qrCodeToken: qrToken(),
                joinedAt: new Date(now.getTime() - a.daysAgoStart * 86400000),
                status: 'ACTIF', // recalculé ci-dessous selon les dates réelles de l'abonnement
            },
        });
        const startDate = new Date(now.getTime() - a.daysAgoStart * 86400000);
        const endDate = new Date(startDate.getTime() + a.formule.durationDays * 86400000);
        const isExpired = endDate < now;
        const daysSinceExpiry = isExpired ? Math.floor((now.getTime() - endDate.getTime()) / 86400000) : 0;
        const subStatus = !isExpired ? 'ACTIF' : daysSinceExpiry <= 15 ? 'EN_GRACE' : 'EXPIRE';
        const adherentAbonnement = await prisma.adherentAbonnement.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                adherentId: adherent.id,
                abonnementCatalogueId: a.formule.id,
                startDate,
                endDate,
                status: subStatus,
            },
        });
        // Statut du dossier adhérent lui-même aligné sur son abonnement
        await prisma.adherentProfile.update({
            where: { id: adherent.id },
            data: { status: subStatus === 'EXPIRE' ? 'EXPIRE' : subStatus === 'EN_GRACE' ? 'EN_GRACE' : 'ACTIF' },
        });
        // Paiement correspondant, horodaté au début de l'abonnement
        const payment = await prisma.payment.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                salleId: salle.id,
                adherentId: adherent.id,
                adherentAbonnementId: adherentAbonnement.id,
                type: 'ABONNEMENT',
                amount: a.formule.price,
                currency: a.formule.currency,
                method: 'ESPECES',
                status: 'VALIDE',
                validatedByUserId: gestionnaireUser.id,
                validatedAt: startDate,
                createdAt: startDate,
            },
        });
        await prisma.receipt.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                paymentId: payment.id,
                number: `GC-REC-DEMO-${(0, crypto_1.randomUUID)().slice(0, 8).toUpperCase()}`,
            },
        });
    }
    console.log(`✓ ${adherentsPlan.length} adhérents créés (statuts variés : actif, en grâce, expiré)`);
    // ── 8. Un adhérent suspendu, pour couvrir ce cas aussi ────────
    const suspendedUser = await createUser({
        firstName: 'Yacouba',
        lastName: 'Some',
        phone: '+22670000018',
        roleCode: 'ADHERENT',
    });
    const memberCount = await prisma.adherentProfile.count({ where: { salleId: salle.id } });
    await prisma.adherentProfile.create({
        data: {
            id: (0, crypto_1.randomUUID)(),
            userId: suspendedUser.id,
            salleId: salle.id,
            memberCode: `${salle.slug.slice(0, 4).toUpperCase()}-${String(memberCount + 1).padStart(5, '0')}`,
            qrCodeToken: qrToken(),
            status: 'SUSPENDU',
        },
    });
    console.log('✓ 1 adhérent suspendu créé');
    // ── 9. Un cours collectif, avec le coach cardio ───────────────
    const coursStart = new Date(now);
    coursStart.setDate(coursStart.getDate() + 1);
    coursStart.setHours(18, 0, 0, 0);
    const coursEnd = new Date(coursStart.getTime() + 60 * 60000);
    await prisma.coursCollectif.create({
        data: {
            id: (0, crypto_1.randomUUID)(),
            salleId: salle.id,
            coachId: coach2.id,
            name: 'CrossTraining — Niveau intermédiaire',
            startAt: coursStart,
            endAt: coursEnd,
            capacity: 15,
        },
    });
    console.log('✓ 1 cours collectif créé (demain 18h)');
    console.log('\n🎉 Seed de démonstration terminé !\n');
    console.log('⚠️  Le plan du propriétaire est volontairement SUSPENDU (facture');
    console.log('   impayée en attente) — pour tester le flux complet :');
    console.log('   1. Connectez-vous en SUPER_ADMIN → "Facturation SaaS"');
    console.log('   2. Trouvez la facture de Aïcha Ouédraogo → "Encaisser"');
    console.log('   3. La salle redevient immédiatement pleinement active');
    console.log('   (toutes les données ci-dessous existent déjà en base — seules les');
    console.log('   actions d\'écriture via l\'interface sont bloquées en attendant.)\n');
    console.log('── Comptes de test (mot de passe unique) ──────────────');
    console.log(`Mot de passe pour tous : ${DEMO_PASSWORD}`);
    console.log(`Propriétaire   : ${proprietaireUser.phone} (Aïcha Ouédraogo)`);
    console.log(`Gestionnaire   : ${gestionnaireUser.phone} (Boureima Kaboré)`);
    console.log(`Coach 1        : ${coach1User.phone} (Fatimata Zongo — séances payantes)`);
    console.log(`Coach 2        : ${coach2User.phone} (Ismaël Traoré)`);
    console.log('Adhérents      : +22670000010 à +22670000018 (voir logs ci-dessus pour les noms)');
    console.log('────────────────────────────────────────────────────────\n');
}
main()
    .catch((e) => {
    console.error('❌ Erreur pendant le seed de démonstration :', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
