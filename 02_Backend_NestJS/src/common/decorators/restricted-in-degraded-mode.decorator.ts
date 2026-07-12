import { SetMetadata } from '@nestjs/common';

export const RESTRICTED_IN_DEGRADED_MODE_KEY = 'restricted_in_degraded_mode';

/**
 * §9.10 — Marque une route comme bloquée en « mode dégradé » (J+8 à
 * J+15 de la période de grâce d'un abonnement SaaS expiré) : création
 * d'adhérents, d'abonnements, de réservations, lancement de
 * campagnes marketing. Vérifié par `SubscriptionAccessGuard`.
 *
 * Ne s'applique qu'aux actions de CRÉATION explicitement décorées —
 * la consultation et l'enregistrement de paiements restent toujours
 * autorisés, même en mode dégradé (§9.10 : la salle doit pouvoir
 * continuer à percevoir des règlements pour sortir de la grâce).
 */
export const RestrictedInDegradedMode = () => SetMetadata(RESTRICTED_IN_DEGRADED_MODE_KEY, true);
