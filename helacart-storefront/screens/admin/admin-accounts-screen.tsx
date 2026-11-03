"use client";
import { useState } from "react";
import type { Page } from "@/lib/shops";
import { formatSellerDate } from "@/lib/seller";
import { useAdmin } from "@/components/admin-provider";
import { useShop } from "@/components/shop-provider";
import { useDebounced } from "@/components/list-controls";
import {
  FeedbackPagination,
  ReasonDialog,
  useFeedbackResource,
} from "@/components/product-reviews";
import s from "@/components/product-feedback.module.css";
type Account = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  accessStatus: "ACTIVE" | "SUSPENDED";
  accessVersion: number;
  isAdmin: boolean;
  memberships: { role: string; seller: { name: string } }[];
  accessChanges: {
    version: number;
    status: string;
    reason: string;
    createdAt: string;
  }[];
};
export default function AdminAccounts() {
  const { user } = useShop();
  return <Accounts key={user?.uid} />;
}
function Accounts() {
  const { request, isPreview } = useAdmin();
  const [q, setQ] = useState("");
  const search = useDebounced(q);
  const [status, setStatus] = useState("");
  const filter = `${search}:${status}`;
  const [paging, setPaging] = useState({ filter: "", page: 1 });
  const page = paging.filter === filter ? paging.page : 1;
  const [target, setTarget] = useState<Account | null>(null);
  const list = useFeedbackResource<Page<Account>>(
    `/admin/accounts?page=${page}${search.trim().length >= 2 ? `&q=${encodeURIComponent(search.trim())}` : ""}${status ? `&status=${status}` : ""}`,
    request,
    !isPreview,
  );
  return (
    <>
      <span className="section-kicker">ACCOUNT PERMISSIONS</span>
      <h1>Accounts & access</h1>
      <p className={s.muted}>
        Suspend or restore access to HelaCart. Suspension blocks authenticated
        buyer and shop actions on the next request. Existing orders, refunds and
        commission history remain recorded. Administrator access is configured
        by the owner’s server allowlist.
      </p>
      {isPreview ? (
        <p className={s.status}>
          Connect the API to manage real account access.
        </p>
      ) : (
        <>
          <div className={s.filters}>
            <label>
              Search name or email
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={100}
                placeholder="At least two characters"
              />
            </label>
            <label>
              Access
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All accounts</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
            <button className="outline-btn" onClick={list.reload}>
              Refresh
            </button>
          </div>
          {list.loading && <p role="status">Loading accounts…</p>}
          {list.error && (
            <div className={s.error} role="alert">
              {list.error}
              <button className="outline-btn" onClick={list.reload}>
                Retry
              </button>
            </div>
          )}
          {list.data && (
            <>
              <div className={s.accountGrid}>
                {list.data.items.map((account) => (
                  <article className={s.review} key={account.id}>
                    <div className={s.heading}>
                      <strong>{account.name || "HelaCart account"}</strong>
                      <span className={s.badge}>{account.accessStatus}</span>
                    </div>
                    <p>{account.email}</p>
                    <small>
                      {account.emailVerified
                        ? "Email verified"
                        : "Email not verified"}
                      {account.isAdmin ? " · Administrator" : ""}
                    </small>
                    <p className={s.muted}>
                      {account.memberships.length
                        ? account.memberships
                            .map(
                              (m) =>
                                `${m.seller.name} (${m.role.toLowerCase()})`,
                            )
                            .join(" · ")
                        : "Buyer account"}
                    </p>
                    {!account.isAdmin && (
                      <button
                        className="outline-btn"
                        onClick={() => setTarget(account)}
                      >
                        {account.accessStatus === "ACTIVE"
                          ? "Suspend access"
                          : "Restore access"}
                      </button>
                    )}
                    {!!account.accessChanges.length && (
                      <details className={s.history}>
                        <summary>Recent access history</summary>
                        {account.accessChanges.map((change) => (
                          <p key={change.version}>
                            <strong>
                              {change.status} ·{" "}
                              {formatSellerDate(change.createdAt)}
                            </strong>
                            <br />
                            {change.reason}
                          </p>
                        ))}
                      </details>
                    )}
                  </article>
                ))}
                {!list.data.items.length && (
                  <p className={s.status}>No accounts match these filters.</p>
                )}
              </div>
              <FeedbackPagination
                page={list.data}
                onPage={(p) => setPaging({ filter, page: p })}
              />
            </>
          )}
        </>
      )}
      {target && (
        <ReasonDialog
          title={
            target.accessStatus === "ACTIVE"
              ? "Suspend account access"
              : "Restore account access"
          }
          description={`${target.name || target.email} (${target.email}). ${target.accessStatus === "ACTIVE" ? "This account will lose authenticated access to HelaCart." : "This account will be able to use its existing HelaCart permissions again."}`}
          submitLabel={
            target.accessStatus === "ACTIVE"
              ? "Suspend access"
              : "Restore access"
          }
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            await request(`/admin/accounts/${target.id}/access`, "PATCH", {
              version: target.accessVersion,
              status: target.accessStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
              reason,
            });
            list.reload();
          }}
        />
      )}
    </>
  );
}
