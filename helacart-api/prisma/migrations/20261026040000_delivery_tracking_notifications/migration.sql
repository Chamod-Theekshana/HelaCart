ALTER TYPE "NotificationType" ADD VALUE 'ORDER_TRACKING_UPDATED';
ALTER TABLE "Seller" ADD COLUMN "deliveryRevision" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "deliveryRules" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "freeShippingThresholdMinor" INTEGER,
 ADD COLUMN "deliveryMinDays" INTEGER, ADD COLUMN "deliveryMaxDays" INTEGER;
ALTER TABLE "Seller" ADD CONSTRAINT "seller_delivery_terms_valid" CHECK ("deliveryRevision">=0
 AND ("freeShippingThresholdMinor" IS NULL OR "freeShippingThresholdMinor" BETWEEN 1 AND 1000000000)
 AND (("deliveryMinDays" IS NULL AND "deliveryMaxDays" IS NULL) OR ("deliveryMinDays" IS NOT NULL AND "deliveryMaxDays" IS NOT NULL AND "deliveryMinDays" BETWEEN 1 AND 60 AND "deliveryMaxDays" BETWEEN "deliveryMinDays" AND 60))
 AND jsonb_typeof("deliveryRules")='array' AND jsonb_array_length("deliveryRules")<=25);
ALTER TABLE "SellerOrder" ADD COLUMN "deliveryDistrict" TEXT, ADD COLUMN "deliveryRateRevision" INTEGER,
 ADD COLUMN "deliveryMinDays" INTEGER, ADD COLUMN "deliveryMaxDays" INTEGER;
ALTER TABLE "SellerOrder" ADD CONSTRAINT "order_delivery_terms_valid" CHECK (("deliveryRateRevision" IS NULL OR "deliveryRateRevision">=0)
 AND (("deliveryMinDays" IS NULL AND "deliveryMaxDays" IS NULL) OR ("deliveryMinDays" IS NOT NULL AND "deliveryMaxDays" IS NOT NULL AND "deliveryMinDays" BETWEEN 1 AND 60 AND "deliveryMaxDays" BETWEEN "deliveryMinDays" AND 60)));
CREATE FUNCTION protect_delivery_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."deliveryDistrict",NEW."deliveryRateRevision",NEW."deliveryMinDays",NEW."deliveryMaxDays",NEW."shippingLkrMinor") IS DISTINCT FROM ROW(OLD."deliveryDistrict",OLD."deliveryRateRevision",OLD."deliveryMinDays",OLD."deliveryMaxDays",OLD."shippingLkrMinor")
 THEN RAISE EXCEPTION 'Order delivery snapshots cannot be changed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "order_delivery_snapshot_immutable" BEFORE UPDATE ON "SellerOrder" FOR EACH ROW EXECUTE FUNCTION protect_delivery_snapshot();
ALTER TABLE "Notification" ADD COLUMN "href" VARCHAR(300);
ALTER TABLE "Notification" ADD CONSTRAINT "notification_internal_link" CHECK (href IS NULL OR (href LIKE '/%' AND href NOT LIKE '//%' AND href !~ E'[\\r\\n]'));
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId","readAt");
CREATE TABLE "SellerShipment" (
 id UUID PRIMARY KEY, "sellerOrderId" UUID NOT NULL REFERENCES "SellerOrder"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "courierName" VARCHAR(100) NOT NULL, "trackingNumber" VARCHAR(100), version INTEGER NOT NULL DEFAULT 1,
 "shippedAt" TIMESTAMPTZ(3) NOT NULL, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CHECK (length(trim("courierName")) BETWEEN 2 AND 100 AND version>0)
);
CREATE UNIQUE INDEX "SellerShipment_sellerOrderId_key" ON "SellerShipment"("sellerOrderId");
CREATE TABLE "ShipmentChange" (
 id UUID PRIMARY KEY, "shipmentId" UUID NOT NULL REFERENCES "SellerShipment"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "actorId" UUID NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE, version INTEGER NOT NULL,
 before JSONB NOT NULL, after JSONB NOT NULL, reason VARCHAR(500) NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(version>0 AND length(trim(reason))>=10)
);
CREATE UNIQUE INDEX "ShipmentChange_shipmentId_version_key" ON "ShipmentChange"("shipmentId",version);
CREATE FUNCTION protect_shipment_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Shipment history is append only'; END $$;
CREATE TRIGGER "shipment_history_immutable" BEFORE UPDATE OR DELETE ON "ShipmentChange" FOR EACH ROW EXECUTE FUNCTION protect_shipment_history();
CREATE FUNCTION protect_shipment_dispatch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Shipment cannot be deleted'; END IF;
 IF NEW."sellerOrderId"<>OLD."sellerOrderId" OR NEW."shippedAt"<>OLD."shippedAt" OR NEW.id<>OLD.id OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Dispatch identity and date are immutable; updates require a new version'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "shipment_dispatch_immutable" BEFORE UPDATE OR DELETE ON "SellerShipment" FOR EACH ROW EXECUTE FUNCTION protect_shipment_dispatch();
