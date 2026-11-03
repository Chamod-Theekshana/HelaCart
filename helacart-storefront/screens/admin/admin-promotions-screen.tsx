"use client";
import { useShop } from "@/components/shop-provider";
import { useAdmin } from "@/components/admin-provider";
import { PromotionsWorkspace } from "@/components/promotions-workspace";
export default function AdminPromotionsScreen() {
  const { request, isPreview } = useAdmin();
  const { user } = useShop();
  return (
    <PromotionsWorkspace
      key={user?.uid}
      root="/admin/promotions"
      request={request}
      isPreview={isPreview}
      isAdmin
    />
  );
}
