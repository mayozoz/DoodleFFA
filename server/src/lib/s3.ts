import type { ProcedureCtx } from 'spacetimedb/server';
import type { SecretKey } from '../config';

export interface S3Creds {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  /** public base (CloudFront) — falls back to the bucket's virtual-hosted URL */
  assetBaseUrl: string;
}

export function s3CredsFrom(secrets: Partial<Record<SecretKey, string>>): S3Creds | null {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET, ASSET_BASE_URL } = secrets;
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !S3_BUCKET) return null;
  return {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION,
    bucket: S3_BUCKET,
    assetBaseUrl: ASSET_BASE_URL || `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com`,
  };
}

/**
 * PUT an object and return its public URL.
 *
 * TODO(M3): implement AWS SigV4 signing. The module runtime has no Node `crypto`, so use a
 * pure-JS SHA-256/HMAC (e.g. `@noble/hashes`, which bundles cleanly) to build the
 * `Authorization` header, then `ctx.http.fetch(url, { method: 'PUT', body, headers })`.
 * Alternative if bundling is painful: a tiny Lambda that returns presigned PUT URLs.
 *
 * Throwing here is safe: callers catch and leave the URL empty → client-side fallback.
 */
export function s3Put(
  _ctx: ProcedureCtx<any>,
  _creds: S3Creds,
  _key: string,
  _body: Uint8Array,
  _contentType: string,
): string {
  throw new Error('s3Put not implemented yet (M3)');
}
