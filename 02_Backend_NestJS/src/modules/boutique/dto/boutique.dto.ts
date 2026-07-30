import { IsString, IsNumber, IsOptional, IsBoolean, Min, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'Stock initial (0 par défaut)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Ajuste le stock à cette valeur exacte (pas un delta)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class RecordSaleDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE', 'CARTE_BANCAIRE', 'VIREMENT'] })
  @IsIn(['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE', 'CARTE_BANCAIRE', 'VIREMENT'])
  paymentMethod!: string;
}
