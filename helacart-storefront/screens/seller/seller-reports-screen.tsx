"use client";
import { useSeller } from "@/components/seller-provider";
import { useShop } from "@/components/shop-provider";
import { BusinessReportsWorkspace } from "@/components/business-reports-workspace";
export default function SellerReportsScreen() {
  const { seller, request, isPreview } = useSeller();
  const { user } = useShop();
  return (
    <BusinessReportsWorkspace
      key={`${user?.uid}:${seller?.id}`}
      root={`/sellers/${seller?.id}/reports`}
      request={request}
      isPreview={isPreview}
    />
  );
}
