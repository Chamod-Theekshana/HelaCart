"use client";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { formatSellerDate } from "@/lib/seller";
import { useSeller } from "@/components/seller-provider";
import {
  ReasonDialog,
  useFeedbackResource,
} from "@/components/product-reviews";
import s from "@/components/product-feedback.module.css";
type TeamMember = {
  id: string;
  role: "OWNER" | "MANAGER";
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    accessStatus: string;
  };
};
type Team = {
  members: TeamMember[];
  history: {
    id: string;
    memberUserId: string;
    action: string;
    reason: string;
    createdAt: string;
  }[];
};
export default function SellerTeam() {
  const { seller, profile } = useSeller();
  return <TeamContent key={`${seller?.id}:${profile?.id}`} />;
}
function TeamContent() {
  const { seller, profile, request, isPreview } = useSeller();
  const owner =
    isPreview ||
    profile?.memberships.some(
      (m) => m.seller.id === seller?.id && m.role === "OWNER",
    );
  const list = useFeedbackResource<Team>(
    `/sellers/${seller?.id}/team`,
    request,
    !!seller && !!owner && !isPreview,
  );
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [target, setTarget] = useState<TeamMember | null>(null);
  return (
    <>
      <span className="section-kicker">SHOP ACCESS</span>
      <h1>Team & permissions</h1>
      <p className={s.muted}>
        The shop owner controls manager access. Managers work within this shop;
        they cannot add team members, remove the owner or grant administrator
        access.
      </p>
      <section className={s.section}>
        <h2>What each role can do</h2>
        <table className={s.permissions}>
          <thead>
            <tr>
              <th>Permission</th>
              <th>Owner</th>
              <th>Manager</th>
            </tr>
          </thead>
          <tbody>
            {[
              "Products & inventory",
              "Orders & delivery",
              "Shop profile & review replies",
              "Returns, support & commission records",
            ].map((v) => (
              <tr key={v}>
                <td>{v}</td>
                <td>Yes</td>
                <td>Yes</td>
              </tr>
            ))}
            <tr>
              <td>Add or remove managers</td>
              <td>Yes</td>
              <td>No</td>
            </tr>
            <tr>
              <td>Admin decisions & commission rates</td>
              <td>No</td>
              <td>No</td>
            </tr>
          </tbody>
        </table>
      </section>
      {!owner ? (
        <p className={s.status}>
          Only this shop’s owner can view or change the team.
        </p>
      ) : isPreview ? (
        <p className={s.status}>
          Connect the API to manage your real shop team.
        </p>
      ) : (
        <>
          <form
            className={s.form}
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || !seller) return;
              setBusy(true);
              setError("");
              setNotice("");
              try {
                await request(`/sellers/${seller.id}/team`, "POST", {
                  email: email.trim(),
                  reason: reason.trim(),
                });
                setEmail("");
                setReason("");
                setNotice(
                  "Manager access added. The account can now select this shop in Seller Center.",
                );
                list.reload();
              } catch (error) {
                setError(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Add a shop manager</h2>
            <p className={s.muted}>
              Enter the exact email of an existing verified HelaCart account.
              This grants access immediately; no invitation email is sent.
            </p>
            <label>
              Account email
              <input
                required
                type="email"
                maxLength={254}
                value={email}
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Reason
              <textarea
                required
                minLength={10}
                maxLength={500}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error && (
              <div className={s.error} role="alert">
                {error}
              </div>
            )}
            <button className="primary-btn" disabled={busy}>
              {busy ? "Adding…" : "Grant manager access"}
            </button>
          </form>
          {notice && (
            <p className={s.status} role="status">
              {notice}
            </p>
          )}
          {list.loading && <p role="status">Loading team…</p>}
          {list.error && (
            <div role="alert" className={s.error}>
              {list.error}
              <button className="outline-btn" onClick={list.reload}>
                Retry
              </button>
            </div>
          )}
          {list.data && (
            <>
              <div className={s.heading}>
                <h2>Current team</h2>
                <button className="outline-btn" onClick={list.reload}>
                  Refresh
                </button>
              </div>
              <div className={s.accountGrid}>
                {list.data.members.map((member) => (
                  <article className={s.review} key={member.id}>
                    <div className={s.heading}>
                      <strong>{member.user.name || "HelaCart account"}</strong>
                      <span className={s.badge}>{member.role}</span>
                    </div>
                    <p>{member.user.email}</p>
                    <p className={s.muted}>{member.user.accessStatus}</p>
                    {member.role === "MANAGER" && (
                      <button
                        className="outline-btn"
                        onClick={() => setTarget(member)}
                      >
                        Remove access
                      </button>
                    )}
                  </article>
                ))}
              </div>
              {!!list.data.history.length && (
                <details className={s.history}>
                  <summary>Recent team access history</summary>
                  {list.data.history.map((change) => (
                    <p key={change.id}>
                      <strong>
                        {change.action} · {formatSellerDate(change.createdAt)}
                      </strong>
                      <br />
                      {change.reason}
                    </p>
                  ))}
                </details>
              )}
            </>
          )}
        </>
      )}
      {target && (
        <ReasonDialog
          title="Remove manager access"
          description={`${target.user.email} will lose access to this shop on the next request. Their buyer account and recorded actions are retained.`}
          submitLabel="Remove access"
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            await request(
              `/sellers/${seller?.id}/team/${target.id}`,
              "DELETE",
              { reason },
            );
            setNotice("Manager access removed.");
            list.reload();
          }}
        />
      )}
    </>
  );
}
