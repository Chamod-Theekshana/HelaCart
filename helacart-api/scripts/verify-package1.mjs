import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { CatalogService } from '../dist/catalog/catalog.service.js';
import { WorkspaceService } from '../dist/workspace/workspace.service.js';
import { CommerceService } from '../dist/commerce/commerce.service.js';
import { NotificationsService } from '../dist/notifications/notifications.service.js';
// Every fixture and mutation is enclosed in one transaction that always rolls back.
const prisma = new PrismaService(new ConfigService(process.env));
const prefix = 'p1-audit-' + randomUUID();
const rollback = new Error('PACKAGE1_ROLLBACK');
let checks = 0;
const pass = (name) => {
  checks++;
  console.log('PASS ' + name);
};
await prisma.$connect();
try {
  await prisma
    .$transaction(
      async (tx) => {
        const database = new Proxy(tx, {
          get(target, key) {
            if (key === '$transaction')
              return async (callback) => callback(target);
            const value = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        const buyerId = randomUUID(),
          otherId = randomUUID(),
          sellerId = randomUUID(),
          categoryId = randomUUID(),
          addressId = randomUUID();
        const auth = {
          getOrCreateProfile: async (identity) => ({
            id: identity.uid === 'other' ? otherId : buyerId,
          }),
        };
        const catalog = new CatalogService(database, auth),
          workspace = new WorkspaceService(database, auth, catalog),
          commerce = new CommerceService(
            database,
            auth,
            catalog,
            new NotificationsService(database, auth),
          );
        const identity = {
          uid: 'buyer',
          email_verified: true,
          email: prefix + '@example.com',
        };
        const before = await workspace.adminSummary();
        await tx.user.createMany({
          data: [
            {
              id: buyerId,
              firebaseUid: prefix,
              email: prefix + '@example.com',
              emailVerified: true,
            },
            {
              id: otherId,
              firebaseUid: prefix + '-other',
              email: prefix + '-other@example.com',
              emailVerified: true,
            },
          ],
        });
        const pendingIds = Array.from({ length: 61 }, () => randomUUID());
        await tx.seller.createMany({
          data: [
            { id: sellerId, name: prefix, slug: prefix, status: 'APPROVED' },
            ...pendingIds.map((id, index) => ({
              id,
              name: prefix + ' ' + index,
              slug: prefix + '-' + index,
              status: 'PENDING',
            })),
          ],
        });
        await tx.sellerMember.create({
          data: { sellerId, userId: buyerId, role: 'OWNER' },
        });
        await tx.category.create({
          data: { id: categoryId, name: prefix, slug: prefix },
        });
        await tx.buyerAddress.create({
          data: {
            id: addressId,
            userId: buyerId,
            recipient: 'Package one buyer',
            phone: '0771234567',
            line1: 'Test address',
            city: 'Colombo',
            district: 'Colombo',
            postalCode: '00100',
          },
        });
        const products = Array.from({ length: 61 }, (_, index) => ({
          id: randomUUID(),
          sellerId,
          categoryId,
          title: prefix + ' product ' + index,
          slug: 'p-' + index,
          description: 'Temporary rollback test product',
          sku: 'P1-' + index,
          priceLkrMinor: 10000 + index * 100,
          status: 'APPROVED',
        }));
        const foreignProduct = {
          ...products[0],
          id: randomUUID(),
          sellerId: pendingIds[0],
          slug: 'pending-shop-product',
          sku: 'P1-FOREIGN',
        };
        await tx.product.createMany({ data: [...products, foreignProduct] });
        const variants = products.map((product, index) => ({
          id: randomUUID(),
          sellerId,
          productId: product.id,
          position: 0,
          sku: product.sku,
          priceLkrMinor: product.priceLkrMinor,
          onHand: index < 2 ? 0 : 10,
        }));
        await tx.productVariant.createMany({
          data: [
            ...variants,
            {
              id: randomUUID(),
              sellerId,
              productId: products[0].id,
              position: 1,
              sku: 'P1-ALT',
              priceLkrMinor: 5000,
              onHand: 7,
              reserved: 2,
            },
          ],
        });
        const orders = products.map((_, index) => ({
          id: randomUUID(),
          buyerId,
          addressId,
          checkoutKey: randomUUID(),
          snapshotHash: 'test',
          recipient: prefix + ' recipient ' + index,
          phone: '0771234567',
          line1: 'Test address',
          city: 'Colombo',
          district: 'Colombo',
          postalCode: '00100',
          subtotalLkrMinor: 10000,
          shippingLkrMinor: 350,
          totalLkrMinor: 10350,
        }));
        await tx.order.createMany({ data: orders });
        const parts = orders.map((order, index) => ({
          id: randomUUID(),
          orderId: order.id,
          sellerId,
          status: index === 60 ? 'PLACED' : 'DELIVERED',
          paymentCollectedAt: index === 60 ? null : new Date(),
          subtotalLkrMinor: 10000,
          shippingLkrMinor: 350,
          totalLkrMinor: 10350,
        }));
        await tx.sellerOrder.createMany({ data: parts });
        await tx.orderItem.createMany({
          data: parts.map((part, index) => ({
            id: randomUUID(),
            sellerOrderId: part.id,
            variantId: variants[index].id,
            productTitle: products[index].title,
            sku: variants[index].sku,
            optionValues: {},
            unitLkrMinor: 5000,
            quantity: 2,
            lineLkrMinor: 10000,
          })),
        });
        const states = ['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED'];
        await tx.returnRequest.createMany({
          data: parts
            .slice(0, 60)
            .map((part, index) => ({
              id: randomUUID(),
              sellerOrderId: part.id,
              buyerId,
              reason: prefix + ' return reason',
              status: states[index % 4],
              reviewedAt: index % 4 ? new Date() : null,
              resolvedAt: index % 4 === 3 ? new Date() : null,
              reviewReason: index % 4 ? 'Reviewed return case' : null,
              resolutionNote:
                index % 4 === 3 ? 'Manually resolved with buyer' : null,
            })),
        });
        const query = { page: 4, limit: 20, q: prefix };
        const listing = await workspace.publicCatalog({
          ...query,
          sort: 'price-asc',
        });
        assert.equal(listing.total, 61);
        assert.equal(listing.items.length, 1);
        assert.equal(listing.items[0].listingPriceLkrMinor, 16000);
        pass(
          'Catalog page four includes products beyond fifty with the full total',
        );
        const offer = await workspace.publicCatalog({
          ...query,
          page: 1,
          minPrice: 4500,
          maxPrice: 5500,
          inStock: true,
          sort: 'price-asc',
        });
        assert.equal(offer.total, 1);
        assert.equal(offer.items[0].id, products[0].id);
        assert.equal(offer.items[0].listingPriceLkrMinor, 5000);
        pass(
          'Stock and price filters use the purchasable variant before pagination',
        );
        const stock = await workspace.publicCatalog({
          ...query,
          page: 1,
          inStock: true,
          sort: 'newest',
        });
        assert.equal(stock.total, 60);
        pass('Out-of-stock products and pending shops are excluded correctly');
        const ownProducts = await workspace.products(query, sellerId, identity);
        assert.equal(ownProducts.total, 61);
        assert.equal(ownProducts.items.length, 1);
        pass('Seller product pages reach older products');
        const inventory = await workspace.inventory(sellerId, identity, {
          ...query,
          q: undefined,
        });
        assert.equal(inventory.total, 62);
        assert.equal(inventory.items.length, 2);
        pass('Variant inventory paginates across all products');
        const ownOrders = await workspace.buyerOrders(identity, {
          ...query,
          q: undefined,
        });
        assert.equal(ownOrders.total, 61);
        assert.equal(ownOrders.items.length, 1);
        pass('Buyer order history reaches page four');
        const foreign = await workspace.buyerOrders(
          { ...identity, uid: 'other' },
          { ...query, q: undefined },
        );
        assert.equal(foreign.total, 0);
        pass('Buyer history cannot expose another buyer orders');
        const sellerOrders = await workspace.sellerOrders(sellerId, identity, {
          page: 3,
          limit: 20,
        });
        assert.equal(sellerOrders.total, 61);
        assert.equal(sellerOrders.items.length, 20);
        pass('Seller order history uses full counts');
        const history = await workspace.buyerReturns(identity, {
          page: 3,
          limit: 20,
        });
        assert.equal(history.total, 60);
        assert.equal(history.items.length, 20);
        assert.ok(
          history.items.every((row) => row.sellerOrder.seller.id === sellerId),
        );
        pass('Buyer return history includes older cases and shop context');
        const applications = await workspace.applications({
          page: 4,
          limit: 20,
          q: prefix,
          status: 'PENDING',
        });
        assert.equal(applications.total, 61);
        assert.equal(applications.items.length, 1);
        pass('Admin applications paginate beyond fifty');
        const queue = await workspace.cod({ page: 3, limit: 20, q: prefix });
        assert.equal(queue.total, 60);
        assert.equal(queue.items.length, 20);
        pass('COD queue searches the full collection history');
        const totals = await workspace.sellerSummary(sellerId, identity);
        assert.equal(totals.totalProducts, 61);
        assert.equal(totals.totalOrders, 61);
        assert.equal(totals.variants, 62);
        assert.equal(totals.lowStock, 3);
        assert.equal(totals.activeOrders, 1);
        pass('Seller aggregate totals match all fixtures instead of one page');
        const admin = await workspace.adminSummary();
        assert.equal(
          admin.pendingApplications - before.pendingApplications,
          61,
        );
        assert.equal(admin.orders - before.orders, 61);
        pass('Admin counters reflect all records');
        const beforeStock = await tx.productVariant.findUniqueOrThrow({
          where: { id: variants[60].id },
        });
        await commerce.buyerCancel(identity, orders[60].id, parts[60].id);
        const afterStock = await tx.productVariant.findUniqueOrThrow({
          where: { id: variants[60].id },
        });
        assert.equal(afterStock.onHand, beforeStock.onHand + 2);
        await assert.rejects(() =>
          commerce.buyerCancel(identity, orders[60].id, parts[60].id),
        );
        const repeated = await tx.productVariant.findUniqueOrThrow({
          where: { id: variants[60].id },
        });
        assert.equal(repeated.onHand, afterStock.onHand);
        pass(
          'Real cancellation restores inventory once and refuses repeated cancellation',
        );
        throw rollback;
      },
      { timeout: 120000, maxWait: 15000, isolationLevel: 'RepeatableRead' },
    )
    .catch((error) => {
      if (error !== rollback) throw error;
    });
  assert.equal(
    await prisma.user.count({ where: { firebaseUid: { startsWith: prefix } } }),
    0,
  );
  assert.equal(
    await prisma.seller.count({ where: { slug: { startsWith: prefix } } }),
    0,
  );
  pass('All temporary records and cancellation writes rolled back');
  console.log(JSON.stringify({ checks, rolledBack: true }));
} finally {
  await prisma.$disconnect();
}
