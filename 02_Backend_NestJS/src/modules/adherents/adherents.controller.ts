import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdherentsService } from './adherents.service';
import { MembershipCardPdfService } from './membership-card-pdf.service';
import { CreateAdherentDto, UpdateAdherentDto, SubscribeAdherentDto } from './dto/adherents.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CheckQuota } from '../../common/guards/quota.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { RestrictedInDegradedMode } from '../../common/decorators/restricted-in-degraded-mode.decorator';

class PaymentInfoDto {
  @ApiProperty({ enum: ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'] })
  @IsIn(['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'])
  method!: 'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE';

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

class CreateAdherentWithPaymentDto extends CreateAdherentDto {
  @ApiProperty({ description: 'Formule d\'abonnement choisie — obligatoire pour ce flux guichet complet' })
  @IsString()
  declare abonnementCatalogueId: string;

  @ApiProperty({ type: PaymentInfoDto })
  @ValidateNested()
  @Type(() => PaymentInfoDto)
  payment!: PaymentInfoDto;
}

@ApiTags('Adhérents')
@ApiBearerAuth()
@RequireModule('adherents')
@Controller('adherents')
export class AdherentsController {
  constructor(
    private readonly adherentsService: AdherentsService,
    private readonly membershipCardPdfService: MembershipCardPdfService,
  ) {}

  @Post()
  @RequirePermission('manage', 'Adherent')
  @CheckQuota('adherents') // quota du plan SaaS (§13.20)
  @RestrictedInDegradedMode() // "création d'adhérents" bloquée en mode dégradé (§9.10)
  @ApiOperation({ summary: 'Inscrire un adhérent, avec souscription immédiate optionnelle (§4.6, §5.6)' })
  create(@Body() dto: CreateAdherentDto, @CurrentUser() user: TenantContext) {
    return this.adherentsService.create(dto, user.userId);
  }

  @Post('with-payment')
  @RequirePermission('manage', 'Adherent')
  @CheckQuota('adherents')
  @RestrictedInDegradedMode()
  @ApiOperation({
    summary:
      'Flux guichet complet (§5.1, §5.6, §8.3) : inscription + choix de la formule + encaissement en une seule opération. La facture et la carte membre ne sont pertinentes qu\'après ce paiement.',
  })
  createWithPayment(@Body() dto: CreateAdherentWithPaymentDto, @CurrentUser() user: TenantContext) {
    const { payment, ...adherentDto } = dto;
    return this.adherentsService.createWithPayment(adherentDto, payment, user.userId);
  }

  @Get(':id/card')
  @RequirePermission('read', 'Adherent')
  @ApiOperation({ summary: 'Carte membre au format PDF, avec QR code d\'accès (§5.1, §6.3)' })
  async downloadCard(@Param('id') id: string, @CurrentUser() user: TenantContext, @Res() res: Response) {
    const pdfBuffer = await this.membershipCardPdfService.generateCard(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="carte-membre-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  @Get('qr/:qrCodeToken')
  @RequirePermission('read', 'Adherent')
  @ApiOperation({
    summary:
      'Rechercher un adhérent par son jeton QR — sans effectuer de scan (contrôle rapide avant action, §6.13)',
  })
  findByQrToken(@Param('qrCodeToken') qrCodeToken: string) {
    return this.adherentsService.findByQrToken(qrCodeToken);
  }

  @Get(':id')
  @RequirePermission('read', 'Adherent')
  @ApiOperation({ summary: 'Dossier complet d\'un adhérent, avec historique d\'abonnements' })
  findOne(@Param('id') id: string) {
    return this.adherentsService.findById(id);
  }

  @Get('salle/:salleId')
  @RequirePermission('read', 'Adherent')
  @ApiOperation({ summary: 'Liste des adhérents d\'une salle, filtrable par statut' })
  findBySalle(@Param('salleId') salleId: string, @Query('status') status?: string) {
    return this.adherentsService.findBySalle(salleId, { status });
  }

  @Patch(':id')
  @RequirePermission('manage', 'Adherent')
  @ApiOperation({ summary: 'Modifier les informations d\'un adhérent (§5.2)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdherentDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.adherentsService.update(id, dto, user.userId);
  }

  @Patch(':id/regenerate-qr')
  @RequirePermission('manage', 'Adherent')
  @ApiOperation({ summary: 'Régénérer le QR code (perte de téléphone, suspicion de partage)' })
  regenerateQr(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.adherentsService.regenerateQrToken(id, user.userId);
  }

  @Patch(':id/suspend')
  @RequirePermission('manage', 'Adherent')
  @ApiOperation({ summary: 'Suspendre un adhérent' })
  suspend(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.adherentsService.suspend(id, user.userId, reason);
  }

  @Patch(':id/reactivate')
  @RequirePermission('manage', 'Adherent')
  @ApiOperation({ summary: 'Réactiver un adhérent suspendu' })
  reactivate(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.adherentsService.reactivate(id, user.userId);
  }

  @Post(':id/subscribe')
  @RequirePermission('manage', 'AdherentAbonnement')
  @RestrictedInDegradedMode() // "création d'abonnements" bloquée en mode dégradé (§9.10)
  @ApiOperation({
    summary: 'Souscrire / réabonner (chaînage automatique sans perte de jours — §5.13)',
  })
  subscribe(
    @Param('id') id: string,
    @Body() dto: SubscribeAdherentDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.adherentsService.subscribe(id, dto, user.userId);
  }

  @Get(':id/history')
  @RequirePermission('read', 'AdherentAbonnement')
  @ApiOperation({ summary: 'Historique complet des abonnements (§5.7)' })
  history(@Param('id') id: string) {
    return this.adherentsService.history(id);
  }
}
