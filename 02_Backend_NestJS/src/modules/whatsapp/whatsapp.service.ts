import { Injectable, Logger } from '@nestjs/common';

/**
 * §14.x — Envoi de messages WhatsApp réels via l'API Cloud de Meta
 * (https://developers.facebook.com/docs/whatsapp/cloud-api). Remplace
 * le canal WHATSAPP jusqu'ici défini mais totalement inopérant (voir
 * NotificationsService) — un vrai bug d'attente, pas juste une
 * fonctionnalité manquante : le canal existait sans jamais rien
 * envoyer.
 *
 * IMPORTANT — contrainte WhatsApp que ce service respecte forcément :
 * un message initié par l'entreprise (pas en réponse à un client dans
 * les 24h) DOIT utiliser un modèle ("template") pré-approuvé par Meta
 * — impossible d'envoyer du texte libre dans ce cas, l'API le
 * refuserait. Chaque appel à send() référence donc un templateName
 * déjà créé et approuvé dans WhatsApp Manager, jamais un corps de
 * texte arbitraire.
 *
 * Configuration par variables d'environnement :
 *
 *   WHATSAPP_ACCESS_TOKEN     (jeton d'accès permanent, généré dans
 *                              l'app Meta > WhatsApp > Configuration
 *                              de l'API)
 *   WHATSAPP_PHONE_NUMBER_ID  (identifiant du numéro expéditeur,
 *                              visible dans le même panneau)
 *
 * Si l'une des deux n'est pas définie, l'envoi est silencieusement
 * désactivé (log d'avertissement) — même philosophie que EmailService :
 * les notifications in-app restent créées normalement même si
 * WhatsApp échoue ou n'est pas configuré.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private readonly apiVersion = 'v21.0';

  constructor() {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        'WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID non défini — envoi WhatsApp désactivé (les notifications in-app/e-mail restent actives)',
      );
    }
  }

  /**
   * Envoie un message basé sur un modèle pré-approuvé.
   *
   * @param to Numéro du destinataire au format international SANS le
   *   "+" (ex: "22674967857"), tel qu'exigé par l'API Cloud.
   * @param templateName Nom exact du modèle tel que créé dans
   *   WhatsApp Manager (ex: "rappel_echeance_abonnement").
   * @param parameters Valeurs venant remplir les variables {{1}},
   *   {{2}}... du modèle, dans l'ordre.
   * @param languageCode Code de langue du modèle tel qu'approuvé
   *   (ex: "fr" pour français).
   */
  async send(to: string, templateName: string, parameters: string[] = [], languageCode = 'fr'): Promise<boolean> {
    if (!this.accessToken || !this.phoneNumberId) return false;

    const normalizedTo = to.replace(/[^\d]/g, ''); // retire "+", espaces, tirets

    try {
      const res = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: normalizedTo,
            type: 'template',
            template: {
              name: templateName,
              language: { code: languageCode },
              components:
                parameters.length > 0
                  ? [{ type: 'body', parameters: parameters.map((p) => ({ type: 'text', text: p })) }]
                  : undefined,
            },
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Échec d'envoi WhatsApp à ${normalizedTo}: ${res.status} ${text}`);
        return false;
      }
      return true;
    } catch (error) {
      // Une panne d'envoi ne doit jamais faire échouer l'opération
      // métier déclenchante — la notification in-app/e-mail reste de
      // toute façon créée séparément (voir NotificationsService).
      this.logger.error(`Échec d'envoi WhatsApp à ${normalizedTo}: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }
}
