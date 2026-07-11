import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsNumber,
  Min,
  IsInt,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CHANNELS = ['SMS', 'EMAIL', 'WHATSAPP', 'PUSH'] as const;
const SEGMENT_TYPES = ['TOUS', 'ACTIFS', 'EXPIRES', 'EN_GRACE', 'INACTIFS'] as const;

export class CreateMessageTemplateDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: CHANNELS })
  @IsIn(CHANNELS)
  channel!: (typeof CHANNELS)[number];

  @ApiProperty()
  @IsString()
  content!: string;
}

export class SegmentCriteriaDto {
  @ApiProperty({ enum: SEGMENT_TYPES })
  @IsIn(SEGMENT_TYPES)
  type!: (typeof SEGMENT_TYPES)[number];

  @ApiPropertyOptional({ description: 'Requis si type = INACTIFS : nombre de jours sans passage' })
  @IsOptional()
  @IsInt()
  @Min(1)
  inactiveDays?: number;
}

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: CHANNELS })
  @IsIn(CHANNELS)
  channel!: (typeof CHANNELS)[number];

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty({ type: SegmentCriteriaDto })
  targetSegment!: SegmentCriteriaDto;

  @ApiPropertyOptional({ description: 'Si omis, la campagne est envoyée immédiatement' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class CreateCouponDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty({ enum: ['PERCENT', 'FIXED'] })
  @IsIn(['PERCENT', 'FIXED'])
  discountType!: 'PERCENT' | 'FIXED';

  @ApiProperty()
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @ApiProperty()
  @IsDateString()
  validFrom!: string;

  @ApiProperty()
  @IsDateString()
  validTo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;
}
