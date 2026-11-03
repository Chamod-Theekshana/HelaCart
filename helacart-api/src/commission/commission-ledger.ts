import { Prisma } from '../generated/prisma/client.js';

/** Integer half-up rounding on an item's merchandise total (never delivery). */
export function commissionMinor(baseMinor: number, rateBps: number) {
  if (
    !Number.isSafeInteger(baseMinor) ||
    baseMinor < 0 ||
    !Number.isInteger(rateBps) ||
    rateBps < 0 ||
    rateBps > 10_000
  )
    throw new RangeError('Invalid commission calculation');
  return Number((BigInt(baseMinor) * BigInt(rateBps) + 5_000n) / 10_000n);
}

export async function commissionSnapshot(tx: Prisma.TransactionClient) {
  const policy = await tx.commissionPolicy.findUnique({
    where: { id: 'platform' },
  });
  return {
    commissionPolicyVersion: policy?.version ?? 0,
    commissionPaymentDays: policy?.paymentDays ?? 14,
  };
}

export function itemCommissionSnapshot(
  product: { commissionRateBps?: number | null; commissionVersion?: number },
  lineMinor: number,
  terms: { commissionPolicyVersion: number; commissionPaymentDays: number },
) {
  if (product.commissionRateBps == null) return {};
  return {
    ...terms,
    commissionRateBps: product.commissionRateBps,
    commissionAmountMinor: commissionMinor(
      lineMinor,
      product.commissionRateBps,
    ),
    commissionProductVersion: product.commissionVersion ?? 0,
  };
}

export async function accrueCommission(
  tx: Prisma.TransactionClient,
  sellerOrderId: string,
) {
  const order = await tx.sellerOrder.findUniqueOrThrow({
    where: { id: sellerOrderId },
    include: { items: true },
  });
  if (order.status !== 'DELIVERED' || !order.paymentCollectedAt) return;
  const itemCharges: Prisma.CommissionChargeCreateManyInput[] = [];
  for (const item of order.items ?? []) {
    if (
      item.commissionRateBps == null ||
      !item.commissionAmountMinor ||
      item.commissionPaymentDays == null
    )
      continue;
    const dueAt = new Date(
      order.paymentCollectedAt.getTime() +
        item.commissionPaymentDays * 86_400_000,
    );
    itemCharges.push({
      sellerOrderId,
      sellerId: order.sellerId,
      orderItemId: item.id,
      baseMinor: item.lineLkrMinor,
      rateBps: item.commissionRateBps,
      amountMinor: item.commissionAmountMinor,
      holdUntil: dueAt,
      dueAt,
    });
  }
  if (itemCharges.length)
    await tx.commissionCharge.createMany({ data: itemCharges });
  // Retain the original terms of orders placed under the earlier policy.
  if (
    order.status !== 'DELIVERED' ||
    !order.paymentCollectedAt ||
    order.commissionRateBps == null ||
    order.commissionReturnDays == null ||
    order.commissionPaymentDays == null
  )
    return;
  const holdUntil = new Date(
    order.paymentCollectedAt.getTime() +
      order.commissionReturnDays * 86_400_000,
  );
  const amountMinor = commissionMinor(
    order.subtotalLkrMinor,
    order.commissionRateBps,
  );
  if (!amountMinor) return;
  await tx.commissionCharge.create({
    data: {
      sellerOrderId,
      sellerId: order.sellerId,
      baseMinor: order.subtotalLkrMinor,
      rateBps: order.commissionRateBps,
      amountMinor,
      holdUntil,
      dueAt: new Date(
        holdUntil.getTime() + order.commissionPaymentDays * 86_400_000,
      ),
    },
  });
}
