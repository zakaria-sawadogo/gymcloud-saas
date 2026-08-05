import { Controller, Get, Post, Query, Body, Res, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiExcludeEndpoint, ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { WhatsAppService } from './whatsapp.service';
import { RequirePermission } from '../../common/casl/policies.guard';

export class TestSendWhatsAppDto {
  @ApiProperty({ description: 'Numéro destinataire, avec ou sans indicatif, ex: "+22674967857"' })
  @IsString()
  to!: string;
}

/**
 * §14.x — Point d'entrée des webhooks WhatsApp (Meta Cloud API).
 * Route sous /public/ pour bénéficier de l'exemption d'authentification
 * déjà en place pour le reste du site public (voir tenant.middleware.ts,
 * PUBLIC_PATH_PREFIXES) — Meta appelle cette route depuis l'extérieur,
 * sans jeton GymCloud, donc jamais derrière l'authentification interne.
 *
 * Deux responsabilités distinctes exigées par Meta :
 *  - GET  : poignée de main de vérification, une seule fois à la
 *    configuration (Meta envoie un "challenge" à renvoyer tel quel si
 *    le jeton de vérification correspond).
 *  - POST : réception réelle des événements (messages entrants, accusés
 *    de lecture/livraison). Pour l'instant, se contente de journaliser
 *    et d'accuser réception (200 OK) — Meta exige une réponse rapide,
 *    sinon désactive le webhook après des échecs répétés. Le
 *    traitement métier des messages entrants (répondre à un adhérent,
 *    etc.) est un chantier séparé, non couvert ici.
 */
@ApiTags('whatsapp')
@Controller('public/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);
  private readonly verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  @Get('webhook')
  @ApiExcludeEndpoint() // appelé exclusivement par Meta, pas un endpoint destiné à un client de l'app
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && this.verifyToken && token === this.verifyToken) {
      this.logger.log('Vérification du webhook WhatsApp réussie');
      return res.status(HttpStatus.OK).send(challenge);
    }
    this.logger.warn('Échec de vérification du webhook WhatsApp — jeton invalide ou non configuré');
    return res.sendStatus(HttpStatus.FORBIDDEN);
  }

  @Post('webhook')
  @ApiExcludeEndpoint()
  receive(@Body() body: unknown, @Res() res: Response) {
    // Accusé de réception immédiat exigé par Meta — le traitement
    // métier des messages entrants n'est pas encore implémenté.
    this.logger.log(`Webhook WhatsApp reçu: ${JSON.stringify(body).slice(0, 500)}`);
    return res.sendStatus(HttpStatus.OK);
  }
}

/**
 * §14.x — Endpoints WhatsApp réservés aux utilisateurs authentifiés
 * (SUPER_ADMIN) — délibérément un contrôleur SÉPARÉ de
 * WhatsAppController ci-dessus : ce dernier vit sous /public/whatsapp,
 * un préfixe exempté d'authentification (voir tenant.middleware.ts).
 * Y mettre un endpoint protégé par @RequirePermission ne fonctionne
 * PAS — le TenantContext n'est jamais peuplé sur un chemin public, la
 * vérification de permission échoue donc systématiquement avec 403,
 * quel que soit le rôle de l'appelant (bug réel corrigé — c'était le
 * cas de test-send avant cette séparation).
 */
@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsAppAdminController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  /**
   * Envoi d'un message de test, réservé SUPER_ADMIN — utilise le
   * modèle "hello_world", pré-approuvé par défaut par Meta pour tout
   * compte WhatsApp Business, permettant de valider la connexion
   * (jeton + identifiant de numéro) sans attendre l'approbation d'un
   * modèle personnalisé. Reste utile au-delà du test initial, pour
   * diagnostiquer une connexion WhatsApp qui semble ne plus fonctionner.
   */
  @Post('test-send')
  @RequirePermission('manage', 'PlatformSettings')
  @ApiOperation({ summary: 'Envoyer un message WhatsApp de test (modèle hello_world) — réservé SUPER_ADMIN' })
  async testSend(@Body() dto: TestSendWhatsAppDto) {
    const sent = await this.whatsAppService.send(dto.to, 'hello_world', [], 'en_US');
    return { sent };
  }
}
