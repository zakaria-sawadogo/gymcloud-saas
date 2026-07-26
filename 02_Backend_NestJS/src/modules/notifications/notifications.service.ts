import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from './email.service';
import { randomUUID } from 'crypto';

export type NotificationChannel = 'PUSH' | 'SMS' | 'EMAIL' | 'WHATSAPP' | 'IN_APP';

/**
 * §6.5, §6.14, §14.x — Notifications internes. Chaque notification
 * est toujours consultable in-app (cloche web, badge mobile), ET
 * envoyée par e-mail en parallèle si l'utilisateur en a un enregistré
 * — aucune passerelle SMS/WhatsApp n'est branchée, et PUSH
 * nécessiterait une configuration Firebase dédiée non mise en place ;
 * les valeurs SMS/WHATSAPP/PUSH restent définies dans le schéma pour
 * une évolution future, mais ne déclenchent aucun envoi réel
 * aujourd'hui — seul IN_APP + e-mail le sont.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(userId: string, title: string, body: string, channel: NotificationChannel = 'IN_APP') {
    const notification = await this.prisma.notification.create({
      data: { id: randomUUID(), userId, channel, title, body },
    });

    // L'e-mail est un complément à la notification in-app, jamais un
    // remplacement — une panne d'envoi (ou une adresse absente) ne
    // doit jamais faire échouer la création de la notification
    // elle-même, déjà actée ci-dessus.
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      await this.emailService.send(user.email, title, body);
    }

    return notification;
  }

  async createForUsers(userIds: string[], title: string, body: string) {
    await Promise.all(userIds.map((userId) => this.create(userId, title, body)));
  }

  async listForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findUniqueOrThrow({ where: { id } });
    if (notif.userId !== userId) {
      throw new ForbiddenException('Cette notification ne vous appartient pas');
    }
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  /**
   * §5.6, §8.3 — Alerte le gestionnaire et le propriétaire qu'un
   * adhérent a soumis une demande de réabonnement depuis l'app
   * mobile — un paiement (espèces ou Mobile Money) reste "En attente"
   * tant que ce n'est pas confirmé côté salle ; sans cette alerte,
   * rien n'indiquait qu'une confirmation était nécessaire.
   */
  async notifyNewSubscriptionRequest(
    salleId: string,
    adherentName: string,
    amount: number,
    currency: string,
    method: string,
  ) {
    const [gestionnaires, salle] = await Promise.all([
      this.prisma.gestionnaireProfile.findMany({ where: { salleId }, select: { userId: true } }),
      this.prisma.salle.findUnique({ where: { id: salleId }, select: { proprietaire: { select: { userId: true } } } }),
    ]);

    const recipientUserIds = [
      ...gestionnaires.map((g: { userId: string }) => g.userId),
      ...(salle?.proprietaire ? [salle.proprietaire.userId] : []),
    ];
    if (recipientUserIds.length === 0) return;

    await this.createForUsers(
      recipientUserIds,
      'Nouvelle demande de réabonnement',
      `${adherentName} demande un réabonnement (${amount} ${currency} par ${method}) — à confirmer dans "Paiements en attente".`,
    );
  }

  /**
   * §9.8, §9.12 — Alerte tous les SUPER_ADMIN qu'un propriétaire a
   * déclaré un paiement pour un changement/réabonnement de plan SaaS,
   * en attente de validation (un propriétaire ne peut jamais
   * s'auto-valider — voir SaasBillingService.changePlan).
   */
  async notifySuperAdminsPlanChangePending(proprietaireName: string, planName: string, amount: number, currency: string) {
    const superAdmins = await this.prisma.user.findMany({
      where: { role: { code: 'SUPER_ADMIN' } },
      select: { id: true },
    });
    if (superAdmins.length === 0) return;

    await this.createForUsers(
      superAdmins.map((u: { id: string }) => u.id),
      'Changement de plan SaaS à valider',
      `${proprietaireName} a déclaré un paiement de ${amount} ${currency} pour passer au plan "${planName}" — à confirmer dans "Facturation SaaS".`,
    );
  }

  /**
   * §9.8, §9.12 — Alerte le propriétaire qu'un SUPER_ADMIN a validé son
   * changement/réabonnement de plan SaaS déclaré.
   */
  async notifyProprietairePlanChangeApproved(proprietaireUserId: string, planName: string) {
    await this.create(
      proprietaireUserId,
      'Changement de plan confirmé',
      `Votre paiement a été validé — votre abonnement GymCloud est maintenant sur le plan "${planName}".`,
    );
  }

  /**
   * §6.14 — Alerte le gestionnaire et le propriétaire d'une salle
   * qu'un adhérent a tenté de pointer son entrée (auto-pointage) mais
   * a été refusé — abonnement expiré ou compte suspendu. Permet un
   * suivi commercial rapide (relance de réabonnement) sans attendre
   * que l'adhérent ne se manifeste lui-même.
   */
  async notifyAccessDenied(salleId: string, adherentName: string, reason: string) {
    const [gestionnaires, salle] = await Promise.all([
      this.prisma.gestionnaireProfile.findMany({ where: { salleId }, select: { userId: true } }),
      this.prisma.salle.findUnique({ where: { id: salleId }, select: { proprietaire: { select: { userId: true } } } }),
    ]);

    const recipientUserIds = [
      ...gestionnaires.map((g: { userId: string }) => g.userId),
      ...(salle?.proprietaire ? [salle.proprietaire.userId] : []),
    ];
    if (recipientUserIds.length === 0) return;

    await this.createForUsers(
      recipientUserIds,
      'Accès refusé — auto-pointage',
      `${adherentName} a tenté de pointer son entrée mais a été refusé : ${reason}`,
    );
  }
}
