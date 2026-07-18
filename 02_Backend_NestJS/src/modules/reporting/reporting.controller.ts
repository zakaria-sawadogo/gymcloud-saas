import { Controller, ForbiddenException, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportingService } from './reporting.service';
import { ReportPdfService } from './report-pdf.service';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * Contrôle d'autorisation (§13.8) : les permissions CASL (@RequirePermission)
 * vérifient QUEL TYPE de rôle peut appeler chaque route, mais pas QUELLE
 * instance (quelle salle, quel propriétaire) — sans quoi n'importe quel
 * Propriétaire ou Gestionnaire authentifié pourrait consulter les données
 * d'une autre salle/d'un autre propriétaire en changeant l'identifiant
 * dans l'URL (IDOR). Chaque méthode vérifie donc explicitement que
 * l'identifiant demandé correspond bien à l'appelant, sauf accès global
 * (SUPER_ADMIN et rôles internes habilités).
 */
@ApiTags('Reporting & BI')
@ApiBearerAuth()
@Controller('reporting')
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly reportPdfService: ReportPdfService,
  ) {}

  private async assertCanAccessSalle(salleId: string, user: TenantContext): Promise<void> {
    if (user.isGlobalAccess) return;
    if (user.salleId === salleId) return; // GESTIONNAIRE / COACH / ADHERENT sur leur propre salle
    if (user.proprietaireId) {
      const owns = await this.reportingService.assertSalleBelongsToProprietaire(salleId, user.proprietaireId);
      if (owns) return;
    }
    throw new ForbiddenException('Vous n\'avez pas accès aux données de cette salle');
  }

  private assertCanAccessProprietaire(proprietaireId: string, user: TenantContext): void {
    if (user.isGlobalAccess) return;
    if (user.proprietaireId === proprietaireId) return;
    throw new ForbiddenException('Vous n\'avez pas accès aux données de ce propriétaire');
  }

  @Get('salle/:salleId/dashboard')
  @RequirePermission('read', 'Payment')
  @ApiOperation({ summary: 'Tableau de bord Gestionnaire — pilotage quotidien d\'une salle (§11)' })
  async gestionnaireDashboard(@Param('salleId') salleId: string, @CurrentUser() user: TenantContext) {
    await this.assertCanAccessSalle(salleId, user);
    return this.reportingService.getGestionnaireDashboard(salleId);
  }

  @Get('salle/:salleId/revenue')
  @RequirePermission('read', 'Payment')
  @ApiOperation({ summary: 'Détail des revenus sur une période, par méthode et par jour' })
  async revenue(
    @Param('salleId') salleId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: TenantContext,
  ) {
    await this.assertCanAccessSalle(salleId, user);
    return this.reportingService.getRevenueReport(salleId, new Date(from), new Date(to));
  }

  @Get('salle/:salleId/occupancy')
  @RequirePermission('read', 'AccessLog')
  @ApiOperation({ summary: 'Tendances de fréquentation sur une période' })
  async occupancy(
    @Param('salleId') salleId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: TenantContext,
  ) {
    await this.assertCanAccessSalle(salleId, user);
    return this.reportingService.getOccupancyTrends(salleId, new Date(from), new Date(to));
  }

  @Get('salle/:salleId/retention')
  @RequirePermission('read', 'Adherent')
  @ApiOperation({ summary: 'Taux de rétention et réabonnements' })
  async retention(@Param('salleId') salleId: string, @CurrentUser() user: TenantContext) {
    await this.assertCanAccessSalle(salleId, user);
    return this.reportingService.getRetentionReport(salleId);
  }

  @Get('proprietaire/:proprietaireId/dashboard')
  @RequirePermission('read', 'SaasSubscription')
  @ApiOperation({ summary: 'Vue consolidée multi-salles pour un propriétaire (§2.3, §11)' })
  proprietaireDashboard(@Param('proprietaireId') proprietaireId: string, @CurrentUser() user: TenantContext) {
    this.assertCanAccessProprietaire(proprietaireId, user);
    return this.reportingService.getProprietaireDashboard(proprietaireId);
  }

  @Get('admin/dashboard')
  @RequirePermission('read', 'SaasPlan')
  @ApiOperation({ summary: 'Santé globale de la plateforme — exclusif SUPER_ADMIN (§9, §13)' })
  adminDashboard() {
    return this.reportingService.getSuperAdminDashboard();
  }

  @Get('admin/kpis')
  @RequirePermission('read', 'SaasPlan')
  @ApiOperation({ summary: 'Indicateurs stratégiques SaaS — MRR, ARR, churn, rétention, LTV, croissance (§9.15)' })
  saasKpis() {
    return this.reportingService.getSaasKpis();
  }

  // ─────────────────────────────────────────────────────────────
  // Rapports PDF (§11) — mêmes vérifications d'appartenance que les
  // tableaux de bord en ligne ci-dessus, réutilisées telles quelles.
  // ─────────────────────────────────────────────────────────────

  @Get('salle/:salleId/pdf')
  @RequirePermission('read', 'Payment')
  @ApiOperation({ summary: 'Rapport PDF de la salle — Gestionnaire, Propriétaire (ses salles) ou SUPER_ADMIN' })
  async gestionnaireReportPdf(
    @Param('salleId') salleId: string,
    @CurrentUser() user: TenantContext,
    @Res() res: Response,
  ) {
    await this.assertCanAccessSalle(salleId, user);
    const pdfBuffer = await this.reportPdfService.generateGestionnaireReportPdf(salleId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rapport-salle-${salleId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  @Get('proprietaire/:proprietaireId/pdf')
  @RequirePermission('read', 'SaasSubscription')
  @ApiOperation({ summary: 'Rapport PDF consolidé — Propriétaire (le sien) ou SUPER_ADMIN' })
  async proprietaireReportPdf(
    @Param('proprietaireId') proprietaireId: string,
    @CurrentUser() user: TenantContext,
    @Res() res: Response,
  ) {
    this.assertCanAccessProprietaire(proprietaireId, user);
    const pdfBuffer = await this.reportPdfService.generateProprietaireReportPdf(proprietaireId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rapport-consolide-${proprietaireId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  @Get('admin/pdf')
  @RequirePermission('read', 'SaasPlan')
  @ApiOperation({ summary: 'Rapport PDF de la plateforme — exclusif SUPER_ADMIN' })
  async superAdminReportPdf(@Res() res: Response) {
    const pdfBuffer = await this.reportPdfService.generateSuperAdminReportPdf();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="rapport-plateforme.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }
}
