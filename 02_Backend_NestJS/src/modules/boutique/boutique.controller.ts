import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
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

  @Get('products/:productId/stock-movements')
  @RequirePermission('read', 'Product')
  @ApiOperation({ summary: 'Historique des ajustements manuels de stock (§14.x) — purgé après 2 mois' })
  listStockMovements(@Param('productId') productId: string, @Param('salleId') salleId: string) {
    return this.boutiqueService.listStockMovements(productId, salleId);
  }

  @Patch('products/:productId/image')
  @RequirePermission('manage', 'Product')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Photo du produit, affichée sur le site public si Site public + Boutique actifs' })
  updateProductImage(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: TenantContext,
  ) {
    if (!file) throw new BadRequestException('Image requise');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Image trop volumineuse (5 Mo maximum)');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Format non supporté — utilisez JPEG, PNG ou WebP');
    }
    return this.boutiqueService.updateProductImage(productId, file, user.userId);
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

  @Get('stock-movements')
  @RequirePermission('read', 'Product')
  @ApiOperation({ summary: "Historique des ajustements manuels de stock, toute la salle (§14.x) — suivi propriétaire" })
  listSalleStockMovements(@Param('salleId') salleId: string) {
    return this.boutiqueService.listSalleStockMovements(salleId);
  }

  @Get('caisse')
  @RequirePermission('read', 'Product')
  @ApiOperation({ summary: 'Synthèse de caisse boutique journalière par moyen de paiement' })
  getDailyCaisse(@Param('salleId') salleId: string, @Query('date') date?: string) {
    return this.boutiqueService.getDailyCaisse(salleId, date);
  }

  @Get('sales-by-product')
  @RequirePermission('read', 'Product')
  @ApiOperation({ summary: 'Quantités vendues par produit, sur le jour ou le mois (§14.x)' })
  getSalesByProduct(
    @Param('salleId') salleId: string,
    @Query('period') period: 'day' | 'month' = 'day',
    @Query('date') date?: string,
  ) {
    return this.boutiqueService.getSalesByProduct(salleId, period, date);
  }
}
