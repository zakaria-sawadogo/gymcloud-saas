import { Body, Controller, Get, Post, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { CurrentUser, TenantContext } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Connexion — retourne access token + refresh token (§4.7)' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto.phone, dto.password, req.ip);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renouvellement de l\'access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Changement de mot de passe (§4.8)' })
  async changePassword(@CurrentUser() user: TenantContext, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
    return { message: 'Mot de passe modifié. Toutes les sessions ont été déconnectées.' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil de l\'utilisateur connecté (rôle, salle, identité)' })
  async me(@CurrentUser() user: TenantContext) {
    return this.authService.getMe(user.userId);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Modifier son propre profil (prénom, nom, email) — le téléphone (identifiant de connexion), le rôle et le statut ne sont jamais modifiables ici (§4.9)',
  })
  async updateMe(@CurrentUser() user: TenantContext, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Demande de réinitialisation par OTP (§4.9)' })
  async forgotPassword(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.phone);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Confirmation de la réinitialisation avec le code OTP (§4.9)' })
  async resetPassword(@Body() dto: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(dto.phone, dto.otpCode, dto.newPassword);
  }
}
