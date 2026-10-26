"use client";
import { useSeller } from "@/components/seller-provider";
import { useShop } from "@/components/shop-provider";
import { SellerPageHeading } from "@/components/seller-ui";
import { ReturnsWorkspace } from "@/components/returns-workspace";
export default function SellerReturnsScreen() {
  const { seller, request, isPreview } = useSeller(),
    { user } = useShop();
  return (
    <>
      <SellerPageHeading
        kicker="CUSTOMER CARE"
        title="Returns & refunds"
        description="Review returned items and record money already refunded to buyers for HelaCart verification."
      />
      {seller && (
        <ReturnsWorkspace
          key={`${user?.uid}:${seller.id}`}
          root={`/sellers/${seller.id}/after-sales`}
          role="SELLER"
          request={request}
          isPreview={isPreview}
        />
      )}
    </>
  );
}
