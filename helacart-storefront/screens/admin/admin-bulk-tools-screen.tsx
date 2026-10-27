"use client";
import { useAdmin } from "@/components/admin-provider";
import { useShop } from "@/components/shop-provider";
import { BulkToolsWorkspace } from "@/components/bulk-tools-workspace";
export default function AdminBulkToolsScreen() {
  const { request, isPreview } = useAdmin();
  const { user } = useShop();
  return (
    <BulkToolsWorkspace
      key={user?.uid}
      root="/admin/bulk-tools"
      role="ADMIN"
      request={request}
      isPreview={isPreview}
    />
  );
}
