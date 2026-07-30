import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BoutiqueService } from './boutique.service';
import { CreateProductDto, UpdateProductDto, RecordSaleDto } from './dto/boutique.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('Boutique (add-on)')
@ApiBearerAuth()
@Controller('salles/:salleId/boutique')
export class BoutiqueController {
  constructor(private readonly boutiqueService: BoutiqueService) {}

  @Get('products')
  @RequirePermission('read', 'Product')
  @ApiOperation({ summary: 'Catalogue produits de la boutique (§14.x)' })
  listProducts(@Param('salleId') salleId: string) {
    return this.boutiqueService.listProducts(salleId);
  }

  @Post('products')
  @RequirePermission('manage', 'Product')
  @ApiOperation({ summary: 'Créer un produit — nécessite l\'add-on Boutique actif' })
  createProduct(
    @Param('salleId') salleId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.boutiqueService.createProduct(salleId, dto, user.userId);
  }

  @Patch('products/:productId')
  @RequirePermission('manage', 'Product')
  @ApiOperation({ summary: 'Modifier un produit (prix, stock, activation)' })
  updateProduct(
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.boutiqueService.updateProduct(productId, dto, user.userId);
  }

  @Post('sales')
  @RequirePermission('manage', 'Product')
  @ApiOperation({ summary: 'Enregistrer une vente au comptoir — décrémente le stock' })
  recordSale(
    @Param('salleId') salleId: string,
    @Body() dto: RecordSaleDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.boutiqueService.recordSale(salleId, dto, user.userId);
  }

  @Get('sales')
  @RequirePermission('read', 'Product')
  @ApiOperation({ summary: 'Ventes du jour (ou date précisée)' })
  listSales(@Param('salleId') salleId: string, @Query('date') date?: string) {
    return this.boutiqueService.listSales(salleId, date);
  }

  @Get('caisse')
  @RequirePermission('read', 'Product')
  @ApiOperation({ summary: 'Synthèse de caisse boutique journalière par moyen de paiement' })
  getDailyCaisse(@Param('salleId') salleId: string, @Query('date') date?: string) {
    return this.boutiqueService.getDailyCaisse(salleId, date);
  }
}
