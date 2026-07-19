import { IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScanQrDto {
  @ApiProperty({ description: 'Jeton QR scanné (AdherentProfile.qrCodeToken)' })
  @IsString()
  qrCodeToken!: string;

  @ApiProperty({ description: 'Salle sur laquelle le scan a lieu (borne physique)' })
  @IsUUID()
  salleId!: string;
}

export class ManualAccessDto {
  @ApiProperty({ description: 'Adhérent sans QR disponible (téléphone oublié, etc.)' })
  @IsUUID()
  adherentId!: string;

  @ApiProperty()
  @IsUUID()
  salleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SelfCheckinDto {
  @ApiProperty({ description: 'Jeton scanné depuis le QR fixe affiché à l\'entrée (Salle.checkinQrToken)' })
  @IsString()
  checkinQrToken!: string;
}
