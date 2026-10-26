"use client";
import { useShop } from "./shop-provider";
import { useBuyerAfterSalesRequest } from "./after-sales-client";
import { ReturnsWorkspace } from "./returns-workspace";
export function BuyerReturns({ revision = 0 }: { revision?: number }) {
  const { user, isPreview } = useShop(),
    request = useBuyerAfterSalesRequest();
  return (
    <ReturnsWorkspace
      key={user?.uid ?? "preview"}
      role="BUYER"
      root="/me/after-sales"
      request={request}
      isPreview={isPreview}
      revision={revision}
    />
  );
}
