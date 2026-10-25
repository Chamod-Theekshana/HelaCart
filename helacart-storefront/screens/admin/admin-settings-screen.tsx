"use client";
import { useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/components/admin-provider";
import { useShop } from "@/components/shop-provider";
import { AdminHeading } from "@/components/admin-ui";
import {
  FinanceCard,
  FinanceFeedback,
  useFinanceResource,
} from "@/components/commission-workspace";
import { previewPolicy, type CommissionPolicy } from "@/lib/commission";
import { PolicyDialog } from "./admin-commission-screen";
import styles from "@/components/commission-workspace.module.css";
export default function AdminSettingsScreen() {
  const { user } = useShop();
  return <SettingsWorkspace key={user?.uid ?? "preview"} />;
}
function SettingsWorkspace() {
  const { request, isPreview } = useAdmin();
  const [revision, setRevision] = useState(0),
    [editing, setEditing] = useState(false),
    [notice, setNotice] = useState("");
  const policy = useFinanceResource<CommissionPolicy>(
    "/admin/commission/policy",
    previewPolicy,
    request,
    isPreview,
    revision,
  );
  return (
    <>
      <AdminHeading
        eyebrow="PLATFORM SETTINGS"
        title="Settings"
        description="Manage commission payment terms and HelaCart collection details."
      />
      <div className={styles.workspace}>
        <FinanceFeedback error={policy.error} notice={notice} />
        <FinanceCard
          title="Commission payment period"
          description="Sellers receive COD money and pay HelaCart commission separately."
          action={
            <button
              className="outline-btn"
              onClick={() => setRevision((v) => v + 1)}
            >
              Refresh
            </button>
          }
        >
          {policy.loading ? (
            <p>Loading payment settings…</p>
          ) : policy.data ? (
            <p>
              Commission is due{" "}
              <strong>
                {policy.data.paymentDays} days after successful delivery
              </strong>
              . Each new order item saves these terms. Open return cases and
              admin holds pause eligibility.
            </p>
          ) : (
            <p>Payment settings could not be loaded. Refresh to try again.</p>
          )}
          <p className={styles.muted}>
            Admin assigns each product’s percentage in Product rates. Unassigned
            products remain inactive.
          </p>
          <div className={styles.toolbar}>
            <button
              className="primary-btn"
              disabled={isPreview || !policy.data}
              onClick={() => setEditing(true)}
            >
              Edit payment settings
            </button>
            <Link href="/admin/commission" className="outline-btn">
              Manage product rates & collections
            </Link>
          </div>
          {policy.data && (
            <p className={styles.muted}>
              Collection account: {policy.data?.bankName || "Not configured"} ·{" "}
              {policy.data?.accountName || "No account holder"}
            </p>
          )}
        </FinanceCard>
      </div>
      {editing && policy.data && (
        <PolicyDialog
          key={policy.data.version}
          policy={policy.data}
          request={request}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setRevision((v) => v + 1);
            setNotice(
              "Settings saved for new orders. Existing orders retain their terms.",
            );
          }}
        />
      )}
    </>
  );
}
