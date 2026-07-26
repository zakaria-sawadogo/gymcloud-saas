import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

/**
 * §6.5, §6.14 — Notifications internes de l'utilisateur connecté.
 * Aucune restriction de rôle particulière : chacun ne voit jamais que
 * les siennes (filtrées par userId, jamais par salle ou par rôle).
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mes notifications' })
  listMine(@CurrentUser() user: TenantContext, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationsService.listForUser(user.userId, unreadOnly === 'true');
  }

  @Get('me/unread-count')
  @ApiOperation({ summary: 'Nombre de notifications non lues' })
  async unreadCount(@CurrentUser() user: TenantContext) {
    return { count: await this.notificationsService.countUnread(user.userId) };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  markRead(@Param('id') id: string, @CurrentUser() user: TenantContext) {
    return this.notificationsService.markRead(id, user.userId);
  }

  @Patch('me/read-all')
  @ApiOperation({ summary: 'Marquer toutes mes notifications comme lues' })
  async markAllRead(@CurrentUser() user: TenantContext) {
    await this.notificationsService.markAllRead(user.userId);
    return { success: true };
  }
}
