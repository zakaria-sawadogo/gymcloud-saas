import { IsString, IsInt, IsOptional, IsNumber, Min, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSaasPlanDto {
  @ApiProperty({ example: 'PROFESSIONAL' })
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceMonthly!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceAnnual!: number;

  @ApiProperty({ description: 'Coût facturé pour chaque salle au-delà du quota inclus (§9.3)' })
  @IsNumber()
  @Min(0)
  extraSalleFee!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  annualDiscountPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  trialDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxRatePct?: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quotaSalles!: number;

  @ApiPropertyOptional({ description: 'null = illimité' })
  @IsOptional()
  @IsInt()
  quotaGestionnaires?: number;

  @ApiPropertyOptional({ description: 'null = illimité' })
  @IsOptional()
  @IsInt()
  quotaCoachs?: number;

  @ApiPropertyOptional({ description: 'null = illimité' })
  @IsOptional()
  @IsInt()
  quotaAdherents?: number;

  @ApiProperty({ type: [String], example: ['adherents', 'abonnements', 'paiements'] })
  @IsArray()
  @IsString({ each: true })
  modules!: string[];
}

export class UpdateSaasPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceMonthly?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceAnnual?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  extraSalleFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  annualDiscountPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  trialDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxRatePct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quotaSalles?: number;

  @ApiPropertyOptional({ description: 'null = illimité' })
  @IsOptional()
  @IsInt()
  quotaGestionnaires?: number;

  @ApiPropertyOptional({ description: 'null = illimité' })
  @IsOptional()
  @IsInt()
  quotaCoachs?: number;

  @ApiPropertyOptional({ description: 'null = illimité' })
  @IsOptional()
  @IsInt()
  quotaAdherents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];
}
