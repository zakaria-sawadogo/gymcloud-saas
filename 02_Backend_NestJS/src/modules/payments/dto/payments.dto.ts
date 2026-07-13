import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentTypeDto {
  ABONNEMENT = 'ABONNEMENT',
  SEANCE = 'SEANCE',
  AUTRE = 'AUTRE',
}

export class CreateCashPaymentDto {
  @ApiProperty()
  @IsUUID()
  salleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  adherentId?: string;

  @ApiPropertyOptional({ description: 'Si le paiement couvre un abonnement (§8.x)' })
  @IsOptional()
  @IsUUID()
  adherentAbonnementId?: string;

  @ApiProperty({ enum: PaymentTypeDto })
  @IsEnum(PaymentTypeDto)
  type!: PaymentTypeDto;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: 'XOF' })
  @IsString()
  currency!: string;

  @ApiPropertyOptional({ description: 'Code coupon à appliquer (§10.x) — réduit le montant facturé' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}

export class InitiateMobileMoneyDto extends CreateCashPaymentDto {
  @ApiProperty({ enum: ['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'] })
  @IsIn(['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'])
  method!: 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE';

  @ApiProperty({ description: 'Numéro Mobile Money à débiter' })
  @IsString()
  phoneNumber!: string;
}

export class ConfirmMobileMoneyDto {
  @ApiProperty({ description: 'Référence opérateur retournée à l\'initiation' })
  @IsString()
  reference!: string;

  @ApiProperty({ enum: ['SUCCESS', 'FAILED'] })
  @IsIn(['SUCCESS', 'FAILED'])
  externalStatus!: 'SUCCESS' | 'FAILED';
}

export class RefundPaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
