import { AbilityFactory } from './ability.factory';
import { TenantContext } from '../middleware/tenant.middleware';

/**
 * §14.x — Premier test réel du projet, volontairement choisi sur les
 * rôles cumulés (chantier de cette session) : la garantie la plus
 * importante à vérifier est que cumuler un rôle ADDITIONNEL ajoute
 * bien des droits, sans jamais en retirer du rôle principal.
 */
describe('AbilityFactory', () => {
  const factory = new AbilityFactory();

  function makeContext(overrides: Partial<TenantContext>): TenantContext {
    return {
      userId: 'user-1',
      roleCode: 'GESTIONNAIRE',
      salleId: 'salle-1',
      proprietaireId: null,
      isGlobalAccess: false,
      additionalRoleCodes: [],
      ...overrides,
    };
  }

  it('SUPER_ADMIN peut tout faire', async () => {
    const ability = await factory.createForUser(makeContext({ roleCode: 'SUPER_ADMIN', isGlobalAccess: true }));
    expect(ability.can('manage', 'Salle')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(true);
  });

  it('un code de rôle inconnu ne donne aucun droit', async () => {
    const ability = await factory.createForUser(makeContext({ roleCode: 'ROLE_INEXISTANT' }));
    expect(ability.can('manage', 'Salle')).toBe(false);
    expect(ability.can('read', 'Salle')).toBe(false);
  });

  it("cumule les droits d'un rôle additionnel sans perdre ceux du rôle principal", async () => {
    // GESTIONNAIRE seul : pas de droits sur SaasSubscription
    const withoutAdditional = await factory.createForUser(makeContext({ roleCode: 'GESTIONNAIRE' }));
    expect(withoutAdditional.can('manage', 'Adherent')).toBe(true);
    expect(withoutAdditional.can('read', 'SaasSubscription')).toBe(false);

    // GESTIONNAIRE + RESPONSABLE_FINANCE cumulé : garde ses droits ET
    // gagne ceux du rôle additionnel.
    const withAdditional = await factory.createForUser(
      makeContext({ roleCode: 'GESTIONNAIRE', additionalRoleCodes: ['RESPONSABLE_FINANCE'] }),
    );
    expect(withAdditional.can('manage', 'Adherent')).toBe(true); // conservé du rôle principal
    expect(withAdditional.can('read', 'SaasSubscription')).toBe(true); // gagné du rôle additionnel
    expect(withAdditional.can('read', 'Payment')).toBe(true); // gagné du rôle additionnel
  });

  it('peut cumuler plusieurs rôles additionnels à la fois', async () => {
    const ability = await factory.createForUser(
      makeContext({
        roleCode: 'RESPONSABLE_SUPPORT',
        additionalRoleCodes: ['RESPONSABLE_FINANCE', 'RESPONSABLE_COMMERCIAL'],
      }),
    );
    expect(ability.can('update', 'User')).toBe(true); // RESPONSABLE_SUPPORT
    expect(ability.can('read', 'Payment')).toBe(true); // RESPONSABLE_FINANCE
    expect(ability.can('manage', 'SaasSubscriptionRequest')).toBe(true); // RESPONSABLE_COMMERCIAL
  });
});
