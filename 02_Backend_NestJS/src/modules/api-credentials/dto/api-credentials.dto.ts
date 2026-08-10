import { IsIn, IsNotEmpty, IsObject, IsString } from 'class-validator';

/**
 * §14.x — Identifiants marchand Mobile Money d'une salle. Le contenu
 * exact de `credentials` varie selon l'opérateur (Orange Money exige
 * username/password/merchantNumber d'après le SDK communautaire de
 * référence — pas de spécification officielle publique à ce jour) —
 * volontairement un objet libre plutôt que des champs figés, pour ne
 * pas avoir à modifier ce DTO à chaque nouvel opérateur intégré.
 */
export class SetSalleCredentialDto {
  @IsIn(['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'])
  provider!: 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE';

  @IsObject()
  @IsNotEmpty()
  credentials!: Record<string, string>;
}

export class RevokeSalleCredentialDto {
  @IsString()
  @IsIn(['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE'])
  provider!: 'ORANGE_MONEY' | 'MOOV_MONEY' | 'WAVE';
}
