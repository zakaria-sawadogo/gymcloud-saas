import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateProductDto, UpdateProductDto, RecordSaleDto } from './dto/boutique.dto';

/**
 * §14.x — Mini caisse boutique : vente de produits au comptoir
 * (boissons, compléments, goodies, pass journalier...), distincte
 * des paiements d'abonnement. Réservée aux salles ayant l'add-on
 * BOUTIQUE actif (§9.3) — jamais inclus automatiquement dans un plan.
 */
@Injectable()
export class BoutiqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertHasBoutiqueAccess(salleId: string) {
    const salle = await this.prisma.salle.findUnique({
      where: { id: salleId },
      select: {
        subscription: { select: { addons: { select: { status: true, addon: { select: { code: true } } } } } },
      },
    });
    const hasAccess =
      salle?.subscription.addons.some(
        (sa: { status: string; addon: { code: string } }) => sa.addon.code === 'BOUTIQUE' && sa.status === 'ACTIF',
      ) ?? false;
    if (!hasAccess) {
      throw new ForbiddenException(
        'L\'add-on "Mini caisse boutique" n\'est pas actif pour cette salle — à activer depuis "Mon abonnement".',
      );
    }
  }

  async listProducts(salleId: string) {
    await this.assertHasBoutiqueAccess(salleId);
    return this.prisma.product.findMany({ where: { salleId }, orderBy: { name: 'asc' } });
  }

  async createProduct(salleId: string, dto: CreateProductDto, actorUserId: string) {
    await this.assertHasBoutiqueAccess(salleId);
    const product = await this.prisma.product.create({
      data: {
        id: randomUUID(),
        salleId,
        name: dto.name,
        price: dto.price,
        stockQty: dto.stockQty ?? 0,
      },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'product.create',
      entityType: 'Product',
      entityId: product.id,
      salleId,
    });
    return product;
  }

  async updateProduct(productId: string, dto: UpdateProductDto, actorUserId: string) {
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
    await this.assertHasBoutiqueAccess(product.salleId);
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.stockQty !== undefined ? { stockQty: dto.stockQty } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'product.update',
      entityType: 'Product',
      entityId: productId,
      salleId: product.salleId,
    });
    return updated;
  }

  /**
   * §14.x — Enregistre une vente et décrémente le stock dans la même
   * transaction — jamais l'un sans l'autre, pour éviter un stock qui
   * dérive silencieusement d'une vente enregistrée en double ou
   * échouée à mi-chemin.
   */
  async recordSale(salleId: string, dto: RecordSaleDto, actorUserId: string) {
    await this.assertHasBoutiqueAccess(salleId);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.salleId !== salleId) {
      throw new NotFoundException('Produit introuvable pour cette salle');
    }
    if (!product.active) {
      throw new BadRequestException('Ce produit est désactivé');
    }
    if (product.stockQty < dto.quantity) {
      throw new BadRequestException(`Stock insuffisant (${product.stockQty} disponible(s))`);
    }

    const unitPrice = Number(product.price);
    const totalAmount = Math.round(unitPrice * dto.quantity * 100) / 100;

    const [sale] = await this.prisma.$transaction([
      this.prisma.productSale.create({
        data: {
          id: randomUUID(),
          salleId,
          productId: dto.productId,
          quantity: dto.quantity,
          unitPrice,
          totalAmount,
          paymentMethod: dto.paymentMethod as never,
          soldByUserId: actorUserId,
        },
      }),
      this.prisma.product.update({
        where: { id: dto.productId },
        data: { stockQty: { decrement: dto.quantity } },
      }),
    ]);

    await this.audit.log({
      userId: actorUserId,
      action: 'product_sale.create',
      entityType: 'ProductSale',
      entityId: sale.id,
      salleId,
      metadata: { productId: dto.productId, quantity: dto.quantity, totalAmount },
    });

    return sale;
  }

  async listSales(salleId: string, date?: string) {
    await this.assertHasBoutiqueAccess(salleId);
    const day = date ? new Date(date) : new Date();
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    return this.prisma.productSale.findMany({
      where: { salleId, createdAt: { gte: dayStart, lte: dayEnd } },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * §14.x — Synthèse de caisse boutique journalière par moyen de
   * paiement — même principe que la caisse des paiements d'abonnement
   * (§8.x), pour une clôture de caisse cohérente en fin de journée.
   */
  async getDailyCaisse(salleId: string, date?: string) {
    const sales = await this.listSales(salleId, date);
    const byMethod: Record<string, number> = {};
    let total = 0;
    for (const sale of sales) {
      const amount = Number(sale.totalAmount);
      byMethod[sale.paymentMethod] = (byMethod[sale.paymentMethod] ?? 0) + amount;
      total += amount;
    }
    return { total, byMethod, salesCount: sales.length, sales };
  }
}
