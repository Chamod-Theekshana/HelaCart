"use client";
import { useSeller } from "@/components/seller-provider";
import { useShop } from "@/components/shop-provider";
import { SellerPageHeading } from "@/components/seller-ui";
import { CommissionAccount } from "@/components/commission-workspace";
import { ProductCommissionManagement } from "@/components/product-commission-management";
import { FinanceCard } from "@/components/commission-workspace";
export default function SellerCommissionScreen() {
  const { seller, request, isPreview } = useSeller();
  const { user } = useShop();
  return (
    <>
      <SellerPageHeading
        kicker="SHOP FINANCES"
        title="Commission & payments"
        description="Review HelaCart commission and submit your bank payments for owner verification."
      />
      {seller && (
        <CommissionAccount
          key={`${user?.uid}:${seller.id}`}
          sellerId={seller.id}
          request={request}
          isPreview={isPreview}
        />
      )}
      {seller && (
        <FinanceCard title="Your product commission rates">
          <ProductCommissionManagement
            key={`rates:${user?.uid}:${seller.id}`}
            sellerId={seller.id}
            request={request}
            isPreview={isPreview}
          />
        </FinanceCard>
      )}
    </>
  );
}
