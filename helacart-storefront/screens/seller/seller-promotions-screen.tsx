"use client";
import { useShop } from "@/components/shop-provider";
import { useSeller } from "@/components/seller-provider";
import { PromotionsWorkspace } from "@/components/promotions-workspace";
export default function SellerPromotionsScreen() {
  const { seller, request, isPreview } = useSeller();
  const { user } = useShop();
  return (
    <PromotionsWorkspace
      key={`${user?.uid}:${seller?.id}`}
      root={`/sellers/${seller?.id}/promotions`}
      request={request}
      isPreview={isPreview}
      canCreate={seller?.status === "APPROVED"}
    />
  );
}
