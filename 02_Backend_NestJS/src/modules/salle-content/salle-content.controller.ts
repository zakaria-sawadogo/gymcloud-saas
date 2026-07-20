import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { SalleContentService } from './salle-content.service';
import { CreateGalleryImageDto, CreatePostDto, UpdatePostDto } from './dto/salle-content.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function assertValidImage(file?: Express.Multer.File) {
  if (!file) throw new BadRequestException('Image requise');
  if (file.size > MAX_IMAGE_SIZE) throw new BadRequestException('Image trop volumineuse (5 Mo maximum)');
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException('Format non supporté — utilisez JPEG, PNG ou WebP');
  }
}

/**
 * §3.2, §3.4 — Contenu promotionnel du site public d'une salle
 * (galerie photo, publications) — PROPRIETAIRE de la salle ou
 * SUPER_ADMIN uniquement, vérifié en service. Nécessite en plus que
 * le plan SaaS de la salle inclue le module "site_public" (§9.3) —
 * fonctionnalité optionnelle, pas automatique pour tous les plans.
 */
@ApiTags('Contenu promotionnel des salles')
@ApiBearerAuth()
@RequireModule('site_public')
@Controller('salles/:salleId/content')
export class SalleContentController {
  constructor(private readonly salleContentService: SalleContentService) {}

  // ── Bannière (hero) ──────────────────────────────────────────

  @Post('cover-image')
  @RequirePermission('update', 'Salle')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Définir/remplacer la bannière (hero) du site public (§3.4)' })
  setCoverImage(
    @Param('salleId') salleId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: TenantContext,
  ) {
    assertValidImage(file);
    return this.salleContentService.setCoverImage(salleId, file, user);
  }

  // ── Galerie ──────────────────────────────────────────────────

  @Get('gallery')
  @RequirePermission('update', 'Salle')
  @ApiOperation({ summary: 'Liste des images de la galerie (vue de gestion)' })
  listGallery(@Param('salleId') salleId: string, @CurrentUser() user: TenantContext) {
    return this.salleContentService.listGallery(salleId, user);
  }

  @Post('gallery')
  @RequirePermission('update', 'Salle')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Ajouter une image à la galerie (§3.4)' })
  addGalleryImage(
    @Param('salleId') salleId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateGalleryImageDto,
    @CurrentUser() user: TenantContext,
  ) {
    assertValidImage(file);
    return this.salleContentService.addGalleryImage(salleId, file, dto, user);
  }

  @Delete('gallery/:imageId')
  @RequirePermission('update', 'Salle')
  @ApiOperation({ summary: 'Retirer une image de la galerie' })
  removeGalleryImage(
    @Param('salleId') salleId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.salleContentService.removeGalleryImage(salleId, imageId, user);
  }

  // ── Publications ─────────────────────────────────────────────

  @Get('posts')
  @RequirePermission('update', 'Salle')
  @ApiOperation({ summary: 'Liste des publications (vue de gestion, y compris dépubliées)' })
  listPosts(@Param('salleId') salleId: string, @CurrentUser() user: TenantContext) {
    return this.salleContentService.listPosts(salleId, user);
  }

  @Post('posts')
  @RequirePermission('update', 'Salle')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Publier une nouvelle actualité — image optionnelle (§3.4)' })
  createPost(
    @Param('salleId') salleId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreatePostDto,
    @CurrentUser() user: TenantContext,
  ) {
    if (file) assertValidImage(file);
    return this.salleContentService.createPost(salleId, dto, user, file);
  }

  @Patch('posts/:postId')
  @RequirePermission('update', 'Salle')
  @ApiOperation({ summary: 'Modifier ou dépublier/republier une publication' })
  updatePost(
    @Param('salleId') salleId: string,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: TenantContext,
  ) {
    return this.salleContentService.updatePost(salleId, postId, dto, user);
  }

  @Delete('posts/:postId')
  @RequirePermission('update', 'Salle')
  @ApiOperation({ summary: 'Supprimer définitivement une publication' })
  deletePost(
    @Param('salleId') salleId: string,
    @Param('postId') postId: string,
    @CurrentUser() user: TenantContext,
  ) {
    return this.salleContentService.deletePost(salleId, postId, user);
  }
}
