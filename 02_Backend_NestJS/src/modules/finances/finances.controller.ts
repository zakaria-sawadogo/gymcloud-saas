import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinancesService } from './finances.service';
import { CreateExpenseDto, UpdateExpenseDto, SetBudgetDto } from './dto/finances.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('GymCloud Finances (add-on)')
@ApiBearerAuth()
@Controller('salles/:salleId/finances')
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  @Get('expenses')
  @RequirePermission('read', 'Expense')
  @ApiOperation({ summary: 'Dépenses du mois (§14.x) — un gestionnaire ne voit jamais les confidentielles' })
  listExpenses(
    @Param('salleId') salleId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.financesService.listExpenses(salleId, Number(year), Number(month), user);
  }

  @Post('expenses')
  @RequirePermission('manage', 'Expense')
  @ApiOperation({ summary: "Enregistrer une dépense — nécessite l'add-on GymCloud Finances actif" })
  createExpense(
    @Param('salleId') salleId: string,
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.financesService.createExpense(salleId, dto, user);
  }

  @Post('expenses/:expenseId/duplicate')
  @RequirePermission('manage', 'Expense')
  @ApiOperation({ summary: 'Dupliquer une dépense récurrente pour le mois courant' })
  duplicateExpense(@Param('expenseId') expenseId: string, @CurrentUser() user: TenantContext) {
    return this.financesService.duplicateExpense(expenseId, user);
  }

  @Patch('expenses/:expenseId')
  @RequirePermission('manage', 'Expense')
  @ApiOperation({ summary: 'Modifier une dépense' })
  updateExpense(
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.financesService.updateExpense(expenseId, dto, user);
  }

  @Delete('expenses/:expenseId')
  @RequirePermission('manage', 'Expense')
  @ApiOperation({ summary: 'Supprimer une dépense' })
  deleteExpense(@Param('expenseId') expenseId: string, @CurrentUser() user: TenantContext) {
    return this.financesService.deleteExpense(expenseId, user);
  }

  @Patch('expenses/:expenseId/receipt')
  @RequirePermission('manage', 'Expense')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Photo du justificatif' })
  uploadReceipt(
    @Param('expenseId') expenseId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: TenantContext,
  ) {
    if (!file) throw new BadRequestException('Image requise');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Image trop volumineuse (5 Mo maximum)');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Format non supporté — utilisez JPEG, PNG ou WebP');
    }
    return this.financesService.uploadReceipt(expenseId, file, user);
  }

  @Get('net-result')
  @RequirePermission('read', 'Expense')
  @ApiOperation({ summary: 'Revenus - dépenses = résultat net, pour un mois donné — réservé propriétaire/SUPER_ADMIN' })
  getNetResult(
    @Param('salleId') salleId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.financesService.getNetResult(salleId, Number(year), Number(month), user);
  }

  @Get('boutique-revenue')
  @RequirePermission('read', 'Expense')
  @ApiOperation({ summary: "Revenus boutique seuls — équivalent restreint pour le gestionnaire" })
  getBoutiqueRevenueSummary(
    @Param('salleId') salleId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.financesService.getBoutiqueRevenueSummary(salleId, Number(year), Number(month));
  }

  @Get('trend')
  @RequirePermission('read', 'Expense')
  @ApiOperation({ summary: "Évolution mensuelle (revenus/dépenses/résultat net) — réservé propriétaire/SUPER_ADMIN" })
  getMonthlyTrend(
    @Param('salleId') salleId: string,
    @Query('months') months: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.financesService.getMonthlyTrend(salleId, Number(months) || 6, user);
  }

  @Get('budgets')
  @RequirePermission('read', 'Expense')
  @ApiOperation({ summary: 'Budgets indicatifs par catégorie — réservé propriétaire/SUPER_ADMIN' })
  listBudgets(@Param('salleId') salleId: string, @CurrentUser() user: TenantContext) {
    return this.financesService.listBudgets(salleId, user);
  }

  @Post('budgets')
  @RequirePermission('manage', 'Expense')
  @ApiOperation({ summary: 'Définir un budget mensuel pour une catégorie' })
  setBudget(
    @Param('salleId') salleId: string,
    @Body() dto: SetBudgetDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.financesService.setBudget(salleId, dto, user);
  }

  @Delete('budgets')
  @RequirePermission('manage', 'Expense')
  @ApiOperation({ summary: "Retirer le budget d'une catégorie" })
  deleteBudget(
    @Param('salleId') salleId: string,
    @Query('category') category: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.financesService.deleteBudget(salleId, category, user);
  }

  @Get('expenses/export')
  @RequirePermission('read', 'Expense')
  @ApiOperation({ summary: 'Export CSV des dépenses du mois — réservé propriétaire/SUPER_ADMIN' })
  async exportCsv(
    @Param('salleId') salleId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: TenantContext,
    @Res() res: Response,
  ) {
    const csv = await this.financesService.exportExpensesCsv(salleId, Number(year), Number(month), user);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="depenses-${year}-${month}.csv"`,
    });
    res.send('\uFEFF' + csv); // BOM — pour un affichage correct des accents dans Excel
  }

  @Get('expenses/export-excel')
  @RequirePermission('read', 'Expense')
  @ApiOperation({ summary: "État Excel pour le gestionnaire — revenus boutique + dépenses non confidentielles uniquement" })
  async exportExcel(
    @Param('salleId') salleId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: TenantContext,
    @Res() res: Response,
  ) {
    const buffer = await this.financesService.exportGestionnaireExcel(salleId, Number(year), Number(month), user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="etat-${year}-${month}.xlsx"`,
    });
    res.send(buffer);
  }
}
