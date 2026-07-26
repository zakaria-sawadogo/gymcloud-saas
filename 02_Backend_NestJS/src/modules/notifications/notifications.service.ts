import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';

export type NotificationChannel = 'PUSH' | 'SMS' | 'EMAIL' | 'WHATSAPP' | 'IN_APP';

/**
 * §6.5, §6.14 — Notifications internes. Seul le canal IN_APP est
 * réellement acheminé pour l'instant (consultable dans l'app/le web) :
 * aucune passerelle SMS/WhatsApp n'est branchée, et PUSH nécessiterait
 * une configuration Firebase dédiée non mise en place — les valeurs
 * SMS/WHATSAPP/PUSH restent définies dans le schéma pour une évolution
 * future, mais ne déclenchent aucun envoi réel aujourd'hui.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, title: string, body: string, channel: NotificationChannel = 'IN_APP') {
    return this.prisma.notification.create({
      data: { id: randomUUID(), userId, channel, title, body },
    });
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
