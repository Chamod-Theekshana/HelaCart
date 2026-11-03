-- Enum values only. PostgreSQL cannot use a value added by ALTER TYPE ... ADD
-- VALUE in the same transaction, so every statement that uses these values
-- lives in the following migration.
ALTER TYPE "SellerOrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';
ALTER TYPE "SellerOrderStatus" ADD VALUE IF NOT EXISTS 'RETURNED_TO_SELLER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SELLER_STATUS_CHANGED';
ALTER TYPE "AccountAccessStatus" ADD VALUE IF NOT EXISTS 'DELETED';
