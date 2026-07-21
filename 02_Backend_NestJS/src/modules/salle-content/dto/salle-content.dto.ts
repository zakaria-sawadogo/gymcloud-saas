import { IsString, IsOptional, IsBoolean, IsInt, IsISO8601, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGalleryImageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({ description: 'Promo à durée limitée — passé cette date, la publication disparaît du site public' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Dépublier sans supprimer — repasse à true pour republier' })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({ description: 'Chaîne vide ou null pour retirer la date d\'expiration' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class CreateTestimonialDto {
  @ApiProperty()
  @IsString()
  authorName!: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({ description: 'Note sur 5, optionnelle' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
