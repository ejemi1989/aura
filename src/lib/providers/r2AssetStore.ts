// Cloudflare R2 asset store. R2 is the S3-compatible object store; we
// drive it with the standard AWS SDK rather than a custom fetch layer so
// SigV4, presigning, and retry semantics are handled correctly.
//
// Activation:
//   The store activates when R2_BUCKET, R2_ACCESS_KEY_ID, and
//   R2_SECRET_ACCESS_KEY are all set in the environment. R2_ENDPOINT
//   defaults to the standard Cloudflare endpoint
//   (`https://<account>.r2.cloudflarestorage.com`) when only the account
//   ID is set.
//
// URL delivery:
//   If R2_PUBLIC_URL is set, every put returns the stable custom-domain
//   URL `${R2_PUBLIC_URL}/${key}`. Otherwise we return a presigned GET URL
//   with a 1-hour expiry — the spec's preferred safer default for §35.

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRESIGN_EXPIRY_SECONDS = 60 * 60;

let cachedClient: S3Client | null = null;
let cachedBucket = "";
let cachedPublicUrl = "";
let cachedForcePathStyle = false;

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_BUCKET &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
  );
}

/**
 * Build the R2 endpoint URL. Order of preference:
 *   1. R2_ENDPOINT if explicitly set
 *   2. https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com (only if account ID set)
 *   3. https://r2.cloudflarestorage.com (lets the SDK error out cleanly)
 */
function resolveEndpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
  if (process.env.R2_ACCOUNT_ID) {
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }
  return "https://r2.cloudflarestorage.com";
}

export async function getR2Client(): Promise<R2Store> {
  if (!isR2Configured()) {
    throw new Error(
      "R2 not configured. Set R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }
  if (!cachedClient) {
    // R2 ignores the region (it's a globally-distributed store) but the
    // AWS SDK requires the field, and the recommended default per the
    // R2 docs is `us-east-1`. Override with R2_REGION only if you're
    // pointing this at an S3-compatible mock that requires a specific
    // region string.
    const region = process.env.R2_REGION || "us-east-1";
    cachedClient = new S3Client({
      region,
      endpoint: resolveEndpoint(),
      // Cloudflare R2 requires path-style addressing on the custom
      // endpoint. The SDK defaults to virtual-hosted style which R2's
      // per-account subdomain doesn't serve. forcePathStyle is the
      // standard fix per the R2 docs.
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    cachedBucket = process.env.R2_BUCKET!;
    cachedPublicUrl = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
    cachedForcePathStyle = true;
  }
  return {
    s3: cachedClient,
    bucket: cachedBucket,
    publicUrl: cachedPublicUrl,
    forcePathStyle: cachedForcePathStyle,
    putObject: async (args: {
      Bucket: string;
      Key: string;
      Body: Buffer | Uint8Array;
      ContentType?: string;
    }) => {
      await cachedClient!.send(
        new PutObjectCommand({
          Bucket: args.Bucket,
          Key: args.Key,
          Body: args.Body,
          ContentType: args.ContentType,
        }),
      );
    },
    urlFor: async (key: string): Promise<string> => {
      if (cachedPublicUrl) {
        return `${cachedPublicUrl}/${key}`;
      }
      const cmd = new GetObjectCommand({ Bucket: cachedBucket, Key: key });
      return getSignedUrl(cachedClient!, cmd, { expiresIn: PRESIGN_EXPIRY_SECONDS });
    },
  };
}

export interface R2Store {
  s3: S3Client;
  bucket: string;
  publicUrl: string;
  forcePathStyle: boolean;
  putObject(args: {
    Bucket: string;
    Key: string;
    Body: Buffer | Uint8Array;
    ContentType?: string;
  }): Promise<void>;
  urlFor(key: string): Promise<string>;
}

/**
 * Test helper. Clears the cached S3 client so a new R2 client is built
 * the next time `getR2Client()` is called. Useful after rotating env
 * vars during local development.
 */
export function _resetR2ClientForTests() {
  cachedClient = null;
  cachedBucket = "";
  cachedPublicUrl = "";
  cachedForcePathStyle = false;
}
