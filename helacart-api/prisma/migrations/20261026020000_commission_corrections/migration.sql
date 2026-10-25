-- CreateTable
CREATE TABLE "CommissionCorrection" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "paymentId" UUID,
    "refundId" UUID,
    "requestKey" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "baseMinor" INTEGER NOT NULL DEFAULT 0,
    "reference" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionCorrection_paymentId_key" ON "CommissionCorrection"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionCorrection_refundId_key" ON "CommissionCorrection"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionCorrection_requestKey_key" ON "CommissionCorrection"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionCorrection_reference_key" ON "CommissionCorrection"("reference");

-- CreateIndex
CREATE INDEX "CommissionCorrection_sellerId_createdAt_idx" ON "CommissionCorrection"("sellerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommissionCorrection" ADD CONSTRAINT "CommissionCorrection_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionCorrection" ADD CONSTRAINT "CommissionCorrection_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionCorrection" ADD CONSTRAINT "CommissionCorrection_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommissionPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionCorrection" ADD CONSTRAINT "CommissionCorrection_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "CommissionRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommissionCorrection" ADD CONSTRAINT "commission_correction_valid" CHECK (
  "amountMinor">=0 AND (("paymentId" IS NOT NULL AND "refundId" IS NULL AND "baseMinor"=0 AND "amountMinor">0)
    OR ("paymentId" IS NULL AND "refundId" IS NOT NULL AND "baseMinor">0))
);
CREATE TRIGGER "commission_correction_immutable" BEFORE UPDATE OR DELETE ON "CommissionCorrection" FOR EACH ROW EXECUTE FUNCTION protect_commission_record();

CREATE FUNCTION validate_commission_correction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p "CommissionPayment"%ROWTYPE; r "CommissionRefund"%ROWTYPE; c "CommissionCharge"%ROWTYPE; refunded bigint; credited bigint;
BEGIN
  PERFORM 1 FROM "Seller" WHERE id=NEW."sellerId" FOR UPDATE;
  IF NEW."paymentId" IS NOT NULL THEN
    SELECT * INTO p FROM "CommissionPayment" WHERE id=NEW."paymentId" AND "sellerId"=NEW."sellerId" AND status='APPROVED';
    IF NOT FOUND OR NEW."amountMinor"<>p."amountMinor" THEN RAISE EXCEPTION 'Correction must reverse a confirmed payment of this shop'; END IF;
  ELSE
    SELECT * INTO r FROM "CommissionRefund" WHERE id=NEW."refundId" AND "sellerId"=NEW."sellerId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Correction must reverse a refund of this shop'; END IF;
    SELECT * INTO c FROM "CommissionCharge" WHERE id=r."chargeId";
    SELECT COALESCE(SUM(f."baseMinor"-COALESCE(x."baseMinor",0)),0),COALESCE(SUM(f."creditMinor"-COALESCE(x."amountMinor",0)),0)
      INTO refunded,credited FROM "CommissionRefund" f LEFT JOIN "CommissionCorrection" x ON x."refundId"=f.id WHERE f."chargeId"=c.id;
    IF NEW."baseMinor"<>r."baseMinor" OR NEW."amountMinor"<>credited-((refunded-r."baseMinor")*c."rateBps"+5000)/10000
    THEN RAISE EXCEPTION 'Refund correction must preserve cumulative commission rounding'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "commission_correction_matches_record" BEFORE INSERT ON "CommissionCorrection" FOR EACH ROW EXECUTE FUNCTION validate_commission_correction();

CREATE OR REPLACE FUNCTION validate_commission_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "CommissionCharge"%ROWTYPE; refunded bigint; credited bigint;
BEGIN
  PERFORM 1 FROM "Seller" WHERE id=NEW."sellerId" FOR UPDATE;
  SELECT * INTO c FROM "CommissionCharge" WHERE id=NEW."chargeId" AND "sellerId"=NEW."sellerId";
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund must belong to the charged shop'; END IF;
  SELECT COALESCE(SUM(f."baseMinor"-COALESCE(x."baseMinor",0)),0),COALESCE(SUM(f."creditMinor"-COALESCE(x."amountMinor",0)),0)
    INTO refunded,credited FROM "CommissionRefund" f LEFT JOIN "CommissionCorrection" x ON x."refundId"=f.id WHERE f."chargeId"=NEW."chargeId";
  IF refunded+NEW."baseMinor">c."baseMinor" OR NEW."creditMinor"<>((refunded+NEW."baseMinor")*c."rateBps"+5000)/10000-credited
  THEN RAISE EXCEPTION 'Refund credit must match the remaining merchandise commission'; END IF;
  RETURN NEW;
END $$;
