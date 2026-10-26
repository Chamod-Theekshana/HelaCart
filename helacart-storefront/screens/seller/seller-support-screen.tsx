"use client";
import { useSeller } from "@/components/seller-provider";
import { useShop } from "@/components/shop-provider";
import { SellerPageHeading } from "@/components/seller-ui";
import { SupportWorkspace } from "@/components/support-workspace";
export default function SellerSupportScreen() {
  const { seller, request, isPreview } = useSeller(),
    { user } = useShop();
  return (
    <>
      <SellerPageHeading
        kicker="CUSTOMER CARE"
        title="Support cases"
        description="Follow order conversations with buyers and the HelaCart team."
      />
      {seller && (
        <SupportWorkspace
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
