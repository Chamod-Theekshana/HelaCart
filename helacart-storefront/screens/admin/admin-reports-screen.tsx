"use client";
import { useAdmin } from "@/components/admin-provider";
import { useShop } from "@/components/shop-provider";
import { BusinessReportsWorkspace } from "@/components/business-reports-workspace";
export default function AdminReportsScreen() {
  const { request, isPreview } = useAdmin();
  const { user } = useShop();
  return (
    <BusinessReportsWorkspace
      key={user?.uid}
      root="/admin/reports"
      request={request}
      isPreview={isPreview}
      isAdmin
    />
  );
}
