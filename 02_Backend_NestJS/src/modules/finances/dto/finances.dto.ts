import { IsString, IsNumber, IsOptional, IsBoolean, Min, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty({ description: 'Catégorie libre (ex: Loyer, Salaires, Électricité, Équipement, Marketing...)' })
  @IsString()
  category!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Date réelle de la dépense (pas la date de saisie)' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description:
      'Uniquement significatif si isRecurring=true. false = montant fixe (loyer...), régénérée automatiquement chaque mois. true (défaut) = montant variable (électricité...), juste un rappel.',
  })
  @IsOptional()
  @IsBoolean()
  recurringAmountVaries?: boolean;

  @ApiPropertyOptional({ description: 'Réservé propriétaire/SUPER_ADMIN — invisible pour un gestionnaire' })
  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recurringAmountVaries?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;
}

export class SetBudgetDto {
  @ApiProperty()
  @IsString()
  category!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  monthlyLimit!: number;
}
