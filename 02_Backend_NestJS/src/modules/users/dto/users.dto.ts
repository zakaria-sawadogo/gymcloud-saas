import { IsString, IsEmail, IsOptional, IsUUID, IsArray, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * §2.4, §3.2, §9.7 — Un propriétaire n'existe jamais seul dans
 * GymCloud : sa raison d'être est de posséder au moins une salle, et
 * une salle n'existe jamais sans souscription SaaS active. Ce DTO
 * regroupe donc la création du propriétaire, de sa première salle et
 * du choix du plan en une seule opération atomique (voir
 * UsersService.createProprietaire), plutôt que de permettre un
 * propriétaire "orphelin" créé séparément puis complété plus tard.
 */
export class CreateProprietaireDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Pays du propriétaire (peut différer du pays de la salle)' })
  @IsOptional()
  @IsUUID()
  countryId?: string;

  // ── Première salle — obligatoire (§3.2) ──────────────────────
  @ApiProperty({ description: 'Nom de la première salle du propriétaire' })
  @IsString()
  salleName!: string;

  @ApiProperty()
  @IsString()
  sallePhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  salleEmail?: string;

  @ApiProperty()
  @IsString()
  salleAddress!: string;

  @ApiProperty()
  @IsString()
  salleCity!: string;

  @ApiProperty()
  @IsUUID()
  salleCountryId!: string;

  // ── Plan SaaS de démarrage — obligatoire (§9.7) ───────────────
  @ApiProperty({ description: 'Plan SaaS souscrit dès la création — aucun propriétaire sans souscription active' })
  @IsUUID()
  saasPlanId!: string;
}

export class CreateGestionnaireDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Un gestionnaire est rattaché à une seule salle (§2.3)' })
  @IsUUID()
  salleId!: string;
}

export class CreateCoachDto {
  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Un coach est rattaché à une seule salle en V1 (§2.3)' })
  @IsUUID()
  salleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}
