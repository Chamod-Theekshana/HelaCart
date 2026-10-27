"use client";
import { useSeller } from "@/components/seller-provider";
import { useShop } from "@/components/shop-provider";
import { BulkToolsWorkspace } from "@/components/bulk-tools-workspace";
export default function SellerBulkToolsScreen() {
  const { seller, request, isPreview } = useSeller();
  const { user } = useShop();
  return (
    <BulkToolsWorkspace
      key={`${user?.uid}:${seller?.id}`}
      root={`/sellers/${seller?.id}/bulk-tools`}
      role="SELLER"
      request={request}
      isPreview={isPreview}
    />
  );
}
