import {
  IsString,
  IsUUID,
  IsInt,
  Min,
  IsDateString,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// Cours collectifs (§7.1, §7.2)
// ─────────────────────────────────────────────────────────────

export class CreateCoursCollectifDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsUUID()
  coachId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiProperty()
  @IsDateString()
  startAt!: string;

  @ApiProperty()
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @ApiPropertyOptional({ description: 'Règle RRULE si récurrent' })
  @IsOptional()
  @IsString()
  recurrenceRule?: string;
}

export class UpdateCoursCollectifDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string;
}

// ─────────────────────────────────────────────────────────────
// Réservations (§7.3 à §7.9)
// ─────────────────────────────────────────────────────────────

export class BookCoursCollectifDto {
  @ApiProperty()
  @IsUUID()
  adherentId!: string;
}

export class BookSeanceIndividuelleDto {
  @ApiProperty()
  @IsUUID()
  adherentId!: string;

  @ApiProperty()
  @IsUUID()
  coachId!: string;

  @ApiProperty()
  @IsDateString()
  startAt!: string;

  @ApiProperty()
  @IsDateString()
  endAt!: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

// ─────────────────────────────────────────────────────────────
// Disponibilités coach (§7.6)
// ─────────────────────────────────────────────────────────────

export class SetCoachAvailabilityDto {
  @ApiProperty({ description: '0 = dimanche ... 6 = samedi' })
  @IsInt()
  @Min(0)
  dayOfWeek!: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  startTime!: string;

  @ApiProperty({ example: '12:00' })
  @IsString()
  endTime!: string;
}
