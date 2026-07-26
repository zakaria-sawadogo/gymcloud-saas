import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * §14.x — Envoi d'e-mails réels via SMTP, depuis l'adresse
 * gymcloudsys@gmail.com. Configuré par variables d'environnement :
 *
 *   SMTP_HOST     (défaut: smtp.gmail.com)
 *   SMTP_PORT     (défaut: 587)
 *   SMTP_USER     (ex: gymcloudsys@gmail.com)
 *   SMTP_PASSWORD (mot de passe d'application Gmail — PAS le mot de
 *                  passe du compte lui-même ; Gmail exige un mot de
 *                  passe généré spécifiquement pour les applications
 *                  tierces, avec la validation en 2 étapes activée :
 *                  https://myaccount.google.com/apppasswords)
 *
 * Si ces variables ne sont pas définies, l'envoi est silencieusement
 * désactivé (log d'avertissement) — n'empêche jamais le reste de
 * l'application de fonctionner : les notifications in-app restent
 * créées normalement même si l'e-mail échoue ou n'est pas configuré.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;

  constructor() {
    this.fromAddress = process.env.SMTP_USER ?? 'gymcloudsys@gmail.com';

    if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: false, // STARTTLS sur le port 587 — pas de TLS direct
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    } else {
      this.logger.warn(
        'SMTP_USER/SMTP_PASSWORD non définis — envoi d\'e-mail désactivé (les notifications in-app restent actives)',
      );
    }
  }

  async send(to: string, subject: string, body: string): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({
        from: `GymCloud <${this.fromAddress}>`,
        to,
        subject,
        text: body,
        html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
      });
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
