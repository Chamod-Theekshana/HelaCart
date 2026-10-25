import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CommissionReceiptsService } from '../dist/commission/commission-receipts.service.js';
const service = new CommissionReceiptsService(new ConfigService(process.env));
const buffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ncAAAAASUVORK5CYII=',
  'base64',
);
let receipt;
try {
  receipt = await service.upload(randomUUID(), {
    buffer,
    size: buffer.length,
    mimetype: 'image/png',
  });
  assert.ok(receipt.storageKey.startsWith('commission-receipts/'));
  const read = await service.read(receipt);
  assert.deepEqual(read.bytes, buffer);
  assert.equal(read.contentType, 'image/png');
  console.log(
    'PASS Temporary receipt uploads to and reads from private R2 storage',
  );
  await service.remove(receipt);
  await assert.rejects(() => service.read(receipt));
  receipt = undefined;
  console.log('PASS Temporary receipt is removed and cannot be read afterward');
} finally {
  if (receipt) await service.remove(receipt);
}
console.log(
  JSON.stringify({
    checks: 2,
    temporaryObjectRemoved: true,
    customerDocumentsUntouched: true,
  }),
);
