import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

// Creates a new, private-by-default R2 bucket; never modifies public access settings.
const envFile = new URL('../.env', import.meta.url);
const original = await readFile(envFile, 'utf8');
const env = parse(original);
if (env.R2_PRIVATE_BUCKET) {
  console.log('Private seller document storage is already configured.');
  process.exit(0);
}
if (
  !['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'].every(
    (key) => env[key],
  )
) {
  console.error(
    'Configure the R2 account and credentials before creating private document storage.',
  );
  process.exit(1);
}
const bucket = `helacart-verification-${randomUUID().slice(0, 8)}`;
const key = `setup-check/${randomUUID()}.txt`;
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  maxAttempts: 1,
});
const send = (command) =>
  client.send(command, { abortSignal: AbortSignal.timeout(30_000) });
let created = false;
let configured = false;
try {
  await send(new CreateBucketCommand({ Bucket: bucket }));
  created = true;
  const sample =
    'HelaCart private document storage connectivity check. No identity data.';
  await send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: sample,
      ContentType: 'text/plain',
      CacheControl: 'private, no-store',
    }),
  );
  const result = await send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if ((await result.Body?.transformToString()) !== sample)
    throw new Error('StorageCheckFailed');
  await send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  const updated = /^R2_PRIVATE_BUCKET=.*$/m.test(original)
    ? original.replace(/^R2_PRIVATE_BUCKET=.*$/m, `R2_PRIVATE_BUCKET=${bucket}`)
    : `${original.trimEnd()}${newline}${newline}# Private seller verification photos; public access stays disabled.${newline}R2_PRIVATE_BUCKET=${bucket}${newline}`;
  await writeFile(envFile, updated);
  configured = true;
  console.log(`Created and verified private seller document bucket: ${bucket}`);
  console.log(
    'Saved R2_PRIVATE_BUCKET to the API .env. No credentials were changed.',
  );
} catch (error) {
  console.error(
    `Private document storage setup failed (${error.name ?? 'Error'}, HTTP ${error.$metadata?.httpStatusCode ?? 'unavailable'}).`,
  );
  console.error(
    'The R2 token must permit bucket creation and object access for the new private bucket.',
  );
  process.exitCode = 1;
} finally {
  if (created && !configured) {
    // Only clean up the random bucket created by this invocation and its own test object.
    await send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(
      () => undefined,
    );
    await send(new DeleteBucketCommand({ Bucket: bucket })).catch(
      () => undefined,
    );
  }
  client.destroy();
}
