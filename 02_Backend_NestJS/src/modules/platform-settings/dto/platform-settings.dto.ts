import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supportPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiPropertyOptional({ description: 'Nom affiché en en-tête des factures PDF, ex: "Sahel System — GymCloud"' })
  @IsOptional()
  @IsString()
  invoiceIssuerName?: string;

  @ApiPropertyOptional({
    description:
      'Taux de conversion USD → XOF, utilisé pour les propriétaires hors zone XOF et pour agréger les revenus au tableau de bord SUPER_ADMIN (§14.x)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  usdToXofRate?: number;
}
