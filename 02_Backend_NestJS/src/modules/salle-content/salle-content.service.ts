import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { TenantContext } from '../../common/middleware/tenant.middleware';
import { CreateGalleryImageDto, CreatePostDto, UpdatePostDto } from './dto/salle-content.dto';

/**
 * §3.2, §3.4 — Contenu promotionnel du site public d'une salle : galerie
 * photo et fil de publications. Gérable par le PROPRIETAIRE de la salle
 * (c'est sa vitrine commerciale) et le SUPER_ADMIN — jamais un
 * gestionnaire, ni un autre propriétaire.
 */
@Injectable()
export class SalleContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private async assertOwnsSalle(salleId: string, actor: TenantContext) {
    if (actor.isGlobalAccess) return;
    const salle = await this.prisma.salle.findUnique({ where: { id: salleId } });
    if (!salle) throw new NotFoundException('Salle introuvable');
    if (!actor.proprietaireId || salle.proprietaireId !== actor.proprietaireId) {
      throw new ForbiddenException('Cette salle ne vous appartient pas');
    }
  }

  /** §3.4 — Image de bannière (hero) du site public — remplace l'image précédente si elle existe. */
  async setCoverImage(
    salleId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    actor: TenantContext,
  ) {
    await this.assertOwnsSalle(salleId, actor);
    const previous = await this.prisma.salle.findUnique({ where: { id: salleId }, select: { coverImageUrl: true } });
    const coverImageUrl = await this.storage.uploadFile(file.buffer, `salles/${salleId}/banniere`, file.originalname, file.mimetype);
    await this.prisma.salle.update({ where: { id: salleId }, data: { coverImageUrl } });
    if (previous?.coverImageUrl) await this.storage.deleteFileByUrl(previous.coverImageUrl);
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.cover_image_update',
      entityType: 'Salle',
      entityId: salleId,
    });
    return { coverImageUrl };
  }

  // ── Galerie ──────────────────────────────────────────────────

  async listGallery(salleId: string, actor: TenantContext) {
    await this.assertOwnsSalle(salleId, actor);
    return this.prisma.salleGalleryImage.findMany({
      where: { salleId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async addGalleryImage(
    salleId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    dto: CreateGalleryImageDto,
    actor: TenantContext,
  ) {
    await this.assertOwnsSalle(salleId, actor);
    const imageUrl = await this.storage.uploadFile(file.buffer, `salles/${salleId}/galerie`, file.originalname, file.mimetype);
    const image = await this.prisma.salleGalleryImage.create({
      data: { salleId, imageUrl, caption: dto.caption, displayOrder: dto.displayOrder ?? 0 },
    });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.gallery_image_add',
      entityType: 'SalleGalleryImage',
      entityId: image.id,
    });
    return image;
  }

  async removeGalleryImage(salleId: string, imageId: string, actor: TenantContext) {
    await this.assertOwnsSalle(salleId, actor);
    const image = await this.prisma.salleGalleryImage.findUnique({ where: { id: imageId } });
    if (!image || image.salleId !== salleId) throw new NotFoundException('Image introuvable');
    await this.storage.deleteFileByUrl(image.imageUrl);
    await this.prisma.salleGalleryImage.delete({ where: { id: imageId } });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.gallery_image_remove',
      entityType: 'SalleGalleryImage',
      entityId: imageId,
    });
    return { message: 'Image supprimée' };
  }

  // ── Publications ─────────────────────────────────────────────

  async listPosts(salleId: string, actor: TenantContext) {
    await this.assertOwnsSalle(salleId, actor);
    return this.prisma.sallePost.findMany({
      where: { salleId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async createPost(
    salleId: string,
    dto: CreatePostDto,
    actor: TenantContext,
    file?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    await this.assertOwnsSalle(salleId, actor);
    const imageUrl = file
      ? await this.storage.uploadFile(file.buffer, `salles/${salleId}/publications`, file.originalname, file.mimetype)
      : undefined;
    const post = await this.prisma.sallePost.create({
      data: { salleId, title: dto.title, content: dto.content, imageUrl, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
    });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.post_create',
      entityType: 'SallePost',
      entityId: post.id,
    });
    return post;
  }

  async updatePost(salleId: string, postId: string, dto: UpdatePostDto, actor: TenantContext) {
    await this.assertOwnsSalle(salleId, actor);
    const existing = await this.prisma.sallePost.findUnique({ where: { id: postId } });
    if (!existing || existing.salleId !== salleId) throw new NotFoundException('Publication introuvable');
    const post = await this.prisma.sallePost.update({
      where: { id: postId },
      data: {
        title: dto.title,
        content: dto.content,
        published: dto.published,
        expiresAt: dto.expiresAt !== undefined ? (dto.expiresAt ? new Date(dto.expiresAt) : null) : undefined,
      },
    });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.post_update',
      entityType: 'SallePost',
      entityId: postId,
    });
    return post;
  }

  async deletePost(salleId: string, postId: string, actor: TenantContext) {
    await this.assertOwnsSalle(salleId, actor);
    const existing = await this.prisma.sallePost.findUnique({ where: { id: postId } });
    if (!existing || existing.salleId !== salleId) throw new NotFoundException('Publication introuvable');
    if (existing.imageUrl) await this.storage.deleteFileByUrl(existing.imageUrl);
    await this.prisma.sallePost.delete({ where: { id: postId } });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.post_delete',
      entityType: 'SallePost',
      entityId: postId,
    });
    return { message: 'Publication supprimée' };
  }

  // ── Témoignages ──────────────────────────────────────────────

  async listTestimonials(salleId: string, actor: TenantContext) {
    await this.assertOwnsSalle(salleId, actor);
    return this.prisma.salleTestimonial.findMany({
      where: { salleId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createTestimonial(
    salleId: string,
    dto: { authorName: string; content: string; rating?: number; displayOrder?: number },
    actor: TenantContext,
  ) {
    await this.assertOwnsSalle(salleId, actor);
    const testimonial = await this.prisma.salleTestimonial.create({
      data: {
        salleId,
        authorName: dto.authorName,
        content: dto.content,
        rating: dto.rating,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.testimonial_create',
      entityType: 'SalleTestimonial',
      entityId: testimonial.id,
    });
    return testimonial;
  }

  async deleteTestimonial(salleId: string, testimonialId: string, actor: TenantContext) {
    await this.assertOwnsSalle(salleId, actor);
    const existing = await this.prisma.salleTestimonial.findUnique({ where: { id: testimonialId } });
    if (!existing || existing.salleId !== salleId) throw new NotFoundException('Témoignage introuvable');
    await this.prisma.salleTestimonial.delete({ where: { id: testimonialId } });
    await this.audit.log({
      userId: actor.userId,
      salleId,
      action: 'salle.testimonial_delete',
      entityType: 'SalleTestimonial',
      entityId: testimonialId,
    });
    return { message: 'Témoignage supprimé' };
  }
}
