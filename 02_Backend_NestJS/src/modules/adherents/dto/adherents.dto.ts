import {
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// Dossier adhérent (§4.6, §5.1, §5.2)
// ─────────────────────────────────────────────────────────────

export class CreateAdherentDto {
  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty({ description: 'Un adhérent est rattaché à une seule salle en V1 (§2.3)' })
  @IsUUID()
  salleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({
    description: 'Si fourni avec durationDays et price, souscrit immédiatement un abonnement (§5.6)',
  })
  @IsOptional()
  @IsUUID()
  abonnementCatalogueId?: string;
}

export class UpdateAdherentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}

// ─────────────────────────────────────────────────────────────
// Catalogue d'abonnements par salle (§3.8, §5.6)
// ─────────────────────────────────────────────────────────────

export class CreateAbonnementCatalogueDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Durée en jours (30 = mensuel, 365 = annuel, etc.)' })
  @IsInt()
  @Min(1)
  durationDays!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 'XOF' })
  @IsString()
  currency!: string;
}

export class UpdateAbonnementCatalogueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Attribution et réabonnement (§5.7, §5.8, §5.12, §5.13)
// ─────────────────────────────────────────────────────────────

export class SubscribeAdherentDto {
  @ApiProperty()
  @IsUUID()
  abonnementCatalogueId!: string;

  @ApiPropertyOptional({
    description: 'Date de début — par défaut aujourd\'hui, ou lendemain de l\'expiration en cours pour un réabonnement anticipé (§5.13)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
