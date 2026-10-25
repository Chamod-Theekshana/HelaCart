"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { errorMessage } from "@/lib/api";
import {
  pageOf,
  shopDate,
  shopPath,
  type Page,
  type ShopReview,
} from "@/lib/shops";
import { useAdmin, useAdminResource } from "@/components/admin-provider";
import s from "@/components/shop.module.css";
import { AdminReviewPhotos } from "@/components/admin-review-photos";
type Report = {
  id: string;
  reason: string;
  status: string;
  commentSnapshot: string;
  ratingSnapshot: number;
  photoSnapshotIds?: string[];
  createdAt: string;
  moderationNote: string | null;
  reviewedAt: string | null;
  review: ShopReview & {
    isHidden: boolean;
    deletedAt: string | null;
    seller: { id: string; name: string; slug: string };
  };
};
const sample: Page<Report> = pageOf([]);
export default function ReviewReportsPage() {
  const { request, isPreview } = useAdmin();
  const [status, setStatus] = useState("OPEN"),
    [page, setPage] = useState(1),
    [notice, setNotice] = useState("");
  const { data, loading, error, reload } = useAdminResource<Page<Report>>(
    `/admin/shop-review-reports?status=${status}&page=${page}`,
    sample,
  );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="section-kicker">COMMUNITY MODERATION</span>
          <h1>Review reports</h1>
          <p>
            Investigate reported shop reviews and record a moderation decision.
          </p>
        </div>
      </div>
      <div className={s.reviewFilters}>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
              setNotice("");
            }}
          >
            <option value="OPEN">Open reports</option>
            <option value="ACTIONED">Review hidden</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </label>
        <span>{data?.total ?? 0} reports</span>
      </div>
      {notice && (
        <div className={s.notice} role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="message error" role="alert">
          {error} <button onClick={reload}>Try again</button>
        </div>
      )}
      {loading ? (
        <div className={s.empty}>Loading reports…</div>
      ) : data?.items.length ? (
        data.items.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            disabled={isPreview}
            onDecision={async (action, note) => {
              await request(
                `/admin/shop-review-reports/${report.id}`,
                "PATCH",
                { action, note },
              );
              setNotice(
                action === "HIDE"
                  ? "Review hidden. Its rating is excluded from shop totals."
                  : "Report dismissed.",
              );
              reload();
            }}
          />
        ))
      ) : (
        !error && (
          <div className={s.empty}>
            {isPreview
              ? "Sample queue is empty. Real reports appear here when the API is connected."
              : "No reports in this queue."}
          </div>
        )
      )}
      {data && data.pages > 1 && (
        <nav className={s.pagination} aria-label="Report pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
            className="outline-btn"
          >
            Previous
          </button>
          <span>
            {page} / {data.pages}
          </span>
          <button
            disabled={page >= data.pages}
            onClick={() => setPage((value) => value + 1)}
            className="outline-btn"
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
function ReportCard({
  report,
  disabled,
  onDecision,
}: {
  report: Report;
  disabled: boolean;
  onDecision: (action: "HIDE" | "DISMISS", note: string) => Promise<void>;
}) {
  const [note, setNote] = useState(""),
    [action, setAction] = useState<"HIDE" | "DISMISS">("HIDE"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function decide(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onDecision(action, note);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={s.reportCard}>
      <h2>
        <Link href={`${shopPath(report.review.seller)}#reviews`}>
          {report.review.seller.name}
        </Link>
      </h2>
      <small>
        {shopDate(report.createdAt)} · {report.status}
      </small>
      <p>
        <strong>Reason:</strong> {report.reason}
      </p>
      <small>Review at the time of report · {report.ratingSnapshot}/5</small>
      <blockquote>{report.commentSnapshot}</blockquote>
      <AdminReviewPhotos
        reportId={report.id}
        photoIds={report.photoSnapshotIds ?? []}
      />
      <small>
        Current review · {report.review.rating}/5 ·{" "}
        {report.review.isHidden
          ? "Hidden"
          : report.review.deletedAt
            ? "Deleted by buyer"
            : "Published"}
      </small>
      <blockquote>{report.review.comment}</blockquote>
      {report.review.reply && (
        <p>
          <strong>Seller response:</strong> {report.review.reply}
        </p>
      )}
      {report.status === "OPEN" ? (
        <form className={s.form} onSubmit={(event) => void decide(event)}>
          <label>
            Decision
            <select
              value={action}
              disabled={busy || disabled}
              onChange={(event) =>
                setAction(event.target.value as "HIDE" | "DISMISS")
              }
            >
              <option value="HIDE">Hide review and exclude rating</option>
              <option value="DISMISS">Dismiss report</option>
            </select>
          </label>
          <label>
            Moderation note
            <textarea
              required
              minLength={10}
              maxLength={500}
              value={note}
              disabled={busy || disabled}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button
            className="primary-btn"
            disabled={busy || disabled || note.trim().length < 10}
          >
            {busy ? "Saving…" : "Save decision"}
          </button>
          {error && <div role="alert">{error}</div>}
        </form>
      ) : (
        <p>
          <strong>Decision note:</strong> {report.moderationNote}
        </p>
      )}
    </article>
  );
}
