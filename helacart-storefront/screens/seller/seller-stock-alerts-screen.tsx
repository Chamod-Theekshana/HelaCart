"use client";
import { useSeller } from "@/components/seller-provider";
import { useShop } from "@/components/shop-provider";
import { StockAlertsWorkspace } from "@/components/stock-alerts-workspace";
export default function SellerStockAlertsScreen() {
  const { seller, request, isPreview } = useSeller();
  const { user } = useShop();
  return (
    <StockAlertsWorkspace
      key={`${user?.uid}:${seller?.id}`}
      root={`/sellers/${seller?.id}/stock-alerts`}
      request={request}
      isPreview={isPreview}
      canEdit={seller?.status === "APPROVED"}
    />
  );
}
