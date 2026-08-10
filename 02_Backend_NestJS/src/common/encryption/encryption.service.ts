import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * §14.x — Chiffrement des identifiants marchand externes (Orange
 * Money, Moov Money, Wave...) avant stockage en base
 * (ApiCredential.encryptedValue) — jamais en clair, même dans une
 * sauvegarde de base de données.
 *
 * AES-256-GCM : chiffrement symétrique authentifié (détecte toute
 * altération du texte chiffré, contrairement à un simple AES-CBC).
 * La clé dérive de CREDENTIALS_ENCRYPTION_KEY (variable d'environnement,
 * jamais committée) via scrypt — jamais la clé brute utilisée
 * directement comme clé AES.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
    if (!secret || secret.length < 32) {
      this.logger.warn(
        'CREDENTIALS_ENCRYPTION_KEY absente ou trop courte (min 32 caractères) — ' +
          'les identifiants marchand ne pourront pas être chiffrés correctement.',
      );
    }
    this.key = scryptSync(secret ?? 'insecure-dev-fallback-key', 'gymcloud-credentials-salt', 32);
  }

  /**
   * Renvoie une chaîne unique combinant IV + tag d'authentification +
   * texte chiffré (format : "iv:tag:ciphertext", tout en hexadécimal)
   * — un seul champ texte à stocker, pas trois colonnes séparées.
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(payload: string): string {
    const [ivHex, tagHex, dataHex] = payload.split(':');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
