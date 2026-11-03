"use client";
import { useAdmin } from "@/components/admin-provider";
import { useShop } from "@/components/shop-provider";
import { AdminHeading } from "@/components/admin-ui";
import { RefundWorkspace } from "@/components/refund-workspace";
export default function AdminRefundsScreen() {
  const { request, isPreview } = useAdmin(),
    { user } = useShop();
  return (
    <>
      <AdminHeading
        eyebrow="AFTER-SALES FINANCES"
        title="Buyer refund records"
        description="Verify seller refund evidence, confirm records and preserve corrections with their history."
      />
      <RefundWorkspace
        key={user?.uid ?? "preview"}
        request={request}
        isPreview={isPreview}
      />
    </>
  );
}
