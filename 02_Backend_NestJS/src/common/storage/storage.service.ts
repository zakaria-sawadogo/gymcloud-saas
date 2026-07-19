import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';

/**
 * §3.4, §3.10 — Stockage de fichiers (logos, galerie photo, images de
 * publications) sur MinIO (S3-compatible), déjà provisionné dans
 * docker-compose.yml mais jamais réellement utilisé jusqu'ici —
 * `logoUrl` n'était qu'un champ texte où coller une URL externe.
 *
 * Adressage "path-style" (bucket comme premier segment du chemin,
 * pas de sous-domaine par bucket) — c'est ce que nginx route
 * directement vers MinIO sans réécriture (voir nginx.conf).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? 'gymcloud-files';
    // Domaine public de l'app — mêmes fichiers, servis via nginx (pas
    // le port interne MinIO, jamais exposé directement au public).
    this.publicBaseUrl = (process.env.PUBLIC_APP_URL ?? 'http://localhost').replace(/\/$/, '');
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? 'http://minio:9000',
      region: 'us-east-1', // ignoré par MinIO, mais requis par le SDK
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? 'gymcloud_admin',
        secretAccessKey: process.env.S3_SECRET_KEY ?? 'changeme_dev_only',
      },
      forcePathStyle: true, // requis pour MinIO
    });
  }

  /** Crée le bucket s'il n'existe pas encore, et le rend public en lecture seule. */
  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket "${this.bucket}" créé`);
      } catch (err) {
        this.logger.warn(`Impossible de créer le bucket "${this.bucket}": ${err}`);
        return;
      }
    }
    try {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };
      await this.client.send(
        new PutBucketPolicyCommand({ Bucket: this.bucket, Policy: JSON.stringify(policy) }),
      );
    } catch (err) {
      this.logger.warn(`Impossible d'appliquer la politique publique sur "${this.bucket}": ${err}`);
    }
  }

  /**
   * Téléverse un fichier et renvoie son URL publique définitive.
   * `folder` organise les fichiers par usage (ex: "salles/logos",
   * "salles/galerie", "publications") — purement cosmétique, aucune
   * logique n'en dépend.
   */
  async uploadFile(buffer: Buffer, folder: string, originalFilename: string, contentType: string): Promise<string> {
    const ext = originalFilename.includes('.') ? originalFilename.split('.').pop() : 'bin';
    const key = `${folder}/${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `${this.publicBaseUrl}/${this.bucket}/${key}`;
  }

  /** Supprime un fichier à partir de son URL publique complète (l'inverse d'uploadFile). */
  async deleteFileByUrl(url: string): Promise<void> {
    const marker = `/${this.bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return; // URL externe (avant migration) ou déjà supprimée — rien à faire
    const key = url.slice(idx + marker.length);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Échec de suppression de "${key}": ${err}`);
    }
  }
}
