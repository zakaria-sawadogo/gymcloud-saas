import { Injectable, Logger } from '@nestjs/common';

/**
 * §14.x — Envoi d'e-mails réels via l'API Resend (https://resend.com).
 * Basculé depuis une première tentative SMTP Gmail, bloquée par
 * Google sur les comptes très récemment créés (restriction anti-abus,
 * levée après quelques jours d'usage normal) — Resend fonctionne
 * immédiatement, avec un plan gratuit large (3 000 e-mails/mois).
 *
 * Configuration par variables d'environnement :
 *
 *   RESEND_API_KEY      (clé API, générée sur resend.com/api-keys)
 *   EMAIL_FROM_ADDRESS   (ex: notifications@gymcloud.sahelsystem.com —
 *                         doit appartenir à un domaine vérifié dans
 *                         Resend ; impossible d'envoyer "depuis" une
 *                         adresse @gmail.com, dont vous ne possédez
 *                         pas le domaine)
 *
 * Si RESEND_API_KEY n'est pas définie, l'envoi est silencieusement
 * désactivé (log d'avertissement) — les notifications in-app restent
 * créées normalement même si l'e-mail échoue ou n'est pas configuré.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY;
  private readonly fromAddress = process.env.EMAIL_FROM_ADDRESS ?? 'notifications@gymcloud.sahelsystem.com';
  // §14.x — L'adresse d'envoi (domaine vérifié Resend) n'est
  // généralement pas surveillée activement : le "Répondre à" redirige
  // vers le vrai contact support, pour qu'une réponse directe du
  // propriétaire arrive bien quelque part.
  private readonly replyToAddress = process.env.EMAIL_REPLY_TO ?? 'gymcloudsys@gmail.com';

  constructor() {
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY non définie — envoi d\'e-mail désactivé (les notifications in-app restent actives)');
    }
  }

  async send(to: string, subject: string, body: string, fromName = 'GymCloud'): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const footer = `<hr style="margin-top:24px;border:none;border-top:1px solid #E5E7E8;">
        <p style="color:#71767A;font-size:12px;margin-top:12px;">
          Vous pouvez répondre directement à cet e-mail — votre message nous parviendra à ${this.replyToAddress}.
        </p>`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${this.fromAddress}>`,
          to: [to],
          reply_to: this.replyToAddress,
          subject,
          html: `<p>${body.replace(/\n/g, '<br>')}</p>${footer}`,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Échec d'envoi d'e-mail à ${to}: ${res.status} ${text}`);
        return false;
      }
      return true;
    } catch (error) {
      // Une panne d'envoi ne doit jamais faire échouer l'opération
      // métier déclenchante (ex: création d'un adhérent) — la
      // notification in-app reste de toute façon créée séparément.
      this.logger.error(`Échec d'envoi d'e-mail à ${to}: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }
}
