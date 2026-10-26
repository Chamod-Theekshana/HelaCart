"use client";
import { useAdmin } from "@/components/admin-provider";
import { useShop } from "@/components/shop-provider";
import { AdminHeading } from "@/components/admin-ui";
import { SupportWorkspace } from "@/components/support-workspace";
export default function AdminSupportScreen() {
  const { request, isPreview } = useAdmin(),
    { user } = useShop();
  return (
    <>
      <AdminHeading
        eyebrow="CUSTOMER CARE"
        title="Support cases"
        description="Reply to buyers and shops, record decisions and manage case-related commission holds."
      />
      <SupportWorkspace
        key={user?.uid ?? "preview"}
        root="/admin/after-sales"
        role="ADMIN"
        request={request}
        isPreview={isPreview}
      />
    </>
  );
}
