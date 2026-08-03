import { IsString, IsEmail, IsOptional, IsUUID, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterProspectDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Formule qui intéresse le prospect, si connue' })
  @IsOptional()
  @IsUUID()
  desiredCatalogueId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class RequestTrialSessionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Cours collectif pour lequel l\'essai est demandé' })
  @IsUUID()
  trialCoursCollectifId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class RequestSubscriptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  phone!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Nom de la salle/entreprise envisagée' })
  @IsString()
  @MaxLength(120)
  companyName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiProperty({ description: 'Pays où sera implantée la salle' })
  @IsUUID()
  countryId!: string;

  @ApiProperty({ description: 'Plan qui intéresse le prospect' })
  @IsUUID()
  desiredPlanId!: string;

  @ApiPropertyOptional({ description: 'Codes des add-ons qui intéressent le prospect (ex: ["SITE_SALLE"])', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  desiredAddonCodes?: string[];

  @ApiPropertyOptional({ description: 'Code de parrainage saisi par le prospect, non validé ici' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
