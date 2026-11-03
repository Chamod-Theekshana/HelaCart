"use client";

import { useState } from "react";
import { useAdminCursorList } from "@/components/admin-provider";
import { AdminEmpty, AdminFeedback, AdminHeading } from "@/components/admin-ui";
import {
  auditActions,
  dateTime,
  previewAuditLog,
  shortId,
  type AuditLogEntry,
} from "@/lib/admin";

/** Read-only administrator audit trail (GET /admin/audit-log, §10). */
export default function AdminAuditLogPage() {
  const [action, setAction] = useState("");
  const list = useAdminCursorList<AuditLogEntry>(
    `/admin/audit-log?limit=50${action ? `&action=${encodeURIComponent(action)}` : ""}`,
    previewAuditLog.filter((row) => !action || row.action === action),
  );
  return (
    <>
      <AdminHeading
        eyebrow="GOVERNANCE"
        title="Audit log"
        description="Every administrative order intervention, seller suspension, product decision, category and storefront change, access change and commission-rate change, with who did it and why."
      />
      <AdminFeedback error={list.error} />
      <div className="admin-card">
        <div className="admin-toolbar">
          <label className="admin-search">
            Action
            <select
              aria-label="Filter by action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="">All actions</option>
              {auditActions.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <span>{list.items.length} entries shown</span>
        </div>
        {list.loading ? (
          <AdminEmpty message="Loading audit entries…" />
        ) : list.items.length ? (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Administrator</th>
                  <th>Action</th>
                  <th>Subject</th>
                  <th>Reason</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((row) => (
                  <tr key={row.id}>
                    <td>{dateTime(row.createdAt)}</td>
                    <td>
                      {row.actorEmail ??
                        (row.actorId ? shortId(row.actorId) : "System")}
                    </td>
                    <td>
                      <strong>
                        {row.action.replaceAll("_", " ").toLowerCase()}
                      </strong>
                    </td>
                    <td>
                      {row.subjectType} {shortId(row.subjectId)}
                    </td>
                    <td>{row.reason ?? "—"}</td>
                    <td>
                      {row.details == null ? (
                        "—"
                      ) : (
                        <details>
                          <summary>View</summary>
                          <pre className="admin-json">
                            {JSON.stringify(row.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmpty
            message={
              list.error
                ? "Could not load the audit log."
                : "No audit entries yet."
            }
          />
        )}
        {list.hasMore && (
          <div className="admin-row-actions">
            <button
              className="outline-btn"
              disabled={list.loadingMore}
              onClick={() => void list.loadMore()}
            >
              {list.loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
