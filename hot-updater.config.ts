import { expo } from "@hot-updater/expo";
import { standaloneRepository } from "@hot-updater/standalone";
import { s3Storage } from "@hot-updater/aws";
import { defineConfig } from "hot-updater";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const {
  HT_URL,
  CI_JOB_JWT_V2,
  HOT_UPDATER_PRIVATE_KEY,
  S3_REGION = "garage",
  S3_ENDPOINT,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME,
} = process.env;

const AUTH_HEADERS: Record<string, string> = CI_JOB_JWT_V2
  ? { Authorization: `Bearer ${CI_JOB_JWT_V2}` }
  : {};

const PRIVATE_KEY_PATH = (() => {
  const localPath = "./keys/private-key.pem";
  if (fs.existsSync(localPath)) return localPath;

  if (HOT_UPDATER_PRIVATE_KEY) {
    const tmpPath = path.join(os.tmpdir(), "hot-updater-private-key.pem");
    fs.writeFileSync(tmpPath, HOT_UPDATER_PRIVATE_KEY, { mode: 0o600 });
    return tmpPath;
  }
  return localPath;
})();

export default defineConfig({
  updateStrategy: "fingerprint",
  build: expo(),
  storage: s3Storage({
    region: S3_REGION,
    endpoint: S3_ENDPOINT!,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID!,
      secretAccessKey: S3_SECRET_ACCESS_KEY!,
    },
    bucketName: S3_BUCKET_NAME!,
    forcePathStyle: true,
  }),
  database: standaloneRepository({
    baseUrl: HT_URL,
    commonHeaders: AUTH_HEADERS,
  }),
  signing: {
    enabled: true,
    privateKeyPath: PRIVATE_KEY_PATH,
  },
  compressStrategy: "tar.br",
});
