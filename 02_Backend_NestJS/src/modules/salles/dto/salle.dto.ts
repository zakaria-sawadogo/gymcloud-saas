import { IsString, IsEmail, IsOptional, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSalleDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'ID du propriétaire (doit déjà exister — §4.3)' })
  @IsUUID()
  proprietaireId!: string;

  @ApiPropertyOptional({
    description:
      'Requis uniquement si le propriétaire n\'a pas encore de souscription active. ' +
      'Si une souscription existe déjà, ce champ est ignoré (voir README_modele_donnees.md).',
  })
  @IsOptional()
  @IsUUID()
  saasPlanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  address!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsUUID()
  countryId!: string;
}

export class UpdateSalleBrandingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slogan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}

export class UpdateSalleSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  openingHours?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  paymentMethods?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  notificationSettings?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  reservationSettings?: Record<string, unknown>;
}
