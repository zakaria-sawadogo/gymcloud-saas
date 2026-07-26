import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/platform-settings.dto';
import { RequirePermission } from '../../common/casl/policies.guard';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * §14.x — Coordonnées de contact de la plateforme GymCloud, gérées
 * exclusivement par le SUPER_ADMIN.
 */
@ApiTags('Paramètres plateforme')
@ApiBearerAuth()
@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get()
  @RequirePermission('manage', 'PlatformSettings')
  @ApiOperation({ summary: 'Coordonnées de contact actuelles de la plateforme' })
  get() {
    return this.platformSettingsService.get();
  }

  @Patch()
  @RequirePermission('manage', 'PlatformSettings')
  @ApiOperation({ summary: 'Modifier les coordonnées de contact de la plateforme' })
  update(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: TenantContext) {
    return this.platformSettingsService.update(dto, user.userId);
  }
}
