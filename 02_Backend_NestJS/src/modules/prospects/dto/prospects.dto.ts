import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

/** §3.2, §5.6 — Convertir un prospect : formule choisie + paiement associé. */
export class ConvertProspectDto {
  @ApiProperty()
  @IsUUID()
  abonnementCatalogueId!: string;

  @ApiProperty({ enum: ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'] })
  @IsIn(['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'])
  paymentMethod!: 'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
